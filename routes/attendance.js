const express = require('express');
const router = express.Router();
const { Attendance, Employee } = require('../backend/config/db');
const { authMiddleware } = require('../backend/middleware/auth');

router.post("/", authMiddleware, async (req, res) => {
    try {
        const { employeeId, date, status, checkIn, checkOut, lateMinutes, overtimeHours, notes } = req.body;
        const month = date.substring(0, 7);
        const record = await Attendance.findOneAndUpdate(
            { employeeId, date },
            { employeeId, companyId: req.user.companyId, date, month, status, checkIn: checkIn || "", checkOut: checkOut || "", lateMinutes: lateMinutes || 0, overtimeHours: overtimeHours || 0, notes: notes || "" },
            { upsert: true, new: true }
        );
        res.json(record);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post("/bulk", authMiddleware, async (req, res) => {
    try {
        const { records } = req.body; 
        const ops = records.map(r => ({
            updateOne: {
                filter: { employeeId: r.employeeId, date: r.date },
                update: { ...r, companyId: req.user.companyId, month: r.date.substring(0, 7) },
                upsert: true
            }
        }));
        await Attendance.bulkWrite(ops);
        res.json({ success: true, count: records.length });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/webhook/biometric', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.BIOMETRIC_API_KEY) {
        return res.status(401).json({ error: "Invalid API key" });
    }
    try {
        const { nationalId, deviceId, timestamp, type } = req.body; 
        const employee = await Employee.findOne({ nationalId });
        if (!employee) return res.status(404).json({ error: "الموظف غير مسجل" });
        const date = new Date(timestamp).toISOString().split('T')[0];
        const time = new Date(timestamp).toISOString().split('T')[1].substring(0, 5);
        const month = date.substring(0, 7);
        let attendance = await Attendance.findOne({ employeeId: employee._id, date });
        if (!attendance) attendance = new Attendance({ employeeId: employee._id, companyId: employee.companyId, date, month });
        if (type === 'check-in') attendance.checkIn = time;
        if (type === 'check-out') attendance.checkOut = time;
        await attendance.save();
        res.json({ status: "success" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get(["/:employeeId/:month", "/"], authMiddleware, async (req, res) => {
    try {

        const employeeId = req.params.employeeId || req.query.employeeId;
        const month = req.params.month || req.query.month;
        const records = await Attendance.find({ employeeId, month }).sort({ date: 1 });
        res.json(records);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/company/:month", authMiddleware, async (req, res) => {
    try {
        const records = await Attendance.find({ companyId: req.user.companyId, month: req.params.month }).populate('employeeId', 'name department');
        res.json(records);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/stats/:employeeId/:month", authMiddleware, async (req, res) => {
    try {
        const records = await Attendance.find({ employeeId: req.params.employeeId, month: req.params.month });
        const stats = {
            present: records.filter(r => r.status === 'present').length,
            absent: records.filter(r => r.status === 'absent').length,
            late: records.filter(r => r.status === 'late').length,
            half: records.filter(r => r.status === 'half').length,
            totalLateMinutes: records.reduce((s, r) => s + r.lateMinutes, 0),
            totalOvertimeHours: records.reduce((s, r) => s + r.overtimeHours, 0),
            totalDays: records.filter(r => ['present', 'late'].includes(r.status)).length
        };
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

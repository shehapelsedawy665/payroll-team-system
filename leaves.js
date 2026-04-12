const express = require('express');
const router = express.Router();
const { connectDB, Leave, LeaveBalance, Employee, EWARequest } = require('../backend/config/db');
const { authMiddleware, adminOnly } = require('../backend/middleware/auth');

router.post("/", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { employeeId, type, startDate, endDate, days, reason } = req.body;
        const year = new Date(startDate).getFullYear();
        if (['annual', 'sick', 'emergency'].includes(type)) {
            let balance = await LeaveBalance.findOne({ employeeId, year });
            if (!balance) balance = await new LeaveBalance({ employeeId, companyId: req.user.companyId, year }).save();
            const usedKey = type + 'Used';
            const remaining = balance[type] - balance[usedKey];
            if (days > remaining) return res.status(400).json({ error: `رصيد الإجازة غير كافٍ. المتاح: ${remaining} يوم` });
        }
        const leave = await new Leave({ employeeId, companyId: req.user.companyId, type, startDate, endDate, days, reason, year }).save();
        res.status(201).json(leave);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get(["/:employeeId", "/employee"], authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const employeeId = req.params.employeeId || req.query.id;
        const year = req.query.year || new Date().getFullYear();
        const leaves = await Leave.find({ employeeId, year }).sort({ startDate: -1 });
        const balance = await LeaveBalance.findOne({ employeeId, year });
        res.json({ leaves, balance });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get(["/company/pending", "/pending"], authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const leaves = await Leave.find({ companyId: req.user.companyId, status: 'pending' }).populate('employeeId', 'name department').sort({ createdAt: -1 });
        res.json(leaves);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put(["/:id/approve", "/approve"], authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const id = req.params.id || req.query.id;
        const { status } = req.body; 
        const leave = await Leave.findByIdAndUpdate(id, { status, approvedBy: req.user.id }, { new: true });
        if (status === 'approved' && ['annual', 'sick', 'emergency'].includes(leave.type)) {
            const usedKey = leave.type + 'Used';
            await LeaveBalance.findOneAndUpdate({ employeeId: leave.employeeId, year: leave.year }, { $inc: { [usedKey]: leave.days } });
        }
        res.json(leave);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get("/balance/:employeeId", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const year = req.query.year || new Date().getFullYear();
        let balance = await LeaveBalance.findOne({ employeeId: req.params.employeeId, year });
        if (!balance) {
            const emp = await Employee.findById(req.params.employeeId);
            balance = await new LeaveBalance({ employeeId: req.params.employeeId, companyId: emp.companyId, year }).save();
        }
        res.json(balance);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

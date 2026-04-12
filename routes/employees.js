const express = require('express');
const router = express.Router();
const { connectDB, Employee, LeaveBalance, Payroll, Attendance, Leave } = require('../backend/config/db');
const { authMiddleware, adminOnly } = require('../backend/middleware/auth');

// 1. جلب كل الموظفين
router.get("/", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const employees = await Employee.find({ companyId: req.user.companyId }).sort({ _id: -1 });
        res.json(employees);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. إضافة موظف جديد
router.post("/", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const emp = await new Employee({
            ...req.body,
            companyId: req.user.companyId
        }).save();
        await new LeaveBalance({ employeeId: emp._id, companyId: emp.companyId, year: new Date().getFullYear() }).save();
        res.status(201).json(emp);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// 3. تفاصيل الموظف (البروفايل)
router.get("/details", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const id = req.query.id;
        const emp = await Employee.findById(id);
        const history = await Payroll.find({ employeeId: id }).sort({ month: 1 });
        const leaveBalance = await LeaveBalance.findOne({ employeeId: id, year: new Date().getFullYear() });
        res.json({ emp, history, leaveBalance });
    } catch (err) { res.status(404).json({ error: "Employee not found" }); }
});

// 4. تحديث بيانات موظف
router.put("/", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const emp = await Employee.findByIdAndUpdate(req.query.id, req.body, { new: true });
        res.json(emp);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// 5. حذف موظف
router.delete("/", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const id = req.query.id;
        await Employee.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

module.exports = router;

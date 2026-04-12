const express = require('express');
const router = express.Router();
const { connectDB, Company, Employee, Payroll, Leave } = require('../backend/config/db');
const { authMiddleware, adminOnly } = require('../backend/middleware/auth');

router.get("/", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const company = await Company.findById(req.user.companyId);
        res.json(company?.settings || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const company = await Company.findByIdAndUpdate(req.user.companyId, { settings: req.body }, { new: true });
        res.json({ success: true, settings: company.settings });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get("/analytics/dashboard", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const companyId = req.user.companyId;
        const currentMonth = new Date().toISOString().substring(0, 7);
        const [totalEmployees, activeEmployees, monthPayroll, pendingLeaves] = await Promise.all([
            Employee.countDocuments({ companyId }), Employee.countDocuments({ companyId, resignationDate: "" }),
            Payroll.find({ companyId, month: currentMonth }), Leave.countDocuments({ companyId, status: 'pending' })
        ]);
        const payrollTotals = monthPayroll.reduce((acc, r) => ({ gross: acc.gross + (r.payload.gross || 0), net: acc.net + (r.payload.net || 0), tax: acc.tax + (r.payload.monthlyTax || 0), ins: acc.ins + (r.payload.insuranceEmployee || 0) }), { gross: 0, net: 0, tax: 0, ins: 0 });
        const trend = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const m = d.toISOString().substring(0, 7);
            const records = await Payroll.find({ companyId, month: m });
            trend.push({ month: m, total: records.reduce((s, r) => s + (r.payload.net || 0), 0), count: records.length });
        }
        res.json({ totalEmployees, activeEmployees, currentMonth, payrollTotals, payrollCount: monthPayroll.length, pendingLeaves, trend });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

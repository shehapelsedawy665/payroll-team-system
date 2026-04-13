const express = require('express');
const router = express.Router();
const { Candidate, Employee, LeaveBalance, Loan, Settlement, Company, EWARequest } = require('../backend/config/db');
const { authMiddleware, adminOnly } = require('../backend/middleware/auth');

let calculations = require("../backend/logic/payrollEngine");
const { calculateSettlement } = calculations;
if (!calculateSettlement) {
    throw new Error("❌ CRITICAL: Settlement calculation function not loaded");
}

router.post('/candidates', authMiddleware, async (req, res) => {
    try {
        const candidate = new Candidate({ ...req.body, companyId: req.user.companyId });
        await candidate.save();
        res.status(201).json({ message: "تم إضافة المرشح بنجاح", candidate });
    } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/hire-candidate/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ error: "المرشح غير موجود" });
        const newEmployee = new Employee({ name: candidate.name, nationalId: req.body.nationalId, hiringDate: new Date(), basicSalary: req.body.basicSalary, insSalary: req.body.insSalary || 0, jobType: req.body.jobType || "Full Time", position: candidate.appliedPosition, phone: candidate.phone, companyId: req.user.companyId });
        await newEmployee.save();
        candidate.status = 'hired';
        await candidate.save();
        res.json({ message: "تم تحويل المرشح إلى موظف بنجاح", employee: newEmployee });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/settlement/:employeeId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.employeeId);
        const company = await Company.findById(req.user.companyId);
        const currentYear = new Date().getFullYear();
        const leaveBalance = await LeaveBalance.findOne({ employeeId: employee._id, year: currentYear });
        const remainingLeaves = leaveBalance ? (leaveBalance.annual - leaveBalance.annualUsed) : 0;
        const activeLoans = await Loan.find({ employeeId: employee._id, status: 'active' });
        const unsettledLoans = activeLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0);
        const settlementData = calculateSettlement(employee, remainingLeaves, 0, unsettledLoans, company.settings);
        const settlement = new Settlement({ employeeId: employee._id, companyId: req.user.companyId, resignationDate: new Date(), ...settlementData });
        await settlement.save();
        employee.resignationDate = new Date();
        await employee.save();
        res.json({ message: "تم إصدار كشف تصفية الحساب", settlement });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/ewa-request', authMiddleware, async (req, res) => {
    try {
        const { requestedAmount, walletNumber } = req.body;
        if (!req.user.employeeId) return res.status(403).json({ error: "هذه الخاصية للموظفين فقط" });
        const employee = await Employee.findById(req.user.employeeId);
        if (requestedAmount > (employee.basicSalary * 0.5)) return res.status(400).json({ error: "لا يمكن سحب أكثر من 50% من الراتب الأساسي مقدماً" });
        const ewa = new EWARequest({ employeeId: req.user.employeeId, companyId: req.user.companyId, requestedAmount, walletNumber, month: new Date().toISOString().substring(0, 7) });
        await ewa.save();
        res.status(201).json({ message: "تم إرسال طلب السلفة", ewa });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;

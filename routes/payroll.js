const express = require('express');
const router = express.Router();
const { connectDB, Employee, Payroll, Attendance, Penalty, Company } = require('../backend/config/db');
const { authMiddleware } = require('../backend/middleware/auth');

let calculations = {};
try { calculations = require("../backend/logic/payrollEngine"); } catch (e) {}
const { runPayrollLogic, calculateGrossToNet, analyzePayrollAnomaly, generateUnifiedTaxRow } = calculations;

router.post(["/calculate", "/"], authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const empId = req.body.empId || req.body.employeeId;
        const { month, days, fullBasic, fullTrans, additions, deductions, prevData, hiringDate, resignationDate } = req.body;
        const emp = await Employee.findById(empId);
        const MAX_INS = 16700, MIN_INS = 5384.62;
        const effectiveInsSalary = Math.min(MAX_INS, Math.max(MIN_INS, emp.insSalary || 0));
        const empForCalc = { ...emp.toObject(), insSalary: effectiveInsSalary };
        if (resignationDate) await Employee.findByIdAndUpdate(empId, { resignationDate });
        const result = runPayrollLogic({ fullBasic, fullTrans, days, additions, deductions, month, hiringDate, resignationDate }, prevData || { pDays: 0, pTaxable: 0, pTaxes: 0 }, empForCalc);
        const record = await Payroll.findOneAndUpdate({ employeeId: empId, month }, { employeeId: empId, companyId: req.user.companyId, month, payload: result, createdAt: new Date() }, { upsert: true, new: true });
        res.json({ success: true, data: { payload: result, record } });
    } catch (err) { res.status(500).json({ error: "Calculation error: " + err.message }); }
});

router.post("/net-to-gross", authMiddleware, async (req, res) => {
    try {
        const { targetNet } = req.body;
        let estimateGross = Number(targetNet);
        let finalResult = {};
        const MAX_INS = 16700, MIN_INS = 5384.62;
        for (let i = 0; i < 100; i++) {
            let cappedIns = Math.min(MAX_INS, Math.max(MIN_INS, estimateGross));
            finalResult = runPayrollLogic({ fullBasic: estimateGross, fullTrans: 0, days: 30, additions: [], deductions: [], month: new Date().toISOString().substring(0, 7), hiringDate: null, resignationDate: null }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: cappedIns });
            let diff = Number(targetNet) - finalResult.net;
            if (Math.abs(diff) < 0.01) break;
            estimateGross += diff;
        }
        res.json({ gross: Math.round(estimateGross * 100) / 100, insSalary: Math.min(MAX_INS, Math.max(MIN_INS, estimateGross)), insEmployee: finalResult.insuranceEmployee, taxes: finalResult.monthlyTax, net: finalResult.net });
    } catch (err) { res.status(500).json({ error: "Net to Gross failed" }); }
});

router.post('/run', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { month } = req.body; 
        const company = await Company.findById(req.user.companyId);
        const employees = await Employee.find({ companyId: req.user.companyId, resignationDate: null });
        const payrollResults = [];
        const startOfMonth = new Date(`${month}-01T00:00:00.000Z`);
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        for (const emp of employees) {
            const absentDays = await Attendance.countDocuments({ employeeId: emp._id, month, status: 'absent' });
            const penaltyDocs = await Penalty.find({ employeeId: emp._id, date: { $gte: startOfMonth, $lte: endOfMonth } });
            const penaltyDays = penaltyDocs.reduce((sum, p) => sum + p.deductionDays, 0);
            const payload = calculateGrossToNet({ basicSalary: emp.basicSalary || emp.insSalary, variableSalary: emp.variableSalary || 0, allowances: 0, insSalary: emp.insSalary, absentDays, penaltyDays, overtimeHours: 0, loanDeduction: 0, isTaxExempted: emp.isTaxExempted, companySettings: company.settings });
            const prevMonthDate = new Date(startOfMonth);
            prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
            const lastMonthString = prevMonthDate.toISOString().substring(0, 7);
            const previousPayroll = await Payroll.findOne({ employeeId: emp._id, month: lastMonthString });
            const anomalyData = analyzePayrollAnomaly(payload, previousPayroll ? previousPayroll.payload : null);
            const payrollRecord = await Payroll.findOneAndUpdate({ employeeId: emp._id, month }, { companyId: req.user.companyId, payload, netSalary: payload.netSalary, hasAnomaly: anomalyData.hasAnomaly, anomalyReason: anomalyData.warnings, status: 'draft' }, { upsert: true, new: true });
            payrollResults.push(payrollRecord);
        }
        res.json({ message: "تم إصدار الرواتب بنجاح", count: payrollResults.length, data: payrollResults });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/export-unified-tax/:month', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const payrolls = await Payroll.find({ companyId: req.user.companyId, month: req.params.month }).populate('employeeId');
        const exportData = payrolls.map(pr => generateUnifiedTaxRow(pr.employeeId, pr));
        res.json({ month: req.params.month, data: exportData });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get("/summary/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const records = await Payroll.find({ companyId: req.user.companyId, month: req.params.month }).populate('employeeId', 'name department');
        const totals = records.reduce((acc, r) => ({ gross: acc.gross + (r.payload.gross || 0), insurance: acc.insurance + (r.payload.insuranceEmployee || 0), tax: acc.tax + (r.payload.monthlyTax || 0), net: acc.net + (r.payload.net || 0), count: acc.count + 1 }), { gross: 0, insurance: 0, tax: 0, net: 0, count: 0 });
        res.json({ records, totals });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

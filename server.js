const express = require("express");
const cors    = require("cors");
const path    = require("path");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");

// 1. استيراد قاعدة البيانات وكل النماذج من ملف db.js المجمع
const {
    connectDB, Company, User, Employee, Payroll, Subscription,
    Attendance, Leave, LeaveBalance, Candidate, Shift, Loan,
    EWARequest, Settlement, Penalty
} = require('./backend/config/db');

// 2. استيراد دوال الحسابات
let calculations = {};
try {
    calculations = require("./backend/logic/payrollEngine"); 
} catch (e) {
    console.log("Calculations file not found yet, skipping...");
}

const { 
    runPayrollLogic, 
    calculateEgyptianTax,
    calculateGrossToNet,
    calculateNetToGross,
    generateUnifiedTaxRow,
    analyzePayrollAnomaly,
    calculateSettlement,
    EGY_CONSTANTS
} = calculations;

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET         = process.env.JWT_SECRET         || "payroll-pro-secret-2026-egypt";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "payroll-pro-refresh-2026-egypt";

// ==================== MIDDLEWARE ====================

const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "غير مصرح" });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: "الجلسة انتهت، سجل دخول مجدداً" });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "للمديرين فقط" });
    next();
};

// ==================== AUTH ====================

// ==================== AUTH ====================
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// سيب باقي المسارات زي (refresh و logout) موجودة زي ما هي تحت السطرين دول مؤقتاً
    try {
        await connectDB();
        const { email, password, role, companyName, companyPassword } = req.body;
        if (!email || !password) return res.status(400).json({ error: "البيانات ناقصة" });

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: "الإيميل مسجل بالفعل" });

        const hashedPass = await bcrypt.hash(password, 10);
        let companyId = null;

        if (role === 'admin' || companyName) {
            const hashedCompPass = await bcrypt.hash(companyPassword || password, 10);
            const company = await new Company({ name: companyName || "New Company", adminPassword: hashedCompPass }).save();
            companyId = company._id;
            // Create trial subscription
            await new Subscription({ companyId: company._id, plan: 'trial', status: 'active' }).save();
        }

        const user = await new User({ email, password: hashedPass, role: role || 'admin', companyId }).save();
        res.status(201).json({ success: true, message: "تم إنشاء الحساب بنجاح" });
    } catch (err) {
        res.status(400).json({ error: "فشل التسجيل: " + err.message });
    }
});

// ==================== AUTH ====================
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// سيب باقي المسارات زي (refresh و logout) موجودة زي ما هي تحت السطرين دول مؤقتاً
    try {
        await connectDB();
        const { email, password } = req.body;
        const user = await User.findOne({ email }).populate('companyId');
        if (!user) return res.status(401).json({ error: "بيانات غير صحيحة" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "بيانات غير صحيحة" });

        const payload = {
            id: user._id,
            email: user.email,
            role: user.role,
            companyId: user.companyId?._id || null,
            companyName: user.companyId?.name || "System",
            employeeId: user.employeeId || null 
        };

        const accessToken  = jwt.sign(payload, JWT_SECRET,         { expiresIn: "24h" });
        const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET,  { expiresIn: "7d" });

        await User.findByIdAndUpdate(user._id, { refreshToken });

        let sub = null;
        if (user.companyId) {
            sub = await Subscription.findOne({ companyId: user.companyId._id });
        }

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: payload,
            subscription: sub ? {
                plan: sub.plan,
                status: sub.status,
                endDate: sub.endDate,
                features: sub.features
            } : null
        });
    } catch (err) {
        res.status(500).json({ error: "Login failed: " + err.message });
    }
});

app.post("/api/auth/refresh", async (req, res) => {
    try {
        await connectDB();
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(401).json({ error: "No token" });
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id).populate('companyId');
        if (!user || user.refreshToken !== refreshToken) return res.status(401).json({ error: "Invalid token" });

        const payload = { id: user._id, email: user.email, role: user.role, companyId: user.companyId?._id, companyName: user.companyId?.name, employeeId: user.employeeId };
        const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
        res.json({ accessToken });
    } catch {
        res.status(401).json({ error: "Refresh failed" });
    }
});

app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    await connectDB();
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    res.json({ success: true });
});

app.post("/api/settings/dev-login", (req, res) => {
    const { password } = req.body;
    if (password === (process.env.DEV_PASSWORD || "CO.Sedawy.2026")) {
        const token = jwt.sign({ role: 'dev' }, JWT_SECRET, { expiresIn: "2h" });
        return res.json({ success: true, token });
    }
    res.status(401).json({ success: false, message: "Unauthorized" });
});

// ==================== SUBSCRIPTION ====================

app.get("/api/subscription", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const sub = await Subscription.findOne({ companyId: req.user.companyId });
        if (!sub) return res.status(404).json({ error: "No subscription" });
        res.json(sub);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/subscription/upgrade", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { plan, billingCycle } = req.body;
        const plans = {
            starter:    { maxEmployees: 25,  features: { attendance: true,  leaves: true,  pdfExport: true,  analytics: false, apiAccess: false } },
            growth:     { maxEmployees: 100, features: { attendance: true,  leaves: true,  pdfExport: true,  analytics: true,  apiAccess: false } },
            enterprise: { maxEmployees: 9999,features: { attendance: true,  leaves: true,  pdfExport: true,  analytics: true,  apiAccess: true  } }
        };
        const cycleMonths = { monthly: 1, halfyear: 6, yearly: 12 };
        const months = cycleMonths[billingCycle] || 1;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + months);

        const sub = await Subscription.findOneAndUpdate(
            { companyId: req.user.companyId },
            { plan, billingCycle, ...plans[plan], status: 'active', startDate: new Date(), endDate, paymentRef: `PAY-${Date.now()}` },
            { new: true, upsert: true }
        );
        res.json({ success: true, subscription: sub });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== HR & ATS (NEW) ====================

app.post('/api/hr/candidates', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const candidate = new Candidate({ ...req.body, companyId: req.user.companyId });
        await candidate.save();
        res.status(201).json({ message: "تم إضافة المرشح بنجاح", candidate });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/hr/hire-candidate/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ error: "المرشح غير موجود" });

        const newEmployee = new Employee({
            name: candidate.name,
            nationalId: req.body.nationalId, 
            hiringDate: new Date(),
            basicSalary: req.body.basicSalary,
            insSalary: req.body.insSalary || 0,
            jobType: req.body.jobType || "Full Time",
            position: candidate.appliedPosition,
            phone: candidate.phone,
            companyId: req.user.companyId
        });
        
        await newEmployee.save();
        candidate.status = 'hired';
        await candidate.save();

        res.json({ message: "تم تحويل المرشح إلى موظف بنجاح", employee: newEmployee });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/hr/settlement/:employeeId', authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const employee = await Employee.findById(req.params.employeeId);
        const company = await Company.findById(req.user.companyId);
        
        const currentYear = new Date().getFullYear();
        const leaveBalance = await LeaveBalance.findOne({ employeeId: employee._id, year: currentYear });
        const remainingLeaves = leaveBalance ? (leaveBalance.annual - leaveBalance.annualUsed) : 0;

        const unpaidSalaries = 0; 
        const activeLoans = await Loan.find({ employeeId: employee._id, status: 'active' });
        const unsettledLoans = activeLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0);

        const settlementData = calculateSettlement(employee, remainingLeaves, unpaidSalaries, unsettledLoans, company.settings);

        const settlement = new Settlement({
            employeeId: employee._id,
            companyId: req.user.companyId,
            resignationDate: new Date(),
            ...settlementData
        });

        await settlement.save();
        employee.resignationDate = new Date();
        await employee.save();

        res.json({ message: "تم إصدار كشف تصفية الحساب", settlement });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== EMPLOYEES ====================

app.post("/api/employees", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const emp = await new Employee({
            name: req.body.name, nationalId: req.body.nationalId,
            hiringDate: req.body.hiringDate, insSalary: Number(req.body.insSalary) || 0,
            basicSalary: Number(req.body.basicSalary) || 0, 
            jobType: req.body.jobType || "Full Time", resignationDate: req.body.resignationDate || "",
            department: req.body.department || "", position: req.body.position || "",
            phone: req.body.phone || "", companyId: req.body.companyId || req.user.companyId
        }).save();
        await new LeaveBalance({ employeeId: emp._id, companyId: emp.companyId, year: new Date().getFullYear() }).save();
        res.status(201).json(emp);
    } catch (err) {
        res.status(400).json({ error: "فشل الحفظ: " + err.message });
    }
});

app.get("/api/employees", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const filter = { companyId: req.user.companyId };
        const employees = await Employee.find(filter).sort({ _id: -1 });
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get(["/api/employees/:id/details", "/api/employees/details"], authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const id = req.params.id || req.query.id;
        const emp = await Employee.findById(id);
        const history = await Payroll.find({ employeeId: id }).sort({ month: 1 });
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => {
            pDays    += (Number(r.payload.days) || 0);
            pTaxable += (Number(r.payload.currentTaxable) || 0);
            pTaxes   += (Number(r.payload.monthlyTax) || 0);
        });
        const leaveBalance = await LeaveBalance.findOne({ employeeId: id, year: new Date().getFullYear() });
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes }, leaveBalance });
    } catch (err) {
        res.status(404).json({ error: "Employee not found" });
    }
});

// تم دعم الـ id من الـ query عشان الفرونت إند يشتغل
app.put(["/api/employees/:id", "/api/employees"], authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const id = req.params.id || req.query.id;
        const emp = await Employee.findByIdAndUpdate(id, req.body, { new: true });
        res.json(emp);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// تم دعم الـ id من الـ query
app.delete(["/api/employees/:id", "/api/employees"], authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const id = req.params.id || req.query.id;
        await Employee.findByIdAndDelete(id);
        await Payroll.deleteMany({ employeeId: id });
        await Attendance.deleteMany({ employeeId: id });
        await Leave.deleteMany({ employeeId: id });
        await LeaveBalance.deleteMany({ employeeId: id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// ==================== PAYROLL ====================

// تم دمج مسار /api/payroll مع /calculate ليعمل مع الفرونت إند الحالي
app.post(["/api/payroll/calculate", "/api/payroll"], authMiddleware, async (req, res) => {
    try {
        await connectDB();
        // دعم لـ empId أو employeeId
        const empId = req.body.empId || req.body.employeeId;
        const { month, days, fullBasic, fullTrans, additions, deductions, prevData, hiringDate, resignationDate } = req.body;
        
        const emp = await Employee.findById(empId);
        const MAX_INS = 16700, MIN_INS = 5384.62;
        const effectiveInsSalary = Math.min(MAX_INS, Math.max(MIN_INS, emp.insSalary || 0));
        const empForCalc = { ...emp.toObject(), insSalary: effectiveInsSalary };

        if (resignationDate) await Employee.findByIdAndUpdate(empId, { resignationDate });

        const result = runPayrollLogic(
            { fullBasic, fullTrans, days, additions, deductions, month, hiringDate, resignationDate },
            prevData || { pDays: 0, pTaxable: 0, pTaxes: 0 },
            empForCalc
        );

        const record = await Payroll.findOneAndUpdate(
            { employeeId: empId, month },
            { employeeId: empId, companyId: req.user.companyId, month, payload: result, createdAt: new Date() },
            { upsert: true, new: true }
        );
        
        // تعديل بسيط ليتوافق شكل الرد مع توقعات الفرونت إند
        res.json({ success: true, data: { payload: result, record } });
    } catch (err) {
        console.error("Calculation Error:", err);
        res.status(500).json({ error: "Calculation error: " + err.message });
    }
});

app.post("/api/payroll/net-to-gross", authMiddleware, async (req, res) => {
    try {
        const { targetNet } = req.body;
        let estimateGross = Number(targetNet);
        let finalResult = {};
        const MAX_INS = 16700, MIN_INS = 5384.62;
        for (let i = 0; i < 100; i++) {
            let cappedIns = Math.min(MAX_INS, Math.max(MIN_INS, estimateGross));
            finalResult = runPayrollLogic(
                { fullBasic: estimateGross, fullTrans: 0, days: 30, additions: [], deductions: [], month: new Date().toISOString().substring(0, 7), hiringDate: null, resignationDate: null },
                { pDays: 0, pTaxable: 0, pTaxes: 0 },
                { insSalary: cappedIns }
            );
            let diff = Number(targetNet) - finalResult.net;
            if (Math.abs(diff) < 0.01) break;
            estimateGross += diff;
        }
        res.json({
            gross: Math.round(estimateGross * 100) / 100,
            insSalary: Math.min(MAX_INS, Math.max(MIN_INS, estimateGross)),
            insEmployee: finalResult.insuranceEmployee,
            taxes: finalResult.monthlyTax,
            net: finalResult.net
        });
    } catch (err) {
        res.status(500).json({ error: "Net to Gross failed" });
    }
});

app.post('/api/payroll/run', authMiddleware, async (req, res) => {
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
            
            const penaltyDocs = await Penalty.find({ 
                employeeId: emp._id, 
                date: { $gte: startOfMonth, $lte: endOfMonth } 
            });
            const penaltyDays = penaltyDocs.reduce((sum, p) => sum + p.deductionDays, 0);
            
            const payload = calculateGrossToNet({
                basicSalary: emp.basicSalary || emp.insSalary,
                variableSalary: emp.variableSalary || 0,
                allowances: 0, 
                insSalary: emp.insSalary,
                absentDays,
                penaltyDays,
                overtimeHours: 0, 
                loanDeduction: 0, 
                isTaxExempted: emp.isTaxExempted,
                companySettings: company.settings
            });

            const prevMonthDate = new Date(startOfMonth);
            prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
            const lastMonthString = prevMonthDate.toISOString().substring(0, 7);
            const previousPayroll = await Payroll.findOne({ employeeId: emp._id, month: lastMonthString });
            
            const anomalyData = analyzePayrollAnomaly(payload, previousPayroll ? previousPayroll.payload : null);

            const payrollRecord = await Payroll.findOneAndUpdate(
                { employeeId: emp._id, month },
                { 
                    companyId: req.user.companyId, 
                    payload, 
                    netSalary: payload.netSalary,
                    hasAnomaly: anomalyData.hasAnomaly,
                    anomalyReason: anomalyData.warnings,
                    status: 'draft'
                },
                { upsert: true, new: true }
            );
            payrollResults.push(payrollRecord);
        }

        res.json({ message: "تم إصدار الرواتب بنجاح", count: payrollResults.length, data: payrollResults });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/payroll/export-unified-tax/:month', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const payrolls = await Payroll.find({ companyId: req.user.companyId, month: req.params.month }).populate('employeeId');
        const exportData = payrolls.map(pr => generateUnifiedTaxRow(pr.employeeId, pr));
        res.json({ month: req.params.month, data: exportData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/payroll/summary/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const records = await Payroll.find({ companyId: req.user.companyId, month: req.params.month })
            .populate('employeeId', 'name department');
        const totals = records.reduce((acc, r) => ({
            gross: acc.gross + (r.payload.gross || 0),
            insurance: acc.insurance + (r.payload.insuranceEmployee || 0),
            tax: acc.tax + (r.payload.monthlyTax || 0),
            net: acc.net + (r.payload.net || 0),
            count: acc.count + 1
        }), { gross: 0, insurance: 0, tax: 0, net: 0, count: 0 });
        res.json({ records, totals });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ATTENDANCE & WEBHOOKS ====================

app.post("/api/attendance", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { employeeId, date, status, checkIn, checkOut, lateMinutes, overtimeHours, notes } = req.body;
        const month = date.substring(0, 7);
        const record = await Attendance.findOneAndUpdate(
            { employeeId, date },
            { employeeId, companyId: req.user.companyId, date, month, status, checkIn: checkIn || "", checkOut: checkOut || "", lateMinutes: lateMinutes || 0, overtimeHours: overtimeHours || 0, notes: notes || "" },
            { upsert: true, new: true }
        );
        res.json(record);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post("/api/attendance/bulk", authMiddleware, async (req, res) => {
    try {
        await connectDB();
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
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/attendance/webhook/biometric', async (req, res) => {
    try {
        await connectDB();
        const { nationalId, deviceId, timestamp, type } = req.body; 
        const employee = await Employee.findOne({ nationalId });
        if (!employee) return res.status(404).json({ error: "الموظف غير مسجل" });

        const date = new Date(timestamp).toISOString().split('T')[0];
        const time = new Date(timestamp).toISOString().split('T')[1].substring(0, 5);
        const month = date.substring(0, 7);

        let attendance = await Attendance.findOne({ employeeId: employee._id, date });
        if (!attendance) {
            attendance = new Attendance({ employeeId: employee._id, companyId: employee.companyId, date, month });
        }

        if (type === 'check-in') attendance.checkIn = time;
        if (type === 'check-out') attendance.checkOut = time;
        
        await attendance.save();
        res.json({ status: "success" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تم دعم req.query لتعمل مع الفرونت إند
app.get(["/api/attendance/:employeeId/:month", "/api/attendance"], authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const employeeId = req.params.employeeId || req.query.employeeId;
        const month = req.params.month || req.query.month;
        const records = await Attendance.find({ employeeId, month }).sort({ date: 1 });
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/attendance/company/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const records = await Attendance.find({ companyId: req.user.companyId, month: req.params.month })
            .populate('employeeId', 'name department');
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/attendance/stats/:employeeId/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== LEAVES & EWA ====================

app.post("/api/leaves", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { employeeId, type, startDate, endDate, days, reason } = req.body;
        const year = new Date(startDate).getFullYear();

        if (['annual', 'sick', 'emergency'].includes(type)) {
            let balance = await LeaveBalance.findOne({ employeeId, year });
            if (!balance) balance = await new LeaveBalance({ employeeId, companyId: req.user.companyId, year }).save();
            const usedKey = type + 'Used';
            const totalKey = type;
            const remaining = balance[totalKey] - balance[usedKey];
            if (days > remaining) return res.status(400).json({ error: `رصيد الإجازة غير كافٍ. المتاح: ${remaining} يوم` });
        }

        const leave = await new Leave({ employeeId, companyId: req.user.companyId, type, startDate, endDate, days, reason, year }).save();
        res.status(201).json(leave);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/employee/ewa-request', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { requestedAmount, walletNumber } = req.body;
        if (!req.user.employeeId) return res.status(403).json({ error: "هذه الخاصية للموظفين فقط" });
        
        const employee = await Employee.findById(req.user.employeeId);
        if (requestedAmount > (employee.basicSalary * 0.5)) {
            return res.status(400).json({ error: "لا يمكن سحب أكثر من 50% من الراتب الأساسي مقدماً" });
        }

        const ewa = new EWARequest({
            employeeId: req.user.employeeId,
            companyId: req.user.companyId,
            requestedAmount,
            walletNumber,
            month: new Date().toISOString().substring(0, 7)
        });

        await ewa.save();
        res.status(201).json({ message: "تم إرسال طلب السلفة", ewa });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تم دعم req.query لتعمل مع الفرونت إند
app.get(["/api/leaves/:employeeId", "/api/leaves/employee"], authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const employeeId = req.params.employeeId || req.query.id;
        const year = req.query.year || new Date().getFullYear();
        const leaves = await Leave.find({ employeeId, year }).sort({ startDate: -1 });
        const balance = await LeaveBalance.findOne({ employeeId, year });
        res.json({ leaves, balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تم إضافة المسار البديل ليتوافق مع الفرونت إند
app.get(["/api/leaves/company/pending", "/api/leaves/pending"], authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const leaves = await Leave.find({ companyId: req.user.companyId, status: 'pending' })
            .populate('employeeId', 'name department').sort({ createdAt: -1 });
        res.json(leaves);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تم دعم req.query للـ ID
app.put(["/api/leaves/:id/approve", "/api/leaves/approve"], authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const id = req.params.id || req.query.id;
        const { status } = req.body; 
        const leave = await Leave.findByIdAndUpdate(id, { status, approvedBy: req.user.id }, { new: true });

        if (status === 'approved' && ['annual', 'sick', 'emergency'].includes(leave.type)) {
            const usedKey = leave.type + 'Used';
            await LeaveBalance.findOneAndUpdate(
                { employeeId: leave.employeeId, year: leave.year },
                { $inc: { [usedKey]: leave.days } }
            );
        }
        res.json(leave);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get("/api/leaves/balance/:employeeId", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const year = req.query.year || new Date().getFullYear();
        let balance = await LeaveBalance.findOne({ employeeId: req.params.employeeId, year });
        if (!balance) {
            const emp = await Employee.findById(req.params.employeeId);
            balance = await new LeaveBalance({ employeeId: req.params.employeeId, companyId: emp.companyId, year }).save();
        }
        res.json(balance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== SETTINGS ====================

app.get("/api/settings", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const company = await Company.findById(req.user.companyId);
        res.json(company?.settings || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/settings", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const company = await Company.findByIdAndUpdate(req.user.companyId, { settings: req.body }, { new: true });
        res.json({ success: true, settings: company.settings });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ==================== ANALYTICS ====================

app.get("/api/analytics/dashboard", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const companyId = req.user.companyId;
        const currentMonth = new Date().toISOString().substring(0, 7);
        const year = new Date().getFullYear();

        const [totalEmployees, activeEmployees, monthPayroll, pendingLeaves] = await Promise.all([
            Employee.countDocuments({ companyId }),
            Employee.countDocuments({ companyId, resignationDate: "" }),
            Payroll.find({ companyId, month: currentMonth }),
            Leave.countDocuments({ companyId, status: 'pending' })
        ]);

        const payrollTotals = monthPayroll.reduce((acc, r) => ({
            gross: acc.gross + (r.payload.gross || 0),
            net: acc.net + (r.payload.net || 0),
            tax: acc.tax + (r.payload.monthlyTax || 0),
            ins: acc.ins + (r.payload.insuranceEmployee || 0)
        }), { gross: 0, net: 0, tax: 0, ins: 0 });

        const trend = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const m = d.toISOString().substring(0, 7);
            const records = await Payroll.find({ companyId, month: m });
            trend.push({ month: m, total: records.reduce((s, r) => s + (r.payload.net || 0), 0), count: records.length });
        }

        res.json({ totalEmployees, activeEmployees, currentMonth, payrollTotals, payrollCount: monthPayroll.length, pendingLeaves, trend });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== STATIC ====================

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => res.sendFile(path.join(publicPath, "index.html")));

const startApp = async () => {
    try {
        await connectDB();
        console.log("Database Ready ✅");
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));
    } catch (err) {
        console.error("Critical: DB Connection Failed", err);
    }
};

startApp();

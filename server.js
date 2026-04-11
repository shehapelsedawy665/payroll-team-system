const express = require("express");
const cors    = require("cors");
const path    = require("path");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");

// استيراد النماذج من قاعدة البيانات المحدثة
const { 
    connectDB, Company, User, Employee, Candidate, Loan, Asset, 
    Penalty, Payroll, Subscription, Attendance, Leave, LeaveBalance 
} = require("./db");

// استيراد دوال الحسابات والذكاء الاصطناعي من calculations.js المحدث
const { 
    runPayrollLogic, runAIAuditor, calculateOffboarding, generateTaxExportCSV 
} = require("./calculations");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET         = process.env.JWT_SECRET         || "payroll-pro-secret-2026-egypt";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "payroll-pro-refresh-2026-egypt";

// ==================== MIDDLEWARE (دوال الحماية) ====================

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

// ==================== AUTH (المصادقة والتسجيل) ====================

app.post("/api/auth/signup", async (req, res) => {
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
            await new Subscription({ companyId: company._id, plan: 'enterprise', status: 'active' }).save();
        }

        const user = await new User({ email, password: hashedPass, role: role || 'admin', companyId }).save();
        res.status(201).json({ success: true, message: "تم إنشاء الحساب بنجاح" });
    } catch (err) {
        res.status(400).json({ error: "فشل التسجيل: " + err.message });
    }
});

app.post("/api/auth/login", async (req, res) => {
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
            companyName: user.companyId?.name || "System"
        };

        const accessToken  = jwt.sign(payload, JWT_SECRET,         { expiresIn: "24h" });
        const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET,  { expiresIn: "7d" });

        await User.findByIdAndUpdate(user._id, { refreshToken });

        let sub = null;
        if (user.companyId) {
            sub = await Subscription.findOne({ companyId: user.companyId._id });
        }

        res.json({
            success: true, accessToken, refreshToken,
            user: payload,
            subscription: sub ? { plan: sub.plan, status: sub.status } : null
        });
    } catch (err) {
        res.status(500).json({ error: "Login failed: " + err.message });
    }
});

app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    await connectDB();
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    res.json({ success: true });
});

// ==================== ATS (نظام تتبع المرشحين للتوظيف) ====================

app.post("/api/ats/candidates", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const candidate = await new Candidate({ ...req.body, companyId: req.user.companyId }).save();
        res.status(201).json(candidate);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get("/api/ats/candidates", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const candidates = await Candidate.find({ companyId: req.user.companyId }).sort({ createdAt: -1 });
        res.json(candidates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/ats/hire/:id", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const candidate = await Candidate.findByIdAndUpdate(req.params.id, { status: 'Hired' });
        if (!candidate) return res.status(404).json({ error: "Candidate not found" });

        const emp = await new Employee({
            name: candidate.name,
            phone: candidate.phone,
            nationalId: "يرجى التحديث",
            hiringDate: new Date().toISOString().split('T')[0],
            position: candidate.appliedPosition,
            companyId: req.user.companyId
        }).save();
        res.json({ success: true, employeeId: emp._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== EMPLOYEES (إدارة شؤون العاملين) ====================

app.post("/api/employees", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const emp = await new Employee({ ...req.body, companyId: req.user.companyId }).save();
        await new LeaveBalance({ employeeId: emp._id, companyId: emp.companyId, year: new Date().getFullYear() }).save();
        res.status(201).json(emp);
    } catch (err) {
        res.status(400).json({ error: "فشل الحفظ: " + err.message });
    }
});

app.get("/api/employees", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const employees = await Employee.find({ companyId: req.user.companyId }).sort({ _id: -1 });
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/employees/:id/details", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const emp = await Employee.findById(req.params.id);
        const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => {
            pDays    += (Number(r.payload.days) || 0);
            pTaxable += (Number(r.payload.currentTaxable) || 0);
            pTaxes   += (Number(r.payload.monthlyTax) || 0);
        });
        const leaveBalance = await LeaveBalance.findOne({ employeeId: req.params.id, year: new Date().getFullYear() });
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes }, leaveBalance });
    } catch (err) {
        res.status(404).json({ error: "Employee not found" });
    }
});

app.put("/api/employees/:id", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const emp = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(emp);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// تصفية الموظف بنقرة واحدة (One-Click Offboarding)
app.post("/api/employees/:id/offboard", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const emp = await Employee.findById(req.params.id);
        if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });

        const leaves = await LeaveBalance.findOne({ employeeId: emp._id, year: new Date().getFullYear() });
        const unpaidLoans = await Loan.find({ employeeId: emp._id, status: 'Active' });
        const unreturnedAssets = await Asset.find({ employeeId: emp._id, status: 'Possessed' });

        const settlement = calculateOffboarding(emp, leaves || { annual: 0, annualUsed: 0 }, unpaidLoans, unreturnedAssets);
        
        await Employee.findByIdAndUpdate(emp._id, { resignationDate: new Date().toISOString().split('T')[0] });
        res.json({ success: true, settlement });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== SETTINGS & COMPANY ====================

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

app.get("/api/subscription", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const sub = await Subscription.findOne({ companyId: req.user.companyId });
        res.json(sub);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------- نهاية الجزء الأول --------
// -------- بداية الجزء الثاني --------

// ==================== ESS & BLUE-COLLAR (الخدمة الذاتية المبسطة) ====================

app.post("/api/ess/request-leave", async (req, res) => {
    try {
        await connectDB();
        const { phone, type, days } = req.body;
        const emp = await Employee.findOne({ phone });
        if (!emp) return res.status(404).json({ error: "رقم الهاتف غير مسجل بالنظام" });
        
        const leave = await new Leave({ 
            employeeId: emp._id, 
            companyId: emp.companyId, 
            type, 
            days: Number(days), 
            status: 'pending',
            year: new Date().getFullYear()
        }).save();
        
        res.json({ success: true, message: "تم إرسال الطلب للمدير" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ASSETS & LOANS (السلف والعهد) ====================

app.post("/api/loans", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const loan = await new Loan({ ...req.body, companyId: req.user.companyId }).save();
        res.status(201).json(loan);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post("/api/assets", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const asset = await new Asset({ ...req.body, companyId: req.user.companyId }).save();
        res.status(201).json(asset);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ==================== SMART PENALTIES (الجزاءات الذكية) ====================

app.post("/api/penalties", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { employeeId, reason, date } = req.body;
        
        // التدرج الآلي: نحسب عدد المخالفات السابقة لنفس الموظف ولنفس السبب
        const prevPenalties = await Penalty.countDocuments({ employeeId, reason });
        let deductionDays = 0.25; // أول مرة ربع يوم
        if (prevPenalties === 1) deductionDays = 0.5; // ثاني مرة نصف يوم
        else if (prevPenalties >= 2) deductionDays = 1.0; // ثالث مرة أو أكثر يوم كامل

        const penalty = await new Penalty({ 
            employeeId, companyId: req.user.companyId, date, reason, deductionDays 
        }).save();
        
        res.status(201).json({ penalty, message: `تم تطبيق جزاء بخصم ${deductionDays} يوم حسب لائحة التدرج` });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ==================== ATTENDANCE & LEAVES (الحضور والإجازات) ====================

app.post("/api/attendance", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { employeeId, date } = req.body;
        const month = date.substring(0, 7);
        const record = await Attendance.findOneAndUpdate(
            { employeeId, date },
            { ...req.body, companyId: req.user.companyId, month },
            { upsert: true, new: true }
        );
        res.json(record);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get("/api/attendance/:employeeId/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const records = await Attendance.find({ employeeId: req.params.employeeId, month: req.params.month });
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/leaves/company/pending", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const leaves = await Leave.find({ companyId: req.user.companyId, status: 'pending' }).populate('employeeId');
        res.json(leaves);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== PAYROLL & AI AUDIT (مسير الرواتب) ====================

app.post("/api/payroll/calculate", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { empId, month, fullBasic, fullTrans, additions = [], deductions = [], days = 30 } = req.body;
        const emp = await Employee.findById(empId);
        if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });

        // 1. استدعاء السلف النشطة وخصمها أوتوماتيكياً
        const activeLoans = await Loan.find({ employeeId: empId, status: 'Active' });
        activeLoans.forEach(l => {
            deductions.push({ name: 'قسط سلفة', type: 'non-exempted', amount: l.monthlyDeduction });
            // هنا في بيئة الإنتاج نقوم بتحديث قيمة الـ paidAmount للسلفة
        });
        
        // 2. استدعاء الجزاءات الموقعة في هذا الشهر
        const monthPenalties = await Penalty.find({ employeeId: empId, date: { $regex: `^${month}` } });
        const dailyRate = fullBasic / 30;
        monthPenalties.forEach(p => {
            // R function from calculations.js will round it nicely
            deductions.push({ name: `جزاء: ${p.reason}`, type: 'non-exempted', amount: (p.deductionDays * dailyRate) });
        });

        // 3. جلب بيانات الشهور السابقة للتسويات الضريبية
        let prevData = { pDays: 0, pTaxable: 0, pTaxes: 0 };
        const prevHistory = await Payroll.find({ employeeId: empId, month: { $lt: month } }).sort({ month: -1 });
        if (prevHistory.length) {
            prevData = prevHistory.reduce((s, r) => ({ 
                pDays: s.pDays + (Number(r.payload.days) || 0), 
                pTaxable: s.pTaxable + (Number(r.payload.currentTaxable) || 0), 
                pTaxes: s.pTaxes + (Number(r.payload.monthlyTax) || 0) 
            }), prevData);
        }

        // 4. تنفيذ لوجيك المرتبات والضرائب (المستورد من calculations.js)
        const payrollInput = { fullBasic, fullTrans, days, additions, deductions, month, hiringDate: emp.hiringDate, resignationDate: emp.resignationDate };
        const payload = runPayrollLogic(payrollInput, prevData, emp);
        
        // 5. تمرير النتيجة لمدقق الذكاء الاصطناعي لاكتشاف أي شذوذ مالي
        const alerts = runAIAuditor(payload, prevHistory[0]?.payload || null);

        // 6. حفظ النتيجة
        const record = await Payroll.findOneAndUpdate(
            { employeeId: empId, month },
            { employeeId: empId, companyId: req.user.companyId, month, payload, aiAuditAlerts: alerts },
            { upsert: true, new: true }
        );
        
        res.json(record);
    } catch (err) {
        console.error("Calculation Error:", err);
        res.status(500).json({ error: "فشل الحساب: " + err.message });
    }
});

// ==================== TAX EXPORT (منظومة الضرائب المصرية) ====================

app.get("/api/payroll/tax-export/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const records = await Payroll.find({ companyId: req.user.companyId, month: req.params.month }).populate('employeeId');
        
        const csvData = generateTaxExportCSV(records);
        
        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment(`Tax_Export_${req.params.month}.csv`);
        
        // البايت \uFEFF (Byte Order Mark) ضروري جداً لكي يقرأ برنامج Excel الحروف العربية بشكل سليم دون تشفير
        res.send("\uFEFF" + csvData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== WEBHOOKS (البصمة والواتساب) ====================

app.post("/api/webhooks/biometric", async (req, res) => {
    // Endpoint تستقبل البيانات من أجهزة البصمة (مثل ZKTeco) مباشرة
    const { deviceId, employeeId, timestamp, type } = req.body;
    console.log(`[Biometric] Received ${type} for Emp ID: ${employeeId} at ${timestamp}`);
    res.json({ success: true, received: true });
});

app.post("/api/webhooks/whatsapp", async (req, res) => {
    // Endpoint تستقبل رسائل الواتساب (مثلاً لطلب إجازة سريعة للعمال)
    console.log(`[WhatsApp] Webhook received payload`);
    res.json({ success: true });
});

// ==================== STATIC & STARTUP ====================

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => res.sendFile(path.join(publicPath, "index.html")));

const startApp = async () => {
    try {
        await connectDB();
        console.log("Database Ready ✅");
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`🚀 ERP Server LIVE on port ${PORT}`));
    } catch (err) {
        console.error("Critical: DB Connection Failed", err);
    }
};

startApp();
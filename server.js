const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");            // ✅ NEW

const { connectDB, Company, User, Employee, Payroll, Subscription, Attendance, Leave, LeaveBalance } = require("./db");
const { runPayrollLogic } = require("./calculations");
const taxExport = require("./tax_export_route");             // ✅ NEW

// ✅ NEW: production guard — لازم تحط MONGODB_URI في Vercel env vars
if (!process.env.MONGODB_URI && process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI environment variable is required in production");
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));                    // ✅ NEW: body size limit

// ✅ NEW: rate limiting على auth endpoints
app.use("/api/auth/", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: "محاولات كثيرة، انتظر 15 دقيقة" }
}));

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
    if (req.user.role !== "admin") return res.status(403).json({ error: "للمديرين فقط" });
    next();
};

// ==================== AUTH ====================

app.post("/api/auth/signup", async (req, res) => {
    try {
        await connectDB();
        const { email, password, role, companyName, companyPassword } = req.body;
        if (!email || !password) return res.status(400).json({ error: "البيانات ناقصة" });

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: "الإيميل مسجل بالفعل" });

        const hashedPass = await bcrypt.hash(password, 10);
        let companyId = null;

        if (role === "admin" || companyName) {
            const hashedCompPass = await bcrypt.hash(companyPassword || password, 10);
            const company = await new Company({ name: companyName || "New Company", adminPassword: hashedCompPass }).save();
            companyId = company._id;
            await new Subscription({ companyId: company._id, plan: "trial", status: "active" }).save();
        }

        const user = await new User({ email, password: hashedPass, role: role || "admin", companyId }).save();
        res.status(201).json({ success: true, message: "تم إنشاء الحساب بنجاح" });
    } catch (err) {
        res.status(400).json({ error: "فشل التسجيل: " + err.message });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        await connectDB();
        const { email, password } = req.body;
        const user = await User.findOne({ email }).populate("companyId");
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
            success: true,
            accessToken,
            refreshToken,
            user: {
                email: user.email,
                role: user.role,
                companyId: user.companyId?._id || null,
                companyName: user.companyId?.name || "System"
            },
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
        const user = await User.findById(decoded.id).populate("companyId");
        if (!user || user.refreshToken !== refreshToken) return res.status(401).json({ error: "Invalid token" });

        const payload = { id: user._id, email: user.email, role: user.role, companyId: user.companyId?._id, companyName: user.companyId?.name };
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
        const token = jwt.sign({ role: "dev" }, JWT_SECRET, { expiresIn: "2h" });
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
            starter:    { maxEmployees: 25,   features: { attendance: true, leaves: true, pdfExport: true, analytics: false, apiAccess: false } },
            growth:     { maxEmployees: 100,  features: { attendance: true, leaves: true, pdfExport: true, analytics: true,  apiAccess: false } },
            enterprise: { maxEmployees: 9999, features: { attendance: true, leaves: true, pdfExport: true, analytics: true,  apiAccess: true  } }
        };
        const cycleMonths = { monthly: 1, halfyear: 6, yearly: 12 };
        const months = cycleMonths[billingCycle] || 1;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + months);

        const sub = await Subscription.findOneAndUpdate(
            { companyId: req.user.companyId },
            { plan, billingCycle, ...plans[plan], status: "active", startDate: new Date(), endDate, paymentRef: `PAY-${Date.now()}` },
            { new: true, upsert: true }
        );
        res.json({ success: true, subscription: sub });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== EMPLOYEES ====================

app.post("/api/employees", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const emp = await new Employee({
            name: req.body.name, nationalId: req.body.nationalId,
            hiringDate: req.body.hiringDate, insSalary: Number(req.body.insSalary) || 0,
            jobType: req.body.jobType || "Full Time", resignationDate: req.body.resignationDate || "",
            department: req.body.department || "", position: req.body.position || "",
            phone: req.body.phone || "",
            nationality: req.body.nationality || "مصري",
            insuranceNo: req.body.insuranceNo || "",
            passportNo:  req.body.passportNo  || "",
            companyId: req.body.companyId || req.user.companyId
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

app.delete("/api/employees/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        await Employee.findByIdAndDelete(req.params.id);
        await Payroll.deleteMany({ employeeId: req.params.id });
        await Attendance.deleteMany({ employeeId: req.params.id });
        await Leave.deleteMany({ employeeId: req.params.id });
        await LeaveBalance.deleteMany({ employeeId: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// ==================== PAYROLL ====================

app.post("/api/payroll/calculate", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { empId, month, days, fullBasic, fullTrans, additions, deductions, prevData, hiringDate, resignationDate } = req.body;

        // ✅ NEW: Month lock check
        const existingRecord = await Payroll.findOne({ employeeId: empId, month });
        if (existingRecord?.isLocked) {
            return res.status(423).json({ error: `شهر ${month} مقفول — استخدم إلغاء القفل أولاً` });
        }

        const emp = await Employee.findById(empId);
        const MAX_INS = 16700, MIN_INS = 5384.62;
        const effectiveInsSalary = Math.min(MAX_INS, Math.max(MIN_INS, emp.insSalary || 0));
        const empForCalc = { ...emp.toObject(), insSalary: effectiveInsSalary };

        if (resignationDate) await Employee.findByIdAndUpdate(empId, { resignationDate });

        const result = runPayrollLogic(
            { fullBasic, fullTrans, days, additions, deductions, month, hiringDate, resignationDate },
            prevData,
            empForCalc
        );

        const record = await Payroll.findOneAndUpdate(
            { employeeId: empId, month },
            { employeeId: empId, companyId: req.user.companyId, month, payload: result, createdAt: new Date() },
            { upsert: true, new: true }
        );
        res.json(record);
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

app.get("/api/payroll/summary/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const records = await Payroll.find({ companyId: req.user.companyId, month: req.params.month })
            .populate("employeeId", "name department");
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

// ✅ NEW: Lock a payroll month
app.post("/api/payroll/lock/:month", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const result = await Payroll.updateMany(
            { companyId: req.user.companyId, month: req.params.month },
            { isLocked: true, lockedAt: new Date(), lockedBy: req.user.id }
        );
        res.json({ success: true, locked: result.modifiedCount, month: req.params.month });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ NEW: Unlock a month
app.post("/api/payroll/unlock/:month", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        await Payroll.updateMany(
            { companyId: req.user.companyId, month: req.params.month },
            { $unset: { isLocked: 1, lockedAt: 1, lockedBy: 1 } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ NEW: Check lock status
app.get("/api/payroll/lock-status/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const locked = await Payroll.countDocuments({ companyId: req.user.companyId, month: req.params.month, isLocked: true });
        const total  = await Payroll.countDocuments({ companyId: req.user.companyId, month: req.params.month });
        res.json({ month: req.params.month, isLocked: locked > 0, lockedCount: locked, totalCount: total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ NEW: Bulk calculate all employees for a month
app.post("/api/payroll/bulk-calculate", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { month, defaultBasic, defaultTrans } = req.body;
        if (!month) return res.status(400).json({ error: "month مطلوب" });

        const employees = await Employee.find({ companyId: req.user.companyId, resignationDate: "" });
        const results = { success: [], failed: [], skipped: [] };

        for (const emp of employees) {
            const existing = await Payroll.findOne({ employeeId: emp._id, month });
            if (existing?.isLocked) { results.skipped.push(emp.name); continue; }

            const history = await Payroll.find({ employeeId: emp._id, month: { $lt: month } }).sort({ month: 1 });
            const pDays    = history.reduce((s, r) => s + (r.payload?.days || 0), 0);
            const pTaxable = history.reduce((s, r) => s + (r.payload?.currentTaxable || 0), 0);
            const pTaxes   = history.reduce((s, r) => s + (r.payload?.monthlyTax || 0), 0);

            try {
                const MAX_INS = 16700, MIN_INS = 5384.62;
                const effectiveIns = Math.min(MAX_INS, Math.max(MIN_INS, emp.insSalary || 0));
                const result = runPayrollLogic(
                    { fullBasic: defaultBasic || 5000, fullTrans: defaultTrans || 1000,
                      days: 30, additions: [], deductions: [], month,
                      hiringDate: emp.hiringDate, resignationDate: emp.resignationDate },
                    { pDays, pTaxable, pTaxes },
                    { ...emp.toObject(), insSalary: effectiveIns }
                );
                await Payroll.findOneAndUpdate(
                    { employeeId: emp._id, month },
                    { employeeId: emp._id, companyId: req.user.companyId, month, payload: result },
                    { upsert: true }
                );
                results.success.push(emp.name);
            } catch (e) {
                results.failed.push({ name: emp.name, error: e.message });
            }
        }
        res.json({ success: true, month, ...results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ATTENDANCE ====================

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

app.get("/api/attendance/:employeeId/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const records = await Attendance.find({ employeeId: req.params.employeeId, month: req.params.month }).sort({ date: 1 });
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/attendance/company/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const records = await Attendance.find({ companyId: req.user.companyId, month: req.params.month })
            .populate("employeeId", "name department");
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
            present: records.filter(r => r.status === "present").length,
            absent:  records.filter(r => r.status === "absent").length,
            late:    records.filter(r => r.status === "late").length,
            half:    records.filter(r => r.status === "half").length,
            totalLateMinutes:  records.reduce((s, r) => s + r.lateMinutes, 0),
            totalOvertimeHours: records.reduce((s, r) => s + r.overtimeHours, 0),
            totalDays: records.filter(r => ["present", "late"].includes(r.status)).length
        };
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== LEAVES ====================

app.post("/api/leaves", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { employeeId, type, startDate, endDate, days, reason } = req.body;
        const year = new Date(startDate).getFullYear();

        if (["annual", "sick", "emergency"].includes(type)) {
            let balance = await LeaveBalance.findOne({ employeeId, year });
            if (!balance) balance = await new LeaveBalance({ employeeId, companyId: req.user.companyId, year }).save();
            const usedKey = type + "Used";
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

app.get("/api/leaves/:employeeId", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const year = req.query.year || new Date().getFullYear();
        const leaves = await Leave.find({ employeeId: req.params.employeeId, year }).sort({ startDate: -1 });
        const balance = await LeaveBalance.findOne({ employeeId: req.params.employeeId, year });
        res.json({ leaves, balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/leaves/company/pending", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const leaves = await Leave.find({ companyId: req.user.companyId, status: "pending" })
            .populate("employeeId", "name department").sort({ createdAt: -1 });
        res.json(leaves);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/leaves/:id/approve", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { status } = req.body;
        const leave = await Leave.findByIdAndUpdate(req.params.id, { status, approvedBy: req.user.id }, { new: true });

        if (status === "approved" && ["annual", "sick", "emergency"].includes(leave.type)) {
            const usedKey = leave.type + "Used";
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

        const [totalEmployees, activeEmployees, monthPayroll, pendingLeaves] = await Promise.all([
            Employee.countDocuments({ companyId }),
            Employee.countDocuments({ companyId, resignationDate: "" }),
            Payroll.find({ companyId, month: currentMonth }),
            Leave.countDocuments({ companyId, status: "pending" })
        ]);

        const payrollTotals = monthPayroll.reduce((acc, r) => ({
            gross: acc.gross + (r.payload.gross || 0),
            net:   acc.net   + (r.payload.net || 0),
            tax:   acc.tax   + (r.payload.monthlyTax || 0),
            ins:   acc.ins   + (r.payload.insuranceEmployee || 0)
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

// ==================== TAX EXPORT ✅ NEW ====================

app.use("/api/export", authMiddleware, adminOnly, taxExport);

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

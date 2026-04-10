// ============================================================
// ADDITIONS TO server.js — Copy-paste these sections
// ============================================================

// 1. TOP OF FILE — after requires:
// ─────────────────────────────────────────────────────────────
if (!process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
    throw new Error("MONGODB_URI environment variable is required in production");
}

const rateLimit = require('express-rate-limit');
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'محاولات كثيرة، انتظر 15 دقيقة' } }));
app.use(express.json({ limit: '2mb' }));

// ─────────────────────────────────────────────────────────────
// 2. MONTH LOCK ENDPOINTS — Add after payroll routes:
// ─────────────────────────────────────────────────────────────

// Lock a payroll month
app.post("/api/payroll/lock/:month", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const result = await Payroll.updateMany(
            { companyId: req.user.companyId, month: req.params.month },
            { isLocked: true, lockedAt: new Date(), lockedBy: req.user.id }
        );
        res.json({ success: true, locked: result.modifiedCount, month: req.params.month });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Unlock a month (emergency use)
app.post("/api/payroll/unlock/:month", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        await Payroll.updateMany(
            { companyId: req.user.companyId, month: req.params.month },
            { $unset: { isLocked: 1, lockedAt: 1, lockedBy: 1 } }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Check locked status
app.get("/api/payroll/lock-status/:month", authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const locked = await Payroll.countDocuments({ companyId: req.user.companyId, month: req.params.month, isLocked: true });
        const total  = await Payroll.countDocuments({ companyId: req.user.companyId, month: req.params.month });
        res.json({ month: req.params.month, isLocked: locked > 0, lockedCount: locked, totalCount: total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk calculate all employees for a month
app.post("/api/payroll/bulk-calculate", authMiddleware, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { month, defaultBasic, defaultTrans } = req.body;
        if (!month) return res.status(400).json({ error: "month مطلوب" });

        const employees = await Employee.find({ companyId: req.user.companyId, resignationDate: "" });
        const results = { success: [], failed: [], skipped: [] };

        for (const emp of employees) {
            // Check if already locked
            const existing = await Payroll.findOne({ employeeId: emp._id, month });
            if (existing?.isLocked) { results.skipped.push(emp.name); continue; }

            // Get previous payroll data for YTD
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
            } catch (e) { results.failed.push({ name: emp.name, error: e.message }); }
        }
        res.json({ success: true, month, ...results });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Tax Portal Export (add require at top: const taxExport = require('./tax_export_route'))
// app.use('/api/export', authMiddleware, adminOnly, taxExport);

// ─────────────────────────────────────────────────────────────
// 3. PAYROLL CALCULATE — Add this check inside the existing route:
// ─────────────────────────────────────────────────────────────
// const existing = await Payroll.findOne({ employeeId: empId, month });
// if (existing?.isLocked) return res.status(423).json({ error: `شهر ${month} مقفول — استخدم إلغاء القفل أولاً` });


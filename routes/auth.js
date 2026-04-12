const express = require('express');
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { connectDB, User, Company, Subscription } = require('../backend/config/db');

// مسار التسجيل (/api/auth/signup)
router.post('/signup', async (req, res) => {
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
            await new Subscription({ companyId: company._id, plan: 'trial', status: 'active' }).save();
        }

        const user = await new User({ email, password: hashedPass, role: role || 'admin', companyId }).save();
        res.status(201).json({ success: true, message: "تم إنشاء الحساب بنجاح" });
    } catch (err) {
        res.status(400).json({ error: "فشل التسجيل: " + err.message });
    }
});

// مسار الدخول (/api/auth/login)
router.post('/login', async (req, res) => {
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
        
        if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
            return res.status(500).json({ error: "❌ JWT secrets not configured on server" });
        }
        
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

module.exports = router;

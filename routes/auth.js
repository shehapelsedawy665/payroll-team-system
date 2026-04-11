const express = require('express');
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { connectDB, User, Company, Subscription } = require('../backend/config/db');

const JWT_SECRET = process.env.JWT_SECRET || "payroll-pro-secret-2026-egypt";

// مسار التسجيل (/api/auth/signup)
router.post('/signup', async (req, res) => {
    try {
        await connectDB();
        const { email, password, companyName } = req.body;
        const hashedPass = await bcrypt.hash(password, 10);
        
        const company = await new Company({ name: companyName || "New Company", adminPassword: hashedPass }).save();
        await new User({ email, password: hashedPass, role: 'admin', companyId: company._id }).save();
        await new Subscription({ companyId: company._id, plan: 'trial', status: 'active' }).save();
        
        res.status(201).json({ success: true, message: "تم الإنشاء" });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// مسار الدخول (/api/auth/login)
router.post('/login', async (req, res) => {
    try {
        await connectDB();
        const { email, password } = req.body;
        const user = await User.findOne({ email }).populate('companyId');
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "بيانات غير صحيحة" });

        const payload = { id: user._id, email: user.email, role: user.role, companyId: user.companyId?._id, companyName: user.companyId?.name };
        const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
        
        res.json({ success: true, accessToken, user: payload });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

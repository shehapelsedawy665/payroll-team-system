const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// عشان نربط اليوزر بشركة لما نأسس السيستم
const mongoose = require('mongoose');
const companySchema = new mongoose.Schema({ name: String, isActive: Boolean });
const Company = mongoose.models.Company || mongoose.model('Company', companySchema);

/**
 * مسار تأسيس السيستم (بنفتحه مرة واحدة بس من المتصفح عشان يكريت أول حساب)
 * المسار: GET /api/auth/setup
 */
router.get('/setup', async (req, res) => {
    try {
        const existingUser = await User.findOne({ email: 'admin@hr.com' });
        if (existingUser) return res.send('تم تأسيس النظام مسبقاً. يمكنك تسجيل الدخول.');

        // 1. إنشاء شركة جديدة
        const newCompany = await Company.create({ name: 'الشركة الرئيسية', isActive: true });

        // 2. إنشاء باسورد مشفر
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        // 3. إنشاء حساب الأدمن وربطه بالشركة
        await User.create({
            email: 'admin@hr.com',
            password: hashedPassword,
            role: 'SuperAdmin',
            companyId: newCompany._id
        });

        res.send('تم تأسيس السيستم بنجاح! الإيميل: admin@hr.com | الباسورد: 123456');
    } catch (error) {
        res.status(500).send('خطأ في التأسيس: ' + error.message);
    }
});

/**
 * تسجيل الدخول الحقيقي
 * المسار: POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ success: false, message: "الإيميل أو كلمة المرور غير صحيحة" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: "الإيميل أو كلمة المرور غير صحيحة" });

        const payload = {
            userId: user._id,
            role: user.role,
            companyId: user.companyId || null,
            employeeId: user.employeeId || null
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '1d' });

        res.status(200).json({ success: true, token, data: { id: user._id, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في السيرفر", error: error.message });
    }
});

module.exports = router;

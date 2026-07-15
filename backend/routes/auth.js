const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs'); // مكتبة تشفير الباسوردات
const jwt = require('jsonwebtoken'); // مكتبة إصدار تصاريح الدخول (Tokens)

/**
 * 1. تسجيل الدخول (Login) لكل المستخدمين
 * المسار: POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. نتأكد إن الإيميل موجود في الداتابيز
        const user = await User.findOne({ email }).populate('companyId', 'name isActive');
        if (!user) {
            return res.status(401).json({ success: false, message: "الإيميل أو كلمة المرور غير صحيحة" });
        }

        // 2. لو اليوزر تبع شركة، نتأكد إن اشتراك الشركة لسه شغال
        if (user.role !== 'SuperAdmin' && user.companyId && !user.companyId.isActive) {
            return res.status(403).json({ success: false, message: "اشتراك الشركة غير فعال حالياً، يرجى التواصل مع الإدارة" });
        }

        // 3. نقارن الباسورد اللي دخل بالباسورد المتشفر في الداتابيز
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "الإيميل أو كلمة المرور غير صحيحة" });
        }

        // 4. نعمل تصريح الدخول (Token) اللي هيتحرك بيه في السيستم
        const payload = {
            userId: user._id,
            role: user.role,
            companyId: user.companyId ? user.companyId._id : null,
            employeeId: user.employeeId ? user.employeeId : null
        };

        // الـ Token ده بيعيش لمدة يوم واحد (24 ساعة)
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '1d' });

        res.status(200).json({
            success: true,
            message: "تم تسجيل الدخول بنجاح",
            token,
            data: {
                id: user._id,
                email: user.email,
                role: user.role,
                company: user.companyId ? user.companyId.name : 'System Admin'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في السيرفر", error: error.message });
    }
});

/**
 * 2. إنشاء مستخدم جديد (SuperAdmin بيعمل HR، أو HR بيعمل موظف)
 * المسار: POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, role, companyId, employeeId } = req.body;

        // نتأكد إن الإيميل مش متسجل قبل كده
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "الإيميل ده متسجل قبل كده" });
        }

        // تشفير الباسورد قبل ما يتحفظ في الداتابيز
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            email,
            password: hashedPassword,
            role: role || 'Employee',
            companyId,
            employeeId
        });

        await newUser.save();

        res.status(201).json({
            success: true,
            message: "تم إنشاء حساب المستخدم بنجاح"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ أثناء إنشاء الحساب", error: error.message });
    }
});

module.exports = router;

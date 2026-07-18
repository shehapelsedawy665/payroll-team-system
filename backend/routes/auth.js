const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({ name: String, isActive: Boolean });
const Company = mongoose.models.Company || mongoose.model('Company', companySchema);

/**
 * مسار تأسيس السيستم (مع كاشف الأعطال)
 */
router.get('/setup', async (req, res) => {
    try {
        // 1. فحص هل Vercel شايف لينك الداتابيز أصلاً ولا لأ؟
        if (!process.env.MONGO_URI) {
            return res.send(`
                <h2 style="color: red;">❌ السيرفر مش لاقي المتغير MONGO_URI</h2>
                <p>تأكد إنك ضفت اللينك في Environment Variables جوه Vercel وعملت Redeploy.</p>
            `);
        }

        // 2. إجبار الاتصال بقاعدة البيانات واصطياد أي خطأ
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        }

        const existingUser = await User.findOne({ email: 'admin@hr.com' });
        if (existingUser) return res.send('<h2>تم تأسيس النظام مسبقاً. يمكنك تسجيل الدخول.</h2>');

        // 3. التأسيس
        const newCompany = await Company.create({ name: 'الشركة الرئيسية', isActive: true });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        await User.create({
            email: 'admin@hr.com',
            password: hashedPassword,
            role: 'SuperAdmin',
            companyId: newCompany._id
        });

        res.send('<h2 style="color: green;">✅ تم تأسيس السيستم بنجاح! الإيميل: admin@hr.com | الباسورد: 123456</h2>');
    } catch (error) {
        // 4. هنا هيظهرلك العطل الحقيقي من MongoDB على الشاشة
        res.send(`
            <h2 style="color: darkred;">❌ ظهر خطأ حقيقي من قاعدة البيانات:</h2>
            <p style="background: #f8d7da; padding: 10px; border: 1px solid red;">${error.message}</p>
        `);
    }
});

/**
 * تسجيل الدخول
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI);
        }

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
         // ضفنا الـ companyId عشان الـ Frontend يقدر يستخدمه وهو بيسجل الموظفين
        res.status(200).json({ 
            success: true, 
            token, 
            data: { 
                id: user._id, 
                email: user.email, 
                role: user.role,
                companyId: user.companyId 
            } 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في السيرفر", error: error.message });
    }
});

module.exports = router;

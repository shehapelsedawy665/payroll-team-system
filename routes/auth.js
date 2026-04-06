const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // مكتبة التشفير الأساسية
const jwt = require('jsonwebtoken');
const Company = require('../models/company');
const connectDB = require('../db'); 

/**
 * تسجيل شركة جديدة - Seday ERP 2026
 * تم إضافة تشفير كلمة المرور (Bcrypt) وتحسين استقرار الـ Serverless
 */
router.post('/register', async (req, res) => {
    try {
        await connectDB(); // التأكد من الاتصال بالقاعدة

        const { name, adminEmail, email, password } = req.body;

        // 1. التحقق من اكتمال البيانات
        if (!name || !adminEmail || !email || !password) {
            return res.status(400).json({ error: 'برجاء ملء جميع البيانات المطلوبة' });
        }

        // 2. التحقق من وجود الشركة مسبقاً (إجراء احترازي إضافي)
        const existingCompany = await Company.findOne({ email: email.toLowerCase() });
        if (existingCompany) {
            return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
        }

        // 3. تشفير كلمة المرور قبل الحفظ
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const company = new Company({
            name,
            adminEmail: adminEmail.toLowerCase(),
            email: email.toLowerCase(),
            password: hashedPassword // حفظ الباسورد المشفر فقط
        });

        await company.save();
        res.status(201).json({ message: 'تم تسجيل الشركة بنجاح' });

    } catch (error) {
        console.error("Registration Error:", error.message);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'بيانات مكررة: البريد الإلكتروني موجود بالفعل' });
        }
        res.status(500).json({ error: 'فشل في عملية التسجيل، حاول مرة أخرى' });
    }
});

/**
 * تسجيل الدخول (Login)
 * التحقق من الباسورد المشفر وإصدار Token مؤمن
 */
router.post('/login', async (req, res) => {
    try {
        await connectDB();

        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
        }

        // البحث عن الشركة بالإيميل (Case-insensitive)
        const company = await Company.findOne({ email: email.toLowerCase() });

        if (!company) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        // 4. مقارنة الباسورد المبعوث مع المشفر في القاعدة
        const isMatch = await bcrypt.compare(password, company.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        // استخدام المفتاح السري من البيئة المحيطة (إلزامي للـ Production)
        const JWT_SECRET = process.env.JWT_SECRET || 'seday_erp_secret_key_2026';

        // إنشاء Token يحتوي على ID الشركة لتعريف العمليات القادمة
        const token = jwt.sign(
            { companyId: company._id, email: company.email }, 
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            success: true,
            token, 
            companyName: company.name,
            companyId: company._id 
        });

    } catch (error) {
        console.error("Login Error:", error.message);
        res.status(500).json({ error: 'حدث خطأ في السيرفر أثناء تسجيل الدخول' });
    }
});

module.exports = router;

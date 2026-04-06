const express = require('express');
const router = express.Router();
const Company = require('../models/company');
const jwt = require('jsonwebtoken');
const connectDB = require('../db'); // استدعاء ملف الاتصال لضمان الاستقرار على Vercel

/**
 * تسجيل شركة جديدة - Seday ERP
 * تم تحسينه ليعمل بسلاسة مع Vercel Serverless Functions
 */
router.post('/register', async (req, res) => {
    try {
        // التأكد من الاتصال بقاعدة البيانات قبل البدء
        await connectDB();

        const { name, adminEmail, email, password } = req.body;

        // التحقق من وجود البيانات الأساسية لمنع الـ 400 Error العشوائي
        if (!name || !adminEmail || !email || !password) {
            return res.status(400).json({ error: 'برجاء ملء جميع البيانات المطلوبة' });
        }
        
        const company = new Company({
            name,
            adminEmail,
            email,
            password // ملاحظة: يفضل مستقبلاً استخدام bcrypt.hash
        });

        await company.save();
        res.status(201).json({ message: 'تم تسجيل الشركة بنجاح' });
    } catch (error) {
        console.error("Registration Error:", error.message);
        // التحقق لو الإيميل موجود فعلاً (Mongo Error Code 11000)
        if (error.code === 11000) {
            return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
        }
        res.status(400).json({ error: 'فشل في عملية التسجيل، تأكد من البيانات' });
    }
});

/**
 * تسجيل الدخول (Login)
 */
router.post('/login', async (req, res) => {
    try {
        // التأكد من الاتصال بقاعدة البيانات
        await connectDB();

        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
        }

        const company = await Company.findOne({ email });

        if (!company || company.password !== password) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        // استخدام المفتاح السري من البيئة المحيطة أو مفتاح افتراضي للأمان
        const JWT_SECRET = process.env.JWT_SECRET || 'seday_erp_secret_key_2026';

        // إنشاء Token يحتوي على ID الشركة
        const token = jwt.sign(
            { companyId: company._id }, 
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
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

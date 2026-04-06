const express = require('express');
const router = express.Router();
const Company = require('../models/company');
const jwt = require('jsonwebtoken');
// ملحوظة: يفضل تستخدم bcrypt لتشفير الباسورد
// const bcrypt = require('bcryptjs'); 

// 1. تسجيل شركة جديدة
router.post('/register', async (req, res) => {
    try {
        const { name, adminEmail, email, password } = req.body;
        
        const company = new Company({
            name,
            adminEmail,
            email,
            password // في مشروع حقيقي لازم تعمل hash للباسورد هنا
        });

        await company.save();
        res.status(201).json({ message: 'تم تسجيل الشركة بنجاح' });
    } catch (error) {
        res.status(400).json({ error: 'الإيميل مسجل مسبقاً أو بيانات ناقصة' });
    }
});

// 2. تسجيل الدخول (Login)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const company = await Company.findOne({ email });

        if (!company || company.password !== password) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        // إنشاء Token يحتوي على ID الشركة
        const token = jwt.sign(
            { companyId: company._id }, 
            'YOUR_SECRET_KEY', // يفضل وضعها في .env
            { expiresIn: '24h' }
        );

        res.json({ token, companyName: company.name });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في السيرفر' });
    }
});

module.exports = router;

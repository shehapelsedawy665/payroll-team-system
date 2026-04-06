const express = require('express');
const router = express.Router();
const Department = require('../models/department');
const auth = require('../middleware/auth'); // الميدل وير اللي بيجيب الـ companyId

// 1. إضافة قسم جديد
router.post('/add', auth, async (req, res) => {
    try {
        const { name, code, description } = req.body;
        
        const newDept = new Department({
            name,
            code,
            description,
            companyId: req.user.companyId // ربط القسم بالشركة أوتوماتيكياً
        });

        await newDept.save();
        res.status(201).json({ message: 'تم إضافة القسم بنجاح', department: newDept });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في إضافة القسم' });
    }
});

// 2. جلب كل أقسام الشركة فقط
router.get('/all', auth, async (req, res) => {
    try {
        const depts = await Department.find({ companyId: req.user.companyId });
        res.json(depts);
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب الأقسام' });
    }
});

module.exports = router;

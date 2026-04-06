const express = require('express');
const router = express.Router();
const Employee = require('../models/employee');
const auth = require('../middleware/auth');

// 1. إضافة موظف جديد (Create)
router.post('/add', auth, async (req, res) => {
    try {
        const { 
            name, nationalId, email, phone, 
            department, jobTitle, reportingTo, 
            hireDate, basicSalary, allowances 
        } = req.body;

        const newEmployee = new Employee({
            name,
            nationalId,
            email,
            phone,
            companyId: req.user.companyId, // تأمين البيانات للشركة الحالية
            department,
            jobTitle,
            reportingTo: reportingTo || null, // المدير المباشر للـ Org Chart
            hireDate,
            salaryDetails: {
                basicSalary,
                allowances
            }
        });

        await newEmployee.save();
        res.status(201).json({ message: 'تم تسجيل الموظف بنجاح', employee: newEmployee });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: 'رقم البطاقة مسجل مسبقاً' });
        res.status(500).json({ error: 'خطأ في حفظ بيانات الموظف' });
    }
});

// 2. جلب موظفين الشركة (Read) مع بيانات القسم والمدير
router.get('/all', auth, async (req, res) => {
    try {
        const employees = await Employee.find({ companyId: req.user.companyId })
            .populate('department', 'name') // بيجيب اسم القسم بدل الـ ID
            .populate('reportingTo', 'name'); // بيجيب اسم المدير للـ Org Chart
        res.json(employees);
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب البيانات' });
    }
});

// 3. حذف موظف
router.delete('/:id', auth, async (req, res) => {
    try {
        await Employee.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
        res.json({ message: 'تم حذف الموظف بنجاح' });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في عملية الحذف' });
    }
});

module.exports = router;

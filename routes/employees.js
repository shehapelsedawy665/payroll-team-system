const express = require('express');
const router = express.Router();
const Employee = require('../models/employee');
const auth = require('../middleware/auth');
const connectDB = require('../db');

/**
 * 1. إضافة موظف جديد (Create)
 * تم التعديل ليتوافق مع هيكل الرواتب المطور (additions/deductions)
 */
router.post('/add', auth, async (req, res) => {
    try {
        await connectDB();
        
        const { 
            name, nationalId, email, phone, 
            department, jobTitle, reportingTo, 
            hireDate, employmentType, status,
            basicSalary, additions, deductions 
        } = req.body;

        // التحقق من البيانات الإلزامية
        if (!name || !nationalId || !department || !jobTitle || !hireDate) {
            return res.status(400).json({ error: 'برجاء إكمال البيانات الأساسية للموظف' });
        }

        const newEmployee = new Employee({
            name,
            nationalId,
            email: email ? email.toLowerCase() : undefined,
            phone,
            companyId: req.user.companyId, // الربط التلقائي بشركة المستخدم الحالي
            department,
            jobTitle,
            reportingTo: reportingTo || null,
            hireDate,
            employmentType: employmentType || 'Full-time',
            status: status || 'Active',
            salaryDetails: {
                basicSalary: basicSalary || 0,
                additions: additions || [],
                deductions: deductions || []
            }
        });

        await newEmployee.save();
        res.status(201).json({ 
            success: true, 
            message: 'تم تسجيل الموظف بنجاح', 
            employeeId: newEmployee._id 
        });

    } catch (error) {
        console.error("Add Employee Error:", error.message);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'رقم البطاقة (National ID) مسجل لموظف آخر بالفعل' });
        }
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ بيانات الموظف' });
    }
});

/**
 * 2. جلب قائمة الموظفين (Read)
 * تم إضافة Populate لجلب أسماء الأقسام والمديرين بدلاً من الـ IDs
 */
router.get('/all', auth, async (req, res) => {
    try {
        await connectDB();
        
        // جلب موظفين هذه الشركة فقط لضمان خصوصية البيانات
        const employees = await Employee.find({ companyId: req.user.companyId })
            .populate('department', 'name code') 
            .populate('reportingTo', 'name jobTitle')
            .sort({ createdAt: -1 }); // الأحدث أولاً

        res.json({ success: true, count: employees.length, data: employees });
    } catch (error) {
        console.error("Get Employees Error:", error.message);
        res.status(500).json({ error: 'فشل في جلب قائمة الموظفين' });
    }
});

/**
 * 3. حذف موظف (Delete)
 * التحقق من ملكية الشركة للموظف قبل الحذف
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        await connectDB();
        
        const deletedEmployee = await Employee.findOneAndDelete({ 
            _id: req.params.id, 
            companyId: req.user.companyId // لضمان عدم حذف موظف يتبع شركة أخرى
        });

        if (!deletedEmployee) {
            return res.status(404).json({ error: 'الموظف غير موجود أو ليس لديك صلاحية حذفه' });
        }

        res.json({ success: true, message: 'تم حذف سجل الموظف بنجاح' });
    } catch (error) {
        console.error("Delete Employee Error:", error.message);
        res.status(500).json({ error: 'حدث خطأ أثناء محاولة الحذف' });
    }
});

module.exports = router;

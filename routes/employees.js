const express = require('express');
const router = express.Router();
const Employee = require('../models/employee');
const auth = require('../middleware/auth');

/**
 * 1. إضافة موظف جديد
 * POST /api/employees/
 */
router.post('/', auth, async (req, res) => {
    try {
        // تم إزالة connectDB لأننا استدعيناها في server.js
        
        const { 
            name, nationalId, email, phone, 
            department, jobTitle, hireDate, 
            employmentType, status, salaryDetails 
        } = req.body;

        // التحقق من البيانات الأساسية
        if (!name || !nationalId) {
            return res.status(400).json({ error: 'الاسم والرقم القومي بيانات إجبارية' });
        }

        const newEmployee = new Employee({
            name,
            nationalId,
            email: email ? email.toLowerCase() : undefined,
            phone,
            companyId: req.user.companyId, 
            department,
            jobTitle,
            hireDate: hireDate || new Date(),
            employmentType: employmentType || 'Full-time',
            status: status || 'Active',
            salaryDetails: {
                basicSalary: salaryDetails?.basicSalary || 0,
                additions: [],
                deductions: []
            }
        });

        await newEmployee.save();
        
        res.status(201).json({ 
            success: true, 
            message: 'تم تسجيل الموظف بنجاح', 
            employee: newEmployee 
        });

    } catch (error) {
        console.error("Add Employee Error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'الرقم القومي مسجل لموظف آخر بالفعل' });
        }
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ بيانات الموظف' });
    }
});

/**
 * 2. جلب قائمة الموظفين
 * GET /api/employees/
 */
router.get('/', auth, async (req, res) => {
    try {
        const employees = await Employee.find({ companyId: req.user.companyId })
            .sort({ createdAt: -1 });

        // نرسل البيانات مباشرة كـ Array أو نلفها في كائن (الـ Frontend عندك مستني Array)
        res.json(employees); 
    } catch (error) {
        console.error("Get Employees Error:", error);
        res.status(500).json({ error: 'فشل في جلب قائمة الموظفين' });
    }
});

/**
 * 3. جلب تفاصيل موظف واحد (مهمة جداً لشاشة البروفايل)
 * GET /api/employees/:id/details
 */
router.get('/:id/details', auth, async (req, res) => {
    try {
        const emp = await Employee.findOne({ 
            _id: req.params.id, 
            companyId: req.user.companyId 
        });

        if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

        res.json({
            emp: emp,
            history: emp.history || []
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب بيانات الموظف' });
    }
});

/**
 * 4. حذف موظف
 * DELETE /api/employees/:id
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const deletedEmployee = await Employee.findOneAndDelete({ 
            _id: req.params.id, 
            companyId: req.user.companyId 
        });

        if (!deletedEmployee) {
            return res.status(404).json({ error: 'الموظف غير موجود' });
        }

        res.json({ success: true, message: 'تم حذف الموظف بنجاح' });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ أثناء محاولة الحذف' });
    }
});

module.exports = router;

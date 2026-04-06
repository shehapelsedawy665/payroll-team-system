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
        // فك تشفير البيانات القادمة من الـ Request Body
        const { 
            name, 
            nationalId, 
            email, 
            phone, 
            department, 
            jobTitle, 
            hireDate, 
            employmentType, 
            status, 
            salaryDetails 
        } = req.body;

        // التحقق من البيانات الأساسية (الاسم والرقم القومي)
        if (!name || !nationalId) {
            return res.status(400).json({ error: 'الاسم والرقم القومي بيانات إجبارية' });
        }

        // إنشاء كائن الموظف الجديد مع التأكد من هيكلة البيانات صح
        const newEmployee = new Employee({
            name: name.trim(),
            nationalId: nationalId.trim(),
            email: email ? email.toLowerCase().trim() : undefined,
            phone: phone ? phone.trim() : undefined,
            companyId: req.user.companyId, // يتم جلبه تلقائياً من التوكن (Middleware)
            department: department || 'General', // لو القسم مجاش نضع قيمة افتراضية
            jobTitle: jobTitle || 'Employee',
            hireDate: hireDate || new Date(),
            employmentType: employmentType || 'Full-time',
            status: status || 'Active',
            salaryDetails: {
                basicSalary: Number(salaryDetails?.basicSalary) || 0,
                additions: [], // مصفوفة فارغة لحين إضافة بدلات لاحقاً
                deductions: [] // مصفوفة فارغة لحين إضافة خصومات لاحقاً
            },
            history: [] // تهيئة سجل المرتبات فارغاً
        });

        // حفظ في قاعدة البيانات
        await newEmployee.save();
        
        res.status(201).json({ 
            success: true, 
            message: 'تم تسجيل الموظف بنجاح', 
            employee: newEmployee 
        });

    } catch (error) {
        console.error("Add Employee Error:", error);
        
        // معالجة خطأ تكرار الرقم القومي
        if (error.code === 11000) {
            return res.status(400).json({ error: 'عفواً، الرقم القومي هذا مسجل لموظف آخر بالفعل' });
        }
        
        // معالجة أخطاء الـ Validation
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: 'خطأ في البيانات: ' + Object.values(error.errors).map(e => e.message).join(', ') });
        }

        res.status(500).json({ error: 'حدث خطأ داخلي أثناء حفظ بيانات الموظف' });
    }
});

/**
 * 2. جلب قائمة الموظفين
 * GET /api/employees/
 */
router.get('/', auth, async (req, res) => {
    try {
        // جلب موظفين الشركة الخاصة بالمستخدم فقط
        const employees = await Employee.find({ companyId: req.user.companyId })
            .sort({ createdAt: -1 });

        // نرسل البيانات كـ Array مباشر لأن الـ Frontend (DataTables) يحتاجها هكذا
        res.json(employees); 
    } catch (error) {
        console.error("Get Employees Error:", error);
        res.status(500).json({ error: 'فشل في جلب قائمة الموظفين' });
    }
});

/**
 * 3. جلب تفاصيل موظف واحد (لشاشة البروفايل والحسابات)
 * GET /api/employees/:id/details
 */
router.get('/:id/details', auth, async (req, res) => {
    try {
        const emp = await Employee.findOne({ 
            _id: req.params.id, 
            companyId: req.user.companyId 
        });

        if (!emp) return res.status(404).json({ error: 'الموظف غير موجود أو لا تملك صلاحية الوصول إليه' });

        // إرجاع بيانات الموظف مع سجل مرتباته (History)
        res.json({
            emp: emp,
            history: emp.history || []
        });
    } catch (error) {
        console.error("Fetch Employee Details Error:", error);
        res.status(500).json({ error: 'خطأ في جلب بيانات الموظف' });
    }
});

/**
 * 4. حذف موظف
 * DELETE /api/employees/:id
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        // التأكد من حذف موظف يخص هذه الشركة فقط
        const deletedEmployee = await Employee.findOneAndDelete({ 
            _id: req.params.id, 
            companyId: req.user.companyId 
        });

        if (!deletedEmployee) {
            return res.status(404).json({ error: 'الموظف غير موجود' });
        }

        res.json({ success: true, message: 'تم حذف الموظف بنجاح من النظام' });
    } catch (error) {
        console.error("Delete Employee Error:", error);
        res.status(500).json({ error: 'حدث خطأ أثناء محاولة الحذف' });
    }
});

module.exports = router;

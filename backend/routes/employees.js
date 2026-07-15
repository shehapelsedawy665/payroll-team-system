const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

/**
 * 1. إضافة موظف جديد
 * المسار: POST /api/employees
 */
router.post('/', async (req, res) => {
    try {
        const employeeData = req.body;
        
        // التأكد إن كود الموظف مش متكرر في نفس الشركة (عشان الوعاء الضريبي)
        const existingEmployee = await Employee.findOne({ 
            companyId: employeeData.companyId, 
            $or: [{ jobId: employeeData.jobId }, { nationalId: employeeData.nationalId }]
        });

        if (existingEmployee) {
            return res.status(400).json({ 
                success: false, 
                message: "الموظف ده مسجل في الشركة دي قبل كده بكود أو رقم قومي مكرر." 
            });
        }

        const newEmployee = new Employee(employeeData);
        await newEmployee.save();

        res.status(201).json({
            success: true,
            message: "تم تسجيل الموظف بنجاح",
            data: newEmployee
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ أثناء تسجيل الموظف", error: error.message });
    }
});

/**
 * 2. عرض كل الموظفين لشركة معينة (لشاشة الـ HR)
 * المسار: GET /api/employees/company/:companyId
 */
router.get('/company/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const employees = await Employee.find({ companyId }).sort({ createdAt: -1 }); // الترتيب من الأحدث للأقدم
        
        res.status(200).json({
            success: true,
            count: employees.length,
            data: employees
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في استرجاع بيانات الموظفين", error: error.message });
    }
});

/**
 * 3. عرض بيانات موظف واحد بالتفصيل (لشاشة البروفايل بتاعه)
 * المسار: GET /api/employees/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id).populate('companyId', 'name settings');
        
        if (!employee) {
            return res.status(404).json({ success: false, message: "الموظف غير موجود" });
        }

        res.status(200).json({
            success: true,
            data: employee
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في استرجاع بيانات الموظف", error: error.message });
    }
});

module.exports = router;

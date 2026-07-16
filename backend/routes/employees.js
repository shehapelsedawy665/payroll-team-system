const express = require('express');
const router = express.Router();

// استدعاء الموديل (بنحطه في try/catch عشان لو الموديل لسه ماتعملش السيستم ميضربش في وضع التجربة)
let Employee;
try {
    Employee = require('../models/Employee');
} catch (e) {
    console.log("Employee model not found, running in Test Mode only.");
}

/**
 * 1. إضافة موظف جديد
 */
router.post('/', async (req, res) => {
    try {
        const { companyId, name, jobId, department, financials, legalDetails } = req.body;

        // 🟢 الباب السري للتجربة (Test Mode) 🟢
        // لو اليوزر داخل بحساب التجربة، هنرجعله نجاح وهمي عشان الشاشة تشتغل
        if (companyId === 'DUMMY_COMPANY_ID' || !companyId) {
            return res.status(201).json({
                success: true,
                message: "تم حفظ الموظف بنجاح (وضع التجربة)",
                data: { _id: "test_" + Date.now(), name, jobId, department, financials, legalDetails }
            });
        }

        // --- الكود الأصلي الحقيقي ---
        if (Employee) {
            const newEmployee = new Employee(req.body);
            await newEmployee.save();
            res.status(201).json({ success: true, message: "تم تسجيل الموظف بنجاح", data: newEmployee });
        } else {
            res.status(500).json({ success: false, message: "موديل الموظفين غير موجود" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ أثناء تسجيل الموظف", error: error.message });
    }
});

/**
 * 2. جلب الموظفين لعرضهم في الجدول
 */
router.get('/company/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;

        // 🟢 الباب السري للتجربة (Test Mode) 🟢
        if (companyId === 'DUMMY_COMPANY_ID' || companyId === 'null') {
            return res.status(200).json({
                success: true,
                data: [
                    {
                        _id: '1',
                        name: 'أحمد محمود (بيانات تجريبية)',
                        jobId: 'EMP-001',
                        department: 'IT',
                        financials: { basicSalary: 20000, variableSalary: 0 },
                        legalDetails: { insSalary: 16700 }
                    }
                ]
            });
        }

        // --- الكود الأصلي الحقيقي ---
        if (Employee) {
            const employees = await Employee.find({ companyId });
            res.status(200).json({ success: true, data: employees });
        } else {
            res.status(500).json({ success: false, message: "موديل الموظفين غير موجود" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في جلب الموظفين", error: error.message });
    }
});

module.exports = router;

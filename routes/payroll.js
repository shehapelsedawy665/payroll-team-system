const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Employee = require('../models/employee');
const Company = require('../models/company');
const Payroll = require('../models/payroll');
const calculatePayroll = require('../calculations'); // ماكينة الحسابات الخاصة بك
const connectDB = require('../db');

/**
 * 1. حساب وتحميل مرتبات شهر معين (Generate Payroll)
 * الوظيفة: تأخذ الموظفين النشطين، تحسب ضرائبهم وتأميناتهم، وتخزن السجل
 */
router.post('/generate', auth, async (req, res) => {
    try {
        await connectDB();
        const { month } = req.body; // صيغة YYYY-MM

        if (!month) return res.status(400).json({ error: 'يرجى تحديد الشهر والسنة' });

        // أ. جلب إعدادات الشركة (الضرائب والتأمينات الخاصة بها)
        const company = await Company.findById(req.user.companyId);
        
        // ب. جلب جميع موظفي الشركة النشطين
        const employees = await Employee.find({ 
            companyId: req.user.companyId, 
            status: 'Active' 
        });

        const payrollResults = [];

        for (let emp of employees) {
            // ج. تشغيل ماكينة الحسابات لكل موظف بناءً على إعدادات الشركة
            const calculation = calculatePayroll(emp, company.settings);

            // د. حفظ السجل في قاعدة البيانات (أو تحديثه لو موجود)
            const payrollRecord = await Payroll.findOneAndUpdate(
                { employeeId: emp._id, month: month },
                {
                    companyId: req.user.companyId,
                    employeeId: emp._id,
                    month: month,
                    payload: {
                        grossSalary: calculation.grossSalary,
                        netSalary: calculation.netSalary,
                        taxAmount: calculation.taxAmount,
                        insuranceEmployee: calculation.insuranceEmployee,
                        insuranceCompany: calculation.insuranceCompany,
                        totalAdditions: calculation.totalAdditions,
                        totalDeductions: calculation.totalDeductions,
                        details: calculation.details // تفاصيل الحسبة كاملة
                    },
                    status: 'Pending'
                },
                { upsert: true, new: true }
            );
            payrollResults.push(payrollRecord);
        }

        res.json({ 
            success: true, 
            message: `تم معالجة مرتبات عدد ${employees.length} موظف لشهر ${month}`,
            data: payrollResults 
        });

    } catch (error) {
        console.error("Payroll Generation Error:", error.message);
        res.status(500).json({ error: 'حدث خطأ أثناء حساب المرتبات' });
    }
});

/**
 * 2. جلب سجلات المرتبات السابقة (History)
 */
router.get('/history', auth, async (req, res) => {
    try {
        await connectDB();
        const { month } = req.query; // اختياري لفلترة شهر معين

        let query = { companyId: req.user.companyId };
        if (month) query.month = month;

        const records = await Payroll.find(query)
            .populate('employeeId', 'name nationalId jobTitle')
            .sort({ month: -1 });

        res.json({ success: true, count: records.length, data: records });
    } catch (error) {
        console.error("Payroll History Error:", error.message);
        res.status(500).json({ error: 'خطأ في جلب سجلات المرتبات' });
    }
});

module.exports = router;

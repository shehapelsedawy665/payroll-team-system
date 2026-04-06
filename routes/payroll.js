const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Employee = require('../models/employee');
const Company = require('../models/company');
const calculatePayroll = require('../calculations');

/**
 * 1. حساب وحفظ مرتب موظف واحد (المستخدمة في شاشة البروفايل)
 * POST /api/payroll/calculate
 */
router.post('/calculate', auth, async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions } = req.body;

        if (!empId || !month) return res.status(400).json({ error: 'بيانات ناقصة (الموظف أو الشهر)' });

        // أ. جلب بيانات الموظف والشركة
        const [emp, company] = await Promise.all([
            Employee.findOne({ _id: empId, companyId: req.user.companyId }),
            Company.findById(req.user.companyId)
        ]);

        if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });
        
        const settings = company?.settings || { 
            personalExemption: 20000, 
            maxInsSalary: 16700, 
            insEmployeePercent: 0.11 
        };

        // ب. تشغيل المحرك المالي بناءً على البيانات المرسلة من الـ UI
        const calculation = calculatePayroll({
            ...emp.toObject(),
            salaryDetails: {
                ...emp.salaryDetails,
                basicSalary: Number(fullBasic) || emp.salaryDetails.basicSalary,
                allowances: Number(fullTrans) || emp.salaryDetails.allowances
            }
        }, settings, { days, additions, deductions });

        // ج. تجهيز عنصر الهيستوري
        const historyItem = {
            month: month,
            payload: {
                ...calculation,
                days: days,
                createdAt: new Date()
            }
        };

        // د. الحفظ الذكي (لو الشهر موجود يحدثه، لو مش موجود يضيفه)
        // أولاً: نمسح الشهر القديم لو موجود عشان ميتكررش
        await Employee.updateOne(
            { _id: empId },
            { $pull: { history: { month: month } } }
        );

        // ثانياً: نضيف الحسبة الجديدة
        const updatedEmp = await Employee.findByIdAndUpdate(
            empId,
            { $push: { history: historyItem } },
            { new: true }
        );

        res.json({ 
            success: true, 
            message: `تم حفظ مرتب شهر ${month} بنجاح`,
            result: calculation 
        });

    } catch (error) {
        console.error("Payroll Calc Error:", error);
        res.status(500).json({ error: 'حدث خطأ في محرك الحسابات' });
    }
});

/**
 * 2. محرك الـ Net to Gross (الآلة الحاسبة السريعة)
 * POST /api/payroll/net-to-gross
 */
router.post('/net-to-gross', auth, async (req, res) => {
    try {
        const { targetNet } = req.body;
        if (!targetNet) return res.status(400).json({ error: 'يرجى إدخال المبلغ الصافي' });

        const company = await Company.findById(req.user.companyId);
        const settings = company?.settings || { personalExemption: 20000, maxInsSalary: 16700, insEmployeePercent: 0.11 };

        // ملاحظة: تأكد أن ملف calculations.js يحتوي على وظيفة reverse أو loop للوصول للـ Gross
        const result = calculatePayroll.reverse ? calculatePayroll.reverse(Number(targetNet), settings) : { grossSalary: targetNet * 1.4 }; // مثال تقريبي لو مفيش reverse

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'فشل في عملية الحساب العكسي' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const Company = require('../models/Company');
const Attendance = require('../models/Attendance');
const PayrollRecord = require('../models/PayrollRecord');
const payrollEngine = require('../logic/payrollEngine');
const { generatePayslipPDF } = require('../logic/payslipGenerator');
const path = require('path');
const fs = require('fs');

/**
 * 1. تشغيل محرك المرتبات لموظف معين في شهر معين (Run Payroll)
 * المسار: POST /api/payroll/calculate
 */
router.post('/calculate', async (req, res) => {
    try {
        const { employeeId, companyId, month, year } = req.body;

        // 1. نجيب بيانات الموظف والشركة
        const employee = await Employee.findById(employeeId);
        const company = await Company.findOne({ companyCode: companyId });

        if (!employee || !company) {
            return res.status(404).json({ success: false, message: "الموظف أو الشركة غير موجودين" });
        }

        // 2. تجميع بيانات الحضور والانصراف للشهر ده (تجميع مبدئي للتجربة)
        // في الواقع بنعمل Aggregate من جدول الـ Attendance، بس هنحط قيم افتراضية مؤقتاً عشان السيستم يشتغل
        const attendanceSummary = {
            workedDays: 26,
            absentDays: 0,
            lateMinutes: 0,
            overtime: { normalHours: 0, holidayHours: 0 }
        };

        // 3. ندخل الداتا لمحرك المرتبات عشان يحسب الضرايب والتأمينات والصافي
        const calculatedSalary = payrollEngine.calculateNetSalary(employee, attendanceSummary, company.settings);

        // 4. نسجل المرتب في الداتابيز (لو متسجل قبل كده بنعمله تحديث)
        const recordData = {
            employeeId,
            companyId: company._id,
            month,
            year,
            baseDataSnapshot: {
                basicSalary: employee.financials.basicSalary,
                variableSalary: employee.financials.variableSalary,
                insSalary: employee.legalDetails.insSalary
            },
            attendanceSummary,
            financials: calculatedSalary,
            status: 'Draft' // بينزل مسودة لحد ما الـ HR يعتمده
        };

        const payrollRecord = await PayrollRecord.findOneAndUpdate(
            { employeeId, month, year },
            { $set: recordData },
            { new: true, upsert: true } // upsert بتخليه يكريت جديد لو مش موجود
        );

        res.status(200).json({
            success: true,
            message: "تم حساب المرتب بنجاح",
            data: payrollRecord
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في حساب المرتب", error: error.message });
    }
});

/**
 * 2. إصدار مفردات المرتب كملف PDF أوتوماتيك (Generate Payslip)
 * المسار: GET /api/payroll/payslip/:recordId
 */
router.get('/payslip/:recordId', async (req, res) => {
    try {
        // نجيب السجل بتاع المرتب بكل تفاصيله
        const payrollRecord = await PayrollRecord.findById(req.params.recordId)
            .populate('employeeId')
            .populate('companyId');

        if (!payrollRecord) {
            return res.status(404).json({ success: false, message: "سجل المرتب ده مش موجود" });
        }

        const employee = payrollRecord.employeeId;
        const company = payrollRecord.companyId;

        // تجهيز مسار الحفظ للملف
        const fileName = `Payslip_${employee.jobId}_${payrollRecord.month}_${payrollRecord.year}.pdf`;
        const outputPath = path.join(__dirname, '..', '..', 'public', 'payslips', fileName);

        // تشغيل مولد الـ PDF اللي عملناه
        await generatePayslipPDF(employee, payrollRecord, company, outputPath);

        // نبعت الملف كـ Download لليوزر
        res.download(outputPath, fileName, (err) => {
            if (err) {
                console.error("Error downloading file:", err);
            }
            // يفضل نمسح الملف من السيرفر بعد ما ينزل عشان نوفر مساحة
            fs.unlink(outputPath, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting temp PDF:", unlinkErr);
            });
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "حصل خطأ في إصدار الـ PDF", error: error.message });
    }
});

module.exports = router;

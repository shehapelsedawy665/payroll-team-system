// api/payroll.js
const { connectToDatabase } = require('../backend/config/db');
const Employee = require('../backend/models/Employee');
const PayrollRecord = require('../backend/models/PayrollRecord');
const { runPayrollLogic } = require('../backend/logic/payrollEngine');

module.exports = async (req, res) => {
    await connectToDatabase();
    const { method } = req;

    if (method === 'POST') {
        const { employeeId, month, manualDays, additions, deductions } = req.body;

        try {
            // 1. جلب بيانات الموظف
            const emp = await Employee.findById(employeeId);
            if (!emp) return res.status(404).json({ message: "الموظف غير موجود" });

            // 2. جلب بيانات الشهر السابق (لحساب تراكمي الضرائب YTD)
            const prevMonthDate = new Date(month + "-01");
            prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
            const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);

            const prevRecord = await PayrollRecord.findOne({ 
                employeeId, 
                month: prevMonthStr,
                companyId: emp.companyId 
            });

            // تجهيز بيانات الـ Previous (لو مفيش شهر فات بنصفر العداد)
            const prevData = prevRecord ? {
                pDays: prevRecord.payload.totalDaysYTD || 0,
                pTaxable: prevRecord.payload.totalTaxableYTD || 0,
                pTaxes: prevRecord.payload.totalAnnualTax || 0
            } : { pDays: 0, pTaxable: 0, pTaxes: 0 };

            // 3. تشغيل الـ Logic المحسن بتاعنا
            const input = {
                fullBasic: emp.fullBasic,
                fullTrans: emp.fullTrans,
                days: manualDays,
                additions: additions || [],
                deductions: deductions || [],
                hiringDate: emp.hiringDate,
                month: month
            };

            const result = runPayrollLogic(input, prevData, emp);

            // 4. حفظ السجل في قاعدة البيانات
            const updatedRecord = await PayrollRecord.findOneAndUpdate(
                { employeeId, month, companyId: emp.companyId },
                { payload: result, status: 'draft' },
                { upsert: true, new: true }
            );

            return res.status(200).json({ success: true, data: updatedRecord });

        } catch (error) {
            console.error("Payroll Error:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    res.status(405).json({ message: "Method Not Allowed" });
};

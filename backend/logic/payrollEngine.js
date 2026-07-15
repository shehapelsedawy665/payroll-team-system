/**
 * Payroll Engine - المحرك الأساسي لحساب المرتبات
 */
const taxEngine = require('./taxEngine');

const calculateNetSalary = (employee, attendanceSummary, companySettings) => {
    // 1. حساب إجمالي الراتب الأساسي والمتغير والبدلات (Gross Salary)
    const basic = employee.financials.basicSalary || 0;
    const variable = employee.financials.variableSalary || 0;
    const allowances = (employee.financials.allowances.transportation || 0) + (employee.financials.allowances.other || 0);
    
    const grossSalary = basic + variable + allowances;

    // 2. حساب قيمة اليوم والساعة والدقيقة بناءً على إعدادات الشركة
    const calcDays = companySettings.payrollRules.monthCalcType === "30" ? 30 : 26; // 26 كمتوسط أيام العمل الفعلية لو مش 30 ثابت
    const dayRate = grossSalary / calcDays;
    const hourRate = dayRate / companySettings.general.dailyWorkHours;
    const minuteRate = hourRate / 60;

    let additions = 0;
    let deductions = 0;

    // 3. حساب الإضافي (Overtime) بناءً على لائحة الشركة
    if (attendanceSummary.overtime) {
        additions += (attendanceSummary.overtime.normalHours || 0) * hourRate * companySettings.payrollRules.overtimeRate;
        additions += (attendanceSummary.overtime.holidayHours || 0) * hourRate * companySettings.payrollRules.overtimeHolRate;
    }

    // 4. حساب استقطاعات الغياب والتأخير
    if (attendanceSummary.absentDays > 0) {
        deductions += attendanceSummary.absentDays * dayRate * companySettings.payrollRules.absentDayRate;
    }
    if (attendanceSummary.lateMinutes > 0) {
        // هنا ممكن تتطور بعدين عشان تطبق لائحة الجزاءات التصاعدية
        deductions += attendanceSummary.lateMinutes * minuteRate; 
    }

    // 5. حساب حصة الموظف في التأمينات الاجتماعية
    let socialInsuranceDeduction = 0;
    if (employee.legalDetails.insuranceNumber && employee.legalDetails.insSalary > 0) {
        // التأكد من إن الأجر التأميني مش متخطي الحد الأقصى أو أقل من الحد الأدنى للشركة
        let appliedInsSalary = Math.min(employee.legalDetails.insSalary, companySettings.socialInsuranceRules.maxInsurableSalary);
        appliedInsSalary = Math.max(appliedInsSalary, companySettings.socialInsuranceRules.minInsurableSalary);
        
        socialInsuranceDeduction = appliedInsSalary * (companySettings.socialInsuranceRules.employeeShare / 100);
    }

    // 6. حساب وعاء ضريبة كسب العمل (Taxable Income)
    // الوعاء = (الإجمالي + الإضافي) - (الاستقطاعات + التأمينات)
    const incomeBeforeTax = grossSalary + additions - deductions;
    const taxableIncome = incomeBeforeTax - socialInsuranceDeduction;

    // 7. استدعاء محرك الضرائب
    const tax = taxEngine.calculateMonthlyTax(
        taxableIncome, 
        companySettings.taxRules, 
        employee.legalDetails.isTaxExempted
    );

    // 8. حساب الصافي النهائي (Net Salary)
    const netSalary = incomeBeforeTax - socialInsuranceDeduction - tax;

    // ترجيع تفاصيل الـ Payslip (مفردات المرتب) بالكامل
    return {
        grossSalary: Number(grossSalary.toFixed(2)),
        dayRate: Number(dayRate.toFixed(2)),
        hourRate: Number(hourRate.toFixed(2)),
        additions: Number(additions.toFixed(2)),
        deductions: Number(deductions.toFixed(2)),
        socialInsurance: Number(socialInsuranceDeduction.toFixed(2)),
        tax: Number(tax.toFixed(2)),
        netSalary: Number(netSalary.toFixed(2))
    };
};

module.exports = {
    calculateNetSalary
};

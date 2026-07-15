/**
 * Tax Engine - مخصص لقانون ضرائب كسب العمل المصري
 */

const calculateMonthlyTax = (monthlyTaxableIncome, taxRules, isTaxExempted = false) => {
    // لو الموظف معفى ضريبياً (زي بعض حالات ذوي الهمم) أو وعاءه صفر
    if (isTaxExempted || monthlyTaxableIncome <= 0) return 0;

    // 1. تحويل الدخل الشهري لسنوي
    let annualIncome = monthlyTaxableIncome * 12;

    // 2. خصم الإعفاء الشخصي للموظف
    const personalExemption = taxRules.personalExemption || 20000;
    const taxExemptionLimit = taxRules.taxExemptionLimit || 40000; // الشريحة الصفرية المعفاة
    
    let netAnnualIncome = annualIncome - personalExemption;
    if (netAnnualIncome <= 0) return 0;

    let annualTax = 0;

    // 3. حساب الشرائح التصاعدية (الأساسيات لأغلب الموظفين - أقل من 600 ألف سنوياً)
    // ملحوظة: السيستم جاهز يتعدل لو الشركة حبت تطبق قواعد كبار الممولين المعقدة
    
    // الشريحة الأولى: معفاة
    if (netAnnualIncome <= taxExemptionLimit) {
        return 0;
    }

    // الشريحة التانية: من 40,000 إلى 55,000 (10%)
    if (netAnnualIncome > 40000) {
        let amountInBracket = Math.min(netAnnualIncome - 40000, 15000);
        annualTax += amountInBracket * 0.10;
    }

    // الشريحة التالتة: من 55,000 إلى 70,000 (15%)
    if (netAnnualIncome > 55000) {
        let amountInBracket = Math.min(netAnnualIncome - 55000, 15000);
        annualTax += amountInBracket * 0.15;
    }

    // الشريحة الرابعة: من 70,000 إلى 200,000 (20%)
    if (netAnnualIncome > 70000) {
        let amountInBracket = Math.min(netAnnualIncome - 70000, 130000);
        annualTax += amountInBracket * 0.20;
    }

    // الشريحة الخامسة: من 200,000 إلى 400,000 (22.5%)
    if (netAnnualIncome > 200000) {
        let amountInBracket = Math.min(netAnnualIncome - 200000, 200000);
        annualTax += amountInBracket * 0.225;
    }

    // الشريحة السادسة: من 400,000 إلى 1,200,000 (25%)
    if (netAnnualIncome > 400000) {
        let amountInBracket = Math.min(netAnnualIncome - 400000, 800000);
        annualTax += amountInBracket * 0.25;
    }

    // الشريحة السابعة: ما زاد عن 1,200,000 (27.5%)
    if (netAnnualIncome > 1200000) {
        let amountInBracket = netAnnualIncome - 1200000;
        annualTax += amountInBracket * 0.275;
    }

    // 4. تحويل الضريبة السنوية لشهرية
    const monthlyTax = annualTax / 12;
    
    // التقريب لأقرب قرشين عشان الكسور متعملش مشاكل في الحسابات
    return Number(monthlyTax.toFixed(2));
};

/**
 * تسوية الضريبة بناءً على الوعاء الضريبي المتراكم (YTD) للموظفين المنقولين أو للتقفيل السنوي
 */
const calculateYtdTaxAdjustment = (ytdTaxableIncome, ytdTaxPaid, currentMonthlyIncome, taxRules) => {
    // دي الدالة اللي هنستخدمها في التسوية السنوية في آخر السنة 
    // عشان نضمن إن الأوت سورس مبيخسرش قرش ولا الموظف بيتخصم منه بزيادة
    // هنبرمجها بالتفصيل لما نوصل لعمليات التقفيل (Year-End Closing)
    return 0; 
};

module.exports = {
    calculateMonthlyTax,
    calculateYtdTaxAdjustment
};

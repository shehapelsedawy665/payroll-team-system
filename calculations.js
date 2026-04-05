const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    // 1. استخراج البيانات من المدخلات
    const { 
        fullBasic, 
        fullTrans, 
        days, 
        additions = [], 
        deductions = [] 
    } = input;

    // 2. الحسابات الأساسية (Prorated) - S9 في الإكسيل
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    
    // جمع كل الإضافات (حوافز، بدلات...)
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    // جمع كل الخصومات الخارجية (سلف، جزاءات...)
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    
    // إجمالي الاستحقاقات قبل الضرائب (Gross)
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 3. التأمينات الاجتماعية (AV9) - حسب منطق السيرفر
    const insSalary = Number(emp.insSalary) || 0;
    const insuranceEmployee = R(insSalary * 0.11);
    
    // 4. الإعفاء الشخصي (AE9) - مربوط بالأيام لضمان دقة الشهور الناقصة
    const personalExemption = R((20000 / 360) * days); 

    // 5. الوعاء الضريبي للشهر الحالي (AH9)
    const currentTaxable = R(Math.max(0, gross - insuranceEmployee - personalExemption));
    
    // 6. الحسابات التراكمية (YTD) - AF7 و AH7 في الإكسيل
    const totalDaysYTD = Number(days) + (Number(prev.pDays) || 0);
    const totalTaxableYTD = R(currentTaxable + (Number(prev.pTaxable) || 0));
    
    // 7. توقع الدخل السنوي (Annual Projected) - نفس معادلة السيرفر
    const rawAnnual = totalDaysYTD > 0 ? (totalTaxableYTD / totalDaysYTD) * 360 : 0;
    const floorAnnual = Math.floor(R(rawAnnual) / 10) * 10;
    
    // 8. حساب الضريبة السنوية (لوجيك السيرفر 600k/900k بالحرف)
    let annualTax = 0;
    let temp = Math.max(0, floorAnnual - 20000); // طرح الإعفاء الأساسي

    if (floorAnnual <= 600000) {
        if (temp > 40000) annualTax += Math.min(temp - 40000, 15000) * 0.10;
        if (temp > 55000) annualTax += Math.min(temp - 55000, 15000) * 0.15;
        if (temp > 70000) annualTax += Math.min(temp - 70000, 130000) * 0.20;
        if (temp > 200000) annualTax += Math.min(temp - 200000, 200000) * 0.225;
        if (temp > 400000) annualTax += Math.min(temp - 400000, 200000) * 0.25;
        if (temp > 600000) annualTax += (temp - 600000) * 0.275;
    } else if (floorAnnual <= 900000) {
        if (temp > 0) annualTax += Math.min(temp, 200000) * 0.20;
        if (temp > 200000) annualTax += Math.min(temp - 200000, 200000) * 0.225;
        if (temp > 400000) annualTax += (temp - 400000) * 0.25;
    } else {
        if (temp > 0) annualTax += Math.min(temp, 400000) * 0.225;
        if (temp > 400000) annualTax += Math.min(temp - 400000, 800000) * 0.25;
        if (temp > 1200000) annualTax += (temp - 1200000) * 0.275;
    }

    // 9. ضريبة الفترة الحالية (تراكمي)
    const totalTaxDueUntilNow = R((annualTax / 360) * totalDaysYTD);
    const prevTaxes = Number(prev.pTaxes) || 0;
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - prevTaxes));

    // 10. المساهمة التكافلية (شهداء)
    const martyrs = R(gross * 0.0005);

    // 11. الصافي النهائي وإجمالي الخصومات
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    // إرجاع الأرقام بالكامل للجدول وللداتابيز
    return {
        fullBasic,
        fullTrans,
        days,
        proratedBasic,
        proratedTrans,
        totalAdditions,
        gross,
        insBase: insSalary,
        insuranceEmployee,
        prevDays: Number(prev.pDays) || 0,
        totalDaysYTD,
        prevTaxable: Number(prev.pTaxable) || 0,
        currentTaxable,
        taxPoolYTD: totalTaxableYTD,
        annualProjected: floorAnnual,
        totalAnnualTax: R(totalTaxDueUntilNow),
        prevTaxes: prevTaxes,
        monthlyTax,
        martyrs,
        totalOtherDeductions,
        totalAllDeductions,
        net
    };
}

module.exports = { runPayrollLogic };

const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    const { fullBasic, fullTrans, days, additions = [], deductions = [] } = input;
    
    // حسابات الشهر الحالي
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    const insuranceEmployee = R((Number(emp.insSalary) || 0) * 0.11);
    const martyrs = R(gross * 0.0005);
    
    // الإعفاء الشخصي مربوط بالأيام (عشان لو 25 يوم يحسب صح)
    const personalExemption = R((20000 / 360) * days); 
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    // التراكمي (YTD) - هو ده اللي بيظبط فبراير ومارس
    const totalDaysYTD = Number(days) + (Number(prev.pDays) || 0);
    const totalTaxableYTD = R(currentTaxable + (Number(prev.pTaxable) || 0));
    
    // توقع السنوي بناءً على الأيام الفعلية المنقضية
    const rawAnnual = totalDaysYTD > 0 ? (totalTaxableYTD / totalDaysYTD) * 360 : 0;
    const floorAnnual = Math.floor(R(rawAnnual) / 10) * 10;
    
    // لوجيك شرايح السيرفر
    let annualTax = 0;
    let temp = Math.max(0, floorAnnual - 20000);
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

    const totalTaxDueUntilNow = R((annualTax / 360) * totalDaysYTD);
    const prevTaxes = Number(prev.pTaxes) || 0;
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - prevTaxes));

    const net = R(gross - (insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions));

    return {
        fullBasic, fullTrans, days, proratedBasic, proratedTrans,
        totalAdditions, gross, insBase: Number(emp.insSalary), insuranceEmployee,
        prevDays: Number(prev.pDays) || 0, totalDaysYTD,
        prevTaxable: Number(prev.pTaxable) || 0, currentTaxable,
        taxPoolYTD: totalTaxableYTD, annualProjected: floorAnnual,
        totalAnnualTax: R(totalTaxDueUntilNow), prevTaxes: prevTaxes,
        monthlyTax, martyrs, totalOtherDeductions,
        totalAllDeductions: R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions),
        net
    };
}

module.exports = { runPayrollLogic };

const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    const { fullBasic, fullTrans, days, additions = [], deductions = [] } = input;
    
    // 1. الحسابات الأساسية (Prorated)
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 2. التأمينات (AV9)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // 3. الإعفاء الشخصي (يُحسب بالأيام حسب معادلتك)
    const personalExemption = R((20000 / 360) * days); 

    // 4. الوعاء الضريبي الشهري (AH9) - ده اللي كان بيفرق معاك في الكسور
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    // 5. التراكمي (YTD)
    const totalDaysYTD = days + (Number(prev.pDays) || 0); // AF7
    const totalTaxableYTD = R(currentTaxable + (Number(prev.pTaxable) || 0)); // AH7
    
    // 6. الـ Tax Pool السنوي (AI7) - تطبيق معادلة FLOOR(AH7/AF7*360, 10)/360*AF7
    let rawAnnual = totalDaysYTD > 0 ? (totalTaxableYTD / totalDaysYTD) * 360 : 0;
    let floorAnnual = Math.floor(R(rawAnnual) / 10) * 10;
    let taxPoolYTD = totalDaysYTD > 0 ? R((floorAnnual / 360) * totalDaysYTD) : 0;
    
    // 7. حساب الضرائب بالشرايح المتغيرة (Brackets) - ترجمة حرفية لمعادلاتك
    let ai = taxPoolYTD; // AI7
    let af = totalDaysYTD; // AF7
    let L = (val) => af > 0 ? (val / 360) * af : 0; // دالة تحويل القيمة السنوية لقيمة متناسبة مع الأيام

    let AJ = 0, AK = 0, AL = 0, AM = 0, AN = 0, AO = 0, AP = 0;
    
    if (ai > 0 && af > 0) {
        // شريحة الـ 0%
        AJ = ai > L(600000) ? 0 : L(40000);

        // شريحة الـ 10%
        if (ai > L(600000) && ai <= L(700000)) AK = L(55000) * 0.1;
        else if (ai > L(700000)) AK = 0;
        else AK = Math.min(L(15000), Math.max(0, ai - AJ)) * 0.1;

        // شريحة الـ 15%
        if (ai > L(700000) && ai <= L(800000)) AL = L(70000) * 0.15;
        else if (ai > L(800000)) AL = 0;
        else AL = Math.min(L(15000), Math.max(0, ai - AJ - (AK / 0.1))) * 0.15;

        // شريحة الـ 20%
        if (ai > L(800000) && ai <= L(900000)) AM = L(200000) * 0.2;
        else if (ai > L(900000)) AM = 0;
        else AM = Math.min(L(130000), Math.max(0, ai - AJ - (AK/0.1) - (AL/0.15))) * 0.2;

        // شريحة الـ 22.5%
        if (ai > L(900000) && ai <= L(1200000)) AN = L(400000) * 0.225;
        else if (ai > L(1200000)) AN = 0;
        else AN = Math.min(L(200000), Math.max(0, ai - AJ - (AK/0.1) - (AL/0.15) - (AM/0.2))) * 0.225;

        // شريحة الـ 25%
        if (ai > L(1200000)) AO = L(1200000) * 0.25;
        else AO = Math.min(L(800000), Math.max(0, ai - AJ - (AK/0.1) - (AL/0.15) - (AM/0.2) - (AN/0.225))) * 0.25;

        // شريحة الـ 27.5%
        AP = ai > L(1200000) ? (ai - L(1200000)) * 0.275 : 0;
    }

    // إجمالي الضريبة المستحقة (AQ7)
    const totalAnnualTax = R(AK + AL + AM + AN + AO + AP);
    
    // ضريبة الشهر الحالي (AQ7 - AR7)
    const monthlyTax = R(Math.max(0, totalAnnualTax - (Number(prev.pTaxes) || 0)));

    const martyrs = R(gross * 0.0005);
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    return {
        fullBasic, fullTrans, days, 
        proratedBasic, proratedTrans, 
        totalAdditions, gross,
        insBase, insuranceEmployee,
        prevDays: prev.pDays || 0,
        totalDaysYTD,
        prevTaxable: prev.pTaxable || 0,
        currentTaxable,
        taxPoolYTD: taxPoolYTD, // ده الـ AI7
        annualProjected: floorAnnual,
        totalAnnualTax,
        prevTaxes: prev.pTaxes || 0,
        monthlyTax,
        martyrs,
        totalOtherDeductions,
        totalAllDeductions,
        net
    };
}

module.exports = { runPayrollLogic };

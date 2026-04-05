const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    const { fullBasic, fullTrans, days, additions = [], deductions = [] } = input;
    
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    const martyrs = R(gross * 0.0005);
    const personalExemption = R((20000 / 360) * days); 
    
    // AH9: Taxable
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    const totalDaysYTD = days + (Number(prev.pDays) || 0); // AF7
    const totalTaxableYTD = R(currentTaxable + (Number(prev.pTaxable) || 0)); // AH7
    
    // AI7: Taxpool = (IFERROR(FLOOR(AH7/AF7*360,10),FLOOR(AH7*12,10)))/360*AF7
    let rawAnnual = totalDaysYTD > 0 ? (totalTaxableYTD / totalDaysYTD) * 360 : 0;
    let floorAnnual = Math.floor(R(rawAnnual) / 10) * 10;
    let taxPoolYTD = totalDaysYTD > 0 ? R((floorAnnual / 360) * totalDaysYTD) : 0;
    
    // --- ترجمة معادلات الإكسيل الخاصة بالشرائح (Brackets) بالحرف ---
    let ai = taxPoolYTD;       // AI7
    let af = totalDaysYTD;     // AF7
    let L = (val) => af > 0 ? (val / 360) * af : 0; // اختصار لجزء: value / 360 * AF7
    
    let AJ = 0, AK = 0, AL = 0, AM = 0, AN = 0, AO = 0, AP = 0;
    
    if (ai > 0 && af > 0) {
        // 0% (AJ7) - بإشارة موجبة لتسهيل الطرح في الكود
        if (ai > L(600000)) AJ = 0;
        else AJ = L(40000);

        // 10% (AK7)
        if (ai > L(600000) && ai <= L(700000)) AK = L(55000) * 0.1;
        else if (ai > L(700000)) AK = 0;
        else {
            if ((ai - AJ) <= L(15000)) AK = Math.max(0, (ai - AJ) * 0.1);
            else AK = L(15000) * 0.1;
        }

        // 15% (AL7)
        if (ai > L(700000) && ai <= L(800000)) AL = L(70000) * 0.15;
        else if (ai > L(800000)) AL = 0;
        else {
            let rem15 = ai - AJ - (AK / 0.1);
            if (rem15 <= L(15000)) AL = Math.max(0, rem15 * 0.15);
            else AL = L(15000) * 0.15;
        }

        // 20% (AM7)
        if (ai > L(800000) && ai <= L(900000)) AM = L(200000) * 0.2;
        else if (ai > L(900000)) AM = 0;
        else {
            let rem20 = ai - AJ - (AK / 0.1) - (AL / 0.15);
            if (rem20 <= L(130000)) AM = Math.max(0, rem20 * 0.2);
            else AM = L(130000) * 0.2;
        }

        // 22.5% (AN7)
        if (ai > L(900000) && ai <= L(1200000)) AN = L(400000) * 0.225;
        else if (ai > L(1200000)) AN = 0;
        else {
            let rem225 = ai - AJ - (AK / 0.1) - (AL / 0.15) - (AM / 0.2);
            if (rem225 <= L(200000)) AN = Math.max(0, rem225 * 0.225);
            else AN = L(200000) * 0.225;
        }

        // 25% (AO7)
        if (ai > L(1200000)) AO = L(1200000) * 0.25;
        else {
            let rem25 = ai - AJ - (AK / 0.1) - (AL / 0.15) - (AM / 0.2) - (AN / 0.225);
            if (rem25 <= L(800000)) AO = Math.max(0, rem25 * 0.25);
            else AO = L(800000) * 0.25;
        }

        // 27.5% (AP7)
        if (ai > L(1200000)) AP = Math.max(0, (ai - L(1200000)) * 0.275);
        else AP = 0;
    }

    // AQ7: Total Taxes
    const taxUntilNow = R(AK + AL + AM + AN + AO + AP);
    
    // AS7: Taxes of the month (AQ7 - AR7)
    const prevTaxes = Number(prev.pTaxes) || 0;
    const monthlyTax = R(Math.max(0, taxUntilNow - prevTaxes));

    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    // الـ Return زي ما هو متغيرش فيه حرف
    return {
        fullBasic, fullTrans, days, 
        proratedBasic, proratedTrans, 
        totalAdditions, gross,
        insBase, insuranceEmployee,
        prevDays: prev.pDays || 0,
        totalDaysYTD,
        prevTaxable: prev.pTaxable || 0,
        currentTaxable,
        taxPoolYTD: taxPoolYTD,
        annualProjected: floorAnnual,
        totalAnnualTax: taxUntilNow, 
        prevTaxes: prev.pTaxes || 0,
        monthlyTax,
        martyrs,
        totalOtherDeductions,
        totalAllDeductions,
        net
    };
}

module.exports = { runPayrollLogic };

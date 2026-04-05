const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualProjected) {
    let tax = 0;
    const ai = annualProjected; 
    
    // تحديد الشريحة الصفرية (المعفاة) بناءً على إجمالي الدخل السنوي
    let start0 = 40000;
    if (ai > 1200000) start0 = 0;
    else if (ai > 900000) start0 = 0;
    else if (ai > 800000) start0 = 0;
    else if (ai > 700000) start0 = 0;
    else if (ai > 600000) start0 = 0;

    let remainder = ai - start0;
    if (remainder <= 0) return 0;

    const brackets = [
        { limit: 15000, rate: 0.10 },
        { limit: 15000, rate: 0.15 },
        { limit: 130000, rate: 0.20 },
        { limit: 200000, rate: 0.225 },
        { limit: 800000, rate: 0.25 },
        { limit: Infinity, rate: 0.275 }
    ];

    for (let b of brackets) {
        if (remainder <= 0) break;
        let chunk = Math.min(remainder, b.limit);
        tax += chunk * b.rate;
        remainder -= chunk;
    }
    return tax;
}

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
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    const totalDaysYTD = days + (prev.pDays || 0);
    const totalTaxableYTD = currentTaxable + (prev.pTaxable || 0);
    
    // --- تطبيق معادلة الإكسيل بالحرف ---
    // AH7/AF7*360 => (totalTaxableYTD / totalDaysYTD) * 360
    const rawAnnual = (totalTaxableYTD / totalDaysYTD) * 360;
    
    // FLOOR(..., 10) => التقريب السنوي للأقل
    const floorAnnual = Math.floor(rawAnnual / 10) * 10;
    
    // AI7 = (FLOOR...) / 360 * AF7
    // دي الخطوة اللي كانت ناقصة: تحويل الرقم السنوي لرقم متناسب مع أيام الفترة
    const taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    
    // الضريبة السنوية بتتحسب دايماً على الـ Floor السنوي (كأن الموظف هيكمل السنة كدة)
    const totalAnnualTax = calculateEgyptianTax(floorAnnual);
    
    // AQ7 = الضريبة المستحقة للفترة الحالية
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);
    
    // ضريبة الشهر = AQ7 - AR7 (الشهور السابقة)
    const monthlyTax = R(Math.max(0, taxUntilNow - (prev.pTaxes || 0)));

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
        taxPoolYTD: taxPoolYTD, // ده الـ AI7 النهائي
        annualProjected: floorAnnual, // ده الـ Floor اللي جوة المعادلة
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

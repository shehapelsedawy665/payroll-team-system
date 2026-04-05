const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualProjected) {
    let tax = 0;
    const ai = annualProjected; 
    
    // شريحة الصفر (40,000) بتتلغي لو الدخل السنوي عدى 600,000
    let start0 = ai > 600000 ? 0 : 40000;

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
    
    // 1. الحسبة الشهرية (Prorated)
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 2. التأمينات (Employee 11%)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // 3. وعاء الضريبة (Taxable Income)
    const martyrs = R(gross * 0.0005);
    const personalExemption = R((20000 / 360) * days); 
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    // 4. التراكمي (YTD) بناءً على التاريخ السابق
    const totalDaysYTD = days + (prev.pDays || 0);
    const totalTaxableYTD = R(currentTaxable + (prev.pTaxable || 0)); // AH7
    
    // --- تطبيق معادلة الإكسيل بالحرف الواحد ---
    // AI7 = FLOOR(AH7 / AF7 * 360, 10) / 360 * AF7
    
    // الخطوة أ: حساب السنوي الخام وتقريبه لـ 2 decimal عشان الـ Floor يظبط
    const rawAnnual = R((totalTaxableYTD / totalDaysYTD) * 360);
    
    // الخطوة ب: الـ Floor السنوي لأقرب 10 جنيه للأقل
    const floorAnnual = Math.floor(rawAnnual / 10) * 10;
    
    // الخطوة ج: الـ Taxpool النهائي (متناسب مع الأيام)
    const taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    
    // 5. حساب الضريبة المستحقة
    const totalAnnualTax = calculateEgyptianTax(floorAnnual);
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD); // AQ7
    
    // ضريبة الشهر الحالي (AQ7 - الضريبة المسددة سابقاً)
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
        taxPoolYTD: taxPoolYTD,      // سيظهر 46,435.97 في مارس
        annualProjected: floorAnnual, // الـ Floor السنوي (مثل 196,650)
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

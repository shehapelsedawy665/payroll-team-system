const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualProjected) {
    let tax = 0;
    const ai = annualProjected; 
    
    let start0 = 40000;
    if (ai > 600000) start0 = 0; // حسب معادلات الإكسيل اللي بعتها للشرائح

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
    
    // 1. Prorated Salaries
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 2. Insurance
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // 3. Taxable Income
    const martyrs = R(gross * 0.0005);
    const personalExemption = R((20000 / 360) * days); 
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    // 4. Cumulative Data
    const totalDaysYTD = days + (prev.pDays || 0);
    const totalTaxableYTD = currentTaxable + (prev.pTaxable || 0);
    
    // --- التصحيح القاتل لمطابقة الإكسيل ---
    
    // الخطوة 1: حساب الـ Annual Projected (الرقم السنوي قبل الـ Floor)
    const rawAnnual = (totalTaxableYTD / totalDaysYTD) * 360;
    
    // الخطوة 2: عمل الـ Floor لأقرب 10 جنيه (زي الإكسيل بالظبط)
    // FLOOR(AH7/AF7*360, 10)
    const floorAnnual = Math.floor(R(rawAnnual) / 10) * 10;
    
    // الخطوة 3: حساب الـ Taxpool YTD (الـ AI7 في الإكسيل)
    // AI7 = FLOOR(...) / 360 * AF7
    // ملحوظة: لازم نستخدم R() هنا عشان الكسور تطلع زي الإكسيل (46,435.97)
    const taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    
    // 5. Tax Calculation
    const totalAnnualTax = calculateEgyptianTax(floorAnnual);
    
    // AQ7: الضريبة المستحقة للفترة
    // AQ7 = totalAnnualTax / 360 * totalDaysYTD
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);
    
    // ضريبة الشهر = AQ7 - AR7
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
        taxPoolYTD: taxPoolYTD, // هيطلع 46,435.97
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

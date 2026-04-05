const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualProjected) {
    let tax = 0;
    const ai = annualProjected; 

    // الشريحة المعفاة الأساسية (تعديل 2024)
    let start0 = 40000; 

    // تحديد الخصومات على الشريحة الأولى بناءً على الدخل السنوي (AI7)
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
    
    // 1. Prorated Salaries
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 2. Insurance (11% with Limits)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // 3. Taxable Income (Current Month)
    const martyrs = R(gross * 0.0005);
    // الإعفاء الشخصي الـ 20,000 لازم يتحسب بنسبة الأيام للشهر الحالي
    const personalExemption = R((20000 / 360) * days); 
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    // 4. Cumulative Logic (YTD)
    const totalDaysYTD = days + (prev.pDays || 0);
    const totalTaxableYTD = currentTaxable + (prev.pTaxable || 0);
    
    // 5. THE FIX: Tax Pool (Annual Projected AI7)
    // المعادلة: (Total Taxable / Total Days) * 360 ثم عمل Floor لأقرب 10
    const rawAnnual = (totalTaxableYTD / totalDaysYTD) * 360;
    const annualProjected = Math.floor(rawAnnual / 10) * 10;
    
    // 6. Tax Calculation
    const totalAnnualTax = calculateEgyptianTax(annualProjected);
    
    // الضريبة التراكمية المستحقة حتى تاريخه (AQ7)
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);
    
    // ضريبة الشهر الحالي (Monthly Tax = AQ7 - AR7)
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
        taxPoolYTD: totalTaxableYTD,
        annualProjected, // ده الـ AI7
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

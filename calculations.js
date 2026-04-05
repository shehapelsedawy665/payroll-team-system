const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualProjected) {
    let tax = 0;
    const ai = annualProjected; 
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
    
    // S9: Gross (Prorated)
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // AV9: Insurance Employee (11%)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // AE9: Days of current month
    const currentDays = days;

    // حساب الإعفاء الشخصي بناءً على نوع العقد (AC9)
    // IF(AC9=4, 30000, 20000)
    const exemptionBase = emp.jobType === "Special" ? 30000 : 20000; 
    const personalExemption = R((exemptionBase / 360) * currentDays);

    // --- تطبيق معادلة Taxable المعقدة ---
    // الجزء الأساسي: ROUND(S9,2) - ROUND(AV9,2) - personalExemption
    let baseTaxable = R(gross - insuranceEmployee - personalExemption);

    // حساب الـ Insurance Deduction (الـ 15% أو الـ 10,000/12)
    // AX9 هي قيمة التأمين الطبي/الحياة المدفوعة
    const medicalLifeInsurance = deductions.find(d => d.name.includes("Insurance"))?.amount || 0;
    let insDeduction = 0;
    
    if (gross > 0) {
        let fifteenPercent = R(baseTaxable * 0.15);
        let cap = R(10000 / 12);
        insDeduction = Math.min(medicalLifeInsurance, fifteenPercent, cap);
    }
    
    // AH9: Taxable final
    const currentTaxable = R(baseTaxable - insDeduction);
    
    // 4. التراكمي (YTD)
    const totalDaysYTD = currentDays + (prev.pDays || 0);
    const totalTaxableYTD = R(currentTaxable + (prev.pTaxable || 0));
    
    // 5. تطبيق معادلة Tax Pool (AI7)
    const rawAnnual = R((totalTaxableYTD / totalDaysYTD) * 360);
    const floorAnnual = Math.floor(rawAnnual / 10) * 10;
    const taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    
    // 6. الضرائب
    const totalAnnualTax = calculateEgyptianTax(floorAnnual);
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);
    const monthlyTax = R(Math.max(0, taxUntilNow - (prev.pTaxes || 0)));

    const martyrs = R(gross * 0.0005);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    return {
        fullBasic, fullTrans, days, 
        proratedBasic, proratedTrans, 
        totalAdditions, gross,
        insBase, insuranceEmployee,
        totalDaysYTD,
        currentTaxable,
        taxPoolYTD: taxPoolYTD,
        annualProjected: floorAnnual,
        monthlyTax,
        net
    };
}

module.exports = { runPayrollLogic };

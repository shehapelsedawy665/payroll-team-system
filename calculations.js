// دالة التقريب لقرشين (زي الإكسيل بالضبط)
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
    
    // 1. حساب الـ Gross وتقريبه (S9)
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 2. التأمينات وتقريبها (AV9)
    const insBase = Math.max(7000 / 1.3, Math.min(16700, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // 3. الإعفاء وتقريبه
    const exemptionBase = emp.jobType === "Special" ? 30000 : 20000; 
    const personalExemption = R((exemptionBase / 360) * days);

    // 4. الـ TAXABLE (الخلية AH9) - أهم خطوة
    // لازم التقريب هنا يكون صارم عشان يطلع الـ 13,444.45
    const currentTaxable = R(gross - insuranceEmployee - personalExemption);
    
    // 5. التراكمي (YTD)
    const totalDaysYTD = days + (Number(prev.pDays) || 0);
    const totalTaxableYTD = R(currentTaxable + (Number(prev.pTaxable) || 0)); // AH7
    
    // 6. معادلة الـ TAXPOOL (AI7) - تطبيق حرفي لمعادلة الإكسيل
    // FLOOR(AH7/AF7*360, 10)
    const rawAnnual = R((totalTaxableYTD / totalDaysYTD) * 360);
    const floorAnnual = Math.floor(rawAnnual / 10) * 10;
    
    // AI7 = (FLOOR / 360) * AF7
    const taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    
    // 7. الضرائب
    const totalAnnualTax = calculateEgyptianTax(floorAnnual);
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);
    const monthlyTax = R(Math.max(0, taxUntilNow - (Number(prev.pTaxes) || 0)));

    const martyrs = R(gross * 0.0005);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    return {
        proratedBasic,
        proratedTrans,
        gross,
        insuranceEmployee,
        currentTaxable, // هيطلع 13,444.45
        taxPoolYTD,     // هيطلع 46,435.97
        annualProjected: floorAnnual, // هيطلع 196,650
        monthlyTax,
        net,
        // للتخزين في الداتا بيز
        taxPoolYTD_Value: totalTaxableYTD,
        daysYTD_Value: totalDaysYTD
    };
}

module.exports = { runPayrollLogic };

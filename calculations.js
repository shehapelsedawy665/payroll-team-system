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
    
    // الأرقام الأساسية
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // التأمينات
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // الإعفاء الشخصي (حسب معادلتك الجديدة)
    const exemptionBase = emp.jobType === "Special" ? 30000 : 20000; 
    const personalExemption = R((exemptionBase / 360) * days);

    // الوعاء الضريبي (Taxable)
    const currentTaxable = R(Math.max(0, gross - insuranceEmployee - personalExemption));
    
    // التراكمي (YTD)
    const totalDaysYTD = days + (Number(prev.pDays) || 0);
    const totalTaxableYTD = R(currentTaxable + (Number(prev.pTaxable) || 0));
    
    // معادلة الإكسيل للـ Tax Pool
    const rawAnnual = R((totalTaxableYTD / totalDaysYTD) * 360);
    const floorAnnual = Math.floor(rawAnnual / 10) * 10;
    const taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    
    // الضرائب السنوية والشهرية
    const totalAnnualTax = calculateEgyptianTax(floorAnnual);
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);
    const monthlyTax = R(Math.max(0, taxUntilNow - (Number(prev.pTaxes) || 0)));

    const martyrs = R(gross * 0.0005);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    // التعديل هنا: التأكد إن كل الأسامي مطابقة للي الجدول مستنيه في الـ UI
    return {
        fullBasic: Number(fullBasic),
        fullTrans: Number(fullTrans),
        days: Number(days),
        proratedBasic,
        proratedTrans,
        totalAdditions,
        gross,
        insBase,
        insuranceEmployee,
        currentTaxable,
        taxPoolYTD, // AI7
        annualProjected: floorAnnual, // Floor Ann
        monthlyTax,
        martyrs,
        totalAllDeductions,
        net,
        // بيانات التراكمي للشهر الجاي
        taxPoolYTD_Cumulative: totalTaxableYTD, 
        daysYTD: totalDaysYTD
    };
}

module.exports = { runPayrollLogic };

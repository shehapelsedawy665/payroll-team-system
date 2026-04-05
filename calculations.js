const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualProjected, daysYTD) {
    let tax = 0;
    const ai = annualProjected; // AI7 في الإكسيل
    const af = daysYTD;        // AF7 في الإكسيل
    const dayRatio = af / 360;

    // 1. تحديد بداية الشرائح بناءً على إجمالي الدخل السنوي (إلغاء الشريحة المعفاة تدريجياً)
    let start0 = 40000 * dayRatio;
    let start10 = 15000 * dayRatio;
    let start15 = 15000 * dayRatio;
    let start20 = 140000 * dayRatio; // 130k + 10k logic
    let start225 = 200000 * dayRatio;
    let start25 = 800000 * dayRatio;

    // معادلة Excel للـ 0%
    let bracket0 = 0;
    if (ai > 600000 * dayRatio) {
        bracket0 = 0;
    } else {
        bracket0 = 40000 * dayRatio;
    }

    // معادلة Excel للـ 10% (AK7)
    let ak7 = 0;
    if (ai > 600000 * dayRatio && ai <= 700000 * dayRatio) {
        ak7 = (55000 * dayRatio) * 0.1;
    } else if (ai > 700000 * dayRatio) {
        ak7 = 0;
    } else {
        let taxableFor10 = Math.min(ai - bracket0, 15000 * dayRatio);
        ak7 = Math.max(0, taxableFor10 * 0.1);
    }

    // معادلة Excel للـ 15% (AL7)
    let al7 = 0;
    if (ai > 700000 * dayRatio && ai <= 800000 * dayRatio) {
        al7 = (70000 * dayRatio) * 0.15;
    } else if (ai > 800000 * dayRatio) {
        al7 = 0;
    } else {
        let taxableFor15 = Math.min(ai - bracket0 - (ak7 / 0.1), 15000 * dayRatio);
        al7 = Math.max(0, taxableFor15 * 0.15);
    }

    // معادلة Excel للـ 20% (AM7)
    let am7 = 0;
    if (ai > 800000 * dayRatio && ai <= 900000 * dayRatio) {
        am7 = (200000 * dayRatio) * 0.2;
    } else if (ai > 900000 * dayRatio) {
        am7 = 0;
    } else {
        let taxableFor20 = Math.min(ai - bracket0 - (ak7 / 0.1) - (al7 / 0.15), 130000 * dayRatio);
        am7 = Math.max(0, taxableFor20 * 0.2);
    }

    // معادلة Excel للـ 22.5% (AN7)
    let an7 = 0;
    if (ai > 900000 * dayRatio && ai <= 1200000 * dayRatio) {
        an7 = (400000 * dayRatio) * 0.225;
    } else if (ai > 1200000 * dayRatio) {
        an7 = 0;
    } else {
        let taxableFor225 = Math.min(ai - bracket0 - (ak7/0.1) - (al7/0.15) - (am7/0.2), 200000 * dayRatio);
        an7 = Math.max(0, taxableFor225 * 0.225);
    }

    // معادلة Excel للـ 25% (AO7)
    let ao7 = 0;
    if (ai > 1200000 * dayRatio) {
        ao7 = (1200000 * dayRatio) * 0.25;
    } else {
        let taxableFor25 = Math.min(ai - bracket0 - (ak7/0.1) - (al7/0.15) - (am7/0.2) - (an7/0.225), 800000 * dayRatio);
        ao7 = Math.max(0, taxableFor25 * 0.25);
    }

    // معادلة Excel للـ 27.5% (AP7)
    let ap7 = 0;
    if (ai > 1200000 * dayRatio) {
        ap7 = (ai - 1200000 * dayRatio) * 0.275;
    } else {
        ap7 = 0;
    }

    return ak7 + al7 + am7 + an7 + ao7 + ap7;
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
    
    // معادلة Tax Pool من الإكسيل (AI7)
    // FLOOR(AH7/AF7*360, 10)
    const annualProjected = Math.floor((totalTaxableYTD / totalDaysYTD * 360) / 10) * 10;
    
    // حساب إجمالي الضرائب بناءً على الشرائح
    const totalAnnualTax = calculateEgyptianTax(annualProjected, 360); // الحسبة السنوية
    
    // AQ7: الضريبة المستحقة حتى الآن (التراكمية)
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);
    
    // Taxes of the month: AQ7 - AR7
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
        annualProjected,
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

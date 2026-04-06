const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * المحرك المالي لرواتب ERP (قانون العمل والضرائب المصري 2024/2025)
 */
function runPayrollLogic(input, prev, emp, settings = {}) {
    const { 
        fullBasic = 0, 
        fullTrans = 0, 
        days: manualDays, 
        additions = [], 
        deductions = [], 
        month 
    } = input;

    // 1. استخراج الإعدادات (مع قيم افتراضية قانونية)
    const insEEPercent = settings.insEmployeePercent || 0.11;
    const maxInsLimit = settings.maxInsSalary || 16700;
    const minInsLimit = settings.minInsSalary || 2325;
    const annualPersonalExemption = settings.personalExemption || 20000; 

    // 2. حساب الأيام الفعلية (Standard 30 days)
    let finalDays = (manualDays !== undefined) ? Number(manualDays) : 30;
    if (finalDays > 30) finalDays = 30;

    // 3. التأمينات الاجتماعية (Social Insurance)
    // تعتمد على "أجر الاشتراك" المسجل للموظف
    let insSalary = Math.min(Math.max(Number(emp.insSalary) || 0, minInsLimit), maxInsLimit);
    const insuranceEmployee = R(insSalary * insEEPercent);

    // 4. الحسابات المالية للشهر الحالي
    const proratedBasic = R((fullBasic / 30) * finalDays);
    const proratedTrans = R((fullTrans / 30) * finalDays);
    
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 5. الوعاء الضريبي (Taxable Pool)
    const taxableAdditions = additions.reduce((sum, item) => {
        return sum + (item.type !== 'exempted' ? (Number(item.amount) || 0) : 0);
    }, 0);
    
    // الوعاء = (المستحق الخاضع) - التأمينات
    const currentTaxable = Math.max(0, (proratedBasic + proratedTrans + taxableAdditions) - insuranceEmployee);

    // 6. المنطق التراكمي (YTD Logic) - لربط الشهور ببعضها
    const pDays = Number(prev?.pDays) || 0;
    const pTaxable = Number(prev?.pTaxable) || 0;
    const pTaxes = Number(prev?.pTaxes) || 0;

    const totalDaysSoFar = pDays + finalDays; 
    const totalTaxableSoFar = pTaxable + currentTaxable;

    // توقع السنوي بناءً على متوسط الأيام المنقضية
    const avgDailyTaxable = totalDaysSoFar > 0 ? (totalTaxableSoFar / totalDaysSoFar) : 0;
    const estimatedAnnualTaxable = (avgDailyTaxable * 360) - annualPersonalExemption;
    const finalAnnualTaxable = Math.floor(Math.max(0, estimatedAnnualTaxable) / 10) * 10;

    // 7. دالة شرائح الضرائب (آخر تحديث 2024)
    function calculateAnnualTax(taxable) {
        if (taxable <= 40000) return 0;
        let tax = 0;
        let remaining = taxable;
        const slabs = [
            { limit: 40000, rate: 0 }, 
            { limit: 15000, rate: 0.10 },
            { limit: 15000, rate: 0.15 }, 
            { limit: 130000, rate: 0.20 },
            { limit: 200000, rate: 0.225 }, 
            { limit: 400000, rate: 0.25 }
        ];

        // في حالة الدخول في الشريحة الأعلى (أكثر من 1.2 مليون)
        if (taxable > 1200000) return (taxable - 1200000) * 0.275 + 306500;

        for (let s of slabs) {
            let chunk = Math.min(remaining, s.limit);
            tax += chunk * s.rate;
            remaining -= chunk;
            if (remaining <= 0) break;
        }
        if (remaining > 0) tax += remaining * 0.275;
        return tax;
    }

    const totalAnnualTax = calculateAnnualTax(finalAnnualTaxable);
    
    // 8. تسوية الضريبة (Tax Settlement)
    const totalTaxDueUntilNow = (totalAnnualTax / 360) * totalDaysSoFar;
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - pTaxes));

    // 9. الاستقطاعات الأخرى (صندوق الشهداء + يدوي)
    const martyrs = R(gross * 0.0005); 
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    
    const net = R(gross - (insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions));

    return {
        fullBasic, fullTrans, days: finalDays, 
        proratedBasic, proratedTrans, gross,
        insuranceEmployee, monthlyTax, martyrs, 
        totalOtherDeductions, net,
        currentTaxable, 
        annualTaxable: finalAnnualTaxable
    };
}

/**
 * دالة تحويل الصافي لإجمالي (Net to Gross)
 */
function calculateNetToGross(targetNet, input, prev, emp, settings) {
    if (!targetNet || targetNet <= 0) return 0;
    let low = targetNet;
    let high = targetNet * 5; // نطاق بحث واسع
    let estimatedGross = targetNet;
    let attempts = 0;
    
    while (attempts < 50) {
        let testInput = { ...input, fullBasic: estimatedGross, fullTrans: 0, additions: [], deductions: [], days: 30 };
        let result = runPayrollLogic(testInput, prev, { ...emp, insSalary: estimatedGross }, settings);
        
        if (Math.abs(result.net - targetNet) < 0.01) break;
        if (result.net < targetNet) low = estimatedGross; else high = estimatedGross;
        estimatedGross = (low + high) / 2;
        attempts++;
    }
    return R(estimatedGross);
}

module.exports = { runPayrollLogic, calculateNetToGross };

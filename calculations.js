const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp, settings = {}) {
    const { 
        fullBasic, fullTrans, days: manualDays, 
        additions = [], deductions = [], month
    } = input;

    // 1. الإعدادات
    const insEEPercent = settings.insEmployeePercent || 0.11;
    const maxInsLimit = settings.maxInsSalary || 16700;
    const minInsLimit = settings.minInsSalary || 2325;
    const annualPersonalExemption = settings.personalExemption || 20000; 

    // 2. حساب الأيام (مارس = 25 يوم)
    let finalDays = (manualDays !== undefined) ? Number(manualDays) : 30;
    if (finalDays > 30) finalDays = 30;

    // 3. التأمينات (ثابتة على أجر الاشتراك)
    let insSalary = Math.min(Math.max(Number(emp.insSalary) || 0, minInsLimit), maxInsLimit);
    const insuranceEmployee = R(insSalary * insEEPercent);

    // 4. الحسابات المالية الفعلية للشهر
    const proratedBasic = R((fullBasic / 30) * finalDays);
    const proratedTrans = R((fullTrans / 30) * finalDays);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 5. الوعاء الضريبي الفعلي (Taxable)
    const taxableAdditions = additions.reduce((sum, item) => {
        return sum + (item.type !== 'exempted' ? (Number(item.amount) || 0) : 0);
    }, 0);
    // الوعاء = (الأساسي + الانتقالات + الإضافي) - التأمينات
    const currentTaxable = Math.max(0, (proratedBasic + proratedTrans + taxableAdditions) - insuranceEmployee);

    // 6. المنطق التراكمي (YTD) - لربط مارس بيناير وفبراير
    const pDays = Number(prev?.pDays) || 0;
    const pTaxable = Number(prev?.pTaxable) || 0;
    const pTaxes = Number(prev?.pTaxes) || 0;

    const totalDaysSoFar = pDays + finalDays; // هتبقى 85 يوم في حالة مارس
    const totalTaxableSoFar = pTaxable + currentTaxable;

    // حساب السنوي المتوقع بناءً على الأيام المنقضية
    // المعادلة: (إجمالي الوعاء ÷ أيام العمل) * 360 يوم - الإعفاء الشخصي
    const avgDailyTaxable = totalTaxableSoFar / totalDaysSoFar;
    const estimatedAnnualTaxable = (avgDailyTaxable * 360) - annualPersonalExemption;
    const finalAnnualTaxable = Math.floor(Math.max(0, estimatedAnnualTaxable) / 10) * 10;

    // 7. دالة الشرائح (قانون 2024)
    function calculateAnnualTax(taxable) {
        if (taxable <= 40000) return 0;
        let tax = 0;
        let remaining = taxable;
        const slabs = [
            { limit: 40000, rate: 0 }, { limit: 15000, rate: 0.10 },
            { limit: 15000, rate: 0.15 }, { limit: 130000, rate: 0.20 },
            { limit: 200000, rate: 0.225 }, { limit: 400000, rate: 0.25 }
        ];
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
    // نصيب الفترة الحالية من الضريبة السنوية = (الضريبة السنوية ÷ 360) * إجمالي الأيام
    const totalTaxDueUntilNow = (totalAnnualTax / 360) * totalDaysSoFar;
    
    // ضريبة الشهر = المستحق الكلي - اللي اتدفع قبل كدة
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - pTaxes));

    // 9. الصافي
    const martyrs = R(gross * 0.0005);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const net = R(gross - (insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions));

    return {
        fullBasic, fullTrans, days: finalDays, 
        proratedBasic, proratedTrans, gross,
        insuranceEmployee, monthlyTax, martyrs, 
        totalOtherDeductions, net,
        currentTaxable, // لازم يرجع عشان الـ server.js يخزنه في الـ DB
        annualTaxable: finalAnnualTaxable
    };
}

function calculateNetToGross(targetNet, input, prev, emp, settings) {
    if (!targetNet || targetNet <= 0) return 0;
    let low = targetNet;
    let high = targetNet * 5;
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

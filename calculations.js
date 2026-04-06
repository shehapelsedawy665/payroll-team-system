const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * المحرك المالي لرواتب ERP - Seday Core V2
 * تحديث 2026: دعم التأمين الطبي، الإعفاءات الضريبية، والأعمدة الديناميكية
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

    // 1. استخراج الإعدادات
    const insEEPercent = settings.insEmployeePercent || 0.11;
    const maxInsLimit = settings.maxInsSalary || 16700;
    const minInsLimit = settings.minInsSalary || 2325;
    const annualPersonalExemption = settings.personalExemption || 20000;
    // حد الإعفاء الطبي الشهري (10000 / 12)
    const monthlyMedicalLimit = R(10000 / 12); 

    // 2. حساب الأيام الفعلية
    let finalDays = (manualDays !== undefined) ? Number(manualDays) : 30;
    if (finalDays > 30) finalDays = 30;

    // 3. التأمينات الاجتماعية
    let insSalary = Math.min(Math.max(Number(emp.insSalary) || 0, minInsLimit), maxInsLimit);
    const insuranceEmployee = R(insSalary * insEEPercent);

    // 4. الحسابات المالية (Gross Salary)
    const proratedBasic = R((fullBasic / 30) * finalDays);
    const proratedTrans = R((fullTrans / 30) * finalDays);
    
    // حساب إجمالي الإضافات (Additions)
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 5. منطق الإعفاءات الضريبية (Exempted vs Non-Exempted)
    // البنود الـ Non-Exempted هي اللي بتدخل في الوعاء الضريبي (Taxable)
    const taxableAdditions = additions.reduce((sum, item) => {
        return sum + (item.type === 'Non-Exempted' ? (Number(item.amount) || 0) : 0);
    }, 0);

    // حساب وعاء الضريبة المبدئي قبل خصم الميديكال
    let taxableBaseBeforeMedical = (proratedBasic + proratedTrans + taxableAdditions) - insuranceEmployee;
    taxableBaseBeforeMedical = Math.max(0, taxableBaseBeforeMedical);

    // 6. معادلة التأمين الطبي (Medical Insurance Rule)
    let medicalExemption = 0;
    const medicalDeductions = deductions.filter(d => d.isMedical && d.type === 'Exempted');
    
    if (medicalDeductions.length > 0) {
        const actualMedicalAmount = medicalDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        // القاعدة: الأقل من (15% من الوعاء) أو (الحد الأقصى 833.33)
        const fifteenPercentLimit = R(taxableBaseBeforeMedical * 0.15);
        medicalExemption = Math.min(actualMedicalAmount, fifteenPercentLimit, monthlyMedicalLimit);
    }

    // الوعاء الضريبي النهائي للشهر
    const currentTaxable = Math.max(0, taxableBaseBeforeMedical - medicalExemption);

    // 7. المنطق التراكمي (YTD Logic)
    const pDays = Number(prev?.pDays) || 0;
    const pTaxable = Number(prev?.pTaxable) || 0;
    const pTaxes = Number(prev?.pTaxes) || 0;

    const totalDaysSoFar = pDays + finalDays; 
    const totalTaxableSoFar = pTaxable + currentTaxable;

    const avgDailyTaxable = totalDaysSoFar > 0 ? (totalTaxableSoFar / totalDaysSoFar) : 0;
    const estimatedAnnualTaxable = (avgDailyTaxable * 360) - annualPersonalExemption;
    const finalAnnualTaxable = Math.floor(Math.max(0, estimatedAnnualTaxable) / 10) * 10;

    // 8. دالة شرائح الضرائب 2024/2025
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
    const totalTaxDueUntilNow = (totalAnnualTax / 360) * totalDaysSoFar;
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - pTaxes));

    // 9. الاستقطاعات والنتيجة النهائية (Net Salary)
    const martyrs = R(gross * 0.0005); 
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    
    const net = R(gross - (insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions));

    // إرجاع البيانات مع دعم الأعمدة الديناميكية (Additions/Deductions Map)
    const dynamicColumns = {};
    additions.forEach(a => dynamicColumns[`add_${a.name}`] = a.amount);
    deductions.forEach(d => dynamicColumns[`ded_${d.name}`] = d.amount);

    return {
        fullBasic, fullTrans, days: finalDays, 
        proratedBasic, proratedTrans, gross,
        insuranceEmployee, monthlyTax, martyrs, 
        totalOtherDeductions, net,
        currentTaxable, 
        annualTaxable: finalAnnualTaxable,
        insBase: insSalary,
        ...dynamicColumns // لزيادة الأعمدة تلقائياً في الجدول
    };
}

/**
 * دالة تحويل الصافي لإجمالي (Net to Gross)
 */
function calculateNetToGross(targetNet, input, prev, emp, settings) {
    if (!targetNet || targetNet <= 0) return { grossSalary: 0, monthlyTax: 0, insuranceEmployee: 0, insBase: 0 };
    let low = targetNet;
    let high = targetNet * 5; 
    let estimatedGross = targetNet;
    let finalResult = {};
    let attempts = 0;
    
    while (attempts < 50) {
        let testInput = { ...input, fullBasic: estimatedGross, fullTrans: 0, additions: [], deductions: [], days: 30 };
        let result = runPayrollLogic(testInput, prev, { ...emp, insSalary: estimatedGross }, settings);
        finalResult = result;
        
        if (Math.abs(result.net - targetNet) < 0.1) break;
        if (result.net < targetNet) low = estimatedGross; else high = estimatedGross;
        estimatedGross = (low + high) / 2;
        attempts++;
    }
    return {
        grossSalary: R(estimatedGross),
        monthlyTax: finalResult.monthlyTax,
        insuranceEmployee: finalResult.insuranceEmployee,
        insBase: finalResult.insBase
    };
}

module.exports = { runPayrollLogic, calculateNetToGross };

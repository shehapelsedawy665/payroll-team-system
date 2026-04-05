const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * @param {Object} input - بيانات الشهر الحالي
 * @param {Object} prev - بيانات الشهور السابقة (YTD)
 * @param {Object} emp - بيانات الموظف (التأمينات)
 * @param {Object} settings - إعدادات الشركة الديناميكية
 */
function runPayrollLogic(input, prev, emp, settings = {}) {
    const { 
        fullBasic, 
        fullTrans, 
        days: manualDays, 
        additions = [], 
        deductions = [],
        hiringDate,      
        resignationDate, 
        month            
    } = input;

    // --- [إعدادات ديناميكية] ---
    const insEEPercent = settings.insEmployeePercent || 0.11;
    const maxInsLimit = settings.maxInsSalary || 16700;
    const minInsLimit = settings.minInsSalary || 2325;
    const annualPersonalExemption = settings.personalExemption || 20000; 

    // --- [منطق التواريخ والأيام] ---
    const currentMonthDate = new Date(month + "-01");
    let rDate = resignationDate ? new Date(resignationDate) : null;
    
    if (rDate && rDate < currentMonthDate) {
        rDate = null; 
    }

    const hDate = hiringDate ? new Date(hiringDate) : null;
    let startDay = 1;
    if (hDate && hDate.getMonth() === currentMonthDate.getMonth() && hDate.getFullYear() === currentMonthDate.getFullYear()) {
        startDay = hDate.getDate();
    }
    let endDay = 30; 
    if (rDate && rDate.getMonth() === currentMonthDate.getMonth() && rDate.getFullYear() === currentMonthDate.getFullYear()) {
        endDay = rDate.getDate();
    }
    
    let autoDays = Math.max(0, endDay - startDay + 1);
    if (autoDays > 30) autoDays = 30;
    let finalDays = (manualDays !== undefined && Number(manualDays) !== 30) ? Number(manualDays) : autoDays;

    // --- [التأمينات] ---
    let insSalary = Number(emp.insSalary) || 0;
    if (insSalary > maxInsLimit) insSalary = maxInsLimit;
    if (insSalary < minInsLimit && insSalary > 0) insSalary = minInsLimit;
    
    const insuranceEmployee = R(insSalary * insEEPercent);

    // --- [الحسابات المالية الأساسية] ---
    const proratedBasic = R((fullBasic / 30) * finalDays);
    const proratedTrans = R((fullTrans / 30) * finalDays);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // --- [الوعاء الضريبي - تعديل الأيام الفنية] ---
    // لحساب الضريبة صح في حالة الـ 25 يوم، لازم نحسبها على "مرتب الشهر الكامل" أولاً
    const taxableAdditionsFull = additions.reduce((sum, item) => {
        return sum + (item.type !== 'exempted' ? (Number(item.amount) || 0) : 0);
    }, 0);

    // الوعاء الشهري الافتراضي (كأن الموظف اشتغل 30 يوم كاملة)
    const personalExemptionMonthly = R(annualPersonalExemption / 12);
    const fullMonthTaxable = Math.max(0, (fullBasic + fullTrans + taxableAdditionsFull) - insuranceEmployee - personalExemptionMonthly);
    
    // حساب الضريبة السنوية بناءً على دخل الشهر الكامل
    const annualTaxable = Math.floor((fullMonthTaxable * 12) / 10) * 10;

    // --- [حساب الضرائب - نظام الشرائح المصري 2024/2025] ---
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

        if (taxable > 1200000) {
            return (taxable - 1200000) * 0.275 + (800000 * 0.25) + (400000 * 0.225) + (130000 * 0.20) + (15000 * 0.15) + (15000 * 0.10); 
        }

        for (let i = 0; i < slabs.length; i++) {
            let chunk = Math.min(remaining, slabs[i].limit);
            tax += chunk * slabs[i].rate;
            remaining -= chunk;
            if (remaining <= 0) break;
        }

        if (remaining > 0) tax += remaining * 0.275;
        return tax;
    }

    const totalAnnualTax = calculateAnnualTax(annualTaxable);
    
    // الضريبة الشهرية "الكاملة"
    const fullMonthlyTax = totalAnnualTax / 12;

    // ضريبة الشهر "الفعلية" بناءً على أيام العمل (Pro-rata)
    const monthlyTax = R((fullMonthlyTax / 30) * finalDays);

    const martyrs = R(gross * 0.0005);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    return {
        fullBasic, fullTrans, days: finalDays, proratedBasic, proratedTrans,
        totalAdditions, gross, insuranceEmployee, monthlyTax, martyrs, 
        totalOtherDeductions, totalAllDeductions, net, 
        annualTaxable, resignationDate: rDate ? rDate.toISOString().split('T')[0] : ""
    };
}

// ... وظيفة الـ calculateNetToGross تظل كما هي ...
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

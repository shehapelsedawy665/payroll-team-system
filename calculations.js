const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp, settings = {}) {
    const { fullBasic = 0, fullTrans = 0, days: manualDays, additions = [], deductions = [] } = input;

    const insEEPercent = settings.insEmployeePercent || 0.11;
    const maxInsLimit = settings.maxInsSalary || 16700;
    const minInsLimit = settings.minInsSalary || 2325;
    const annualPersonalExemption = settings.personalExemption || 20000; 

    let finalDays = (manualDays !== undefined) ? Number(manualDays) : 30;
    if (finalDays > 30) finalDays = 30;

    let insSalary = Math.min(Math.max(Number(emp.insSalary) || 0, minInsLimit), maxInsLimit);
    const insuranceEmployee = R(insSalary * insEEPercent);

    const proratedBasic = R((fullBasic / 30) * finalDays);
    const proratedTrans = R((fullTrans / 30) * finalDays);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // الوعاء الضريبي مع معالجة الـ Medical
    let currentTaxable = (proratedBasic + proratedTrans) - insuranceEmployee;
    const medicalLimit = R(10000 / 12); 

    additions.forEach(item => {
        const amt = Number(item.amount) || 0;
        if (item.type !== 'exempted') {
            currentTaxable += amt;
        } else if (item.name.toLowerCase().includes('medical')) {
            const fifteenPct = R(currentTaxable * 0.15);
            currentTaxable -= Math.min(fifteenPct, medicalLimit);
        }
    });

    deductions.forEach(item => {
        if (item.type === 'exempted') currentTaxable -= (Number(item.amount) || 0);
    });

    currentTaxable = Math.max(0, currentTaxable);

    const pDays = Number(prev?.pDays) || 0;
    const pTaxable = Number(prev?.pTaxable) || 0;
    const pTaxes = Number(prev?.pTaxes) || 0;
    const totalDaysSoFar = pDays + finalDays; 
    const totalTaxableSoFar = pTaxable + currentTaxable;

    const avgDailyTaxable = totalDaysSoFar > 0 ? (totalTaxableSoFar / totalDaysSoFar) : 0;
    const estimatedAnnualTaxable = (avgDailyTaxable * 360) - annualPersonalExemption;
    const finalAnnualTaxable = Math.floor(Math.max(0, estimatedAnnualTaxable) / 10) * 10;

    function calculateAnnualTax(taxable) {
        if (taxable <= 40000) return 0;
        let tax = 0; let remaining = taxable;
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
    const totalTaxDueUntilNow = (totalAnnualTax / 360) * totalDaysSoFar;
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - pTaxes));

    const martyrs = R(gross * 0.0005); 
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const net = R(gross - (insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions));

    return {
        fullBasic, fullTrans, days: finalDays, gross,
        insuranceEmployee, monthlyTax, martyrs, 
        totalOtherDeductions, net, currentTaxable, 
        annualTaxable: finalAnnualTaxable,
        additionsData: additions, deductionsData: deductions
    };
}

function calculateNetToGross(targetNet, input, prev, emp, settings) {
    if (!targetNet || targetNet <= 0) return 0;
    let low = targetNet, high = targetNet * 5, estimatedGross = targetNet, attempts = 0;
    while (attempts < 50) {
        let testInput = { ...input, fullBasic: estimatedGross, days: 30 };
        let result = runPayrollLogic(testInput, prev, { ...emp, insSalary: estimatedGross }, settings);
        if (Math.abs(result.net - targetNet) < 0.01) break;
        if (result.net < targetNet) low = estimatedGross; else high = estimatedGross;
        estimatedGross = (low + high) / 2;
        attempts++;
    }
    return R(estimatedGross);
}

module.exports = { runPayrollLogic, calculateNetToGross };

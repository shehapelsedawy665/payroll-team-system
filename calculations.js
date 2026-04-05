const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualTaxable) {
    let tax = 0;
    let remainder = annualTaxable;
    const brackets = [
        { limit: 30000, rate: 0.00 }, { limit: 15000, rate: 0.10 },
        { limit: 15000, rate: 0.15 }, { limit: 140000, rate: 0.20 },
        { limit: 200000, rate: 0.225 }, { limit: 200000, rate: 0.25 },
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
    
    // 2. Sum Variables
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    
    // 3. Gross Calculation
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 4. Insurance (The Law Fix)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // 5. Taxes (Cumulative & Floor Logic)
    const martyrs = R(gross * 0.0005);
    const personalExemption = R((20000 / 360) * days); 
    
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    const totalDaysYTD = days + (prev.pDays || 0);
    const totalTaxableYTD = currentTaxable + (prev.pTaxable || 0);
    
    // السر: التقريب لأقرب 10 جنيه (Annual Projected)
    const annualProjected = Math.floor(((totalTaxableYTD / totalDaysYTD) * 360) / 10) * 10;
    
    const totalAnnualTax = calculateEgyptianTax(annualProjected);
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);
    const monthlyTax = R(Math.max(0, taxUntilNow - (prev.pTaxes || 0)));

    // 6. Final Net
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

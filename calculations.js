const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Function to calculate Egyptian tax based on brackets
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

// Main payroll calculation function
function runPayrollLogic(input, prev, emp) {
    const { fullBasic, fullTrans, days, additions = [], deductions = [] } = input;
    
    // Prorate basic and transportation based on days worked
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    
    // Sum additions and deductions
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    
    // Calculate gross salary
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // Insurance calculations
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // Other deductions
    const martyrs = R(gross * 0.0005);
    const personalExemption = R((20000 / 360) * days); 

    // Calculate current taxable income
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    // Year-to-date totals
    const totalDaysYTD = days + (prev.pDays || 0);
    const totalTaxableYTD = R(currentTaxable + (prev.pTaxable || 0));
    
    // Calculate annualized taxable income and floor it
    const rawAnnual = R((totalTaxableYTD / totalDaysYTD) * 360);
    const floorAnnual = Math.floor(rawAnnual / 10) * 10;
    
    // Tax pool for the year
    const taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    
    // Calculate total annual tax based on brackets
    const totalAnnualTax = calculateEgyptianTax(floorAnnual);
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);
    const monthlyTax = R(Math.max(0, taxUntilNow - (prev.pTaxes || 0)));

    // Total deductions
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);

    // Net salary
    const net = R(gross - totalAllDeductions);

    // Return all relevant data
    return {
        fullBasic,
        fullTrans,
        days,
        proratedBasic,
        proratedTrans,
        totalAdditions,
        gross,
        insBase,
        insuranceEmployee,
        prevDays: prev.pDays || 0,
        totalDaysYTD,
        prevTaxable: prev.pTaxable || 0,
        currentTaxable,
        taxPoolYTD,
        annualProjected: floorAnnual,
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

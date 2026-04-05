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

function runPayrollLogic(data, prev, emp) {
    const { basicGross, days } = data;
    
    // تأمينات (حسبة كاملة للمبلغ)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000/1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insAmt = R(insBase * 0.11);
    
    const actualGross = R((basicGross / 30) * days);
    const martyrs = R(actualGross * 0.0005);
    const personalExemption = R((20000 / 360) * days);
    
    // الحسبة التراكمية (YTD)
    const currentTaxable = Math.max(0, (actualGross - insAmt) - personalExemption);
    const totalDays = days + (prev.pDays || 0);
    const totalTaxable = currentTaxable + (prev.pTaxable || 0);
    
    // الإسقاط السنوي (Projected Annual)
    const annualProjected = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
    const annualTax = calculateEgyptianTax(annualProjected);
    
    const monthlyTax = R(Math.max(0, ((annualTax / 360) * totalDays) - (prev.pTaxes || 0)));
    const net = R(actualGross - insAmt - monthlyTax - martyrs);

    return { 
        gross: actualGross, 
        insurance: insAmt, 
        monthlyTax, 
        martyrs, 
        net, 
        taxableIncome: currentTaxable 
    };
}

module.exports = { runPayrollLogic };

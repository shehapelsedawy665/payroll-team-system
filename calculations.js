const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    const { fullBasic, fullTrans, days, additions = [], deductions = [] } = input;

    // Prorated salaries
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // Insurance (11% on capped base)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);

    // Martyrs tax (0.05% of gross)
    const martyrs = R(gross * 0.0005);

    // Personal exemption (20,000 EGP annualized – adjust if you need 30,000 for某些 cases)
    const personalExemption = R((20000 / 360) * days);

    // Current month taxable income
    const currentTaxable = R(Math.max(0, gross - insuranceEmployee - personalExemption));

    // Cumulative values from previous month
    const prevDays = Number(prev.pDays) || 0;
    const prevTaxable = Number(prev.pTaxable) || 0;
    const totalDaysYTD = days + prevDays;
    let totalTaxableYTD = R(currentTaxable + prevTaxable);
    // For tax pool, negative cumulative is treated as zero (Excel would error otherwise)
    const taxableForPool = Math.max(0, totalTaxableYTD);

    // ----- Tax Pool (AI7) exactly as Excel -----
    let taxPoolYTD;
    if (totalDaysYTD > 0) {
        let rawAnnual = (taxableForPool / totalDaysYTD) * 360;
        let floorAnnual = Math.floor(R(rawAnnual) / 10) * 10;
        taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    } else {
        // If days = 0, fallback to FLOOR(AH7*12,10) but then multiplied by zero days -> 0
        taxPoolYTD = 0;
    }

    // Helper: prorate an annual amount to YTD days
    const P = (annualAmount) => R((annualAmount / 360) * totalDaysYTD);

    // ----- Brackets (all using AI7 = taxPoolYTD, AF7 = totalDaysYTD) -----
    const AI = taxPoolYTD;
    const AF = totalDaysYTD;

    // 0% bracket (AJ7) – negative exemption amount
    let AJ = 0;
    if (AF > 0) {
        if (AI > P(600000)) AJ = 0;
        else AJ = -P(40000);
    }

    // 10% bracket (AK7)
    let AK = 0;
    if (AF > 0) {
        if (AI > P(600000) && AI <= P(700000)) {
            AK = R(P(55000) * 0.1);
        } else if (AI > P(700000)) {
            AK = 0;
        } else {
            let base = AI + AJ; // AJ is negative, so this subtracts exemption
            if (base <= P(15000)) AK = R(base * 0.1);
            else AK = R(P(15000) * 0.1);
        }
    }

    // 15% bracket (AL7)
    let AL = 0;
    if (AF > 0) {
        if (AI > P(700000) && AI <= P(800000)) {
            AL = R(P(70000) * 0.15);
        } else if (AI > P(800000)) {
            AL = 0;
        } else {
            let base = AI + AJ - (AK / 0.1);
            if (base <= P(15000)) AL = R(base * 0.15);
            else AL = R(P(15000) * 0.15);
        }
    }

    // 20% bracket (AM7)
    let AM = 0;
    if (AF > 0) {
        if (AI > P(800000) && AI <= P(900000)) {
            AM = R(P(200000) * 0.2);
        } else if (AI > P(900000)) {
            AM = 0;
        } else {
            let base = AI + AJ - (AK / 0.1) - (AL / 0.15);
            if (base <= P(130000)) AM = R(base * 0.2);
            else AM = R(P(130000) * 0.2);
        }
    }

    // 22.5% bracket (AN7)
    let AN = 0;
    if (AF > 0) {
        if (AI > P(900000) && AI <= P(1200000)) {
            AN = R(P(400000) * 0.225);
        } else if (AI > P(1200000)) {
            AN = 0;
        } else {
            let base = AI + AJ - (AK / 0.1) - (AL / 0.15) - (AM / 0.2);
            if (base <= P(200000)) AN = R(base * 0.225);
            else AN = R(P(200000) * 0.225);
        }
    }

    // 25% bracket (AO7)
    let AO = 0;
    if (AF > 0) {
        if (AI > P(1200000)) {
            AO = R(P(1200000) * 0.25);
        } else {
            let base = AI + AJ - (AK / 0.1) - (AL / 0.15) - (AM / 0.2) - (AN / 0.225);
            if (base <= P(800000)) AO = R(base * 0.25);
            else AO = R(P(800000) * 0.25);
        }
    }

    // 27.5% bracket (AP7)
    let AP = 0;
    if (AF > 0 && AI > P(1200000)) {
        AP = R((AI - P(1200000)) * 0.275);
    }

    // Total taxes YTD (AQ7)
    const totalTaxYTD = R(AK + AL + AM + AN + AO + AP);

    // Monthly tax (AS7)
    const prevTaxes = Number(prev.pTaxes) || 0;
    const monthlyTax = R(Math.max(0, totalTaxYTD - prevTaxes));

    // Final deductions and net
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    return {
        fullBasic, fullTrans, days,
        proratedBasic, proratedTrans,
        totalAdditions, gross,
        insBase, insuranceEmployee,
        prevDays,
        totalDaysYTD,
        prevTaxable,
        currentTaxable,
        taxPoolYTD,            // AI7 in Excel
        annualProjected: totalDaysYTD > 0 ? R((taxableForPool / totalDaysYTD) * 360) : 0,
        totalAnnualTax: totalTaxYTD,
        prevTaxes,
        monthlyTax,
        martyrs,
        totalOtherDeductions,
        totalAllDeductions,
        net
    };
}

module.exports = { runPayrollLogic };

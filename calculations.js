const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    // ----- 1. Basic prorations (same as Excel ROUND(S9,2) etc.) -----
    const { fullBasic, fullTrans, days, additions = [], deductions = [] } = input;
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    const totalAdditions = additions.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // ----- 2. Insurance (11% on base, capped) -----
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);          // Ins 11% column

    // ----- 3. Martyrs tax (0.05% of gross) -----
    const martyrs = R(gross * 0.0005);

    // ----- 4. Personal exemption (20,000 per year, prorated) -----
    const personalExemption = R((20000 / 360) * days);

    // ----- 5. Current month taxable (the "Taxable" column in your screenshot) -----
    const currentTaxable = R(Math.max(0, gross - insuranceEmployee - personalExemption));

    // ----- 6. Cumulative days and taxable (YTD) -----
    const prevDays = Number(prev.pDays) || 0;
    const prevTaxable = Number(prev.pTaxable) || 0;
    const totalDaysYTD = days + prevDays;                 // AF7
    let totalTaxableYTD = R(currentTaxable + prevTaxable); // AH7
    // Excel would show #NUM! if negative; we clamp to 0 for safety
    const taxableForPool = Math.max(0, totalTaxableYTD);

    // ----- 7. Tax Pool (AI7) exactly as your formula: -----
    // = (IFERROR(FLOOR(AH7/AF7*360,10), FLOOR(AH7*12,10))) / 360 * AF7
    let taxPoolYTD = 0;
    if (totalDaysYTD > 0) {
        let rawAnnual = (taxableForPool / totalDaysYTD) * 360;
        let floorAnnual = Math.floor(R(rawAnnual) / 10) * 10;
        taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    } else {
        // If days = 0, fallback to FLOOR(AH7*12,10) but then *0/360 = 0
        taxPoolYTD = 0;
    }

    // ----- 8. Brackets (AJ7 to AP7) exactly as your Excel formulas -----
    const AI = taxPoolYTD;      // AI7
    const AF = totalDaysYTD;    // AF7
    const P = (annual) => AF > 0 ? R((annual / 360) * AF) : 0; // prorated helper

    // AJ7 (0% bracket, negative exemption)
    let AJ = 0;
    if (AF > 0) {
        if (AI > P(600000)) AJ = 0;
        else AJ = -P(40000);
    }

    // AK7 (10% bracket)
    let AK = 0;
    if (AF > 0) {
        if (AI > P(600000) && AI <= P(700000)) {
            AK = R(P(55000) * 0.1);
        } else if (AI > P(700000)) {
            AK = 0;
        } else {
            let base = AI + AJ;   // AJ is negative
            if (base <= P(15000)) AK = R(base * 0.1);
            else AK = R(P(15000) * 0.1);
        }
    }

    // AL7 (15% bracket)
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

    // AM7 (20% bracket)
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

    // AN7 (22.5% bracket)
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

    // AO7 (25% bracket)
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

    // AP7 (27.5% bracket)
    let AP = 0;
    if (AF > 0 && AI > P(1200000)) {
        AP = R((AI - P(1200000)) * 0.275);
    }

    // ----- 9. Total taxes YTD (AQ7) and monthly tax (AS7) -----
    const totalTaxYTD = R(AK + AL + AM + AN + AO + AP);
    const prevTaxes = Number(prev.pTaxes) || 0;
    const monthlyTax = R(Math.max(0, totalTaxYTD - prevTaxes));

    // ----- 10. Final net salary -----
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    // ----- Return all values needed for reports -----
    return {
        // Inputs
        fullBasic, fullTrans, days,
        proratedBasic, proratedTrans,
        totalAdditions, gross,
        insBase, insuranceEmployee,
        // Cumulative
        prevDays,
        totalDaysYTD,
        prevTaxable,
        currentTaxable,
        // Excel matching columns
        taxPoolYTD,                // Pool YTD (AI7)
        floorAnnual: totalDaysYTD > 0 ? Math.floor(R((taxableForPool / totalDaysYTD) * 360) / 10) * 10 : 0,  // Floor Ann
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

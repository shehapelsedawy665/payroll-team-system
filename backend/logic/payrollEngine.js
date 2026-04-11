/**
 * @file backend/logic/payrollEngine.js
 * @description Advanced Egyptian Payroll Engine - HR-ERP
 * Includes: Gross-to-Net, Net-to-Gross (Iterative), Smart Tax Engine (2024/2026), Anomaly Detection
 */

// ---------------------------------------------------------------------------
// 1. Constants & Configuration (Egyptian Law 2024/2026)
// ---------------------------------------------------------------------------
const EGY_CONSTANTS = {
    PERSONAL_EXEMPTION_2024: 20000,
    SOCIAL_INSURANCE_EMP_RATE: 0.11,   // حصة الموظف 11%
    SOCIAL_INSURANCE_COMP_RATE: 0.1875, // حصة الشركة 18.75%
    MIN_INSURANCE_SALARY_2024: 2000,
    MAX_INSURANCE_SALARY_2024: 12600,
    MONTHS_IN_YEAR: 12
};

// شرائح الضرائب المصرية مع تطبيق قاعدة "خصم الشريحة المعفاة" للرواتب العليا
const calculateAnnualTax = (annualTaxableIncome) => {
    let tax = 0;
    let income = annualTaxableIncome;

    // تحديد الشريحة وتطبيق التعديلات حسب تجاوز الدخل للحدود
    let tierShift = 0;
    if (income > 1200000) tierShift = 4;
    else if (income > 1000000) tierShift = 3;
    else if (income > 900000) tierShift = 2;
    else if (income > 800000) tierShift = 1;
    else if (income > 600000) tierShift = 0.5; // إلغاء الشريحة المعفاة

    const brackets = [
        { limit: 40000, rate: tierShift >= 0.5 ? 0.10 : 0.00 }, // الشريحة الأولى
        { limit: 15000, rate: tierShift >= 1 ? 0.15 : 0.10 },   // من 40 لـ 55
        { limit: 15000, rate: tierShift >= 2 ? 0.20 : 0.15 },   // من 55 لـ 70
        { limit: 130000, rate: tierShift >= 3 ? 0.225 : 0.20 }, // من 70 لـ 200
        { limit: 200000, rate: tierShift >= 4 ? 0.25 : 0.225 }, // من 200 لـ 400
        { limit: 100000, rate: 0.25 },                          // من 400 لـ 500
        { limit: 700000, rate: 0.275 },                         // من 500 لـ 1.2 مليون
        { limit: Infinity, rate: 0.275 }                        // ما زاد عن 1.2 مليون
    ];

    let remainingIncome = income;

    for (let i = 0; i < brackets.length; i++) {
        if (remainingIncome <= 0) break;
        let taxableAtThisBracket = Math.min(remainingIncome, brackets[i].limit);
        tax += taxableAtThisBracket * brackets[i].rate;
        remainingIncome -= taxableAtThisBracket;
    }

    return tax;
};

// ---------------------------------------------------------------------------
// 2. Core Engine: Gross to Net Calculation
// ---------------------------------------------------------------------------
const calculateGrossToNet = (params) => {
    const {
        basicSalary,
        variableSalary = 0,
        allowances = 0,
        insSalary, 
        absentDays = 0,
        penaltyDays = 0,
        overtimeHours = 0,
        loanDeduction = 0,
        isTaxExempted = 0,
        companySettings = {} 
    } = params;

    const grossSalary = basicSalary + variableSalary + allowances;

    let actualInsSalary = Math.max(EGY_CONSTANTS.MIN_INSURANCE_SALARY_2024, Math.min(insSalary || 0, EGY_CONSTANTS.MAX_INSURANCE_SALARY_2024));
    const socialInsuranceEmpShare = actualInsSalary * EGY_CONSTANTS.SOCIAL_INSURANCE_EMP_RATE;
    const socialInsuranceCompShare = actualInsSalary * EGY_CONSTANTS.SOCIAL_INSURANCE_COMP_RATE;

    const monthCalcType = Number(companySettings.monthCalcType || 30);
    const dayRate = grossSalary / monthCalcType;
    const hourRate = dayRate / Number(companySettings.dailyWorkHours || 8);
    const absenceDeduction = absentDays * dayRate * (companySettings.absentDayRate || 1);
    const penaltyDeduction = penaltyDays * dayRate;
    
    const overtimeAddition = overtimeHours * hourRate * (companySettings.overtimeRate || 1.5);

    const monthlyGrossForTax = grossSalary + overtimeAddition - absenceDeduction - penaltyDeduction;
    const monthlyExemptions = socialInsuranceEmpShare + (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / EGY_CONSTANTS.MONTHS_IN_YEAR);
    
    let monthlyTax = 0;
    
    if (!isTaxExempted) {
        const annualTaxableIncome = (monthlyGrossForTax - monthlyExemptions) * EGY_CONSTANTS.MONTHS_IN_YEAR;
        if (annualTaxableIncome > 0) {
            const annualTax = calculateAnnualTax(annualTaxableIncome);
            monthlyTax = annualTax / EGY_CONSTANTS.MONTHS_IN_YEAR;
        }
    }

    const totalDeductions = socialInsuranceEmpShare + monthlyTax + absenceDeduction + penaltyDeduction + loanDeduction;
    const netSalary = (grossSalary + overtimeAddition) - totalDeductions;
    const costToCompany = grossSalary + overtimeAddition + socialInsuranceCompShare;

    return {
        grossSalary: Number(grossSalary.toFixed(2)),
        overtimeAddition: Number(overtimeAddition.toFixed(2)),
        socialInsuranceEmpShare: Number(socialInsuranceEmpShare.toFixed(2)),
        socialInsuranceCompShare: Number(socialInsuranceCompShare.toFixed(2)),
        absenceDeduction: Number(absenceDeduction.toFixed(2)),
        penaltyDeduction: Number(penaltyDeduction.toFixed(2)),
        monthlyTax: Number(monthlyTax.toFixed(2)),
        loanDeduction: Number(loanDeduction.toFixed(2)),
        totalDeductions: Number(totalDeductions.toFixed(2)),
        netSalary: Number(netSalary.toFixed(2)),
        costToCompany: Number(costToCompany.toFixed(2))
    };
};

// ---------------------------------------------------------------------------
// 3. Adapter: runPayrollLogic (لتشغيل الواجهة القديمة بنفس كفاءة المحرك)
// ---------------------------------------------------------------------------
const runPayrollLogic = (input, prev, emp) => {
    let totalAdditions = 0;
    let totalDeductions = 0;
    
    if (input.additions && Array.isArray(input.additions)) {
        totalAdditions = input.additions.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    }
    if (input.deductions && Array.isArray(input.deductions)) {
        totalDeductions = input.deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    }

    const targetDays = Number(input.days) || 30;
    const basicProp = (Number(input.fullBasic) || 0) * (targetDays / 30);
    const transProp = (Number(input.fullTrans) || 0) * (targetDays / 30);

    const payload = calculateGrossToNet({
        basicSalary: basicProp,
        variableSalary: totalAdditions,
        allowances: transProp,
        insSalary: Number(emp.insSalary) || 0,
        absentDays: 0,
        penaltyDays: 0,
        overtimeHours: 0,
        loanDeduction: totalDeductions,
        isTaxExempted: emp.isTaxExempted || 0,
        companySettings: emp.companySettings || {}
    });

    return {
        ...payload,
        net: payload.netSalary,
        gross: payload.grossSalary,
        insuranceEmployee: payload.socialInsuranceEmpShare,
        currentTaxable: payload.grossSalary - payload.socialInsuranceEmpShare - (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12)
    };
};

// ---------------------------------------------------------------------------
// 4. Iterative Engine: Net to Gross
// ---------------------------------------------------------------------------
const calculateNetToGross = (targetNet, insSalary, companySettings, isTaxExempted = false) => {
    let minGross = targetNet;
    let maxGross = targetNet * 2.5; 
    let currentGross = (minGross + maxGross) / 2;
    let bestMatch = null;

    for (let i = 0; i < 100; i++) {
        const payload = calculateGrossToNet({
            basicSalary: currentGross,
            insSalary: insSalary,
            companySettings: companySettings,
            isTaxExempted: isTaxExempted
        });

        if (Math.abs(payload.netSalary - targetNet) < 0.01) {
            bestMatch = payload;
            break;
        }

        if (payload.netSalary > targetNet) {
            maxGross = currentGross;
        } else {
            minGross = currentGross;
        }
        currentGross = (minGross + maxGross) / 2;
        bestMatch = payload; 
    }

    return bestMatch;
};

// ---------------------------------------------------------------------------
// 5. Unified Tax Sheet Generator
// ---------------------------------------------------------------------------
const generateUnifiedTaxRow = (employee, payrollRecord) => {
    const p = payrollRecord.payload;
    return {
        "كود الموظف": employee.nationalId,
        "اسم الموظف": employee.name,
        "طبيعة العمل": employee.jobType === "Full Time" ? "دائم" : "مؤقت",
        "الموقف التأميني": p.socialInsuranceEmpShare > 0 ? "مؤمن عليه" : "غير مؤمن عليه",
        "المرتب الأساسي": p.grossSalary,
        "العلاوات المعفاة": 0, 
        "البدلات الخاضعة": 0,
        "إجمالي الاستحقاقات": p.grossSalary + (p.overtimeAddition || 0),
        "الإعفاء الشخصي": Number((EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12).toFixed(2)),
        "حصة الموظف في التأمينات": p.socialInsuranceEmpShare,
        "صافي الوعاء الخاضع": Math.max(0, (p.grossSalary + (p.overtimeAddition || 0)) - (p.socialInsuranceEmpShare + (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12))),
        "الضريبة المستقطعة": p.monthlyTax,
        "صافي المرتب": p.netSalary || p.net
    };
};

// ---------------------------------------------------------------------------
// 6. Smart AI Payroll Auditor
// ---------------------------------------------------------------------------
const analyzePayrollAnomaly = (currentPayrollPayload, previousPayrollPayload) => {
    const warnings = [];
    let hasAnomaly = false;

    if (!previousPayrollPayload) return { hasAnomaly, warnings };

    const currentNet = currentPayrollPayload.netSalary || currentPayrollPayload.net || 0;
    const prevNet = previousPayrollPayload.netSalary || previousPayrollPayload.net || 0;

    const netDiff = currentNet - prevNet;
    const netDiffPercentage = prevNet > 0 ? (netDiff / prevNet) * 100 : 0;

    if (netDiffPercentage <= -25) {
        hasAnomaly = true;
        warnings.push(`انخفاض حاد في الصافي بنسبة ${Math.abs(netDiffPercentage).toFixed(1)}% مقارنة بالشهر السابق.`);
    }

    const currentPenalty = currentPayrollPayload.penaltyDeduction || 0;
    const currentGross = currentPayrollPayload.grossSalary || currentPayrollPayload.gross || 0;
    if (currentPenalty > (currentGross * 0.15)) {
        hasAnomaly = true;
        warnings.push("تجاوزت الجزاءات 15% من الراتب الأساسي.");
    }

    const currentTax = currentPayrollPayload.monthlyTax || 0;
    const prevTax = previousPayrollPayload.monthlyTax || 0;
    if (currentTax > prevTax * 1.5 && prevTax > 0) {
        hasAnomaly = true;
        warnings.push("قفزة في الشريحة الضريبية بسبب الأوفرتايم أو البدلات.");
    }

    return { hasAnomaly, warnings: warnings.join(" | ") };
};

// ---------------------------------------------------------------------------
// 7. Dynamic Settlement
// ---------------------------------------------------------------------------
const calculateSettlement = (employee, remainingLeaves, unpaidSalaries, unsettledLoans, companySettings) => {
    const dayRate = employee.basicSalary / Number(companySettings.monthCalcType || 30);
    const leavesValue = remainingLeaves * dayRate;
    const yearsOfService = (new Date() - new Date(employee.hiringDate)) / (1000 * 60 * 60 * 24 * 365.25);
    let endOfServiceBonus = 0;
    if (yearsOfService >= 1) {
        const first5Years = Math.min(yearsOfService, 5);
        const remainingYears = Math.max(0, yearsOfService - 5);
        endOfServiceBonus = (first5Years * 15 * dayRate) + (remainingYears * 30 * dayRate);
    }
    const netPayable = (leavesValue + unpaidSalaries + endOfServiceBonus) - unsettledLoans;

    return {
        leavesValue: Number(leavesValue.toFixed(2)),
        unpaidSalaries: Number(unpaidSalaries.toFixed(2)),
        endOfServiceBonus: Number(endOfServiceBonus.toFixed(2)),
        unsettledLoans: Number(unsettledLoans.toFixed(2)),
        netPayable: Number(netPayable.toFixed(2))
    };
};

module.exports = {
    EGY_CONSTANTS,
    calculateGrossToNet,
    calculateNetToGross,
    generateUnifiedTaxRow,
    analyzePayrollAnomaly,
    calculateSettlement,
    runPayrollLogic
};

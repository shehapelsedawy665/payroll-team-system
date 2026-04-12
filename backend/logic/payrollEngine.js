/**
 * @file backend/logic/payrollEngine.js
 * @description Advanced Egyptian Payroll Engine - (Restored from Original 2026 Logic with Part-Time Support)
 */

// دالة التقريب الدقيقة لحل مشكلة فرق القرش (Floating-point precision)
const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// 1. الثوابت الأصلية بتاعتك + تحديث البارت تايم
const EGY_CONSTANTS = {
    PERSONAL_EXEMPTION_2024: 20000,
    SOCIAL_INSURANCE_EMP_RATE: 0.11,
    SOCIAL_INSURANCE_COMP_RATE: 0.1875,
    MIN_INSURANCE_SALARY_2024: 5384.62,   // الحد الأدنى للدوام الكامل
    MIN_INSURANCE_SALARY_PART_TIME: 2700, // الحد الأدنى للدوام الجزئي
    MAX_INSURANCE_SALARY_2024: 16700,
    MARTYRS_FUND_RATE: 0.0005,            // صندوق الشهداء 0.05% من الإجمالي
    MONTHS_IN_YEAR: 12
};

// 2. محرك الضرائب الأصلي بتاعك
const calculateAnnualTax = (annualTaxableIncome) => {
    let tax = 0;
    let income = R(annualTaxableIncome);

    let tierShift = 0;
    if (income > 1200000) tierShift = 4;
    else if (income > 1000000) tierShift = 3;
    else if (income > 900000) tierShift = 2;
    else if (income > 800000) tierShift = 1;
    else if (income > 600000) tierShift = 0.5;

    const brackets = [
        { limit: 40000, rate: tierShift >= 0.5 ? 0.10 : 0.00 },
        { limit: 15000, rate: tierShift >= 1 ? 0.15 : 0.10 },
        { limit: 15000, rate: tierShift >= 2 ? 0.20 : 0.15 },
        { limit: 130000, rate: tierShift >= 3 ? 0.225 : 0.20 },
        { limit: 200000, rate: tierShift >= 4 ? 0.25 : 0.225 },
        { limit: 100000, rate: 0.25 },
        { limit: 700000, rate: 0.275 },
        { limit: Infinity, rate: 0.275 }
    ];

    let remainingIncome = income;
    for (let i = 0; i < brackets.length; i++) {
        if (remainingIncome <= 0) break;
        let taxableAtThisBracket = R(Math.min(remainingIncome, brackets[i].limit));
        tax = R(tax + R(taxableAtThisBracket * brackets[i].rate));
        remainingIncome = R(remainingIncome - taxableAtThisBracket);
    }
    return tax;
};

// 3. Gross to Net الأساسي الدقيق جداً
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
        companySettings = {},
        jobType = "Full Time" // استقبال نوع الوظيفة
    } = params;

    const grossSalary = R(basicSalary + variableSalary + allowances);

    // 🔥 اللوجيك الجديد: تحديد الحد الأدنى للتأمينات بناءً على نوع الوظيفة
    const minInsSalary = (jobType === "Part Time" || jobType === "مؤقت") ? EGY_CONSTANTS.MIN_INSURANCE_SALARY_PART_TIME : EGY_CONSTANTS.MIN_INSURANCE_SALARY_2024;

    // تطبيق الحد الأقصى والأدنى الصح بتاع 2026
    let actualInsSalary = Math.max(minInsSalary, Math.min(insSalary || 0, EGY_CONSTANTS.MAX_INSURANCE_SALARY_2024));
    
    const socialInsuranceEmpShare = R(actualInsSalary * EGY_CONSTANTS.SOCIAL_INSURANCE_EMP_RATE);
    const socialInsuranceCompShare = R(actualInsSalary * EGY_CONSTANTS.SOCIAL_INSURANCE_COMP_RATE);

    const dayRate = R(grossSalary / Number(companySettings.monthCalcType || 30));
    const hourRate = R(dayRate / Number(companySettings.dailyWorkHours || 8));
    const absenceDeduction = R(absentDays * dayRate * (companySettings.absentDayRate || 1));
    const penaltyDeduction = R(penaltyDays * dayRate);
    
    const overtimeAddition = R(overtimeHours * hourRate * (companySettings.overtimeRate || 1.5));

    const monthlyGrossForTax = R(grossSalary + overtimeAddition - absenceDeduction - penaltyDeduction);
    const monthlyExemptions = R(socialInsuranceEmpShare + (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / EGY_CONSTANTS.MONTHS_IN_YEAR));
    
    let monthlyTax = 0;
    if (!isTaxExempted) {
        const annualTaxableIncome = R((monthlyGrossForTax - monthlyExemptions) * EGY_CONSTANTS.MONTHS_IN_YEAR);
        if (annualTaxableIncome > 0) {
            const annualTax = calculateAnnualTax(annualTaxableIncome);
            monthlyTax = R(annualTax / EGY_CONSTANTS.MONTHS_IN_YEAR);
        }
    }

    const totalDeductions = R(socialInsuranceEmpShare + monthlyTax + absenceDeduction + penaltyDeduction + loanDeduction);
    const martyrsFund = R(grossSalary * EGY_CONSTANTS.MARTYRS_FUND_RATE); // صندوق الشهداء 0.05%
    const netSalary = R(R(grossSalary + overtimeAddition) - totalDeductions - martyrsFund);
    const costToCompany = R(grossSalary + overtimeAddition + socialInsuranceCompShare);

    return {
        grossSalary: Number(grossSalary.toFixed(2)),
        overtimeAddition: Number(overtimeAddition.toFixed(2)),
        socialInsuranceEmpShare: Number(socialInsuranceEmpShare.toFixed(2)),
        socialInsuranceCompShare: Number(socialInsuranceCompShare.toFixed(2)),
        absenceDeduction: Number(absenceDeduction.toFixed(2)),
        penaltyDeduction: Number(penaltyDeduction.toFixed(2)),
        monthlyTax: Number(monthlyTax.toFixed(2)),
        martyrsFund: Number(martyrsFund.toFixed(2)),
        loanDeduction: Number(loanDeduction.toFixed(2)),
        totalDeductions: Number((totalDeductions + martyrsFund).toFixed(2)),
        netSalary: Number(netSalary.toFixed(2)),
        costToCompany: Number(costToCompany.toFixed(2))
    };
};

// 4. المحول للواجهة الأمامية
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
        loanDeduction: totalDeductions,
        isTaxExempted: emp.isTaxExempted || 0,
        companySettings: emp.companySettings || {},
        jobType: emp.jobType || "Full Time" // 🔥 تمرير نوع الوظيفة من الموظف
    });

    return {
        days: targetDays,
        gross: payload.grossSalary,
        proratedBasic: Number(basicProp.toFixed(2)),
        proratedTrans: Number(transProp.toFixed(2)),
        totalAdditions,
        totalOtherDeductions: totalDeductions,
        insuranceEmployee: payload.socialInsuranceEmpShare,
        insuranceCompany: payload.socialInsuranceCompShare,
        currentTaxable: R(payload.grossSalary - payload.socialInsuranceEmpShare - (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12)),
        monthlyTax: payload.monthlyTax,
        martyrs: payload.martyrsFund,
        net: payload.netSalary,
        additions: input.additions || [],
        deductions: input.deductions || [],
        ...payload
    };
};

// 5. Net To Gross
const calculateNetToGross = (targetNet, insSalary, companySettings, isTaxExempted = false, jobType = "Full Time") => {
    let minGross = targetNet;
    let maxGross = targetNet * 2.5; 
    let currentGross = (minGross + maxGross) / 2;
    let bestMatch = null;
    for (let i = 0; i < 100; i++) {
        const payload = calculateGrossToNet({ 
            basicSalary: currentGross, 
            insSalary: insSalary, 
            companySettings: companySettings, 
            isTaxExempted: isTaxExempted,
            jobType: jobType // 🔥 تمرير نوع الوظيفة للوب
        });
        if (Math.abs(payload.netSalary - targetNet) < 0.01) { bestMatch = payload; break; }
        if (payload.netSalary > targetNet) maxGross = currentGross;
        else minGross = currentGross;
        currentGross = (minGross + maxGross) / 2;
        bestMatch = payload; 
    }
    return bestMatch;
};

// 6. تقرير الضرائب الموحدة
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
        "إجمالي الاستحقاقات": R(p.grossSalary + (p.overtimeAddition || 0)),
        "الإعفاء الشخصي": Number((EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12).toFixed(2)),
        "حصة الموظف في التأمينات": p.socialInsuranceEmpShare,
        "صافي الوعاء الخاضع": Math.max(0, R((p.grossSalary + (p.overtimeAddition || 0)) - (p.socialInsuranceEmpShare + (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12)))),
        "الضريبة المستقطعة": p.monthlyTax,
        "صندوق الشهداء": p.martyrsFund || 0,
        "صافي المرتب": p.netSalary || p.net
    };
};

const analyzePayrollAnomaly = (currentPayrollPayload, previousPayrollPayload) => {
    const warnings = [];
    let hasAnomaly = false;
    if (!previousPayrollPayload) return { hasAnomaly, warnings };
    const netDiff = R((currentPayrollPayload.netSalary || currentPayrollPayload.net) - (previousPayrollPayload.netSalary || previousPayrollPayload.net));
    const netDiffPercentage = (netDiff / (previousPayrollPayload.netSalary || previousPayrollPayload.net)) * 100;
    if (netDiffPercentage <= -25) { hasAnomaly = true; warnings.push(`انخفاض بنسبة ${Math.abs(netDiffPercentage).toFixed(1)}%`); }
    if (currentPayrollPayload.penaltyDeduction > (currentPayrollPayload.grossSalary * 0.15)) { hasAnomaly = true; warnings.push("تجاوزت الجزاءات 15%"); }
    if (currentPayrollPayload.monthlyTax > previousPayrollPayload.monthlyTax * 1.5) { hasAnomaly = true; warnings.push("قفزة ضريبية"); }
    return { hasAnomaly, warnings: warnings.join(" | ") };
};

const calculateSettlement = (employee, remainingLeaves, unpaidSalaries, unsettledLoans, companySettings) => {
    const dayRate = R(employee.basicSalary / Number(companySettings.monthCalcType || 30));
    const leavesValue = R(remainingLeaves * dayRate);
    const yearsOfService = (new Date() - new Date(employee.hiringDate)) / (1000 * 60 * 60 * 24 * 365.25);
    let endOfServiceBonus = 0;
    if (yearsOfService >= 1) {
        const first5Years = Math.min(yearsOfService, 5);
        const remainingYears = Math.max(0, yearsOfService - 5);
        endOfServiceBonus = R((first5Years * 15 * dayRate) + (remainingYears * 30 * dayRate));
    }
    const netPayable = R((leavesValue + unpaidSalaries + endOfServiceBonus) - unsettledLoans);
    return { leavesValue: Number(leavesValue.toFixed(2)), unpaidSalaries: Number(unpaidSalaries.toFixed(2)), endOfServiceBonus: Number(endOfServiceBonus.toFixed(2)), unsettledLoans: Number(unsettledLoans.toFixed(2)), netPayable: Number(netPayable.toFixed(2)) };
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

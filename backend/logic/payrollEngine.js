/**
 * @file backend/logic/payrollEngine.js
 * @description The FINAL Advanced Egyptian Payroll Engine - (Cumulative YTD & Strict Floor)
 */

const EGY_CONSTANTS = {
    PERSONAL_EXEMPTION_2024: 20000,
    SOCIAL_INSURANCE_EMP_RATE: 0.11,
    SOCIAL_INSURANCE_COMP_RATE: 0.1875,
    MIN_INSURANCE_SALARY_2024: 5384.62,
    MIN_INSURANCE_SALARY_PART_TIME: 2700,
    MAX_INSURANCE_SALARY_2024: 16700,
    MARTYRS_FUND_RATE: 0.0005,
    MONTHS_IN_YEAR: 12
};

const calculateAnnualTax = (annualTaxableIncome) => {
    let tax = 0;
    let income = annualTaxableIncome;

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
        let taxableAtThisBracket = Math.min(remainingIncome, brackets[i].limit);
        tax += taxableAtThisBracket * brackets[i].rate;
        remainingIncome -= taxableAtThisBracket;
    }
    return tax;
};

// المحرك الرئيسي المحدث لدعم التراكمي (YTD) والأيام الفعلية
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
        jobType = "Full Time",
        targetDays = 30, // أيام الشهر الفعلية للضرايب
        prevData = { pDays: 0, pTaxable: 0, pTaxes: 0 } // بيانات الشهور السابقة
    } = params;

    const grossSalary = basicSalary + variableSalary + allowances;

    const minInsSalary = (jobType === "Part Time" || jobType === "مؤقت") ? EGY_CONSTANTS.MIN_INSURANCE_SALARY_PART_TIME : EGY_CONSTANTS.MIN_INSURANCE_SALARY_2024;
    let actualInsSalary = Math.max(minInsSalary, Math.min(insSalary || 0, EGY_CONSTANTS.MAX_INSURANCE_SALARY_2024));
    
    // التأمينات ثابتة لا تتأثر بالأيام حسب القانون المصري
    const socialInsuranceEmpShare = actualInsSalary * EGY_CONSTANTS.SOCIAL_INSURANCE_EMP_RATE;
    const socialInsuranceCompShare = actualInsSalary * EGY_CONSTANTS.SOCIAL_INSURANCE_COMP_RATE;

    const dayRate = grossSalary / Number(companySettings.monthCalcType || 30);
    const hourRate = dayRate / Number(companySettings.dailyWorkHours || 8);
    const absenceDeduction = absentDays * dayRate * (companySettings.absentDayRate || 1);
    const penaltyDeduction = penaltyDays * dayRate;
    const overtimeAddition = overtimeHours * hourRate * (companySettings.overtimeRate || 1.5);

    const monthlyGrossForTax = grossSalary + overtimeAddition - absenceDeduction - penaltyDeduction;
    
    // 🔥 الإعفاء الشخصي يُنسب لعدد الأيام الفعلية في الشهر
    const proratedPersonalExemption = (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 360) * targetDays;
    
    // الوعاء الخاضع للشهر الحالي فقط (يتم حفظه للداتابيز)
    const currentTaxable = Math.max(0, monthlyGrossForTax - socialInsuranceEmpShare - proratedPersonalExemption);
    
    let monthlyTax = 0;
    
    if (!isTaxExempted) {
        // 🔥 الحسبة التراكمية (YTD Logic)
        const totalDaysYTD = targetDays + (Number(prevData.pDays) || 0);
        const totalTaxableYTD = currentTaxable + (Number(prevData.pTaxable) || 0);

        if (totalDaysYTD > 0 && totalTaxableYTD > 0) {
            // 1. تحويل الوعاء التراكمي إلى سنوي
            let rawAnnual = (totalTaxableYTD / totalDaysYTD) * 360;
            
            // 2. تقريب القانون المصري للأسفل لأقرب 10 جنيه
            let annualProjected = Math.floor(rawAnnual / 10) * 10;
            
            // 3. حساب الضريبة السنوية
            let annualTax = calculateAnnualTax(annualProjected);
            
            // 4. رد الضريبة للمدة التراكمية الفعلية
            let totalTaxDueUntilNow = (annualTax / 360) * totalDaysYTD;
            
            // 5. خصم ما تم تسديده في الشهور السابقة
            let prevTaxes = Number(prevData.pTaxes) || 0;
            monthlyTax = Math.max(0, totalTaxDueUntilNow - prevTaxes);
        }
    }

    const martyrsFund = Number((grossSalary * EGY_CONSTANTS.MARTYRS_FUND_RATE).toFixed(2));
    const totalDeductions = socialInsuranceEmpShare + monthlyTax + absenceDeduction + penaltyDeduction + loanDeduction;
    const netSalary = (grossSalary + overtimeAddition) - totalDeductions - martyrsFund;
    const costToCompany = grossSalary + overtimeAddition + socialInsuranceCompShare;

    return {
        grossSalary: Number(grossSalary.toFixed(2)),
        overtimeAddition: Number(overtimeAddition.toFixed(2)),
        socialInsuranceEmpShare: Number(socialInsuranceEmpShare.toFixed(2)),
        socialInsuranceCompShare: Number(socialInsuranceCompShare.toFixed(2)),
        absenceDeduction: Number(absenceDeduction.toFixed(2)),
        penaltyDeduction: Number(penaltyDeduction.toFixed(2)),
        currentTaxable: Number(currentTaxable.toFixed(2)), // هذا المتغير يخزن للشهر القادم
        monthlyTax: Number(monthlyTax.toFixed(2)),
        martyrsFund,
        loanDeduction: Number(loanDeduction.toFixed(2)),
        totalDeductions: Number((totalDeductions + martyrsFund).toFixed(2)),
        netSalary: Number(netSalary.toFixed(2)),
        costToCompany: Number(costToCompany.toFixed(2))
    };
};

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

    const safePrev = prev || { pDays: 0, pTaxable: 0, pTaxes: 0 };

    const payload = calculateGrossToNet({
        basicSalary: basicProp,
        variableSalary: totalAdditions,
        allowances: transProp,
        insSalary: Number(emp.insSalary) || 0,
        loanDeduction: totalDeductions,
        isTaxExempted: emp.isTaxExempted || 0,
        companySettings: emp.companySettings || {},
        jobType: emp.jobType || "Full Time",
        targetDays: targetDays,
        prevData: safePrev
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
        currentTaxable: payload.currentTaxable,
        monthlyTax: payload.monthlyTax,
        martyrs: payload.martyrsFund,
        net: payload.netSalary,
        additions: input.additions || [],
        deductions: input.deductions || [],
        ...payload
    };
};

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
            jobType: jobType,
            targetDays: 30, // الحاسبة تفترض شهر كامل
            prevData: { pDays: 0, pTaxable: 0, pTaxes: 0 }
        });
        
        if (Math.abs(payload.netSalary - targetNet) < 0.01) { 
            let roundedGross = Math.round(currentGross);
            let checkPayload = calculateGrossToNet({
                basicSalary: roundedGross,
                insSalary: insSalary,
                companySettings: companySettings,
                isTaxExempted: isTaxExempted,
                jobType: jobType,
                targetDays: 30,
                prevData: { pDays: 0, pTaxable: 0, pTaxes: 0 }
            });

            if (Math.abs(checkPayload.netSalary - targetNet) < 0.05) {
                bestMatch = checkPayload;
                break;
            }

            bestMatch = payload; 
            break; 
        }
        if (payload.netSalary > targetNet) maxGross = currentGross;
        else minGross = currentGross;
        currentGross = (minGross + maxGross) / 2;
        bestMatch = payload; 
    }
    return bestMatch;
};

// -- (باقي دوال التقرير والتسوية كما هي بدون تغيير) --
const generateUnifiedTaxRow = (employee, payrollRecord) => {
    const p = payrollRecord.payload;
    return {
        "كود الموظف": employee.nationalId,
        "اسم الموظف": employee.name,
        "طبيعة العمل": employee.jobType === "Full Time" ? "دائم" : "مؤقت",
        "الموقف التأميني": p.socialInsuranceEmpShare > 0 ? "مؤمن عليه" : "غير مؤمن عليه",
        "المرتب الأساسي": p.grossSalary,
        "إجمالي الاستحقاقات": p.grossSalary + (p.overtimeAddition || 0),
        "الإعفاء الشخصي": Number((EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12).toFixed(2)),
        "حصة الموظف في التأمينات": p.socialInsuranceEmpShare,
        "الضريبة المستقطعة": p.monthlyTax,
        "صندوق الشهداء": p.martyrsFund || 0,
        "صافي المرتب": p.netSalary || p.net
    };
};

const analyzePayrollAnomaly = (currentPayrollPayload, previousPayrollPayload) => {
    const warnings = [];
    let hasAnomaly = false;
    if (!previousPayrollPayload) return { hasAnomaly, warnings };
    const netDiff = (currentPayrollPayload.netSalary || currentPayrollPayload.net) - (previousPayrollPayload.netSalary || previousPayrollPayload.net);
    const netDiffPercentage = (netDiff / (previousPayrollPayload.netSalary || previousPayrollPayload.net)) * 100;
    if (netDiffPercentage <= -25) { hasAnomaly = true; warnings.push(`انخفاض بنسبة ${Math.abs(netDiffPercentage).toFixed(1)}%`); }
    return { hasAnomaly, warnings: warnings.join(" | ") };
};

const calculateSettlement = (employee, remainingLeaves, unpaidSalaries, unsettledLoans, companySettings) => {
    const dayRate = employee.basicSalary / Number(companySettings.monthCalcType || 30);
    const leavesValue = remainingLeaves * dayRate;
    const netPayable = (leavesValue + unpaidSalaries) - unsettledLoans;
    return { netPayable: Number(netPayable.toFixed(2)) };
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

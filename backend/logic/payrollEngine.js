// backend/logic/payrollEngine.js
const { calculateEgyptianTax, R } = require('./taxEngine');
const EGY = require('../config/constants'); // << السر هنا: استدعاء أرقامك الصح

// 1. الدالة المساعدة لحساب الرواتب البسيطة
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
    
    const grossSalary = basicProp + totalAdditions + transProp;
    
    // التأمينات بتقرأ من ملفك مش أرقام ثابته
    const minIns = EGY.MIN_INSURANCE_SALARY_2024 || EGY.MIN_INSURANCE_SALARY || 2000;
    const maxIns = EGY.MAX_INSURANCE_SALARY_2024 || EGY.MAX_INSURANCE_SALARY || 16700;
    const empRate = EGY.SOCIAL_INSURANCE_EMP_RATE || 0.11;
    
    let actualInsSalary = Math.max(minIns, Math.min(Number(emp.insSalary) || 0, maxIns));
    const socialInsuranceEmpShare = actualInsSalary * empRate;
    
    const exemption = EGY.PERSONAL_EXEMPTION_2024 || EGY.PERSONAL_EXEMPTION || 20000;
    const currentTaxable = grossSalary - socialInsuranceEmpShare - (exemption / 12);
    
    let monthlyTax = 0;
    
    if (!emp.isTaxExempted && currentTaxable > 0) {
        const ai = currentTaxable * 12; 
        const af = 360;                 
        const annualTax = calculateEgyptianTax(ai, af);
        monthlyTax = annualTax / 12;
    }

    const net = grossSalary - socialInsuranceEmpShare - monthlyTax - totalDeductions;

    return {
        days: targetDays,
        gross: R(grossSalary),
        grossSalary: R(grossSalary),
        insuranceEmployee: R(socialInsuranceEmpShare),
        socialInsuranceEmpShare: R(socialInsuranceEmpShare),
        currentTaxable: R(currentTaxable),
        monthlyTax: R(monthlyTax),
        net: R(net),
        netSalary: R(net),
        totalDeductions: R(totalDeductions)
    };
};

// 2. المحرك المعقد والكامل (زي ما كان في مشروع Test بالظبط)
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

    const minIns = EGY.MIN_INSURANCE_SALARY_2024 || EGY.MIN_INSURANCE_SALARY || 2000;
    const maxIns = EGY.MAX_INSURANCE_SALARY_2024 || EGY.MAX_INSURANCE_SALARY || 16700;
    const empRate = EGY.SOCIAL_INSURANCE_EMP_RATE || 0.11;
    const compRate = EGY.SOCIAL_INSURANCE_COMP_RATE || 0.1875;

    let actualInsSalary = Math.max(minIns, Math.min(insSalary || 0, maxIns));
    const socialInsuranceEmpShare = actualInsSalary * empRate;
    const socialInsuranceCompShare = actualInsSalary * compRate;

    const dayRate = grossSalary / Number(companySettings.monthCalcType || 30);
    const hourRate = dayRate / Number(companySettings.dailyWorkHours || 8);
    const absenceDeduction = absentDays * dayRate * (companySettings.absentDayRate || 1);
    const penaltyDeduction = penaltyDays * dayRate;
    const overtimeAddition = overtimeHours * hourRate * (companySettings.overtimeRate || 1.5);

    const monthlyGrossForTax = grossSalary + overtimeAddition - absenceDeduction - penaltyDeduction;
    const exemption = EGY.PERSONAL_EXEMPTION_2024 || EGY.PERSONAL_EXEMPTION || 20000;
    const monthlyExemptions = socialInsuranceEmpShare + (exemption / 12);
    
    let monthlyTax = 0;
    if (!isTaxExempted && (monthlyGrossForTax - monthlyExemptions) > 0) {
        const ai = (monthlyGrossForTax - monthlyExemptions) * 12;
        const af = 360;
        const annualTax = calculateEgyptianTax(ai, af);
        monthlyTax = annualTax / 12;
    }

    const totalDeductions = socialInsuranceEmpShare + monthlyTax + absenceDeduction + penaltyDeduction + loanDeduction;
    const netSalary = (grossSalary + overtimeAddition) - totalDeductions;
    const costToCompany = grossSalary + overtimeAddition + socialInsuranceCompShare;

    return {
        grossSalary: R(grossSalary),
        overtimeAddition: R(overtimeAddition),
        socialInsuranceEmpShare: R(socialInsuranceEmpShare),
        socialInsuranceCompShare: R(socialInsuranceCompShare),
        absenceDeduction: R(absenceDeduction),
        penaltyDeduction: R(penaltyDeduction),
        monthlyTax: R(monthlyTax),
        loanDeduction: R(loanDeduction),
        totalDeductions: R(totalDeductions),
        netSalary: R(netSalary),
        costToCompany: R(costToCompany)
    };
};

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

const generateUnifiedTaxRow = (employee, payrollRecord) => {
    const p = payrollRecord.payload;
    const exemption = EGY.PERSONAL_EXEMPTION_2024 || EGY.PERSONAL_EXEMPTION || 20000;
    return {
        "كود الموظف": employee.nationalId,
        "اسم الموظف": employee.name,
        "طبيعة العمل": employee.jobType === "Full Time" ? "دائم" : "مؤقت",
        "الموقف التأميني": p.socialInsuranceEmpShare > 0 ? "مؤمن عليه" : "غير مؤمن عليه",
        "المرتب الأساسي": p.grossSalary,
        "العلاوات المعفاة": 0, 
        "البدلات الخاضعة": 0,
        "إجمالي الاستحقاقات": p.grossSalary + (p.overtimeAddition || 0),
        "الإعفاء الشخصي": R(exemption / 12),
        "حصة الموظف في التأمينات": p.socialInsuranceEmpShare,
        "صافي الوعاء الخاضع": Math.max(0, (p.grossSalary + (p.overtimeAddition || 0)) - (p.socialInsuranceEmpShare + (exemption / 12))),
        "الضريبة المستقطعة": p.monthlyTax,
        "صافي المرتب": p.netSalary || p.net
    };
};

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
        leavesValue: R(leavesValue),
        unpaidSalaries: R(unpaidSalaries),
        endOfServiceBonus: R(endOfServiceBonus),
        unsettledLoans: R(unsettledLoans),
        netPayable: R(netPayable)
    };
};

module.exports = {
    runPayrollLogic,
    calculateGrossToNet,
    calculateNetToGross,
    generateUnifiedTaxRow,
    analyzePayrollAnomaly,
    calculateSettlement
};

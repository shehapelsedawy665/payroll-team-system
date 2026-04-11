// backend/logic/payrollEngine.js
const { calculateEgyptianTax } = require('./taxEngine');

const EGY_CONSTANTS = {
    PERSONAL_EXEMPTION_2024: 20000,
    SOCIAL_INSURANCE_EMP_RATE: 0.11,
    SOCIAL_INSURANCE_COMP_RATE: 0.1875,
    MIN_INSURANCE_SALARY_2024: 2000,
    MAX_INSURANCE_SALARY_2024: 16700 // تحديث 2024/2026
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
    
    // الإجمالي الشهري
    const grossSalary = basicProp + totalAdditions + transProp;
    
    // التأمينات
    const actualInsSalary = Math.max(EGY_CONSTANTS.MIN_INSURANCE_SALARY_2024, Math.min(Number(emp.insSalary) || 0, EGY_CONSTANTS.MAX_INSURANCE_SALARY_2024));
    const socialInsuranceEmpShare = actualInsSalary * EGY_CONSTANTS.SOCIAL_INSURANCE_EMP_RATE;
    
    // الوعاء الضريبي الشهري
    const currentTaxable = grossSalary - socialInsuranceEmpShare - (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12);
    
    let monthlyTax = 0;
    
    if (!emp.isTaxExempted && currentTaxable > 0) {
        // 🔥 هنا بنجهز المتغيرات للـ Engine بتاعك إنت 🔥
        const ai = currentTaxable * 12; // ai = الوعاء الخاضع السنوي
        const af = 360;                 // af = أيام السنة الضريبية القياسية

        // استدعاء دالة الضرائب اللي إنت عاملها في taxEngine.js
        const annualTax = calculateEgyptianTax(ai, af);
        monthlyTax = annualTax / 12;
    }

    // الصافي النهائي
    const net = grossSalary - socialInsuranceEmpShare - monthlyTax - totalDeductions;

    return {
        days: targetDays,
        gross: Number(grossSalary.toFixed(2)),
        grossSalary: Number(grossSalary.toFixed(2)),
        insuranceEmployee: Number(socialInsuranceEmpShare.toFixed(2)),
        socialInsuranceEmpShare: Number(socialInsuranceEmpShare.toFixed(2)),
        currentTaxable: Number(currentTaxable.toFixed(2)),
        monthlyTax: Number(monthlyTax.toFixed(2)),
        net: Number(net.toFixed(2)),
        netSalary: Number(net.toFixed(2)),
        totalDeductions: Number(totalDeductions.toFixed(2))
    };
};

// =======================================================
// دوال مساعدة لربط الباك إند المتقسم (عشان مفيش حاجة تضرب)
// =======================================================
const calculateGrossToNet = (params) => {
    return runPayrollLogic({
        fullBasic: params.basicSalary,
        days: 30,
        additions: [{ amount: (params.variableSalary || 0) + (params.allowances || 0) }],
        deductions: [{ amount: (params.absenceDeduction || 0) + (params.penaltyDeduction || 0) + (params.loanDeduction || 0) }]
    }, null, { insSalary: params.insSalary, isTaxExempted: params.isTaxExempted });
};

const analyzePayrollAnomaly = () => ({ hasAnomaly: false, warnings: "" });
const generateUnifiedTaxRow = () => ({});
const calculateSettlement = () => ({});

module.exports = {
    runPayrollLogic,
    calculateGrossToNet,
    analyzePayrollAnomaly,
    generateUnifiedTaxRow,
    calculateSettlement
};

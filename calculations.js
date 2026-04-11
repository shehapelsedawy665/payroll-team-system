/**
 * @file calculations.js
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

    // تحديد الشريحة وتطبيق التعديلات حسب تجاوز الدخل للحدود (قانون 2024/2026)
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
        allowances = 0, // بدلات غير خاضعة/خاضعة (يتم تفصيلها لاحقاً حسب نوعها، هنا نفترض خضوعها للتبسيط العام)
        insSalary, 
        absentDays = 0,
        penaltyDays = 0,
        overtimeHours = 0,
        loanDeduction = 0,
        isTaxExempted = 0, // 1 if special needs
        companySettings
    } = params;

    // 1. الإجمالي الشهري
    const grossSalary = basicSalary + variableSalary + allowances;

    // 2. حساب التأمينات الاجتماعية (على الأجر التأميني)
    let actualInsSalary = Math.max(EGY_CONSTANTS.MIN_INSURANCE_SALARY_2024, Math.min(insSalary, EGY_CONSTANTS.MAX_INSURANCE_SALARY_2024));
    const socialInsuranceEmpShare = actualInsSalary * EGY_CONSTANTS.SOCIAL_INSURANCE_EMP_RATE;
    const socialInsuranceCompShare = actualInsSalary * EGY_CONSTANTS.SOCIAL_INSURANCE_COMP_RATE;

    // 3. حساب الاستقطاعات الإدارية (غياب وجزاءات)
    const dayRate = grossSalary / Number(companySettings.monthCalcType || 30);
    const hourRate = dayRate / Number(companySettings.dailyWorkHours || 8);
    const absenceDeduction = absentDays * dayRate * (companySettings.absentDayRate || 1);
    const penaltyDeduction = penaltyDays * dayRate;
    
    // 4. الإضافي
    const overtimeAddition = overtimeHours * hourRate * (companySettings.overtimeRate || 1.5);

    // 5. الوعاء الضريبي الشهري
    const monthlyGrossForTax = grossSalary + overtimeAddition - absenceDeduction - penaltyDeduction;
    const monthlyExemptions = socialInsuranceEmpShare + (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / EGY_CONSTANTS.MONTHS_IN_YEAR);
    
    let monthlyTax = 0;
    
    if (!isTaxExempted) {
        // تحويل الدخل لسنوي لحساب الضريبة الدقيقة
        const annualTaxableIncome = (monthlyGrossForTax - monthlyExemptions) * EGY_CONSTANTS.MONTHS_IN_YEAR;
        if (annualTaxableIncome > 0) {
            const annualTax = calculateAnnualTax(annualTaxableIncome);
            monthlyTax = annualTax / EGY_CONSTANTS.MONTHS_IN_YEAR;
        }
    }

    // 6. الصافي النهائي
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
// 3. Iterative Engine: Net to Gross (100 Iterations for Extreme Accuracy)
// ---------------------------------------------------------------------------
const calculateNetToGross = (targetNet, insSalary, companySettings, isTaxExempted = false) => {
    let minGross = targetNet;
    let maxGross = targetNet * 2.5; // أقصى افتراض لضريبة الشريحة العليا
    let currentGross = (minGross + maxGross) / 2;
    let bestMatch = null;

    // الخوارزمية التكرارية (100 Iterations) لضبط الجنيه والقرش الضريبي
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
        bestMatch = payload; // حفظ أقرب نتيجة في حال عدم الوصول لصفر مطلق
    }

    return bestMatch;
};

// ---------------------------------------------------------------------------
// 4. Unified Tax Sheet Generator (منظومة توحيد الضرائب المصرية)
// ---------------------------------------------------------------------------
const generateUnifiedTaxRow = (employee, payrollRecord) => {
    // هذه الدالة تعيد الـ Object المتوافق 100% مع شيت الإكسيل لمنظومة توحيد الضرائب
    const p = payrollRecord.payload;
    return {
        "كود الموظف": employee.nationalId,
        "اسم الموظف": employee.name,
        "طبيعة العمل": employee.jobType === "Full Time" ? "دائم" : "مؤقت",
        "الموقف التأميني": p.socialInsuranceEmpShare > 0 ? "مؤمن عليه" : "غير مؤمن عليه",
        "المرتب الأساسي": p.grossSalary,
        "العلاوات المعفاة": 0, // للتهيئة المستقبلية
        "البدلات الخاضعة": 0,
        "إجمالي الاستحقاقات": p.grossSalary + p.overtimeAddition,
        "الإعفاء الشخصي": Number((EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12).toFixed(2)),
        "حصة الموظف في التأمينات": p.socialInsuranceEmpShare,
        "صافي الوعاء الخاضع": Math.max(0, (p.grossSalary + p.overtimeAddition) - (p.socialInsuranceEmpShare + (EGY_CONSTANTS.PERSONAL_EXEMPTION_2024 / 12))),
        "الضريبة المستقطعة": p.monthlyTax,
        "صافي المرتب": p.netSalary
    };
};

// ---------------------------------------------------------------------------
// 5. Smart AI Payroll Auditor (Anomaly Detection)
// ---------------------------------------------------------------------------
const analyzePayrollAnomaly = (currentPayrollPayload, previousPayrollPayload) => {
    const warnings = [];
    let hasAnomaly = false;

    if (!previousPayrollPayload) return { hasAnomaly, warnings };

    const netDiff = currentPayrollPayload.netSalary - previousPayrollPayload.netSalary;
    const netDiffPercentage = (netDiff / previousPayrollPayload.netSalary) * 100;

    if (netDiffPercentage <= -25) {
        hasAnomaly = true;
        warnings.push(`انخفاض حاد في الصافي بنسبة ${Math.abs(netDiffPercentage).toFixed(1)}% مقارنة بالشهر السابق.`);
    }

    if (currentPayrollPayload.penaltyDeduction > (currentPayrollPayload.grossSalary * 0.15)) {
        hasAnomaly = true;
        warnings.push("تجاوزت الجزاءات 15% من الراتب الأساسي (راجع قانون العمل).");
    }

    if (currentPayrollPayload.monthlyTax > previousPayrollPayload.monthlyTax * 1.5) {
        hasAnomaly = true;
        warnings.push("قفزة في الشريحة الضريبية بسبب الأوفرتايم أو البدلات.");
    }

    return { hasAnomaly, warnings: warnings.join(" | ") };
};

// ---------------------------------------------------------------------------
// 6. Dynamic Settlement (One-Click Offboarding)
// ---------------------------------------------------------------------------
const calculateSettlement = (employee, remainingLeaves, unpaidSalaries, unsettledLoans, companySettings) => {
    // حساب قيمة اليوم
    const dayRate = employee.basicSalary / Number(companySettings.monthCalcType || 30);
    
    // رصيد الإجازات المتبقي
    const leavesValue = remainingLeaves * dayRate;

    // مكافأة نهاية الخدمة (حسب قانون العمل - تبسيط أولي: نصف شهر عن أول 5 سنين، شهر عن الباقي)
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
    calculateSettlement
};
// دالة التقريب الصارم زي ROUND(x, 2) في الإكسيل
const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * حساب الضريبة السنوية بناءً على الشريحة (مع مراعاة الإعفاء 40,000)
 */
function calculateEgyptianTax(annualProjected) {
    const exemption = 40000;
    if (annualProjected <= exemption) return 0;

    let tax = 0;
    let remaining = annualProjected - exemption;

    const brackets = [
        { limit: 15000, rate: 0.10 },
        { limit: 15000, rate: 0.15 },
        { limit: 130000, rate: 0.20 },
        { limit: 200000, rate: 0.225 },
        { limit: 800000, rate: 0.25 },
        { limit: Infinity, rate: 0.275 }
    ];

    for (let b of brackets) {
        if (remaining <= 0) break;
        let chunk = Math.min(remaining, b.limit);
        tax += chunk * b.rate;
        remaining -= chunk;
    }
    return tax;
}

/**
 * الدالة الرئيسية لتسوية المرتبات
 * @param {Object} input - بيانات الشهر الحالي
 * @param {Object} prev - بيانات الأشهر السابقة (YTD)
 * @param {Object} emp - بيانات الموظف الثابتة
 */
function runPayrollLogic(input, prev, emp) {
    const { 
        gross,               // S9 (المرتب الأساسي + المتغيرات + البدلات)
        deductions,          // Z9 + AA9 + O9 (خصومات أخرى مطلوبة في المعادلة)
        insuranceEmployee,   // AV9 (تأمينات الموظف)
        days,                // AE9 (أيام العمل في الشهر)
        isFinalSettlement,   // Boolean عشان شرط الـ 10% لما الموظف يسيب
        limitedDeduction     // AX9 (خصم الـ 15% مثلاً تأمين حياة / استثمار)
    } = input;

    // 1. حساب الإعفاء الشخصي (20,000 أو 30,000 حسب نوع الموظف AC9)
    // الإكسيل بيقسم على 360 وبيضرب في أيام الشهر
    const exemptionLimit = emp.exemptionType === 4 ? 30000 : 20000;
    const personalExemption = R((exemptionLimit / 360) * days);

    // 2. حساب الأساس الخاضع للضريبة قبل تطبيق قاعدة الـ 15%
    const baseBeforeLimit = R(gross - (deductions || 0) - insuranceEmployee - personalExemption);

    // 3. تطبيق قاعدة الخصم المحدد بـ 15% (اللي في معادلة الـ IF(ROUND(S9,2)>0... في الإكسيل)
    let appliedDeduction = 0;
    if (baseBeforeLimit > 0) {
        const max15Percent = baseBeforeLimit * 0.15;
        const annualCap = R(10000 / 12); // السقف السنوي 10,000 مقسوم على 12 شهر
        const actualDeductionValue = limitedDeduction || 0;
        
        appliedDeduction = Math.min(max15Percent, actualDeductionValue, annualCap);
    }

    // 4. الـ Taxable النهائي للشهر الحالي (مطابق لمعادلة الـ Dih equation taxable)
    const currentTaxable = R(baseBeforeLimit - appliedDeduction);

    // 5. تجميع YTD (الأشهر السابقة + الشهر الحالي)
    const totalDaysYTD = days + (prev.pDays || 0);
    const totalTaxableYTD = R(currentTaxable + (prev.pTaxable || 0));

    // 6. حساب الـ Tax Pool (مطابق لمعادلة dih equation taxpool)
    // FLOOR في الإكسيل بيقرب لأسفل لأقرب 10
    let taxPoolYTD = 0;
    if (totalDaysYTD > 0) {
        const rawAnnual = (totalTaxableYTD / totalDaysYTD) * 360;
        const floorAnnual = Math.floor(rawAnnual / 10) * 10; // تقريب لحد أقرب 10 لأسفل
        taxPoolYTD = R((floorAnnual / 360) * totalDaysYTD);
    }

    // 7. حساب الضريبة السنوية الكلية بناءً على الـ Tax Pool المقرّب
    const totalAnnualTax = calculateEgyptianTax(taxPoolYTD);
    
    // 8. حساب ضريبة الأشهر المتراكمة (توزيع السنوي على الأيام الفعلية)
    const totalTaxYTD = R((totalAnnualTax / 360) * totalDaysYTD);

    // 9. حساب ضريبة الشهر الحالي (Taxes of the month)
    let monthlyTax = 0;
    if (isFinalSettlement) {
        // لو الموظف لافي أو مستني، ضريبة 10% مباشرة بدون تسوية
        monthlyTax = R(currentTaxable * 0.10);
    } else {
        // الوضع الطبيعي (إجمالي الضريبة لحد دلوقتي - اللي اتحصل فعلاً كدان)
        monthlyTax = R(Math.max(0, totalTaxYTD - (prev.pTaxes || 0)));
    }

    const martyrs = R(gross * 0.0005);
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + (deductions || 0));
    const net = R(gross - totalAllDeductions);

    // الـ return مرتب وزي ما الـ HTML يتوقع
    return {
        gross,
        days,
        insuranceEmployee,
        personalExemption,
        currentTaxable,
        prevDays: prev.pDays || 0,
        totalDaysYTD,
        prevTaxable: prev.pTaxable || 0,
        taxPoolYTD,
        annualProjected: taxPoolYTD, // اللي بنطبق عليه الـ Brackets
        totalAnnualTax,
        prevTaxes: prev.pTaxes || 0,
        monthlyTax,
        martyrs,
        totalAllDeductions,
        net
    };
}

module.exports = { runPayrollLogic };

const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    // 1. استخراج كل البيانات بدون نقص
    const { 
        fullBasic, 
        fullTrans, 
        days: manualDays, 
        additions = [], 
        deductions = [],
        hiringDate,      
        resignationDate, 
        month            
    } = input;

    // --- [حساب الأيام بناءً على التواريخ] ---
    const currentMonthDate = new Date(month + "-01");
    const hDate = hiringDate ? new Date(hiringDate) : null;
    const rDate = resignationDate ? new Date(resignationDate) : null;

    let autoDays = 30; 
    let startDay = 1;
    if (hDate && hDate.getMonth() === currentMonthDate.getMonth() && hDate.getFullYear() === currentMonthDate.getFullYear()) {
        startDay = hDate.getDate();
    }
    let endDay = 30; 
    if (rDate && rDate.getMonth() === currentMonthDate.getMonth() && rDate.getFullYear() === currentMonthDate.getFullYear()) {
        endDay = rDate.getDate();
    }
    
    autoDays = Math.max(0, endDay - startDay + 1);
    if (autoDays > 30) autoDays = 30;

    let finalDays = (manualDays !== undefined && Number(manualDays) !== 30) ? Number(manualDays) : autoDays;

    // --- [منطق التأمينات] ---
    const isHiredAfterFirst = hDate && hDate.getDate() > 1 && hDate.getMonth() === currentMonthDate.getMonth();
    const isResignedSameMonth = rDate && rDate.getMonth() === currentMonthDate.getMonth();
    
    let insuranceEmployee = 0;
    const insSalary = Number(emp.insSalary) || 0;
    if (isHiredAfterFirst && !isResignedSameMonth) {
        insuranceEmployee = 0;
    } else {
        insuranceEmployee = R(insSalary * 0.11);
    }

    // --- [الحسابات المالية الأساسية وتعديل الـ Exemptions] ---
    const proratedBasic = R((fullBasic / 30) * finalDays);
    const proratedTrans = R((fullTrans / 30) * finalDays);

    // حساب إجمالي الإضافات (للقبض) وإجمالي الخاضع منها (للضريبة)
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const taxableAdditions = additions.reduce((sum, item) => {
        // لو البند غير معفى (non-exempted) يدخل في الضريبة
        return sum + (item.type !== 'exempted' ? (Number(item.amount) || 0) : 0);
    }, 0);

    // حساب إجمالي الخصومات (للقبض) وإجمالي الخاضع منها (اللي بيقلل الوعاء الضريبي)
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const taxableDeductions = deductions.reduce((sum, item) => {
        // لو الخصم غير معفى (يعني جزاء قانوني مثلاً) يقلل الوعاء الضريبي
        return sum + (item.type !== 'exempted' ? (Number(item.amount) || 0) : 0);
    }, 0);

    // الـ Gross هو كل اللي الموظف هياخده (بما في ذلك البدلات المعفاة)
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // --- [حساب الضرائب - الوعاء الضريبي المعدل] ---
    const personalExemption = R((20000 / 360) * finalDays); 
    
    // الوعاء الضريبي = (الأساسي + البدلات الخاضعة) - التأمينات - الإعفاء الشخصي - الخصومات الخاضعة
    const currentTaxable = R(Math.max(0, (proratedBasic + proratedTrans + taxableAdditions) - insuranceEmployee - personalExemption - taxableDeductions));
    
    const totalDaysYTD = Number(finalDays) + (Number(prev.pDays) || 0);
    const totalTaxableYTD = R(currentTaxable + (Number(prev.pTaxable) || 0));
    
    const rawAnnual = totalDaysYTD > 0 ? (totalTaxableYTD / totalDaysYTD) * 360 : 0;
    const floorAnnual = Math.floor(R(rawAnnual) / 10) * 10;
    
    const ai = totalDaysYTD > 0 ? R((floorAnnual / 360) * totalDaysYTD) : 0;
    const af = totalDaysYTD;
    const L = (val) => af > 0 ? (val / 360) * af : 0;

    let AJ = 0, AK = 0, AL = 0, AM = 0, AN = 0, AO = 0, AP = 0;

    if (ai > 0 && af > 0) {
        AJ = ai > L(600000) ? 0 : L(40000);
        if (ai > L(600000) && ai <= L(700000)) AK = L(55000) * 0.1;
        else if (ai > L(700000)) AK = 0;
        else AK = Math.min(L(15000), Math.max(0, ai - AJ)) * 0.1;

        if (ai > L(700000) && ai <= L(800000)) AL = L(70000) * 0.15;
        else if (ai > L(800000)) AL = 0;
        else AL = Math.min(L(15000), Math.max(0, ai - AJ - (AK / 0.1))) * 0.15;

        if (ai > L(800000) && ai <= L(900000)) AM = L(200000) * 0.2;
        else if (ai > L(900000)) AM = 0;
        else AM = Math.min(L(130000), Math.max(0, ai - AJ - (AK/0.1) - (AL/0.15))) * 0.2;

        if (ai > L(900000) && ai <= L(1200000)) AN = L(400000) * 0.225;
        else if (ai > L(1200000)) AN = 0;
        else AN = Math.min(L(200000), Math.max(0, ai - AJ - (AK/0.1) - (AL/0.15) - (AM/0.2))) * 0.225;

        if (ai > L(1200000)) AO = L(1200000) * 0.25;
        else AO = Math.min(L(800000), Math.max(0, ai - AJ - (AK/0.1) - (AL/0.15) - (AM/0.2) - (AN/0.225))) * 0.25;

        AP = ai > L(1200000) ? (ai - L(1200000)) * 0.275 : 0;
    }

    const totalTaxDueUntilNow = R(AK + AL + AM + AN + AO + AP);
    const prevTaxes = Number(prev.pTaxes) || 0;
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - prevTaxes));

    // --- [الشهداء والصافي] ---
    const martyrs = R(gross * 0.0005);
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    return {
        fullBasic,
        fullTrans,
        days: finalDays,
        proratedBasic,
        proratedTrans,
        totalAdditions,
        additions, 
        deductions, 
        gross,
        insBase: insSalary,
        insuranceEmployee,
        prevDays: Number(prev.pDays) || 0,
        totalDaysYTD,
        prevTaxable: Number(prev.pTaxable) || 0,
        currentTaxable,
        taxPoolYTD: ai,
        annualProjected: floorAnnual,
        totalAnnualTax: totalTaxDueUntilNow,
        prevTaxes: prevTaxes,
        monthlyTax,
        martyrs,
        totalOtherDeductions,
        totalAllDeductions,
        net,
        resignationDate: resignationDate || ""
    };
}

module.exports = { runPayrollLogic };

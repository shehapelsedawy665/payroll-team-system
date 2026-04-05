const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    // 1. استخراج البيانات الأساسية
    const { 
        fullBasic, 
        fullTrans, 
        additions = [], 
        deductions = [],
        hiringDate,      // تاريخ التعيين (YYYY-MM-DD)
        resignationDate, // تاريخ الاستقالة (YYYY-MM-DD)
        month            // الشهر الحالي (YYYY-MM)
    } = input;

    // --- حساب الأيام بناءً على التعيين والاستقالة ---
    const currentMonthDate = new Date(month + "-01");
    const nextMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
    const endOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate();

    let calcDays = 30; // الافتراضي

    const hDate = hiringDate ? new Date(hiringDate) : null;
    const rDate = resignationDate ? new Date(resignationDate) : null;

    // تحديد بداية الشغل في الشهر الحالي
    let startDay = 1;
    if (hDate && hDate.getMonth() === currentMonthDate.getMonth() && hDate.getFullYear() === currentMonthDate.getFullYear()) {
        startDay = hDate.getDate();
    }

    // تحديد نهاية الشغل في الشهر الحالي
    let endDay = 30; // بنعتبر الشهر 30 يوم للحسابات المالية
    if (rDate && rDate.getMonth() === currentMonthDate.getMonth() && rDate.getFullYear() === currentMonthDate.getFullYear()) {
        // لو استقال في نص الشهر، بناخد اليوم اللي استقال فيه
        endDay = rDate.getDate();
    }

    // حساب عدد الأيام الفعلي (مثال: من 2 لـ 5 يساوي 4 أيام: 5 - 2 + 1)
    calcDays = Math.max(0, endDay - startDay + 1);
    if (calcDays > 30) calcDays = 30; // حد أقصى 30 يوم مالي

    // --- حساب التأمينات (منطق خاص) ---
    // القاعدة: لو اتعين بعد يوم 1 "و" مسبش الشغل في نفس الشهر -> ملوش تأمينات
    const isHiredAfterFirst = hDate && hDate.getDate() > 1 && hDate.getMonth() === currentMonthDate.getMonth();
    const isResignedSameMonth = rDate && rDate.getMonth() === currentMonthDate.getMonth();
    
    let insuranceEmployee = 0;
    const insSalary = Number(emp.insSalary) || 0;

    if (isHiredAfterFirst && !isResignedSameMonth) {
        insuranceEmployee = 0; // مفيش تأمينات حسب طلبك
    } else {
        insuranceEmployee = R(insSalary * 0.11); // تأمينات عادية 11%
    }

    // 2. الحسابات المالية الأساسية (Prorated)
    const proratedBasic = R((fullBasic / 30) * calcDays);
    const proratedTrans = R((fullTrans / 30) * calcDays);
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 3. الإعفاء الشخصي مربوط بالأيام
    const personalExemption = R((20000 / 360) * calcDays); 

    // 4. الوعاء الضريبي (AH9)
    const currentTaxable = R(Math.max(0, gross - insuranceEmployee - personalExemption));
    
    // 5. التراكمي (YTD)
    const totalDaysYTD = Number(calcDays) + (Number(prev.pDays) || 0);
    const totalTaxableYTD = R(currentTaxable + (Number(prev.pTaxable) || 0));
    
    // 6. الـ Tax Pool السنوي (AI7)
    const rawAnnual = totalDaysYTD > 0 ? (totalTaxableYTD / totalDaysYTD) * 360 : 0;
    const floorAnnual = Math.floor(R(rawAnnual) / 10) * 10;
    const taxPoolYTD = totalDaysYTD > 0 ? R((floorAnnual / 360) * totalDaysYTD) : 0;
    
    // 7. حساب الضريبة (شرائح الإكسيل Prorated)
    let ai = taxPoolYTD; 
    let af = totalDaysYTD;
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

    // 8. الشهداء والصافي
    const martyrs = R(gross * 0.0005);
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    return {
        fullBasic,
        fullTrans,
        days: calcDays, // الأيام المحسوبة أوتوماتيكياً
        proratedBasic,
        proratedTrans,
        totalAdditions,
        gross,
        insBase: insSalary,
        insuranceEmployee,
        prevDays: Number(prev.pDays) || 0,
        totalDaysYTD,
        prevTaxable: Number(prev.pTaxable) || 0,
        currentTaxable,
        taxPoolYTD: totalTaxableYTD,
        annualProjected: floorAnnual,
        totalAnnualTax: totalTaxDueUntilNow,
        prevTaxes: prevTaxes,
        monthlyTax,
        martyrs,
        totalOtherDeductions,
        totalAllDeductions,
        net
    };
}

module.exports = { runPayrollLogic };

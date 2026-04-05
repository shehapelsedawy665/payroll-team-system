const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    // 1. استخراج البيانات من المدخلات
    const { 
        fullBasic, 
        fullTrans, 
        days, 
        additions = [], 
        deductions = [] 
    } = input;

    // 2. الحسابات الأساسية (Prorated)
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    
    // جمع كل الإضافات والخصومات الخارجية
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    
    // إجمالي الاستحقاقات (Gross)
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // 3. التأمينات الاجتماعية (AV9)
    const insSalary = Number(emp.insSalary) || 0;
    const insuranceEmployee = R(insSalary * 0.11);
    
    // 4. الإعفاء الشخصي (AE9) - مربوط بالأيام (20000 / 360 * Days)
    const personalExemption = R((20000 / 360) * days); 

    // 5. الوعاء الضريبي للشهر الحالي (AH9)
    const currentTaxable = R(Math.max(0, gross - insuranceEmployee - personalExemption));
    
    // 6. الحسابات التراكمية (YTD) - AF7 و AH7
    const totalDaysYTD = Number(days) + (Number(prev.pDays) || 0);
    const totalTaxableYTD = R(currentTaxable + (Number(prev.pTaxable) || 0));
    
    // 7. الـ Tax Pool السنوي المتوقع (AI7) - تطبيق معادلة FLOOR(AH7/AF7*360, 10)/360*AF7
    const rawAnnual = totalDaysYTD > 0 ? (totalTaxableYTD / totalDaysYTD) * 360 : 0;
    const floorAnnual = Math.floor(R(rawAnnual) / 10) * 10; // التقريب لـ 10 قروش لأسفل
    const taxPoolYTD = totalDaysYTD > 0 ? R((floorAnnual / 360) * totalDaysYTD) : 0;
    
    // 8. حساب الضريبة بناءً على شرائح الإكسيل (Prorated Brackets)
    // AI7 = taxPoolYTD, AF7 = totalDaysYTD
    let ai = taxPoolYTD; 
    let af = totalDaysYTD;
    
    // دالة تحويل حدود الشرائح السنوية إلى قيم متناسبة مع عدد الأيام (L function)
    const L = (val) => af > 0 ? (val / 360) * af : 0;

    let AJ = 0, AK = 0, AL = 0, AM = 0, AN = 0, AO = 0, AP = 0;

    if (ai > 0 && af > 0) {
        // الشريحة الأولى 0% (AJ)
        AJ = ai > L(600000) ? 0 : L(40000);

        // شريحة 10% (AK)
        if (ai > L(600000) && ai <= L(700000)) {
            AK = L(55000) * 0.1;
        } else if (ai > L(700000)) {
            AK = 0;
        } else {
            AK = Math.min(L(15000), Math.max(0, ai - AJ)) * 0.1;
        }

        // شريحة 15% (AL)
        if (ai > L(700000) && ai <= L(800000)) {
            AL = L(70000) * 0.15;
        } else if (ai > L(800000)) {
            AL = 0;
        } else {
            AL = Math.min(L(15000), Math.max(0, ai - AJ - (AK / 0.1))) * 0.15;
        }

        // شريحة 20% (AM)
        if (ai > L(800000) && ai <= L(900000)) {
            AM = L(200000) * 0.2;
        } else if (ai > L(900000)) {
            AM = 0;
        } else {
            AM = Math.min(L(130000), Math.max(0, ai - AJ - (AK/0.1) - (AL/0.15))) * 0.2;
        }

        // شريحة 22.5% (AN)
        if (ai > L(900000) && ai <= L(1200000)) {
            AN = L(400000) * 0.225;
        } else if (ai > L(1200000)) {
            AN = 0;
        } else {
            AN = Math.min(L(200000), Math.max(0, ai - AJ - (AK/0.1) - (AL/0.15) - (AM/0.2))) * 0.225;
        }

        // شريحة 25% (AO)
        if (ai > L(1200000)) {
            AO = L(1200000) * 0.25;
        } else {
            AO = Math.min(L(800000), Math.max(0, ai - AJ - (AK/0.1) - (AL/0.15) - (AM/0.2) - (AN/0.225))) * 0.25;
        }

        // شريحة 27.5% (AP)
        AP = ai > L(1200000) ? (ai - L(1200000)) * 0.275 : 0;
    }

    // إجمالي الضريبة التراكمية المستحقة (AQ7)
    const totalTaxDueUntilNow = R(AK + AL + AM + AN + AO + AP);
    
    // 9. ضريبة الشهر الحالي (Monthly Tax)
    const prevTaxes = Number(prev.pTaxes) || 0;
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - prevTaxes));

    // 10. المساهمة التكافلية (شهداء)
    const martyrs = R(gross * 0.0005);

    // 11. الصافي النهائي
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    // إرجاع الأرقام بالكامل للجدول وللداتابيز
    return {
        fullBasic,
        fullTrans,
        days,
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
        taxPoolYTD: totalTaxableYTD, // تخزين الوعاء التراكمي الفعلي
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

const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function runPayrollLogic(input, prev, emp) {
    // --- [اللوجيك الأصلي الصارم بدون أي تبسيط للـ Gross-to-Net] ---
    const { fullBasic, fullTrans, days: manualDays, additions = [], deductions = [], hiringDate, resignationDate, month } = input;
    const currentMonthDate = new Date(month + "-01");
    const hDate = hiringDate ? new Date(hiringDate) : null;
    const rDate = resignationDate ? new Date(resignationDate) : null;

    let autoDays = 30; 
    let startDay = 1;
    if (hDate && hDate.getMonth() === currentMonthDate.getMonth() && hDate.getFullYear() === currentMonthDate.getFullYear()) { startDay = hDate.getDate(); }
    let endDay = 30; 
    if (rDate && rDate.getMonth() === currentMonthDate.getMonth() && rDate.getFullYear() === currentMonthDate.getFullYear()) { endDay = rDate.getDate(); }
    
    autoDays = Math.max(0, endDay - startDay + 1);
    if (autoDays > 30) autoDays = 30;
    let finalDays = (manualDays !== undefined && Number(manualDays) !== 30) ? Number(manualDays) : autoDays;

    const isHiredAfterFirst = hDate && hDate.getDate() > 1 && hDate.getMonth() === currentMonthDate.getMonth();
    const isResignedSameMonth = rDate && rDate.getMonth() === currentMonthDate.getMonth();
    
    let insuranceEmployee = 0;
    const insSalary = Number(emp.insSalary) || 0;
    if (isHiredAfterFirst && !isResignedSameMonth) insuranceEmployee = 0;
    else insuranceEmployee = R(insSalary * 0.11);

    const proratedBasic = R((fullBasic / 30) * finalDays);
    const proratedTrans = R((fullTrans / 30) * finalDays);
    const totalAdditionsAmount = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gross = R(proratedBasic + proratedTrans + totalAdditionsAmount);

    const taxableAdditions = additions.reduce((sum, item) => {
        const amt = Number(item.amount) || 0;
        const name = item.name.trim().toLowerCase();
        if (name === "medical" && item.type === 'exempted') {
            const limit1 = R(gross * 0.15);
            const limit2 = R((10000 / 360) * finalDays);
            return sum + Math.max(0, amt - Math.min(limit1, limit2));
        }
        return sum + (item.type === 'non-exempted' ? amt : 0);
    }, 0);

    const taxableDeductions = deductions.reduce((sum, item) => {
        const amt = Number(item.amount) || 0;
        const name = item.name.trim().toLowerCase();
        if (name === "medical" && item.type === 'exempted') {
            return sum + Math.min(amt, R(gross * 0.15), R((10000 / 360) * finalDays));
        }
        return sum + (item.type === 'exempted' ? amt : 0);
    }, 0);

    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const personalExemption = R((20000 / 360) * finalDays); 
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

    const martyrs = R(gross * 0.0005);
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    const net = R(gross - totalAllDeductions);

    return {
        fullBasic, fullTrans, days: finalDays, proratedBasic, proratedTrans, totalAdditions: totalAdditionsAmount,
        additions, deductions, gross, insBase: insSalary, insuranceEmployee,
        prevDays: Number(prev.pDays) || 0, totalDaysYTD, prevTaxable: Number(prev.pTaxable) || 0, currentTaxable, taxPoolYTD: ai,
        annualProjected: floorAnnual, totalAnnualTax: totalTaxDueUntilNow, prevTaxes, monthlyTax, martyrs, totalOtherDeductions, totalAllDeductions,
        net, resignationDate: resignationDate || ""
    };
}

// --- AI Payroll Auditor (Anomaly Detection) ---
function runAIAuditor(currentPayload, prevPayload) {
    const alerts = [];
    if (!prevPayload || prevPayload.net === 0) return alerts;
    const diffNet = Math.abs(currentPayload.net - prevPayload.net) / prevPayload.net;
    if (diffNet > 0.3) alerts.push(`⚠️ تحذير: اختلاف في صافي الراتب بنسبة ${(diffNet * 100).toFixed(1)}% عن الشهر السابق.`);
    
    if (currentPayload.currentTaxable > 0 && currentPayload.monthlyTax === 0 && currentPayload.days === 30) {
        alerts.push(`⚠️ تحذير: الوعاء الضريبي موجب (${currentPayload.currentTaxable}) ولكن الضريبة صفر.`);
    }
    return alerts;
}

// --- One-Click Offboarding Settlement ---
function calculateOffboarding(emp, leaveBalance, unpaidLoans, unreturnedAssets) {
    const dailyRate = emp.basicSalary / 30;
    const remainingLeavesValue = (leaveBalance.annual - leaveBalance.annualUsed) * dailyRate;
    
    let totalDeductions = 0;
    const deductionsBreakdown = [];
    
    unpaidLoans.forEach(loan => {
        const remaining = loan.amount - loan.paidAmount;
        totalDeductions += remaining;
        deductionsBreakdown.push({ name: "تسوية سلفة", amount: remaining });
    });

    unreturnedAssets.forEach(asset => {
        totalDeductions += asset.assetValue;
        deductionsBreakdown.push({ name: `تسوية عهدة مفقودة: ${asset.itemName}`, amount: asset.assetValue });
    });

    return { remainingLeavesValue, totalDeductions, deductionsBreakdown };
}

// --- منظومة الضرائب الموحدة (مطابق بنسبة 100% للملف المرفق) ---
function generateTaxExportCSV(records) {
    const headers = [
        "مسلسل", "كود الموظف", "اسم الموظف", "الجنسية", "الرقم القومي", "رقم جواز السفر", "رقم جواز السفر الجديد", "رقم التليفون", 
        "حالة تصريح العمل لغير المصريين", "رقم تصريح العمل", "الوظيفة", "اسم الجهة/الفرع", "المعاملة الضريبية", "رقم التسجيل الضريبي لجهة العمل الأصلية", 
        "مدة العمل", "الحالة التأمينية", "الرقم التأمينى", "تاريخ الالتحاق بالتأمينات", "قسط مدة سابقة", "تاريخ نهاية الخدمة", 
        "تاريخ انتهاء الاشتراك من التأمينات الاجتماعية", "الأجر الشامل", "بدلات غير خاضعة تأمينيأ", "الأجر التأميني", "حالة التأمين الصحي الشامل", 
        "عدد الزوجات الغير عاملات (التأمين الصحي الشامل)", "عدد المعالين (التأمين الصحي الشامل)", "المرتب الأساسي", "مكافات وحوافز/أجر إضافي/منح", 
        "علاوات خاصة معفاة", "علاوات خاصة خاضعة", "عمولات", "نصيب العامل في الأرباح", "مقابل الخدمة", "البقشيش", 
        "مرتبات ومكافات رؤساء اعضاء مجلس الادارة (مقابل العمل الإداري)", "المقابل النقدى لرصيد الاجازات أثناء الخدمة", "مكافأة نهاية الخدمة الخاضعة", 
        "مبالغ منصرفة بقوانين خاصة (الجزء المعفي منها)", "إضافات وبدلات اخرى خاضعة", "ما تحملته المنشاة من ضريبة مرتبات", 
        "ما تحملته المنشأه من حصة العامل في التأمينات الاجتماعيه", "مبالغ خاضعة منصرفة بصورة ربع سنوية", "مبالغ خاضعة منصرفة بصورة نصف سنوية", 
        "مبالغ خاضعة منصرفة بصورة سنوية", "مزايا: السيارات", "مزايا: الهواتف المحمولة", "مزايا: قروض وسلف", "مزايا: التأمين على الحياة (حصة صاحب العمل)", 
        "مزايا: اسهم الشركة داخل مصر او خارج مصر", "مزايا أخرى", "اجمالى الاستحقاقات", "حصة العامل فى التأمينات الإجتماعية والمعاشات", 
        "حصة العامل المستقطعة في التأمين الصحي الشامل", "مبالغ معفاة بقوانين خاصة", "علاوات خاصة معفاة", 
        "العلاوة الاجتماعية/الإضافية لجهات حكومية و ق.ع. وغير خاضع للخدمة المدنية", "الاعفاء الشخصى", "اقساط (مدة سابقة/اعارة/اعتبارية)", 
        "نصيب العامل في الأرباح", "اشتراكات العاملين فى صناديق التامين التى تنشاء طبقا لاحكام ق 54 لسنة 75", 
        "اشتراكات العاملين فى صناديق التامين التى تنشأ طبقا لاحكام ق 155 لسنة 2024", "أقساط التأمين على حياة الممول لمصلحتة ومصلحةزوجته وأولاده القصر", 
        "أقساط التأمين الصحي", "أقساط تأمين لإستحقاق معاش", "إجمالي اشتراكات صناديق التأمين", "اجمالى الاستقطاعات", "صافى الدخل (وعاء الفتره)", 
        "الوعاء السنوى", "الضريبة المستحقة عن الفترة للعمالة الاصلية", "الضريبة المستحقة عن الفترة للعمالة المدرجه بنموذج 3 مرتبات", 
        "الضريبة المستحقة عن الفترة للعمالة المدرجه بنموذج 2 مرتبات", "اجمالى الضريبة المستحقة عن جميع انواع العمالة", "الضريبة المحتسبة عن الفترة", 
        "الضريبة المحتسبة عن الفترات السابقة للمعاملات الضريبية 1 و4 و5 و6 و7", "الضريبة المحتسبة عن الفترة للمعاملات الضريبية 1 و4 و5 و6 و7", 
        "الضريبة المحتسبة عن الفترات السابقة للمعاملة ضريبية 2", "الضريبة المحتسبة عن الفترة للمعاملة ضريبية 2", 
        "الضريبة المحتسبة عن الفترات السابقة للمعاملة ضريبية 3", "الضريبة المحتسبة عن الفترة للمعاملة ضريبية 3", "صافي الأجر النهائي", 
        "مشاركه اجتماعيه استقطاع لصندوق الشهداء وما فى حكمها", "دعم ذوي الهمم (قانون 200 لسنة 2020)", "اضافات: قيمة السلفة/قروض", 
        "اضافات: قيمة مكافأة نهاية الخدمة الغير خاضعة", "اضافات: قيمة رصيد الأجازات الغير خاضعة", "اضافات أخرى", "استقطاعات: نفقة", 
        "استقطاعات: قيمة قسط السلفة/القرض", "استقطاعات: اشتراكات نقابات/أندية", "استقطاعات: جزاءات", "استقطاعات: قيمة قسط بوليصة التأمين على الحياة", 
        "استقطاعات أخرى", "حصة الشركة في التأمينات الاجتماعية", "حصة الشركة في التأمين الصحي الشامل", "المساهمة فى صندوق الشهداء", "الدمغات", 
        "المبالغ المحولة فعلياً"
    ].join(",");

    const rows = records.map((r, i) => {
        const p = r.payload;
        const e = r.employeeId || {};
        
        const row = Array(97).fill(""); 
        row[0] = i + 1; // مسلسل
        row[1] = e._id?.toString() || ""; // كود
        row[2] = e.name || "";
        row[3] = "مصر"; 
        row[4] = e.nationalId || "";
        row[7] = e.phone || "";
        row[10] = e.position || "";
        row[11] = e.department || "";
        row[12] = "1"; // عمالة أصلية
        row[14] = p.days; // مدة العمل
        row[15] = "1"; // خاضع تأمينياً
        row[17] = e.hiringDate || "";
        row[19] = e.resignationDate || "";
        row[21] = p.gross; // أجر شامل
        row[23] = p.insBase; // تأميني
        row[27] = p.proratedBasic; // أساسي
        row[28] = p.totalAdditions; // حوافز
        row[52] = p.gross; // اجمالي الاستحقاقات
        row[53] = p.insuranceEmployee; // حصة التأمينات
        row[57] = R((20000 / 360) * p.days); // اعفاء شخصي
        row[67] = p.currentTaxable; // وعاء الفترة
        row[68] = p.annualProjected; // وعاء سنوي
        row[69] = p.monthlyTax; // ضريبة عمالة أصلية
        row[73] = p.monthlyTax; // محتسبة عن الفترة
        row[80] = p.net; // صافي أجر نهائي
        row[81] = p.martyrs; // شهداء
        row[96] = p.net; // مبالغ محولة فعليا

        return row.join(",");
    });

    return [headers, ...rows].join("\n");
}

module.exports = { runPayrollLogic, runAIAuditor, calculateOffboarding, generateTaxExportCSV };
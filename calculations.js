const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// دالة لحساب الضريبة المصرية بناءً على الشرائح
function calculateEgyptianTax(annualProjected) {
    let tax = 0;
    const ai = annualProjected; 
    let start0 = ai > 600000 ? 0 : 40000;
    let remainder = ai - start0;
    if (remainder <= 0) return 0;

    const brackets = [
        { limit: 15000, rate: 0.10 },
        { limit: 15000, rate: 0.15 },
        { limit: 130000, rate: 0.20 },
        { limit: 200000, rate: 0.225 },
        { limit: 800000, rate: 0.25 },
        { limit: Infinity, rate: 0.275 }
    ];

    for (let b of brackets) {
        if (remainder <= 0) break;
        let chunk = Math.min(remainder, b.limit);
        tax += chunk * b.rate;
        remainder -= chunk;
    }
    return tax;
}

// الدالة الأساسية لحساب الرواتب والضرائب
function runPayrollLogic(input, prev, emp) {
    const { fullBasic, fullTrans, days, additions = [], deductions = [] } = input;
    
    // حساب النسبة المئوية للراتب حسب الأيام
    const proratedBasic = R((fullBasic / 30) * days);
    const proratedTrans = R((fullTrans / 30) * days);
    
    // جمع الإضافات والخصومات
    const totalAdditions = additions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOtherDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    
    // حساب الإجمالي الإجمالي
    const gross = R(proratedBasic + proratedTrans + totalAdditions);

    // حساب التأمينات
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    const insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
    const insuranceEmployee = R(insBase * 0.11);
    
    // حسابات أخرى
    const martyrs = R(gross * 0.0005);
    const personalExemption = R((20000 / 360) * days); 

    // حساب الدخل الخاضع للضريبة الحالي
    const currentTaxable = R(Math.max(0, (gross - insuranceEmployee) - personalExemption));
    
    // حساب الإجمالي السنوي حتى الآن
    const totalDaysYTD = days + (prev.pDays || 0);
    const totalTaxableYTD = R(currentTaxable + (prev.pTaxable || 0));
    
    // حساب الدخل الخاضع للضريبة السنوي
    const rawAnnual = R((totalTaxableYTD / totalDaysYTD) * 360);
    const floorAnnual = Math.floor(rawAnnual / 10) * 10;

    // حساب الـtax pool الحقيقي بناءً على الـtax pool السابق
    const taxPool = prev.taxPool !== undefined ? prev.taxPool : 0; // قيمة الـtax pool السابقة
    const taxPoolYTD = R(taxPool + (floorAnnual / 360) * totalDaysYTD);

    // حساب الضرائب السنوية بناءً على الشرائح
    const totalAnnualTax = calculateEgyptianTax(floorAnnual);
    const taxUntilNow = R((totalAnnualTax / 360) * totalDaysYTD);

    // الضرائب الشهرية بناءً على الـtax pool الحقيقي
    const monthlyTax = R(Math.max(0, taxUntilNow - (prev.pTaxes || 0)));

    // إجمالي الخصومات
    const totalAllDeductions = R(insuranceEmployee + monthlyTax + martyrs + totalOtherDeductions);
    
    // صافي الراتب
    const net = R(gross - totalAllDeductions);

    // إرجاع جميع القيم
    return {
        fullBasic,
        fullTrans,
        days,
        proratedBasic,
        proratedTrans,
        totalAdditions,
        gross,
        insBase,
        insuranceEmployee,
        prevDays: prev.pDays || 0,
        totalDaysYTD,
        prevTaxable: prev.pTaxable || 0,
        currentTaxable,
        taxPool: taxPool, // تمرير قيمة الـtax pool الحالية للخروج
        taxPoolYTD,
        annualProjected: floorAnnual,
        totalAnnualTax,
        prevTaxes: prev.pTaxes || 0,
        monthlyTax,
        martyrs,
        totalOtherDeductions,
        totalAllDeductions,
        net
    };
}

module.exports = { runPayrollLogic };

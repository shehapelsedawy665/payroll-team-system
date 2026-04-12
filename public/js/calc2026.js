// public/js/calculator.js

function calculateAnnualTaxLocal(annualTaxableIncome) {
    let income = annualTaxableIncome;
    let tax = 0;

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

    let remaining = income;
    for (const b of brackets) {
        if (remaining <= 0) break;
        const taxable = Math.min(remaining, b.limit);
        tax += taxable * b.rate;
        remaining -= taxable;
    }
    return tax; 
}

function calcG2NLive() {
    const basic = Number(document.getElementById('calc-basic').value) || 0;
    const trans = Number(document.getElementById('calc-trans').value) || 0;
    const insInput = Number(document.getElementById('calc-ins').value) || 16700;
    const exemp = Number(document.getElementById('calc-exemption').value) || 20000;
    const div = document.getElementById('g2n-result');

    if (!basic) { div.innerHTML = ''; return; }

    const gross = basic + trans;
    const actualIns = Math.max(5384.62, Math.min(insInput, 16700));
    
    const insEmp = actualIns * 0.11;
    const insComp = actualIns * 0.1875;
    
    const monthlyExemptions = insEmp + (exemp / 12);
    const annualTaxable = Math.max(0, (gross - monthlyExemptions) * 12);
    const annualTax = calculateAnnualTaxLocal(annualTaxable);
    const monthTax = annualTax / 12;
    
    // 🔥 السر كان هنا: صندوق الشهداء 🔥
    const martyrs = gross * 0.0005; 
    
    const net = gross - insEmp - monthTax - martyrs;

    div.innerHTML = `
        <div class="result-row add" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span class="label">الإجمالي</span><span class="value" style="color:var(--green)">${fmt(gross)} ج</span>
        </div>
        <div class="result-row deduct" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span class="label">تأمين الموظف (11%)</span><span class="value" style="color:var(--red)">${fmt(insEmp)} ج</span>
        </div>
        <div class="result-row deduct" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span class="label">الوعاء الضريبي السنوي</span><span class="value" style="color:var(--text)">${fmt(annualTaxable)} ج</span>
        </div>
        <div class="result-row deduct" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span class="label">ضريبة الدخل الشهرية</span><span class="value" style="color:var(--red)">${fmt(monthTax)} ج</span>
        </div>
        <div class="result-row deduct" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span class="label">صندوق الشهداء</span><span class="value" style="color:var(--red)">${fmt(martyrs)} ج</span>
        </div>
        <div class="result-row total" style="display:flex; justify-content:space-between; padding:12px 0; margin-top:10px; font-weight:bold; font-size:16px;">
            <span class="label">💰 الصافي</span><span class="value" style="color:var(--gold)">${fmt(net)} ج</span>
        </div>
    `;
}

function calcN2GLive() {
    const targetNet = Number(document.getElementById('calc-target-net').value) || 0;
    const insInput = Number(document.getElementById('calc-n2g-ins').value) || 16700;
    const exemp = 20000;
    const div = document.getElementById('n2g-result');

    if (!targetNet) { div.innerHTML = ''; return; }

    let minG = targetNet;
    let maxG = targetNet * 2.5; 
    let bestGross = targetNet;
    let finalInsEmp = 0;
    let finalMonthTax = 0;
    let finalMartyrs = 0;
    let finalNet = 0;

    for (let i = 0; i < 100; i++) {
        let testGross = (minG + maxG) / 2;
        
        let actualIns = Math.max(5384.62, Math.min(insInput, 16700));
        let insEmp = actualIns * 0.11; 
        
        let monthExemp = insEmp + (exemp / 12);
        let annualTaxable = Math.max(0, (testGross - monthExemp) * 12);
        let monthTax = calculateAnnualTaxLocal(annualTaxable) / 12;
        
        let martyrs = testGross * 0.0005; // 🔥 صندوق الشهداء في اللوب
        
        let currentNet = testGross - insEmp - monthTax - martyrs;

        if (Math.abs(currentNet - targetNet) < 0.01) {
            bestGross = testGross;
            finalInsEmp = insEmp;
            finalMonthTax = monthTax;
            finalMartyrs = martyrs;
            finalNet = currentNet;
            break;
        }

        if (currentNet > targetNet) maxG = testGross;
        else minG = testGross;
        
        bestGross = testGross;
        finalInsEmp = insEmp;
        finalMonthTax = monthTax;
        finalMartyrs = martyrs;
        finalNet = currentNet;
    }

    div.innerHTML = `
        <div class="result-row add" style="background: var(--primary-dim); padding: 10px; border-radius: 8px; display:flex; justify-content:space-between;">
            <span class="label" style="color: var(--primary);">الإجمالي المطلوب:</span>
            <span class="value" style="font-size: 18px; font-weight:bold; color: var(--primary);">${fmt(bestGross)} ج</span>
        </div>
        <div class="result-row deduct" style="display:flex; justify-content:space-between; margin-top:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
            <span class="label">التأمينات (11%)</span>
            <span class="value" style="color:var(--red);">${fmt(finalInsEmp)} ج</span>
        </div>
        <div class="result-row deduct" style="display:flex; justify-content:space-between; margin-top:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
            <span class="label">ضريبة الدخل</span>
            <span class="value" style="color:var(--red);">${fmt(finalMonthTax)} ج</span>
        </div>
        <div class="result-row deduct" style="display:flex; justify-content:space-between; margin-top:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
            <span class="label">صندوق الشهداء</span>
            <span class="value" style="color:var(--red);">${fmt(finalMartyrs)} ج</span>
        </div>
        <div class="result-row add" style="display:flex; justify-content:space-between; margin-top:10px;">
            <span class="label">✅ الصافي الفعلي</span>
            <span class="value" style="color:var(--green); font-weight:bold;">${fmt(finalNet)} ج</span>
        </div>
    `;
}

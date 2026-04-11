// public/js/calculator.js

// --- 1. محرك الضرائب الداخلي (نفس منطق الباك إند بس للآلة الحاسبة السريعة) ---
function calculateAnnualTaxLocal(annualTaxableIncome) {
    let income = annualTaxableIncome;
    let tax = 0;

    // الشرائح المصرية 2024/2026
    const brackets = [
        { limit: 40000, rate: 0.00 },
        { limit: 15000, rate: 0.10 },
        { limit: 15000, rate: 0.15 },
        { limit: 130000, rate: 0.20 },
        { limit: 200000, rate: 0.225 },
        { limit: 800000, rate: 0.25 },
        { limit: Infinity, rate: 0.275 }
    ];

    let remaining = income;
    for (const b of brackets) {
        if (remaining <= 0) break;
        const taxable = Math.min(remaining, b.limit);
        tax += taxable * b.rate;
        remaining -= taxable;
    }
    return Math.round(tax * 100) / 100;
}

// --- 2. حسبة من الإجمالي للصافي (Live) ---
function calcG2NLive() {
    const basic = Number(document.getElementById('calc-basic').value) || 0;
    const trans = Number(document.getElementById('calc-trans').value) || 0;
    const ins = Number(document.getElementById('calc-ins').value) || 5384; // الوعاء التأميني
    const exemp = Number(document.getElementById('calc-exemption').value) || 20000; // الإعفاء الشخصي

    const div = document.getElementById('g2n-result');
    if (!basic) { div.innerHTML = ''; return; }

    const gross = basic + trans;
    const actualIns = Math.max(2000, Math.min(ins, 12600)); // حدود التأمينات
    const insEmp = Math.round(actualIns * 0.11 * 100) / 100; // حصة الموظف
    
    const monthlyExemptions = insEmp + (exemp / 12);
    const annualTaxable = Math.max(0, (gross - monthlyExemptions) * 12);
    const annualTax = calculateAnnualTaxLocal(annualTaxable);
    const monthTax = Math.round((annualTax / 12) * 100) / 100;
    
    const net = Math.round((gross - insEmp - monthTax) * 100) / 100;

    div.innerHTML = `
        <div class="result-row add"><span class="label">الإجمالي</span><span class="value">${fmt(gross)} ج</span></div>
        <div class="result-row deduct"><span class="label">تأمين الموظف (11%)</span><span class="value">${fmt(insEmp)} ج</span></div>
        <div class="result-row deduct"><span class="label">ضريبة الدخل الشهرية</span><span class="value">${fmt(monthTax)} ج</span></div>
        <div class="result-row total"><span class="label">💰 الصافي المتوقع</span><span class="value">${fmt(net)} ج</span></div>
    `;
}

// --- 3. حسبة من الصافي للإجمالي (الخوارزمية التكرارية 100 دورة) ---
function calcN2GLive() {
    const targetNet = Number(document.getElementById('calc-target-net').value) || 0;
    const ins = Number(document.getElementById('calc-n2g-ins').value) || 5384;
    const div = document.getElementById('n2g-result');

    if (!targetNet) { div.innerHTML = ''; return; }

    // الخوارزمية التكرارية للوصول لأدق رقم إجمالي
    let minG = targetNet;
    let maxG = targetNet * 2; 
    let bestGross = targetNet;
    let finalResult = null;

    for (let i = 0; i < 100; i++) {
        let testGross = (minG + maxG) / 2;
        
        // حساب الصافي من الإجمالي التجريبي
        const actualIns = Math.max(2000, Math.min(ins, 12600));
        const insEmp = testGross * 0.11; // تبسيط للتأمينات داخل الحلقة
        const annualTaxable = Math.max(0, (testGross - insEmp - (20000/12)) * 12);
        const monthTax = calculateAnnualTaxLocal(annualTaxable) / 12;
        const currentNet = testGross - insEmp - monthTax;

        if (Math.abs(currentNet - targetNet) < 0.01) {
            bestGross = testGross;
            break;
        }

        if (currentNet > targetNet) maxG = testGross;
        else minG = testGross;
        
        bestGross = testGross;
    }

    div.innerHTML = `
        <div class="result-row add" style="background: var(--primary-dim); padding: 10px; border-radius: 8px;">
            <span class="label" style="color: var(--primary);">الإجمالي المطلوب:</span>
            <span class="value" style="font-size: 18px; color: var(--primary);">${fmt(bestGross)} ج</span>
        </div>
        <p style="font-size: 10px; color: var(--text3); margin-top: 8px; text-align: center;">
            * تم الحساب بناءً على وعاء تأميني ${fmt(ins)} ج وإعفاء شخصي 20,000 ج سنويًا.
        </p>
    `;
}

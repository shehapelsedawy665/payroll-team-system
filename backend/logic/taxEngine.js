// backend/logic/taxEngine.js
const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(ai, af) {
    const L = (val) => af > 0 ? (val / 360) * af : 0;
    let AJ = 0, AK = 0, AL = 0, AM = 0, AN = 0, AO = 0, AP = 0;

    if (ai > 0 && af > 0) {
        // منطق الشرائح المصري 2024/2026 (المستوحى من ملف الـ Main الأصلي)
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
    return R(AK + AL + AM + AN + AO + AP);
}

module.exports = { calculateEgyptianTax, R };

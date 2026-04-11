// backend/logic/payrollEngine.js
const { calculateEgyptianTax, R } = require('./taxEngine');
const EGY = require('../config/constants');

function runPayrollLogic(input, prev, emp) {
    // هنا هنحط نفس الكود بتاع ملف الـ Main اللي بعتهولي (الأول)
    // مع تعديل بسيط إنه ينادي calculateEgyptianTax
    
    // ... (نفس حسابات الأيام والتأمينات من كود الـ Main) ...
    
    // عند حساب الضريبة:
    const totalTaxDueUntilNow = calculateEgyptianTax(ai, af);
    
    // ... (باقي الحسبة لحد الـ Net) ...

    return {
        // الـ Object اللي بيرجع للـ Frontend
        net: net,
        monthlyTax: monthlyTax,
        // وكل التفاصيل التانية...
    };
}

module.exports = { runPayrollLogic };

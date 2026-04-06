const jwt = require('jsonwebtoken');

/**
 * Middleware للحماية والتحقق من الهوية (Authentication)
 * وظيفته: "التفتيش" على الـ Token ومنع أي حد يدخل يشوف بيانات الموظفين بدون صلاحية
 */
const auth = (req, res, next) => {
    try {
        // 1. الحصول على الـ Token من الهيدر (Authorization)
        const authHeader = req.header('Authorization');

        // التحقق من وجود الهيدر وبدايته بكلمة Bearer
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'غير مسموح بالدخول: الـ Token غير موجود أو بتنسيق خاطئ' 
            });
        }

        // 2. استخراج الـ Token الفعلي
        const token = authHeader.split(' ')[1];

        // 3. التحقق من صحة التشفير (Verification)
        // توحيد الـ Secret Key مع الـ Auth Route لضمان القبول
        const secret = process.env.JWT_SECRET || 'seday_erp_secret_key_2026';
        
        const decoded = jwt.verify(token, secret);

        /**
         * 4. ربط بيانات الشركة بالـ Request
         * بنستخدم الـ decoded اللي جواه (companyId) اللي عملناه في الـ Login
         */
        if (!decoded || !decoded.companyId) {
            return res.status(401).json({ 
                success: false, 
                message: 'الـ Token صالح ولكن لا يحتوي على بيانات الشركة' 
            });
        }

        // وضع الـ ID في الـ req.user عشان نقدر نفلتر الموظفين في الـ Routes الجاية
        req.user = decoded; 
        
        next(); // اسمح بالمرور للمسار (Route) التالي

    } catch (err) {
        console.error("Auth Middleware Error:", err.message);
        
        // التعامل مع حالة انتهاء صلاحية الـ Token (Expired)
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'انتهت صلاحية الجلسة، برجاء تسجيل الدخول مرة أخرى' 
            });
        }

        res.status(401).json({ 
            success: false, 
            message: 'الـ Token غير صالح أو تالف' 
        });
    }
};

module.exports = auth;

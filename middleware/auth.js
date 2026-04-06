const jwt = require('jsonwebtoken');

/**
 * Middleware للحماية والتحقق من الهوية (Authentication)
 * وظيفته: التأكد من وجود Token صالح واستخراج بيانات الشركة (companyId)
 */
const auth = (req, res, next) => {
    // 1. الحصول على الـ Token من الهيدر (Authorization)
    const authHeader = req.header('Authorization');

    // التحقق لو الـ Header موجود أصلاً وبصيغة Bearer
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access Denied. Token format is invalid (Use Bearer [token])' 
        });
    }

    // 2. استخراج الـ Token الفعلي بعد كلمة Bearer
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access Denied. No token found after Bearer prefix.' 
        });
    }

    try {
        // 3. التحقق من صحة التشفير
        // ملاحظة: تأكد من إضافة JWT_SECRET في إعدادات Vercel Environment Variables
        // تم توحيد الـ Secret Key لضمان عمل الـ Login مع الـ Middleware
        const secret = process.env.JWT_SECRET || 'SEDAY_ERP_SECRET_2026';
        
        const decoded = jwt.verify(token, secret);

        // 4. وضع بيانات الشركة داخل الـ Request لضمان عزل البيانات (Multi-tenancy)
        // بنخلي الـ req.user يشيل البيانات اللي جاية من الـ decoded مباشرة
        req.user = decoded; 
        
        // التأكد من وجود معرف الشركة (companyId) لضمان الأمان
        if (!req.user || !req.user.companyId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token is valid but does not contain company context.' 
            });
        }
        
        next(); // اسمح بالمرور للـ Route التالي
    } catch (err) {
        console.error("Auth Middleware Error:", err.message);
        res.status(401).json({ 
            success: false, 
            message: 'Invalid, expired, or corrupted token.' 
        });
    }
};

module.exports = auth;

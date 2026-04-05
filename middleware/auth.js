const jwt = require('jsonwebtoken');

/**
 * Middleware للحماية والتحقق من الهوية (Authentication)
 * وظيفته: التأكد من وجود Token صالح واستخراج بيانات الشركة (companyId)
 */
const auth = (req, res, next) => {
    // 1. الحصول على الـ Token من الهيدر (Authorization)
    // بيبقى شكله عادة: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    const authHeader = req.header('Authorization');

    // التحقق لو الـ Header موجود أصلاً
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access Denied. No token provided or format is invalid.' 
        });
    }

    // 2. استخراج الـ Token من كلمة Bearer
    const token = authHeader.split(' ')[1];

    try {
        // 3. التحقق من صحة التشفير
        // ملاحظة: استبدل 'YOUR_JWT_SECRET' بمتغير بيئة في إنتاجك الفعلي
        const secret = process.env.JWT_SECRET || 'SEDAY_ERP_SECRET_2026';
        const decoded = jwt.verify(token, secret);

        // 4. وضع بيانات المستخدم والشركة داخل الـ Request 
        // عشان الـ APIs اللي بعد كدة (زي الموظفين) تعرف هي تبع مين
        req.user = decoded.user; 
        
        //decoded.user بيبقى فيه: { id, companyId, role }
        
        next(); // اسمح بالمرور للـ Route التالي
    } catch (err) {
        // لو الـ Token منتهي الصلاحية أو تم التلاعب به
        res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token.' 
        });
    }
};

module.exports = auth;

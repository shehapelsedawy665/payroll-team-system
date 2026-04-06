const mongoose = require('mongoose');

/**
 * إعدادات الثوابت العالمية لـ Seday ERP 2026
 * تم ضبط القيم بناءً على قوانين الضرائب والتأمينات المصرية المحدثة
 */
const GLOBAL_DEFAULTS = {
    INS_EE_PERCENT: 0.11,           // حصة الموظف في التأمينات 11%
    INS_CO_PERCENT: 0.1875,         // حصة الشركة في التأمينات 18.75%
    MAX_INS_SALARY: 16700,          // الحد الأقصى لأجر الاشتراك التأميني 2026
    MIN_INS_SALARY: 2325,           // الحد الأدنى لأجر الاشتراك التأميني
    PERSONAL_EXEMPTION: 20000,      // الإعفاء الشخصي السنوي للموظف
    MEDICAL_EXEMPTION_LIMIT: 10000  // الحد الأقصى السنوي للإعفاء الطبي (833.33 شهرياً)
};

const companySchema = new mongoose.Schema({
    // معلومات هوية الشركة
    name: { 
        type: String, 
        required: [true, 'اسم الشركة مطلوب'], 
        trim: true 
    },
    // إيميل الأدمن الأساسي (Owner)
    adminEmail: { 
        type: String, 
        required: [true, 'إيميل الأدمن مطلوب'], 
        unique: true,
        lowercase: true,
        trim: true 
    },
    // البريد المستخدم في تسجيل دخول الشركة كـ Entity
    email: {
        type: String,
        required: [true, 'بريد تسجيل الدخول مطلوب'],
        unique: true,
        lowercase: true,
        trim: true
    },
    // كلمة المرور (يجب تشفيرها باستخدام bcrypt قبل الحفظ)
    password: {
        type: String,
        required: [true, 'كلمة المرور مطلوبة']
    },
    
    // إعدادات الشركة القابلة للتخصيص
    settings: {
        insEmployeePercent: { 
            type: Number, 
            default: GLOBAL_DEFAULTS.INS_EE_PERCENT 
        },
        maxInsSalary: { 
            type: Number, 
            default: GLOBAL_DEFAULTS.MAX_INS_SALARY 
        },
        personalExemption: { 
            type: Number, 
            default: GLOBAL_DEFAULTS.PERSONAL_EXEMPTION 
        },
        medicalExemptionLimit: {
            type: Number,
            default: GLOBAL_DEFAULTS.MEDICAL_EXEMPTION_LIMIT
        },
        companyLogo: { 
            type: String, 
            default: "" 
        },
        isActive: { 
            type: Boolean, 
            default: true 
        }
    },
    
    createdAt: { type: Date, default: Date.now },
    lastSettingsUpdate: { type: Date, default: Date.now }
});

/**
 * Middleware: تحديث تاريخ التعديل تلقائياً قبل الحفظ
 */
companySchema.pre('save', function(next) {
    this.lastSettingsUpdate = Date.now();
    next();
});

/**
 * التصدير النهائي (Serverless Optimized)
 * يمنع خطأ "OverwriteModelError" المتكرر في Vercel
 */
module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);

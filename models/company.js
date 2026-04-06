const mongoose = require('mongoose');

/**
 * إعدادات الثوابت العالمية لـ Seday ERP
 * تم التحديث لتشمل التعديلات الضريبية المطلوبة 2026
 */
const GLOBAL_DEFAULTS = {
    INS_EE_PERCENT: 0.11,
    INS_CO_PERCENT: 0.1875,
    MAX_INS_SALARY: 16700, 
    MIN_INS_SALARY: 2325,
    PERSONAL_EXEMPTION: 20000,
    MEDICAL_EXEMPTION_LIMIT: 10000 // الحد الأقصى السنوي للإعفاء الطبي (10000/12 شهرياً)
};

const companySchema = new mongoose.Schema({
    // اسم الشركة
    name: { 
        type: String, 
        required: [true, 'اسم الشركة مطلوب'], 
        trim: true 
    },
    // إيميل الأدمن (الأساسي للتحقق)
    adminEmail: { 
        type: String, 
        required: [true, 'إيميل الأدمن مطلوب'], 
        unique: true,
        lowercase: true,
        trim: true 
    },
    // الإيميل المستخدم في تسجيل الدخول
    email: {
        type: String,
        required: [true, 'بريد تسجيل الدخول مطلوب'],
        unique: true,
        lowercase: true,
        trim: true
    },
    // كلمة المرور مشفرة
    password: {
        type: String,
        required: [true, 'كلمة المرور مطلوبة']
    },
    
    // الإعدادات المرنة للشركة
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
        // إضافة حد الإعفاء الطبي في الإعدادات لدعم الـ Logic الجديد
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

// تحديث تاريخ التعديل تلقائياً قبل الحفظ
companySchema.pre('save', function(next) {
    this.lastSettingsUpdate = Date.now();
    next();
});

/**
 * التصدير النهائي (Vercel Optimized)
 * نستخدم "Company" كاسم للموديل مع التأكد من عدم تكراره
 */
module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);

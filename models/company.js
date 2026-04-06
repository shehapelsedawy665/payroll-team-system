const mongoose = require('mongoose');

// تعريف الثوابت العالمية طبقاً لآخر تحديثات قانون العمل والضرائب 2024/2025
const GLOBAL_DEFAULTS = {
    INS_EE_PERCENT: 0.11,
    INS_CO_PERCENT: 0.1875,
    MAX_INS_SALARY: 16700, 
    MIN_INS_SALARY: 2325,
    PERSONAL_EXEMPTION: 20000 
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
    // الإيميل المستخدم في تسجيل الدخول (Login Email)
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
    
    // تم حذف الـ departmentSchema الداخلية لأننا اعتمدنا على ملف مستقل
    // دي الطريقة الـ Professional لربط الموديلات ببعضها (Reference)
    
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
        // إضافة خانة للوجو لدعم المرحلة التانية (Company Settings)
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

// تصدير الموديل مع التأكد من اسم المجموعة في قاعدة البيانات
module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);

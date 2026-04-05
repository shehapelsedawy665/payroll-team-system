const mongoose = require('mongoose');

// تعريف الثوابت العالمية (ممكن تحطها في ملف منفصل مستقبلاً)
const GLOBAL_DEFAULTS = {
    INS_EE_PERCENT: 0.11,
    INS_CO_PERCENT: 0.1875,
    MAX_INS_SALARY: 16700, // الرقم ده لو اتغير في القانون، بتغيره هنا بس
    MIN_INS_SALARY: 2325,
    PERSONAL_EXEMPTION: 15000
};

const companySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    adminEmail: { type: String, required: true, unique: true },
    
    // الإعدادات هنا بقت مرنة جداً
    settings: {
        // لو القيمة null، السيستم أوتوماتيكياً هيستخدم الـ Global Default
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
        // حقل جديد عشان لو حبيت توقف شركة معينة عن العمل مؤقتاً
        isActive: { type: Boolean, default: true }
    },
    
    // تاريخ آخر تحديث للإعدادات
    lastSettingsUpdate: { type: Date, default: Date.now }
});

// "Magic Function" - بتشتغل قبل ما البيانات تتحفظ
companySchema.pre('save', function(next) {
    this.lastSettingsUpdate = Date.now();
    next();
});

module.exports = mongoose.model('Company', companySchema);

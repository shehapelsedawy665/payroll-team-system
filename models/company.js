const mongoose = require('mongoose');

// تعريف الثوابت العالمية طبقاً لآخر تحديثات قانون العمل والضرائب 2024/2025
const GLOBAL_DEFAULTS = {
    INS_EE_PERCENT: 0.11,
    INS_CO_PERCENT: 0.1875,
    MAX_INS_SALARY: 16700, 
    MIN_INS_SALARY: 2325,
    PERSONAL_EXEMPTION: 20000 
};

// سكيما الأقسام (عشان نقسم الشركة لـ IT, HR, Sales إلخ)
const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true }, // كود القسم اختياري (مثلاً: IT-01)
    headOfDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' } // رئيس القسم (للـ Org Chart)
});

const companySchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'اسم الشركة مطلوب'], 
        trim: true 
    },
    adminEmail: { 
        type: String, 
        required: [true, 'إيميل الأدمن مطلوب'], 
        unique: true,
        lowercase: true,
        trim: true 
    },
    email: {
        type: String,
        required: [true, 'بريد تسجيل الدخول مطلوب'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'كلمة المرور مطلوبة']
    },
    
    // مصفوفة الأقسام الخاصة بكل شركة (Core HR - المرحلة التانية)
    departments: [departmentSchema],

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
        // إضافة خانة للعملة أو اللوجو مستقبلاً
        companyLogo: { type: String, default: "" },
        isActive: { 
            type: Boolean, 
            default: true 
        }
    },
    
    createdAt: { type: Date, default: Date.now },
    lastSettingsUpdate: { type: Date, default: Date.now }
});

// تحديث تاريخ التعديل تلقائياً
companySchema.pre('save', function(next) {
    this.lastSettingsUpdate = Date.now();
    next();
});

module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);

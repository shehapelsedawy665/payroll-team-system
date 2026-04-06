const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    // 1. البيانات الشخصية (Identity)
    name: { 
        type: String, 
        required: [true, 'اسم الموظف مطلوب'], 
        trim: true 
    },
    nationalId: { 
        type: String, 
        required: [true, 'رقم البطاقة مطلوب'],
        unique: true,
        trim: true 
    },
    email: { 
        type: String, 
        lowercase: true, 
        trim: true 
    },
    phone: { type: String, trim: true },

    // 2. البيانات الوظيفية (Core HR & Multi-tenancy)
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        required: [true, 'يجب ربط الموظف بشركة'] 
    },
    // التعديل: جعل القسم يقبل نص (String) ليتوافق مع الـ Frontend الحالي
    department: { 
        type: String, 
        required: [true, 'يجب تحديد قسم للموظف'],
        default: 'General'
    },
    jobTitle: { 
        type: String, 
        required: [true, 'المسمى الوظيفي مطلوب'], 
        trim: true,
        default: 'Employee'
    },
    
    // الهيكل التنظيمي (Hierarchy)
    reportingTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Employee', 
        default: null 
    },

    // 3. دورة حياة الموظف (Lifecycle)
    hireDate: { 
        type: Date, 
        default: Date.now 
    },
    resignationDate: { 
        type: Date, 
        default: null 
    },
    employmentType: { 
        type: String, 
        enum: ['Full-time', 'Part-time', 'Contractor'], 
        default: 'Full-time' 
    },

    // 4. محرك الرواتب (Payroll Engine Structure)
    salaryDetails: {
        basicSalary: { 
            type: Number, 
            default: 0 
        },
        // البدلات والحوافز
        additions: [{
            name: { type: String },
            amount: { type: Number, default: 0 },
            type: { 
                type: String, 
                enum: ['Exempted', 'Non-Exempted'], 
                default: 'Non-Exempted' 
            }
        }],
        // الاستقطاعات والخصومات
        deductions: [{
            name: { type: String },
            amount: { type: Number, default: 0 },
            isMedical: { type: Boolean, default: false },
            type: { 
                type: String, 
                enum: ['Exempted', 'Non-Exempted'], 
                default: 'Non-Exempted' 
            }
        }]
    },

    // 5. الأرشيف وسجل المرتبات (History)
    // أضفت لك حقل الـ history هنا لأنه أساسي لعرض سجل الموظف في الـ UI
    history: [{
        month: String,
        payload: Object
    }],

    documents: [{
        title: { type: String }, 
        fileUrl: { type: String }, 
        expiryDate: { type: Date }
    }],

    status: { 
        type: String, 
        enum: ['Active', 'Inactive', 'Resigned'], 
        default: 'Active' 
    },
    createdAt: { type: Date, default: Date.now }
});

// تحسين الأداء
employeeSchema.index({ companyId: 1, status: 1 });
employeeSchema.index({ nationalId: 1 }, { unique: true });

module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

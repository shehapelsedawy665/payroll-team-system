const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    // البيانات الشخصية الأساسية
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

    // البيانات الوظيفية (Core HR)
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        required: true 
    },
    department: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Department', 
        required: [true, 'يجب تحديد قسم للموظف'] 
    },
    jobTitle: { type: String, required: true, trim: true },
    
    // نظام المدير المباشر (Org Chart Logic)
    reportingTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Employee', 
        default: null 
    },

    // تواريخ التعيين والاستقالة
    hireDate: { 
        type: Date, 
        required: [true, 'تاريخ التعيين مطلوب'] 
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

    // هيكل الرواتب المطور (Payroll Engine)
    salaryDetails: {
        basicSalary: { type: Number, required: true, default: 0 },
        // تم تحديث البدلات والحوافز لتكون مرنة مع الـ Logic الجديد
        additions: [{
            name: { type: String }, // اسم البند (مثلاً: حافز إنتاج)
            amount: { type: Number, default: 0 },
            type: { 
                type: String, 
                enum: ['Exempted', 'Non-Exempted'], // التعديل المطلوب لـ Taxable/Non-Taxable
                default: 'Non-Exempted' 
            }
        }],
        deductions: [{
            name: { type: String }, // اسم الخصم (مثلاً: تأمين طبي)
            amount: { type: Number, default: 0 },
            isMedical: { type: Boolean, default: false }, // علامة عشان الـ 15% Medical Rule
            type: { 
                type: String, 
                enum: ['Exempted', 'Non-Exempted'], 
                default: 'Non-Exempted' 
            }
        }]
    },

    // إدارة الوثائق (Document Management)
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

// Indexing لسرعة البحث في الشركة والقسم
employeeSchema.index({ companyId: 1, department: 1 });
employeeSchema.index({ nationalId: 1 }, { unique: true });

/**
 * التصدير النهائي (Vercel Optimized)
 * يمنع الـ Duplicate model name error تماماً
 */
module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

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
    department: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Department', 
        required: [true, 'يجب تحديد قسم للموظف'] 
    },
    jobTitle: { 
        type: String, 
        required: [true, 'المسمى الوظيفي مطلوب'], 
        trim: true 
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

    // 4. محرك الرواتب (Payroll Engine Structure)
    salaryDetails: {
        basicSalary: { 
            type: Number, 
            required: [true, 'الراتب الأساسي مطلوب'], 
            default: 0 
        },
        // البدلات والحوافز
        additions: [{
            name: { type: String, required: true },
            amount: { type: Number, default: 0 },
            type: { 
                type: String, 
                enum: ['Exempted', 'Non-Exempted'], // Exempted = معفى من الضريبة
                default: 'Non-Exempted' 
            }
        }],
        // الاستقطاعات والخصومات
        deductions: [{
            name: { type: String, required: true },
            amount: { type: Number, default: 0 },
            isMedical: { type: Boolean, default: false }, // أساسي لحساب بند الـ 15% تأمين طبي
            type: { 
                type: String, 
                enum: ['Exempted', 'Non-Exempted'], 
                default: 'Non-Exempted' 
            }
        }]
    },

    // 5. الأرشيف والوثائق (Documents)
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

/**
 * تحسين الأداء (Performance Optimization)
 * Indexing لسرعة استخراج كشوف المرتبات والبحث بالبطاقة
 */
employeeSchema.index({ companyId: 1, department: 1 });
employeeSchema.index({ companyId: 1, status: 1 }); // مهم لفلترة الموظفين النشطين فقط
employeeSchema.index({ nationalId: 1 }, { unique: true });

/**
 * التصدير النهائي (Serverless Optimized)
 * حل مشكلة الـ OverwriteModelError في Vercel
 */
module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

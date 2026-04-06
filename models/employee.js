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
        ref: 'Department', // الربط مع موديل الأقسام الجديد
        required: [true, 'يجب تحديد قسم للموظف'] 
    },
    jobTitle: { type: String, required: true, trim: true },
    
    // نظام المدير المباشر (Org Chart Logic)
    reportingTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Employee', // الموظف مدير لموظف آخر
        default: null 
    },

    // تواريخ التعيين والاستقالة (التزاماً بالـ Roadmap)
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

    // هيكل الرواتب (Payroll Engine Base)
    salaryDetails: {
        basicSalary: { type: Number, required: true, default: 0 }, // الراتب الأساسي
        allowances: { type: Number, default: 0 }, // البدلات
        otherIncentives: { type: Number, default: 0 } // حوافز أخرى
    },

    // إدارة الوثائق (Document Management)
    documents: [{
        title: { type: String }, // مثلاً: "صورة البطاقة" أو "عقد العمل"
        fileUrl: { type: String }, 
        expiryDate: { type: Date } // تنبيهات انتهاء الأوراق
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

module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

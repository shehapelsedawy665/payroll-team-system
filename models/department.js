const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    // اسم القسم (مثلاً: الموارد البشرية، الحسابات، البرمجة)
    name: { 
        type: String, 
        required: [true, 'اسم القسم مطلوب'], 
        trim: true 
    },
    // كود تعريفي اختياري للقسم (مثلاً: HR-01)
    code: { 
        type: String, 
        trim: true 
    },
    // ربط القسم بالشركة (ضروري جداً عشان الـ Multi-tenancy)
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        required: true 
    },
    // مدير القسم (خيار من قائمة الموظفين - أساسي للـ Org Chart)
    manager: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Employee',
        default: null
    },
    // وصف بسيط للقسم
    description: { 
        type: String, 
        trim: true 
    },
    // حالة القسم (نشط أو غير نشط)
    isActive: { 
        type: Boolean, 
        default: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// إضافة Index للبحث السريع عن أقسام شركة معينة
departmentSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);

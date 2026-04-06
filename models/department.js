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
    // ربط القسم بالشركة (أساسي لضمان فصل بيانات كل شركة عن الأخرى)
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        required: [true, 'يجب ربط القسم بشركة محددة'] 
    },
    // مدير القسم (يربط بموديل الموظفين)
    manager: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Employee',
        default: null
    },
    // وصف بسيط لمسؤوليات القسم
    description: { 
        type: String, 
        trim: true 
    },
    // حالة القسم (نشط أو مؤرشف)
    isActive: { 
        type: Boolean, 
        default: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

/**
 * تحسين أداء الاستعلامات (Performance Optimization)
 * عمل Index مركب لسرعة الوصول لأقسام شركة معينة بالاسم
 */
departmentSchema.index({ companyId: 1, name: 1 });

/**
 * التصدير النهائي (Serverless & Vercel Friendly)
 * التأكد من عدم إعادة تعريف الموديل في كل طلب (Request)
 */
module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);

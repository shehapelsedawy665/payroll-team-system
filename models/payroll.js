const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
    // ربط السجل بالشركة لضمان فصل البيانات
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        required: [true, 'يجب تحديد الشركة'] 
    },
    // ربط السجل بالموظف
    employeeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Employee', 
        required: [true, 'يجب تحديد الموظف'] 
    },
    // الشهر والسنة (مثال: "2026-04")
    month: { 
        type: String, 
        required: [true, 'يجب تحديد الشهر والسنة'],
        trim: true 
    },
    /**
     * تفاصيل الحسبة كاملة (Snapshot)
     * بنخزن هنا الأرقام النهائية وقت الحسبة عشان لو مرتب الموظف اتغير مستقبلاً 
     * يفضل السجل القديم محتفظ بأرقامه صح
     */
    payload: {
        grossSalary: { type: Number, required: true },
        netSalary: { type: Number, required: true },
        taxAmount: { type: Number, default: 0 },
        insuranceEmployee: { type: Number, default: 0 }, // حصة الموظف
        insuranceCompany: { type: Number, default: 0 },  // حصة الشركة
        totalAdditions: { type: Number, default: 0 },
        totalDeductions: { type: Number, default: 0 },
        details: { type: Object } // تفاصيل إضافية مرنة
    },
    // حالة الدفع (مدفوع، معلق، مراجعة)
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Paid'],
        default: 'Pending'
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

/**
 * تحسين الأداء للتقارير (Indexing)
 */
// لمنع تكرار عمل كشف مرتب لنفس الموظف في نفس الشهر مرتين
payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });
// لسرعة جلب مرتبات شهر معين لشركة معينة
payrollSchema.index({ companyId: 1, month: 1 });

/**
 * التصدير النهائي (Serverless & Vercel Optimized)
 */
module.exports = mongoose.models.Payroll || mongoose.model('Payroll', payrollSchema);

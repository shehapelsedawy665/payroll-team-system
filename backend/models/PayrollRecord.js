const mongoose = require('mongoose');

const PayrollRecordSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    
    // شهر وسنة الاستحقاق (عشان تقارير وتأمينات كل شهر)
    month: { type: Number, required: true }, // 1 to 12
    year: { type: Number, required: true },
    
    // تفاصيل الراتب الأساسية وقت الحساب (عشان لو راتبه اتغير بعدين، السجل ده يفضل محتفظ بالقديم)
    baseDataSnapshot: {
        basicSalary: { type: Number, required: true },
        variableSalary: { type: Number, required: true },
        insSalary: { type: Number, required: true },
    },

    // ملخص الحضور والانصراف اللي اتبنى عليه المرتب
    attendanceSummary: {
        workedDays: { type: Number, default: 0 },
        absentDays: { type: Number, default: 0 },
        lateMinutes: { type: Number, default: 0 },
        overtimeNormal: { type: Number, default: 0 }, // بالساعات
        overtimeHoliday: { type: Number, default: 0 }
    },

    // تفاصيل الحسابات المالية (مفردات المرتب الفعلية)
    financials: {
        grossSalary: { type: Number, required: true },
        additions: { type: Number, default: 0 }, // إجمالي البدلات المتغيرة والإضافي
        deductions: { type: Number, default: 0 }, // إجمالي جزاءات الغياب والتأخير
        socialInsurance: { type: Number, default: 0 }, // خصم التأمينات
        tax: { type: Number, default: 0 }, // ضريبة كسب العمل
        netSalary: { type: Number, required: true } // الصافي اللي هيتقبض
    },

    // حالة الدفع
    status: { 
        type: String, 
        enum: ['Draft', 'Approved', 'Paid'], 
        default: 'Draft' // Draft يعني لسه الـ HR بيراجع ومقفلش الشهر
    },
    
    paymentMethod: { type: String, enum: ['BankTransfer', 'E-Wallet', 'Cash'] },
    
    // مين اللي اعتمد المرتب ده
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date }

}, { timestamps: true });

// Index عشان نمنع تكرار نزول مرتب مرتين لنفس الموظف في نفس الشهر والسنة
PayrollRecordSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

// Index عشان يسرع استخراج تقرير المرتبات الشهري للشركة كلها
PayrollRecordSchema.index({ companyId: 1, month: 1, year: 1 });

module.exports = mongoose.models.PayrollRecord || mongoose.model('PayrollRecord', PayrollRecordSchema);

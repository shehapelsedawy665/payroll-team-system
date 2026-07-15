const mongoose = require('mongoose');

const LeaveBalanceSchema = new mongoose.Schema({
    // 1. ربط الرصيد بالموظف والشركة
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    
    // 2. رصيد سنة كام؟
    year: { type: Number, required: true }, 

    // 3. تفاصيل الأرصدة (بناءً على قانون العمل المصري)
    balances: {
        annual: {
            total: { type: Number, default: 21 }, // الإجمالي المستحق في السنة (الاعتيادي)
            used: { type: Number, default: 0 }    // اللي اتسحب منه لحد دلوقتي
        },
        casual: {
            total: { type: Number, default: 6 },  // العارضة (بتتخصم من رصيد الاعتيادي فعلياً بس ليها حد أقصى 6 أيام)
            used: { type: Number, default: 0 }
        },
        sick: {
            total: { type: Number, default: 90 }, // المرضي
            used: { type: Number, default: 0 }
        }
    },

    // 4. الرصيد المرحل 
    carriedForward: { type: Number, default: 0 } // لو الموظفرحله أيام من السنة اللي فاتت

}, { timestamps: true });

// Index عشان نمنع إن الموظف ينزله رصيدين لنفس السنة بالغلط
LeaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

module.exports = mongoose.models.LeaveBalance || mongoose.model('LeaveBalance', LeaveBalanceSchema);

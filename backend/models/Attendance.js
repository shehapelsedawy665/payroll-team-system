const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    // 1. ربط السجل بالموظف والشركة
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    
    // 2. بيانات اليوم
    date: { type: Date, required: true }, // تاريخ اليوم ده
    dayType: { 
        type: String, 
        enum: ['WorkDay', 'Weekend', 'PublicHoliday', 'RestDay'], 
        default: 'WorkDay' 
    },
    
    // 3. البصمة (الفعلية)
    checkIn: { type: Date }, // وقت الحضور الفعلي
    checkOut: { type: Date }, // وقت الانصراف الفعلي
    
    // 4. حالة الموظف في اليوم ده
    status: { 
        type: String, 
        enum: ['Present', 'Absent', 'SickLeave', 'AnnualLeave', 'CasualLeave', 'Mission'], 
        default: 'Absent' 
    },

    // 5. الحسابات الدقيقة (اللي هتتبعت للـ Payroll Engine)
    calculatedData: {
        workedHours: { type: Number, default: 0 }, // عدد ساعات العمل الفعلية
        lateMinutes: { type: Number, default: 0 }, // دقائق التأخير الصباحي (عشان تتخصم حسب اللائحة)
        earlyDepartureMinutes: { type: Number, default: 0 }, // الانصراف المبكر
        
        // تفاصيل الإضافي
        overtime: {
            normalHours: { type: Number, default: 0 }, // الإضافي في الأيام العادية (بيضرب في 1.35 مثلاً)
            holidayHours: { type: Number, default: 0 } // الإضافي في العطلات (بيضرب في 2)
        }
    },

    // 6. حالة الاعتماد (عشان نقفل الشهر)
    isProcessedByPayroll: { type: Boolean, default: false }, // هل اليوم ده اتحسب في المرتب ولا لسه؟
    managerApproval: { 
        isApproved: { type: Boolean, default: true }, // للاعتماد اليدوي للإضافي أو المأموريات
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    
    notes: { type: String } // لو فيه أي عذر أو ملاحظة من الموارد البشرية
}, { timestamps: true });

// منع تكرار نفس اليوم لنفس الموظف عشان الداتا متضربش
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
// Index عشان نسرع عملية البحث وقت تقفيل المرتبات للشركة كلها في شهر معين
AttendanceSchema.index({ companyId: 1, date: 1 });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

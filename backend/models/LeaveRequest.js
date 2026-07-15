const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema({
    // 1. ربط الإجازة بالموظف والشركة
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    
    // 2. تفاصيل الإجازة (بناءً على قانون العمل المصري)
    leaveType: { 
        type: String, 
        enum: ['Annual', 'Casual', 'Sick', 'Maternity', 'Unpaid', 'Other'], // اعتيادي، عارضة، مرضي، وضع، بدون أجر
        required: true 
    },
    
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    
    // عدد أيام الإجازة الفعلية (عشان لو الإجازة تخللتها أيام راحة أسبوعية والـ HR هيخصمها)
    totalDays: { type: Number, required: true }, 
    
    reason: { type: String }, // سبب الإجازة
    attachmentUrl: { type: String }, // مهم جداً للإجازات المرضي عشان الموظف يرفع الروشتة أو التقرير الطبي
    
    // 3. دورة الاعتماد (Approval Workflow)
    status: { 
        type: String, 
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'], 
        default: 'Pending' 
    },
    
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // مين المدير أو الـ HR اللي وافق
    approvalDate: { type: Date },
    rejectionReason: { type: String }, // لو اترفضت، اترفضت ليه
    
    // 4. حالة المعالجة في المرتبات
    isProcessedByPayroll: { type: Boolean, default: false } // هل اتخصمت من رصيده وسمعت في مرتب الشهر ده ولا لسه؟

}, { timestamps: true });

// Index عشان لما الموظف يفتح صفحته يشوف إجازاته بسرعة
LeaveRequestSchema.index({ employeeId: 1, status: 1 });

// Index عشان الـ HR يقدر يفلتر إجازات الشركة كلها في شهر معين بسرعة
LeaveRequestSchema.index({ companyId: 1, startDate: 1 });

module.exports = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', LeaveRequestSchema);

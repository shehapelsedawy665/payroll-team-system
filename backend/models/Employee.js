const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
    // 1. البيانات الشخصية
    name: { type: String, required: true },
    nationalId: { type: String, required: true }, 
    
    // 2. البيانات الوظيفية
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }, // كود الشركة أو الأوت سورس
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
    jobId: { type: String, required: true }, 
    
    // جهة العمل الفعلية (عشان شركات الأوت سورس)
    assignment: {
        clientName: { type: String }, // اسم الشركة اللي شغال فيها فعلياً
        costCenter: { type: String }  // مركز التكلفة
    },
    
    position: { type: String },
    department: { type: String },
    jobType: { type: String, enum: ['Full Time', 'Part Time', 'Contract', 'Shift Based'], default: 'Full Time' },
    hiringDate: { type: Date, required: true },
    resignationDate: { type: Date },
    status: { type: String, enum: ['Active', 'OnLeave', 'Resigned'], default: 'Active' },

    // 3. البيانات المالية (المرتب)
    financials: {
        basicSalary: { type: Number, default: 0 }, 
        variableSalary: { type: Number, default: 0 }, 
        fullBasic: { type: Number, default: 0 }, 
        allowances: {
            transportation: { type: Number, default: 0 }, 
            other: { type: Number, default: 0 }
        }
    },

    // 4. الوعاء الضريبي المتراكم (عشان تسويات آخر السنة للموظف اللي بيتنقل)
    ytdFinancials: {
        taxableIncome: { type: Number, default: 0 }, // إجمالي الوعاء الضريبي من أول السنة
        taxPaid: { type: Number, default: 0 }        // إجمالي الضرائب اللي اتخصمت منه لحد دلوقتي
    },

    // 5. التأمينات والضرائب
    legalDetails: {
        insuranceNumber: { type: String }, 
        insSalary: { type: Number, default: 0 }, 
        isTaxExempted: { type: Boolean, default: false }, 
        specialTaxExemption: { type: Number, default: 0 } 
    },

    // 6. طريقة الدفع 
    paymentInfo: {
        method: { type: String, enum: ['BankTransfer', 'E-Wallet', 'Cash'], default: 'BankTransfer' },
        bankName: { type: String },
        accountNumber: { type: String }, 
    }
}, { timestamps: true });

// منع التكرار جوه نفس الشركة، عشان نحافظ على الوعاء الضريبي
EmployeeSchema.index({ companyId: 1, jobId: 1 }, { unique: true });
EmployeeSchema.index({ companyId: 1, nationalId: 1 }, { unique: true });

module.exports = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);

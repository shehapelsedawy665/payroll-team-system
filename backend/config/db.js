const mongoose = require("mongoose");

// منع التحذيرات في النسخ الجديدة من Mongoose
mongoose.set('strictQuery', false);

// ==================== CONNECTION ====================
// Vercel Serverless: كل request ممكن يجي في function instance جديدة
// الحل: نحفظ الـ connection في global scope عشان يتشارك بين الـ invocations

let connectionPromise = null;

const connectDB = async () => {
    // 1. لو الـ connection موجود وشغال فعلاً، ارجع فوراً
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    // 2. لو فيه محاولة connection قيد التنفيذ، استنى نفس الـ Promise
    if (connectionPromise) {
        return connectionPromise;
    }

    const uri = process.env.MONGODB_URI || "mongodb+srv://Sedawy:FinalPass2026@egyptian-payroll.a6bquen.mongodb.net/payrollDB?retryWrites=true&w=majority";

    const options = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
        // ⚠️ bufferCommands: true (default) — لازم يكون true عشان الـ queries
        // تستنى الـ connection بدل ما ترجع error فوراً
        // bufferCommands: false كان هو السبب في مشكلة "Cannot call before connection"
    };

    console.log("⏳ Connecting to MongoDB...");

    connectionPromise = mongoose.connect(uri, options)
        .then(conn => {
            console.log("✅ MongoDB Connected Successfully");
            return conn;
        })
        .catch(err => {
            connectionPromise = null; // reset عشان نحاول تاني في الـ request الجاي
            console.error("❌ MongoDB Connection Error:", err.message);
            throw err;
        });

    return connectionPromise;
};

// ==================== SCHEMAS ====================

// 1. Company
const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    adminPassword: { type: String, required: true },
    settings: {
        absentDayRate: { type: Number, default: 1 },
        overtimeRate: { type: Number, default: 1.5 },
        overtimeHolRate: { type: Number, default: 2.0 },
        medicalLimit: { type: Number, default: 10000 },
        taxExemptionLimit: { type: Number, default: 40000 },
        personalExemption: { type: Number, default: 20000 },
        workDaysPerWeek: { type: Number, default: 5 },
        dailyWorkHours: { type: Number, default: 8 },
        lateThreshold: { type: Number, default: 120 },
        monthCalcType: { type: String, default: "30" },
        enableGamification: { type: Boolean, default: true },
        attendanceBonusPoints: { type: Number, default: 100 },
        penaltyMatrixEnabled: { type: Boolean, default: true }
    },
    createdAt: { type: Date, default: Date.now }
});

// 2. User
const userSchema = new mongoose.Schema({
    email: { type: String, required: false, sparse: true },
    phone: { type: String, required: false, sparse: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'hr', 'employee', 'blue_collar', 'dev'], default: 'employee' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    refreshToken: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

// 3. Employee
const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true, unique: true },
    hiringDate: { type: Date, required: true },
    resignationDate: { type: Date, default: null },
    jobType: { type: String, enum: ['Full Time', 'Part Time', 'Contract'], default: "Full Time" },
    department: { type: String, default: "" },
    position: { type: String, default: "" },
    phone: { type: String, default: "" },
    basicSalary: { type: Number, required: true, default: 0 },
    variableSalary: { type: Number, default: 0 },
    insSalary: { type: Number, default: 0 },
    isTaxExempted: { type: Boolean, default: false },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null },
    gamificationPoints: { type: Number, default: 0 },
    flightRiskScore: { type: Number, default: 0 },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
});

// 4. Shift
const shiftSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    allowancePerShift: { type: Number, default: 0 },
    isNightShift: { type: Boolean, default: false },
    gracePeriod: { type: Number, default: 15 }
});

// 5. Candidate
const candidateSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    appliedPosition: { type: String, required: true },
    status: { type: String, enum: ['applied', 'interviewing', 'offered', 'hired', 'rejected'], default: 'applied' },
    resumeUrl: { type: String, default: "" },
    interviewNotes: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

// 6. Loan
const loanSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    totalAmount: { type: Number, required: true },
    installmentAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, required: true },
    status: { type: String, enum: ['active', 'paused', 'settled'], default: 'active' },
    requestDate: { type: Date, default: Date.now },
    startMonth: { type: String, required: true }
});

// 7. EWA Request
const ewaRequestSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    requestedAmount: { type: Number, required: true },
    transferMethod: { type: String, enum: ['wallet', 'bank', 'cash'], default: 'wallet' },
    walletNumber: { type: String, default: "" },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'transferred'], default: 'pending' },
    month: { type: String, required: true },
    requestDate: { type: Date, default: Date.now }
});

// 8. Custody (العهد)
const custodySchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    itemName: { type: String, required: true },
    serialNumber: { type: String, default: "" },
    estimatedValue: { type: Number, required: true },
    receiveDate: { type: Date, required: true },
    returnDate: { type: Date, default: null },
    status: { type: String, enum: ['with_employee', 'returned', 'lost'], default: 'with_employee' }
});

// 9. Penalty
const penaltySchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    violationType: { type: String, required: true },
    actionTaken: { type: String, enum: ['warning', 'deduction'], required: true },
    deductionDays: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    isSystemGenerated: { type: Boolean, default: false }
});

// 10. Appraisal (التقييم)
const appraisalSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    month: { type: String, required: true },
    kpiScore: { type: Number, required: true, min: 0, max: 100 },
    bonusAmount: { type: Number, default: 0 },
    evaluatorNotes: { type: String, default: "" },
    status: { type: String, enum: ['draft', 'approved'], default: 'draft' }
});

// 11. Settlement (تصفية الحساب)
const settlementSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    resignationDate: { type: Date, required: true },
    remainingLeavesValue: { type: Number, default: 0 },
    unpaidSalaries: { type: Number, default: 0 },
    unsettledLoans: { type: Number, default: 0 },
    lostCustodyValue: { type: Number, default: 0 },
    endOfServiceBonus: { type: Number, default: 0 },
    netPayable: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'finalized', 'paid'], default: 'draft' },
    createdAt: { type: Date, default: Date.now }
});

// 12. Payroll
const payrollSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    month: { type: String, required: true },
    payload: { type: Object, required: true },
    netSalary: { type: Number, required: true },
    hasAnomaly: { type: Boolean, default: false },
    anomalyReason: { type: String, default: "" },
    status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
    createdAt: { type: Date, default: Date.now }
});
payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });

// 13. Attendance
const attendanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    date: { type: String, required: true },
    month: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent', 'late', 'half', 'holiday', 'weekend'], default: 'present' },
    checkIn: { type: String, default: "" },
    checkOut: { type: String, default: "" },
    lateMinutes: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// 14. Leave
const leaveSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    type: { type: String, enum: ['annual', 'sick', 'emergency', 'unpaid', 'maternity', 'other'], default: 'annual' },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    days: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    year: { type: Number, default: () => new Date().getFullYear() },
    createdAt: { type: Date, default: Date.now }
});

// 15. Leave Balance
const leaveBalanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    year: { type: Number, required: true },
    annual: { type: Number, default: 21 },
    sick: { type: Number, default: 7 },
    emergency: { type: Number, default: 6 },
    annualUsed: { type: Number, default: 0 },
    sickUsed: { type: Number, default: 0 },
    emergencyUsed: { type: Number, default: 0 }
});
leaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

// 16. Subscription
const subscriptionSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    plan: { type: String, enum: ['trial', 'starter', 'growth', 'enterprise'], default: 'trial' },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
    endDate: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// ==================== MODEL INITIALIZATION ====================
// تأكدنا إننا بنستخدم النمط الآمن لمنع OverwriteModelError

const Company      = mongoose.models.Company      || mongoose.model("Company",      companySchema);
const User         = mongoose.models.User         || mongoose.model("User",         userSchema);
const Employee     = mongoose.models.Employee     || mongoose.model("Employee",     employeeSchema);
const Shift        = mongoose.models.Shift        || mongoose.model("Shift",        shiftSchema);
const Candidate    = mongoose.models.Candidate    || mongoose.model("Candidate",    candidateSchema);
const Loan         = mongoose.models.Loan         || mongoose.model("Loan",         loanSchema);
const EWARequest   = mongoose.models.EWARequest   || mongoose.model("EWARequest",   ewaRequestSchema);
const Custody      = mongoose.models.Custody      || mongoose.model("Custody",      custodySchema);
const Penalty      = mongoose.models.Penalty      || mongoose.model("Penalty",      penaltySchema);
const Appraisal    = mongoose.models.Appraisal    || mongoose.model("Appraisal",    appraisalSchema);
const Settlement   = mongoose.models.Settlement   || mongoose.model("Settlement",   settlementSchema);
const Payroll      = mongoose.models.Payroll      || mongoose.model("Payroll",      payrollSchema);
const Subscription = mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema);
const Attendance   = mongoose.models.Attendance   || mongoose.model("Attendance",   attendanceSchema);
const Leave        = mongoose.models.Leave        || mongoose.model("Leave",        leaveSchema);
const LeaveBalance = mongoose.models.LeaveBalance || mongoose.model("LeaveBalance", leaveBalanceSchema);

// ==================== EXPORTS ====================
module.exports = { 
    connectDB, 
    connectToDatabase: connectDB, // <-- السر كله هنا يا هندسة!
    Company, User, Employee, Shift, Candidate, Loan, EWARequest, 
    Custody, Penalty, Appraisal, Settlement, Payroll, Subscription, 
    Attendance, Leave, LeaveBalance 
};
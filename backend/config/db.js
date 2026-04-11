const mongoose = require("mongoose");

let cachedConnection = null;

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    if (cachedConnection) { await cachedConnection; return; }
    try {
        const uri = process.env.MONGODB_URI || "mongodb+srv://Sedawy:FinalPass2026@egyptian-payroll.a6bquen.mongodb.net/payrollDB?retryWrites=true&w=majority";
        const options = { serverSelectionTimeoutMS: 30000, socketTimeoutMS: 45000, family: 4, bufferCommands: false, heartbeatFrequencyMS: 10000 };
        cachedConnection = mongoose.connect(uri, options);
        await cachedConnection;
        console.log("✅ MongoDB Ready & Connected (HR-ERP Advanced)");
    } catch (err) {
        cachedConnection = null;
        console.error("❌ MongoDB Connection Error:", err.message);
        throw err;
    }
};

// 1. Company Schema (Enhanced with Smart Policies & Localization)
const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    adminPassword: { type: String, required: true },
    settings: {
        absentDayRate: { type: Number, default: 1 },
        overtimeRate: { type: Number, default: 1.5 },
        overtimeHolRate: { type: Number, default: 2.0 },
        medicalLimit: { type: Number, default: 10000 },
        taxExemptionLimit: { type: Number, default: 40000 }, // Updated for 2024/2026 brackets
        personalExemption: { type: Number, default: 20000 }, // Updated
        workDaysPerWeek: { type: Number, default: 5 },
        dailyWorkHours: { type: Number, default: 8 },
        lateThreshold: { type: Number, default: 120 }, // minutes
        monthCalcType: { type: String, default: "30" }, // 30 fixed or actual days
        enableGamification: { type: Boolean, default: true },
        attendanceBonusPoints: { type: Number, default: 100 }, // Points for perfect attendance
        penaltyMatrixEnabled: { type: Boolean, default: true }
    },
    createdAt: { type: Date, default: Date.now }
});

// 2. User Schema (Enhanced for ESS & Blue-Collar access)
const userSchema = new mongoose.Schema({
    email: { type: String, required: false, sparse: true }, // Optional for blue-collar
    phone: { type: String, required: false, sparse: true }, // Login for blue-collar
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'hr', 'employee', 'blue_collar'], default: 'employee' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    refreshToken: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

// 3. Employee Schema (Enhanced with AI flags, Shift, and Financial Details)
const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true, unique: true },
    hiringDate: { type: Date, required: true },
    resignationDate: { type: Date, default: null },
    jobType: { type: String, enum: ['Full Time', 'Part Time', 'Contract'], default: "Full Time" },
    department: { type: String, default: "" },
    position: { type: String, default: "" },
    phone: { type: String, default: "" },
    
    // Financial & Egyptian Law specifics
    basicSalary: { type: Number, required: true, default: 0 },
    variableSalary: { type: Number, default: 0 },
    insSalary: { type: Number, default: 0 }, // الأجر التأميني
    isTaxExempted: { type: Boolean, default: false }, // ذوي الهمم أو إعفاءات خاصة
    
    // Smart HR Features
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null },
    gamificationPoints: { type: Number, default: 0 },
    flightRiskScore: { type: Number, default: 0 }, // 0 to 100 (AI updated)
    
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
});

// 4. Shift Schema (New - For varied & night shifts)
const shiftSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true }, // e.g., "Night Shift", "Morning Shift"
    startTime: { type: String, required: true }, // e.g., "22:00"
    endTime: { type: String, required: true }, // e.g., "06:00"
    allowancePerShift: { type: Number, default: 0 }, // بدل وردية
    isNightShift: { type: Boolean, default: false },
    gracePeriod: { type: Number, default: 15 } // Minutes
});

// 5. Candidate Schema (New - ATS Module)
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

// 6. Loan Schema (New - Dynamic Advances)
const loanSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    totalAmount: { type: Number, required: true },
    installmentAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, required: true },
    status: { type: String, enum: ['active', 'paused', 'settled'], default: 'active' },
    requestDate: { type: Date, default: Date.now },
    startMonth: { type: String, required: true } // format: "YYYY-MM"
});

// 7. Earned Wage Access (EWA) Schema (New)
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

// 8. Custody Schema (New - Equipment tracking)
const custodySchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    itemName: { type: String, required: true }, // e.g., "Laptop", "Car"
    serialNumber: { type: String, default: "" },
    estimatedValue: { type: Number, required: true },
    receiveDate: { type: Date, required: true },
    returnDate: { type: Date, default: null },
    status: { type: String, enum: ['with_employee', 'returned', 'lost'], default: 'with_employee' }
});

// 9. Penalty Matrix Schema (New - Smart Penalties)
const penaltySchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    violationType: { type: String, required: true }, // e.g., "Late", "Absence without permission"
    actionTaken: { type: String, enum: ['warning', 'deduction'], required: true },
    deductionDays: { type: Number, default: 0 }, // 0.25, 0.5, 1, etc.
    date: { type: Date, default: Date.now },
    isSystemGenerated: { type: Boolean, default: false }
});

// 10. Appraisal & KPI Schema (New)
const appraisalSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    month: { type: String, required: true },
    kpiScore: { type: Number, required: true, min: 0, max: 100 },
    bonusAmount: { type: Number, default: 0 },
    evaluatorNotes: { type: String, default: "" },
    status: { type: String, enum: ['draft', 'approved'], default: 'draft' }
});

// 11. Settlement Schema (New - Offboarding/One-click settlement)
const settlementSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    resignationDate: { type: Date, required: true },
    remainingLeavesValue: { type: Number, default: 0 },
    unpaidSalaries: { type: Number, default: 0 },
    unsettledLoans: { type: Number, default: 0 },
    lostCustodyValue: { type: Number, default: 0 },
    endOfServiceBonus: { type: Number, default: 0 }, // مكافأة نهاية الخدمة
    netPayable: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'finalized', 'paid'], default: 'draft' },
    createdAt: { type: Date, default: Date.now }
});

// 12. Payroll Schema (Updated to support detailed payload & anomaly flags)
const payrollSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    month: { type: String, required: true },
    payload: { type: Object, required: true }, // Will contain full gross-to-net breakdown
    netSalary: { type: Number, required: true },
    hasAnomaly: { type: Boolean, default: false }, // AI Auditor flag
    anomalyReason: { type: String, default: "" },
    status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
    createdAt: { type: Date, default: Date.now }
});
payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });
payrollSchema.index({ companyId: 1, month: 1 });

// Remaining existing schemas (Attendance, Leave, LeaveBalance, Subscription)...
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
    source: { type: String, enum: ['manual', 'biometric', 'whatsapp'], default: 'manual' }, // Device integration prep
    notes: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const leaveSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    type: { type: String, enum: ['annual', 'sick', 'emergency', 'unpaid', 'maternity', 'other'], default: 'annual' },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    days: { type: Number, required: true },
    reason: { type: String, default: "" },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, enum: ['portal', 'whatsapp', 'admin'], default: 'portal' },
    year: { type: Number, default: () => new Date().getFullYear() },
    createdAt: { type: Date, default: Date.now }
});

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

const subscriptionSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    plan: { type: String, enum: ['trial', 'starter', 'growth', 'enterprise'], default: 'trial' },
    billingCycle: { type: String, enum: ['monthly', 'halfyear', 'yearly'], default: 'monthly' },
    maxEmployees: { type: Number, default: 999999 },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
    features: {
        attendance: { type: Boolean, default: true },
        leaves: { type: Boolean, default: true },
        pdfExport: { type: Boolean, default: true },
        analytics: { type: Boolean, default: true },
        apiAccess: { type: Boolean, default: false },
        whatsappBot: { type: Boolean, default: false } // SaaS tier feature
    },
    paymentRef: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

// Model Initialization
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

mongoose.connection.on("error", (err) => console.error("❌ Mongoose Runtime Error:", err));
mongoose.connection.on("disconnected", () => console.log("⚠️ Mongoose Disconnected"));

module.exports = { 
    connectDB, Company, User, Employee, Shift, Candidate, Loan, EWARequest, 
    Custody, Penalty, Appraisal, Settlement, Payroll, Subscription, 
    Attendance, Leave, LeaveBalance 
};

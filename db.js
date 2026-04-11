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
        console.log("✅ MongoDB Ready & Connected (Enterprise HR-ERP)");
    } catch (err) {
        cachedConnection = null;
        console.error("❌ MongoDB Connection Error:", err.message);
        throw err;
    }
};

// 1. الشركة والإعدادات
const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    adminPassword: { type: String, required: true },
    settings: {
        absentDayRate: { type: Number, default: 1 },
        overtimeRate: { type: Number, default: 1.5 },
        workDaysPerWeek: { type: Number, default: 5 },
        dailyWorkHours: { type: Number, default: 8 },
        lateThreshold: { type: Number, default: 120 },
        enableGamification: { type: Boolean, default: true },
        ewaMaxPercentage: { type: Number, default: 0.5 } // Earned Wage Access max 50%
    },
    createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'hr', 'employee', 'blue-collar'], default: 'employee' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    refreshToken: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

// 2. الموظفين (معدل ليدعم الذكاء الاصطناعي وتقييم الأداء)
const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true },
    hiringDate: { type: String, required: true },
    insSalary: { type: Number, default: 0 },
    basicSalary: { type: Number, default: 0 }, // Added for ESS and Loans
    jobType: { type: String, default: "Full Time" },
    isBlueCollar: { type: Boolean, default: false }, // لعمال المصانع (واجهة مبسطة)
    resignationDate: { type: String, default: "" },
    department: { type: String, default: "" },
    position: { type: String, default: "" },
    phone: { type: String, default: "" },
    gamificationPoints: { type: Number, default: 0 }, // نقاط الالتزام
    flightRiskScore: { type: Number, default: 0 }, // مؤشر خطر الاستقالة (0-100)
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }
});

// 3. التوظيف ATS (Applicant Tracking System)
const candidateSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    name: { type: String, required: true },
    phone: String,
    email: String,
    appliedPosition: String,
    status: { type: String, enum: ['Applied', 'Interview', 'Offer', 'Hired', 'Rejected'], default: 'Applied' },
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

// 4. السلف (Loans & Advances)
const loanSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    amount: { type: Number, required: true },
    installments: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    monthlyDeduction: { type: Number, required: true },
    status: { type: String, enum: ['Active', 'Paused', 'Settled'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

// 5. العهد (Assets)
const assetSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    itemName: { type: String, required: true },
    assetValue: { type: Number, required: true }, // للاستقطاع عند عدم التسليم
    status: { type: String, enum: ['Possessed', 'Returned', 'Lost'], default: 'Possessed' },
    createdAt: { type: Date, default: Date.now }
});

// 6. الجزاءات الذكية (Automated Penalties)
const penaltySchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    date: { type: String, required: true },
    reason: { type: String, required: true },
    deductionDays: { type: Number, required: true }, // يحدد آلياً حسب التكرار
    createdAt: { type: Date, default: Date.now }
});

const payrollSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    month: { type: String, required: true },
    payload: { type: Object, required: true },
    aiAuditAlerts: [{ type: String }], // الذكاء الاصطناعي لحسابات الرواتب
    createdAt: { type: Date, default: Date.now }
});
payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });

const subscriptionSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    plan: { type: String, enum: ['trial', 'starter', 'growth', 'enterprise'], default: 'enterprise' },
    status: { type: String, default: 'active' }
});

const attendanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    date: { type: String, required: true },
    month: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent', 'late', 'half', 'holiday', 'weekend'], default: 'present' },
    checkIn: String, checkOut: String, lateMinutes: Number, overtimeHours: Number, shiftType: String
});

const leaveSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    type: String, startDate: String, endDate: String, days: Number, reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    year: Number
});

const leaveBalanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    year: Number, annual: {type: Number, default: 21}, annualUsed: {type: Number, default: 0}
});

const Models = {
    Company: mongoose.models.Company || mongoose.model("Company", companySchema),
    User: mongoose.models.User || mongoose.model("User", userSchema),
    Employee: mongoose.models.Employee || mongoose.model("Employee", employeeSchema),
    Candidate: mongoose.models.Candidate || mongoose.model("Candidate", candidateSchema),
    Loan: mongoose.models.Loan || mongoose.model("Loan", loanSchema),
    Asset: mongoose.models.Asset || mongoose.model("Asset", assetSchema),
    Penalty: mongoose.models.Penalty || mongoose.model("Penalty", penaltySchema),
    Payroll: mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema),
    Subscription: mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema),
    Attendance: mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema),
    Leave: mongoose.models.Leave || mongoose.model("Leave", leaveSchema),
    LeaveBalance: mongoose.models.LeaveBalance || mongoose.model("LeaveBalance", leaveBalanceSchema)
};

module.exports = { connectDB, ...Models };
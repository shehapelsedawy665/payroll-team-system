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
        console.log("✅ MongoDB Ready & Connected");
    } catch (err) {
        cachedConnection = null;
        console.error("❌ MongoDB Connection Error:", err.message);
        throw err;
    }
};

const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    adminPassword: { type: String, required: true },
    taxRegNo: { type: String, default: "" },                    // ✅ NEW: للتصدير الضريبي
    settings: {
        absentDayRate: { type: Number, default: 1 },
        overtimeRate: { type: Number, default: 1.5 },
        overtimeHolRate: { type: Number, default: 2.0 },
        medicalLimit: { type: Number, default: 10000 },
        taxExemptionLimit: { type: Number, default: 20000 },
        workDaysPerWeek: { type: Number, default: 5 },
        dailyWorkHours: { type: Number, default: 8 },
        lateThreshold: { type: Number, default: 120 },
        monthCalcType: { type: String, default: "30" },
        employerInsPercent: { type: Number, default: 19 }       // ✅ NEW: نسبة تأمين الشركة
    },
    createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'hr', 'employee'], default: 'employee' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    refreshToken: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true },
    hiringDate: { type: String, required: true },
    insSalary: { type: Number, default: 0 },
    jobType: { type: String, default: "Full Time" },
    resignationDate: { type: String, default: "" },
    department: { type: String, default: "" },
    position: { type: String, default: "" },
    phone: { type: String, default: "" },
    nationality: { type: String, default: "مصري" },            // ✅ NEW: للتصدير الضريبي
    insuranceNo: { type: String, default: "" },                 // ✅ NEW: الرقم التأميني
    passportNo:  { type: String, default: "" },                 // ✅ NEW: للموظفين الأجانب
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }
});

const payrollSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    month: { type: String, required: true },
    payload: { type: Object, required: true },
    isLocked: { type: Boolean, default: false },                // ✅ NEW: قفل الشهر
    lockedAt: { type: Date },                                   // ✅ NEW
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ✅ NEW
    createdAt: { type: Date, default: Date.now }
});
payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });
payrollSchema.index({ companyId: 1, month: 1 });

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
        apiAccess: { type: Boolean, default: false }
    },
    paymentRef: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

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
attendanceSchema.index({ companyId: 1, month: 1 });

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
    year: { type: Number, default: () => new Date().getFullYear() },
    createdAt: { type: Date, default: Date.now }
});
leaveSchema.index({ employeeId: 1, year: 1 });
leaveSchema.index({ companyId: 1, status: 1 });

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

// ✅ NEW: Department Schema
const departmentSchema = new mongoose.Schema({
    name:      { type: String, required: true },
    code:      { type: String, default: "" },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    parentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    headcount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
departmentSchema.index({ companyId: 1 });

// ✅ NEW: Recruitment Schema
const recruitmentSchema = new mongoose.Schema({
    companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    position:   { type: String, required: true },
    department: { type: String, default: "" },
    status:     { type: String, enum: ['open','screening','interview','offer','hired','closed'], default: 'open' },
    headcount:  { type: Number, default: 1 },
    openDate:   { type: Date, default: Date.now },
    closeDate:  { type: Date },
    candidates: [{
        name: String, email: String, phone: String,
        cvUrl: String,
        stage: { type: String, enum: ['applied','screening','interview1','interview2','offer','rejected','hired'], default: 'applied' },
        notes: String, addedAt: { type: Date, default: Date.now }
    }],
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt:  { type: Date, default: Date.now }
});

// ✅ NEW: Performance Review Schema
const performanceSchema = new mongoose.Schema({
    employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    period:       { type: String, required: true },
    type:         { type: String, enum: ['quarterly','semiannual','annual'], default: 'annual' },
    kpis: [{
        title: String, target: Number, actual: Number,
        weight: Number,
        score:  Number
    }],
    overallScore: { type: Number, default: 0 },
    rating:       { type: String, enum: ['excellent','veryGood','good','acceptable','poor'], default: 'good' },
    salaryImpact: { type: Number, default: 0 },
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status:       { type: String, enum: ['draft','submitted','approved'], default: 'draft' },
    comments:     { type: String, default: "" },
    createdAt:    { type: Date, default: Date.now }
});
performanceSchema.index({ employeeId: 1, period: 1 });

const Company      = mongoose.models.Company      || mongoose.model("Company",      companySchema);
const User         = mongoose.models.User         || mongoose.model("User",         userSchema);
const Employee     = mongoose.models.Employee     || mongoose.model("Employee",     employeeSchema);
const Payroll      = mongoose.models.Payroll      || mongoose.model("Payroll",      payrollSchema);
const Subscription = mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema);
const Attendance   = mongoose.models.Attendance   || mongoose.model("Attendance",   attendanceSchema);
const Leave        = mongoose.models.Leave        || mongoose.model("Leave",        leaveSchema);
const LeaveBalance = mongoose.models.LeaveBalance || mongoose.model("LeaveBalance", leaveBalanceSchema);
const Department   = mongoose.models.Department   || mongoose.model("Department",   departmentSchema);   // ✅ NEW
const Recruitment  = mongoose.models.Recruitment  || mongoose.model("Recruitment",  recruitmentSchema);  // ✅ NEW
const Performance  = mongoose.models.Performance  || mongoose.model("Performance",  performanceSchema);  // ✅ NEW

mongoose.connection.on("error", (err) => console.error("❌ Mongoose Runtime Error:", err));
mongoose.connection.on("disconnected", () => console.log("⚠️ Mongoose Disconnected"));

module.exports = { connectDB, Company, User, Employee, Payroll, Subscription, Attendance, Leave, LeaveBalance, Department, Recruitment, Performance };

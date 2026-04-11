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
    settings: {
        absentDayRate: { type: Number, default: 1 },
        overtimeRate: { type: Number, default: 1.5 },
        overtimeHolRate: { type: Number, default: 2.0 },
        medicalLimit: { type: Number, default: 10000 },
        taxExemptionLimit: { type: Number, default: 20000 },
        workDaysPerWeek: { type: Number, default: 5 },
        dailyWorkHours: { type: Number, default: 8 },
        lateThreshold: { type: Number, default: 120 },
        monthCalcType: { type: String, default: "30" }
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
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }
});

const payrollSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    month: { type: String, required: true },
    payload: { type: Object, required: true },
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

const Company      = mongoose.models.Company      || mongoose.model("Company",      companySchema);
const User         = mongoose.models.User         || mongoose.model("User",         userSchema);
const Employee     = mongoose.models.Employee     || mongoose.model("Employee",     employeeSchema);
const Payroll      = mongoose.models.Payroll      || mongoose.model("Payroll",      payrollSchema);
const Subscription = mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema);
const Attendance   = mongoose.models.Attendance   || mongoose.model("Attendance",   attendanceSchema);
const Leave        = mongoose.models.Leave        || mongoose.model("Leave",        leaveSchema);
const LeaveBalance = mongoose.models.LeaveBalance || mongoose.model("LeaveBalance", leaveBalanceSchema);

mongoose.connection.on("error", (err) => console.error("❌ Mongoose Runtime Error:", err));
mongoose.connection.on("disconnected", () => console.log("⚠️ Mongoose Disconnected"));

module.exports = { connectDB, Company, User, Employee, Payroll, Subscription, Attendance, Leave, LeaveBalance };

const mongoose = require("mongoose");

// إضافة كاش للاتصال لتحسين الأداء ومنع التكرار في بيئة Vercel (Serverless)
let cachedConnection = null;

const connectDB = async () => {
    // 1. التحقق إذا كان هناك اتصال قائم بالفعل
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    // 2. إذا كان هناك محاولة اتصال جارية، انتظرها بدلاً من فتح واحدة جديدة
    if (cachedConnection) {
        await cachedConnection;
        return;
    }

    try {
        // الرابط الخاص بك مع إعدادات الاستقرار المحسنة
        const uri = process.env.MONGODB_URI || "mongodb+srv://Sedawy:FinalPass2026@egyptian-payroll.a6bquen.mongodb.net/payrollDB?retryWrites=true&w=majority";

        const options = {
            serverSelectionTimeoutMS: 30000, // زيادة وقت البحث عن السيرفر لـ 30 ثانية لمنع الـ Timeout
            socketTimeoutMS: 45000,         
            family: 4,                       // إجبار استخدام IPv4 لزيادة التوافق مع Vercel
            bufferCommands: false,           // منع تعليق الأوامر في حالة فشل الاتصال اللحظي
            heartbeatFrequencyMS: 10000      
        };

        // حفظ الوعد (Promise) الخاص بالاتصال في الكاش
        cachedConnection = mongoose.connect(uri, options);
        await cachedConnection;

        console.log("✅ MongoDB Ready & Connected");
    } catch (err) {
        cachedConnection = null; // إعادة تعيين الكاش في حالة الخطأ للمحاولة لاحقاً
        console.error("❌ MongoDB Connection Error Details:");
        console.error(err.message);
        throw err; // تمرير الخطأ للسيرفر ليظهر في الـ Logs
    }
};

// --- [Schemas التأسيسية للنظام - الحفاظ على الهيكل كاملاً] ---

// 1. هيكل بيانات الشركة (Company)
const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    adminPassword: { type: String, required: true }, 
    settings: {
        absentDayRate: { type: Number, default: 1 },
        overtimeRate: { type: Number, default: 1.5 },
        medicalLimit: { type: Number, default: 10000 },
        taxExemptionLimit: { type: Number, default: 20000 }
    },
    createdAt: { type: Date, default: Date.now }
});

// 2. هيكل بيانات المستخدمين (User)
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, 
    role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }, 
    createdAt: { type: Date, default: Date.now }
});

// 3. هيكل بيانات الموظفين (الموجود مسبقاً مع ربطه بالشركة)
const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true },
    hiringDate: { type: String, required: true },
    insSalary: { type: Number, default: 0 },
    jobType: { type: String, default: "Full Time" },
    resignationDate: { type: String, default: "" },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' } 
});

// تصدير النماذج (Models) مع منع إعادة تعريفها (Overwriting) في Vercel
const Company = mongoose.models.Company || mongoose.model("Company", companySchema);
const User = mongoose.models.User || mongoose.model("User", userSchema);
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

// مراقبة أحداث الاتصال في الـ Runtime
mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose Runtime Error:", err);
});

mongoose.connection.on("disconnected", () => {
    console.log("⚠️ Mongoose Disconnected");
});

module.exports = { connectDB, Company, User, Employee };

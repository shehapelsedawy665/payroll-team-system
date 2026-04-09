const mongoose = require("mongoose");

const connectDB = async () => {
    // التحقق إذا كان هناك اتصال قائم بالفعل لتجنب التكرار في بيئة Serverless
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    try {
        // الرابط الخاص بك مع إعدادات الاستقرار
        const uri = process.env.MONGODB_URI || "mongodb+srv://Sedawy:FinalPass2026@egyptian-payroll.a6bquen.mongodb.net/payrollDB?retryWrites=true&w=majority";

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 45000,         
            family: 4                       
        });

        console.log("✅ MongoDB Ready & Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error Details:");
        console.error(err.message);
    }
};

// --- [Schemas التأسيسية للنظام الجديد] ---

// 1. هيكل بيانات الشركة (Company)
const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    adminPassword: { type: String, required: true }, // الباسورد الخاصة بالشركة (غير باسورد الإيميل)
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
    password: { type: String, required: true }, // باسورد الإيميل الشخصي
    role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }, // ربط المستخدم بشركته
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
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' } // ربط الموظف بشركة معينة
});

// تصدير النماذج (Models) لاستخدامها في السيرفر
const Company = mongoose.models.Company || mongoose.model("Company", companySchema);
const User = mongoose.models.User || mongoose.model("User", userSchema);
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

// مراقبة أحداث الاتصال
mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose Runtime Error:", err);
});

mongoose.connection.on("disconnected", () => {
    console.log("⚠️ Mongoose Disconnected");
});

module.exports = { connectDB, Company, User, Employee };

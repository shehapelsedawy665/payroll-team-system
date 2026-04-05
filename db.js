const mongoose = require("mongoose");

/**
 * وظيفة الاتصال بقاعدة البيانات
 * تم تحسينها لضمان استقرار الاتصال مع MongoDB Atlas
 */
const connectDB = async () => {
    // التحقق إذا كان هناك اتصال قائم بالفعل لتجنب التكرار
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    try {
        // الرابط الخاص بك مع إضافة إعدادات التحسين (Optimization)
        const dbURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

        await mongoose.connect(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // أقصى عدد من الاتصالات المفتوحة لضمان السرعة
            maxPoolSize: 10, 
            // وقت الانتظار قبل فشل الاتصال
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 45000,
        });

        console.log("✅ MongoDB Connected & Ready for Multi-tenant ERP");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        // محاولة إعادة الاتصال في حالة الفشل بعد 5 ثواني
        setTimeout(connectDB, 5000);
    }
};

// التعامل مع أحداث الاتصال لمتابعة الحالة
mongoose.connection.on("disconnected", () => {
    console.log("⚠️ MongoDB Disconnected. Trying to reconnect...");
});

module.exports = connectDB;

const mongoose = require("mongoose");

/**
 * وظيفة الاتصال بقاعدة البيانات - Seday ERP Core
 * تم تحسينها لضمان استقرار الاتصال مع MongoDB Atlas وتقليل الـ Latency
 */
const connectDB = async () => {
    // التحقق إذا كان هناك اتصال قائم بالفعل لتجنب التكرار في بيئة الـ Development
    if (mongoose.connection.readyState >= 1) {
        console.log("ℹ️ Using existing MongoDB connection");
        return;
    }

    try {
        // الرابط الخاص بك من الـ Environment Variables (الأولوية لـ Vercel)
        // أو الرابط الاحتياطي مع التأكد من الـ Encoding
        const dbURI = process.env.MONGODB_URI || "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

        await mongoose.connect(dbURI, {
            // الإعدادات دي بتضمن استقرار الـ Shards في Atlas
            maxPoolSize: 10, 
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 45000,
            family: 4, // بيساعد في سرعة الـ DNS Resolve في بعض السيرفرات
            dbName: "payrollDB" // التأكيد على اسم قاعدة البيانات
        });

        console.log("✅ MongoDB Connected | Ready for Multi-tenant Payroll Operations");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        // محاولة إعادة الاتصال التلقائي كل 5 ثواني في حالة الفشل (فقط في بيئة الـ Local)
        if (process.env.NODE_ENV !== 'production') {
            setTimeout(connectDB, 5000);
        }
    }
};

// متابعة حالة الاتصال (Monitoring) لضمان عدم توقف النظام
mongoose.connection.on("connected", () => {
    console.log("🟢 Database Connection: Established");
});

mongoose.connection.on("disconnected", () => {
    console.log("⚠️ Database Connection: Disconnected. Attempting Reconnect...");
});

mongoose.connection.on("error", (err) => {
    console.error("🔥 Database Critical Error:", err);
});

// إغلاق الاتصال بأمان عند توقف السيرفر (Graceful Shutdown)
process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log("🛑 MongoDB Connection closed due to app termination");
    process.exit(0);
});

module.exports = connectDB;

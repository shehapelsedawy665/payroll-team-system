const mongoose = require("mongoose");

/**
 * وظيفة الاتصال بقاعدة البيانات - Seday ERP Core
 * تم تحسينها لضمان استقرار الاتصال مع MongoDB Atlas وتقليل الـ Latency
 */
const connectDB = async () => {
    // 1. منع التكرار: لو متصل بالفعل، اخرج فوراً
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    try {
        // 2. استخدام الرابط من البيئة المحيطة (Vercel)
        const dbURI = process.env.MONGODB_URI;

        if (!dbURI) {
            console.error("❌ MONGODB_URI is missing in Environment Variables!");
            return;
        }

        // 3. خيارات الاتصال المحسنة لبيئة السحاب
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4,
            dbName: "payrollDB"
        };

        await mongoose.connect(dbURI, options);

        console.log("✅ MongoDB Connected | Ready for Multi-tenant Payroll Operations");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        
        // في Vercel لا نستخدم setTimeout لإعادة الاتصال لأنها Serverless
        // يفضل ترك المنصة هي من تعيد تشغيل الـ Function
        if (process.env.NODE_ENV !== 'production') {
            setTimeout(connectDB, 5000);
        }
    }
};

// متابعة حالة الاتصال (Monitoring) لضمان استقرار النظام
mongoose.connection.on("connected", () => {
    console.log("🟢 Database Connection: Established");
});

mongoose.connection.on("disconnected", () => {
    console.log("⚠️ Database Connection: Disconnected");
});

mongoose.connection.on("error", (err) => {
    // تقليل الضجيج في الـ Logs عند حدوث خطأ عابر
    if (err.message.includes("buffering timed out")) {
        console.error("🔥 Database Timeout: Check your MongoDB Atlas IP Access!");
    } else {
        console.error("🔥 Database Critical Error:", err.message);
    }
});

// إغلاق الاتصال بأمان عند توقف السيرفر (Graceful Shutdown)
process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log("🛑 MongoDB Connection closed due to app termination");
    process.exit(0);
});

module.exports = connectDB;

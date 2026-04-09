const mongoose = require("mongoose");

const connectDB = async () => {
    // التحقق إذا كان هناك اتصال قائم بالفعل لتجنب التكرار في بيئة Serverless
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    try {
        // الرابط اللي إنت بعته (SRV) هو الأفضل والأسرع في الربط
        const uri = process.env.MONGODB_URI || "mongodb+srv://Sedawy:FinalPass2026@egyptian-payroll.a6bquen.mongodb.net/payrollDB?retryWrites=true&w=majority";

        await mongoose.connect(uri, {
            // إعدادات لضمان استقرار الاتصال ومنع الـ Timeout
            serverSelectionTimeoutMS: 5000, // يحاول يربط لمدة 5 ثواني كحد أقصى
            socketTimeoutMS: 45000,         // يغلق الـ socket لو مفيش استجابة بعد 45 ثانية
            family: 4                       // إجبار الاتصال باستخدام IPv4 (بيحل مشاكل كتير مع Vercel)
        });

        console.log("✅ MongoDB Ready & Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error Details:");
        console.error(err.message);
        // في حالة الفشل، بنطبع الخطأ بوضوح عشان نعرف لو المشكلة IP Access
    }
};

// مراقبة أحداث الاتصال (مفيدة جداً في الـ Debugging)
mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose Runtime Error:", err);
});

mongoose.connection.on("disconnected", () => {
    console.log("⚠️ Mongoose Disconnected");
});

module.exports = connectDB;

const mongoose = require("mongoose");

/**
 * وظيفة الاتصال بقاعدة البيانات - Seday ERP Core (Vercel Optimized)
 * تم تحسينها لمنع تكرار الاتصال وتجنب الـ Memory Leaks في البيئة السحابية
 */

// متغير لتخزين حالة الاتصال (Caching the connection)
let isConnected = false;

const connectDB = async () => {
    // 1. منع التكرار: لو متصل بالفعل (readyState == 1)، اخرج فوراً
    if (mongoose.connection.readyState === 1) {
        console.log("🟢 Using existing MongoDB connection");
        return;
    }

    // تأكد إننا مش بنحاول نفتح اتصال تاني لو فيه واحد "بيلف" (Connecting)
    if (mongoose.connection.readyState === 2) {
        console.log("⏳ Connection is already in progress...");
        return;
    }

    try {
        const dbURI = process.env.MONGODB_URI;

        if (!dbURI) {
            throw new Error("❌ MONGODB_URI is missing in Environment Variables!");
        }

        // 2. خيارات الاتصال المحسنة (نفس الخيارات بتاعتك مع ضبط الـ Buffering)
        const options = {
            maxPoolSize: 1, // في Vercel يفضل 1 لتقليل عدد الـ Connections المفتوحة في Atlas
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4,
            dbName: "payrollDB",
            autoIndex: true, // مهم عشان الـ Unique fields تشتغل صح
        };

        // منع Mongoose من عمل Listeners متكررة في كل Request
        mongoose.set('strictQuery', true);

        await mongoose.connect(dbURI, options);
        isConnected = true;
        
        console.log("✅ MongoDB Connected | Ready for Payroll Operations");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        // في Vercel لا نستخدم الـ Throw هنا عشان السيرفر ما يقعش بالكامل
        isConnected = false;
    }
};

// تصدير الوظيفة لاستخدامها في server.js
module.exports = connectDB;

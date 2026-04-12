const mongoose = require("mongoose");

// منع التحذيرات في النسخ الجديدة من Mongoose
mongoose.set('strictQuery', false);

let cachedConnection = null;

const connectDB = async () => {
    // 1. لو فيه اتصال شغال فعلاً، ارجع فوراً
    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection;
    }

    // 2. لو فيه محاولة اتصال قيد التنفيذ، استناها
    if (cachedConnection) {
        return await cachedConnection;
    }

    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error("❌ MONGODB_URI not set in environment variables");
        
        // إعدادات محسنة لبيئة Vercel (Serverless)
        const options = {
            serverSelectionTimeoutMS: 5000, // تقليل وقت الانتظار عشان الـ Function متفصلش
            socketTimeoutMS: 45000,
            family: 4,
            bufferCommands: false, // تعطيل التخزين المؤقت عشان الأخطاء تظهر فوراً
        };

        console.log("⏳ Connecting to MongoDB...");
        cachedConnection = mongoose.connect(uri, options);
        
        const conn = await cachedConnection;
        console.log("✅ MongoDB Ready & Connected (HR-ERP Advanced)");
        return conn;
    } catch (err) {
        cachedConnection = null;
        console.error("❌ MongoDB Connection Error:", err.message);
        throw err;
    }
};

const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const PayrollRecord = require('../models/PayrollRecord');
const Attendance = require('../models/Attendance');
const Penalty = require('../models/Penalty');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Subscription = require('../models/Subscription');
const Shift = require('../models/Shift');

module.exports = { connectDB, User, Company, Employee, PayrollRecord, Attendance, Penalty, Leave, LeaveBalance, Subscription, Shift };
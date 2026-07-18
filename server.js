require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const path = require('path');

const app = express();

// --- 1. الـ Middleware الأساسية ---
app.use(express.json()); 
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. الاتصال بقاعدة البيانات (مُجهز لبيئة Vercel) ---
const dbURI = process.env.MONGO_URI;

// لو اللينك مش موجود في Vercel السيرفر هيعرفنا فوراً
if (!dbURI) {
    console.error('❌ رابط قاعدة البيانات (MONGO_URI) مش موجود في Vercel!');
} else {
    mongoose.connect(dbURI, {
        serverSelectionTimeoutMS: 5000, // خليناها 5 ثواني عشان لو فيه غلطة يرد أسرع
    })
    .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
    .catch((err) => console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err));
}

// --- 3. تعريف مسارات الـ API ---
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/employees', require('./backend/routes/employees'));
app.use('/api/attendance', require('./backend/routes/attendance'));
app.use('/api/payroll', require('./backend/routes/payroll'));

// --- 4. مسار اختبار سريع ---
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: '🚀 HR & Payroll System API is running flawlessly!'
    });
});

app.use('/payslips', express.static(path.join(__dirname, 'public/payslips')));

// --- 5. تشغيل السيرفر (متوافق مع Vercel) ---
const PORT = process.env.PORT || 5000;

// لو شغالين محلياً نشغله بالطريقة العادية
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 السيرفر شغال تمام على بورت ${PORT}`);
    });
}

// 🟢 السطر ده هو "المفتاح السحري" لـ Vercel عشان ميضربش Timeout 🟢
module.exports = app;

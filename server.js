require('dotenv').config(); // عشان نقرأ المتغيرات السرية زي رابط الداتابيز
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // عشان نسمح للـ Frontend يكلم الـ Backend بدون مشاكل
const path = require('path');

const app = express();

// --- 1. الـ Middleware الأساسية ---
app.use(express.json()); // عشان السيرفر يفهم الداتا اللي مبعوتة في شكل JSON
app.use(cors());

// --- 2. الاتصال بقاعدة البيانات (MongoDB) ---
const dbURI = process.env.MONGO_URI || 'mongodb://localhost:27017/hr_payroll_system';
mongoose.connect(dbURI)
    .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
    .catch((err) => console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err));

// --- 3. تعريف مسارات الـ API (الـ Routes اللي عملناها) ---
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/employees', require('./backend/routes/employees'));
app.use('/api/attendance', require('./backend/routes/attendance'));
app.use('/api/payroll', require('./backend/routes/payroll'));

// --- 4. مسار اختبار سريع للتأكد إن السيرفر شغال ---
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: '🚀 HR & Payroll System API is running flawlessly!'
    });
});

// مسار عشان الـ Frontend يقدر يحمل ملفات الـ PDF اللي بتطلع
app.use('/payslips', express.static(path.join(__dirname, 'public/payslips')));

// --- 5. تشغيل السيرفر ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر شغال تمام على بورت ${PORT}`);
});

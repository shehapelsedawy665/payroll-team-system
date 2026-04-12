const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require('dotenv').config();  // Load from .env file
const { connectDB, Company, User, Employee } = require('./backend/config/db');
const { runPayrollLogic } = require('./backend/logic/payrollEngine');

const app = express();
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// تعريف نموذج الـ Payroll
const payrollSchema = new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, 
    month: String, 
    payload: Object 
});
const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema);

// --- [تعديل: استدعاء قاعدة البيانات لبيئة Vercel Serverless] ---
connectDB().catch(err => console.error("Critical: DB Connection Failed", err));

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const payrollRoutes = require('./routes/payroll');
const attendanceRoutes = require('./routes/attendance');
const attendanceAPIRoutes = require('./routes/attendanceAPI');
const biometricRoutes = require('./routes/biometric');
const leaveAPIRoutes = require('./routes/leaveAPI');
const settingsRoutes = require('./routes/settings');
const leaveRoutes = require('./routes/leaves');
const hrRoutes = require('./routes/hr');
const devRoutes = require('./routes/dev');
const appraisalRoutes = require('./routes/appraisal');
const hrIntegrationRoutes = require('./routes/hrIntegration');
const recruitmentRoutes = require('./routes/recruitment');
const onboardingRoutes = require('./routes/onboarding');

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/attendance', attendanceAPIRoutes);
app.use('/api/biometric', biometricRoutes);
app.use('/api/leave', leaveAPIRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/appraisal', appraisalRoutes);
app.use('/api/hr-integration', hrIntegrationRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/onboarding', onboardingRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error("❌ Error:", err);
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

const publicPath = path.join(__dirname, "public");

// Serve static files (CSS, JS, images) from public/ folder
app.use(express.static(publicPath));

// SPA catch-all: serve index.html for any non-API, non-static route
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// تشغيل السيرفر محلياً (Vercel يتجاهل هذا تلقائياً في بيئة Serverless)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));

// تصدير التطبيق لـ Vercel Serverless Functions
module.exports = app;
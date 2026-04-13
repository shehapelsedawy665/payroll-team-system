const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require('dotenv').config();

const { connectDB, Company, User, Employee } = require('./backend/config/db');
const { runPayrollLogic } = require('./backend/logic/payrollEngine');

// ============= STRICT MATHEMATICAL PRECISION =============
// Rounding function for Egyptian tax calculations (2 decimals)
const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const app = express();

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Payroll Schema (inline for immediate availability)
const payrollSchema = new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, 
    month: String, 
    payload: Object 
});
const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema);

// LAZY DB CONNECTION: Connect on first API request, not at startup
let dbConnected = false;

app.use(async (req, res, next) => {
    if (!dbConnected && req.path.startsWith('/api/')) {
        try {
            await connectDB();
            dbConnected = true;
        } catch (error) {
            console.error("Database connection failed on request:", error.message);
            return res.status(503).json({
                error: "Database connection failed",
                message: process.env.NODE_ENV === 'development' ? error.message : "Service temporarily unavailable"
            });
        }
    }
    next();
});

// Health check endpoint (before DB requirement)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        dbConnected: mongoose.connection.readyState === 1,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Route Imports
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

// API Routes
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

// Static Files
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// SPA catch-all: serve index.html for non-API routes
app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"), (err) => {
        if (err) {
            res.status(404).json({ error: "Page not found" });
        }
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", {
        message: err.message,
        path: req.path,
        method: req.method,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        statusCode: statusCode
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found", path: req.path });
});

// Local development server (Vercel ignores this)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Development Server running on http://localhost:${PORT}`);
    });
}

// Export for Vercel Serverless
module.exports = app;
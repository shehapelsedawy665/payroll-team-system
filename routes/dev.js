const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Company, User, Employee } = require('../backend/config/db');

// 🔐 Security middleware - Verify request origin/IP if needed (optional extra layer)
const isDev = (req, res, next) => {
    // In production, you may want to check request source IP
    // For now, we rely on password protection in frontend
    next();
};

// ==================== DEV STATISTICS ====================
router.get('/stats', isDev, async (req, res) => {
    try {
        const companies = await Company.countDocuments();
        const users = await User.countDocuments();
        const employees = await Employee.countDocuments();
        
        // Count employees with linked user accounts
        const linkedAccounts = await User.countDocuments({ employeeId: { $ne: null } });
        
        res.json({
            companies,
            users,
            employees,
            linkedAccounts
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== LIST ALL COMPANIES ====================
router.get('/companies', isDev, async (req, res) => {
    try {
        const companies = await Company.find().select('_id name createdAt');
        res.json(companies);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== MANUAL COMPANY REGISTRATION ====================
// Only accessible via Dev Panel (password protected)
router.post('/register-company', isDev, async (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        
        // Check if email already exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Create company
        const company = await new Company({
            name,
            adminPassword: await bcrypt.hash(password, 10),
            settings: {
                taxYear: 2026,
                currency: 'EGP',
                absentDayRate: 1,
                overtimeRate: 1.5,
                overtimeHolRate: 2.0,
                medicalLimit: 10000,
                taxExemptionLimit: 40000,
                personalExemption: 20000,
                workDaysPerWeek: 5,
                dailyWorkHours: 8,
                lateThreshold: 120,
                monthCalcType: "30"
            }
        }).save();
        
        // Create admin user for company
        const hashedPass = await bcrypt.hash(password, 10);
        const user = await new User({
            email,
            password: hashedPass,
            role: 'admin',
            companyId: company._id
        }).save();
        
        res.status(201).json({
            success: true,
            companyId: company._id,
            userId: user._id,
            message: `Company "${name}" created successfully with admin user "${email}"`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== MANUAL USER REGISTRATION ====================
// Only for admins to create HR/Finance users
router.post('/register-user', isDev, async (req, res) => {
    const { companyId, email, password, role } = req.body;
    
    if (!companyId || !email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['admin', 'hr', 'finance', 'employee'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    
    try {
        
        // Verify company exists
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        // Check if email already exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Create user
        const hashedPass = await bcrypt.hash(password, 10);
        const user = await new User({
            email,
            password: hashedPass,
            role,
            companyId
        }).save();
        
        res.status(201).json({
            success: true,
            userId: user._id,
            message: `User "${email}" created with role "${role}"`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== TEST EMPLOYEE AUTO-ACCOUNT CREATION ====================
// Tests the auto-account generation for a new employee
router.post('/test-emp-autoaccount', isDev, async (req, res) => {
    const { jobId, nationalId, name, companyId } = req.body;
    
    if (!jobId || !nationalId || !name || !companyId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (nationalId.length !== 14) {
        return res.status(400).json({ error: 'National ID must be 14 digits' });
    }
    
    try {
        
        // Verify company exists
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        // Create employee
        const employee = await new Employee({
            name,
            nationalId,
            jobId,
            hiringDate: new Date(),
            companyId,
            basicSalary: 0,
            insSalary: 5384.62,
            jobType: 'Full Time'
        }).save();
        
        // Auto-generate user account
        // Username = Job ID
        // Password = National ID (hashed)
        const username = jobId; // This will be the login username
        const passwordHash = await bcrypt.hash(nationalId, 10);
        
        const user = await new User({
            email: `${jobId}@${company.name.toLowerCase().replace(/\s+/g, '')}`, // Generate email from jobId
            password: passwordHash,
            role: 'employee',
            companyId,
            employeeId: employee._id // Link to employee
        }).save();
        
        // Update employee with userId link
        await Employee.findByIdAndUpdate(employee._id, { userId: user._id });
        
        res.status(201).json({
            success: true,
            employeeId: employee._id,
            userId: user._id,
            username: jobId,
            message: `Auto-account created for employee "${name}". They can login with Job ID: ${jobId} and National ID as password.`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Employee, LeaveBalance, Payroll, Attendance, Leave, User, Company } = require('../backend/config/db');
const { authMiddleware, adminOnly } = require('../backend/middleware/auth');
const { validateEmployee } = require('../backend/middleware/validators');

// 1. جلب كل الموظفين
router.get("/", authMiddleware, async (req, res) => {
    try {
        const employees = await Employee.find({ companyId: req.user.companyId }).sort({ _id: -1 });
        res.json(employees);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. إضافة موظف جديد (مع إنشاء حساب تلقائي)
router.post("/", authMiddleware, validateEmployee, async (req, res) => {
    try {
        
        // Create employee
        const emp = await new Employee({
            ...req.body,
            companyId: req.user.companyId
        }).save();
        
        // 🔥 AUTO-ACCOUNT GENERATION HOOK
        // When employee is created, automatically generate a user account
        // Username = Job ID (الرقم الوظيفي)
        // Password = National ID (الرقم القومي) - hashed
        if (req.body.jobId && req.body.nationalId) {
            try {
                const hashedPassword = await bcrypt.hash(req.body.nationalId, 10);
                const company = await Company.findById(req.user.companyId);
                
                const autoUser = await new User({
                    email: `${req.body.jobId}@${company.name.toLowerCase().replace(/\s+/g, '')}`,
                    password: hashedPassword,
                    role: 'employee',
                    companyId: req.user.companyId,
                    employeeId: emp._id
                }).save();
                
                // Update employee with user link
                emp.userId = autoUser._id;
                await emp.save();
                
                console.log(`✅ Auto-account created for employee ${req.body.name}: Job ID: ${req.body.jobId}`);
            } catch (autoErr) {
                console.warn(`⚠️ Could not create auto-account for employee: ${autoErr.message}`);
                // Don't fail the entire request if auto-account fails
            }
        }
        
        await new LeaveBalance({ employeeId: emp._id, companyId: emp.companyId, year: new Date().getFullYear() }).save();
        res.status(201).json(emp);
    } catch (err) {
        // Handle MongoDB E11000 duplicate key error (duplicate nationalId)
        if (err.code === 11000) {
            return res.status(400).json({ error: "هذا الرقم القومي مسجل مسبقاً لموظف آخر" });
        }
        res.status(400).json({ error: err.message });
    }
});

// 3. تفاصيل الموظف (البروفايل)
router.get("/details", authMiddleware, async (req, res) => {
    try {
        const id = req.query.id;
        const emp = await Employee.findById(id);
        const history = await Payroll.find({ employeeId: id }).sort({ month: 1 });
        const leaveBalance = await LeaveBalance.findOne({ employeeId: id, year: new Date().getFullYear() });
        res.json({ emp, history, leaveBalance });
    } catch (err) { res.status(404).json({ error: "Employee not found" }); }
});

// 4. تحديث بيانات موظف
router.put("/", authMiddleware, async (req, res) => {
    try {
        const emp = await Employee.findByIdAndUpdate(req.query.id, req.body, { new: true });
        res.json(emp);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// 5. حذف موظف
router.delete("/", authMiddleware, adminOnly, async (req, res) => {
    try {
        const id = req.query.id;
        await Employee.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

module.exports = router;

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const { connectDB, Company, User, Employee } = require("./db"); // استيراد النماذج من db.js
const { runPayrollLogic } = require("./calculations");

const app = express();
app.use(cors());
app.use(express.json());

// 1. الاتصال بقاعدة البيانات
connectDB();

// تعريف نموذج الـ Payroll (باقي النماذج تم نقلها لـ db.js)
const payrollSchema = new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, 
    month: String, 
    payload: Object 
});
const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema);

// --- [نظام الحماية والـ Authentication] ---

// 1. تسجيل مستخدم جديد (Sign-up) - تم تعديل المنطق لضمان الربط الصحيح
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { email, password, role, companyName, companyPassword } = req.body;

        // التحقق يدوياً إذا كان المستخدم موجوداً لتجنب رسالة الخطأ العامة
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "هذا البريد الإلكتروني مسجل بالفعل" });
        }
        
        let companyId = null;

        if (role === 'admin') {
            // إنشاء شركة جديدة وربطها بالأدمن
            const newCompany = new Company({
                name: companyName || "New Company",
                adminPassword: companyPassword // الباسورد الخاصة بالشركة
            });
            const savedCompany = await newCompany.save();
            companyId = savedCompany._id;
        }

        const newUser = new User({ 
            email, 
            password, 
            role: role || 'admin', 
            companyId 
        });
        
        await newUser.save();
        res.status(201).json({ success: true, message: "User created successfully" });
    } catch (err) {
        console.error("Signup Error:", err);
        res.status(400).json({ error: "بيانات غير مكتملة أو خطأ في التسجيل" });
    }
});

// 2. تسجيل الدخول (Login)
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        // استخدام populate لجلب بيانات الشركة مع المستخدم
        const user = await User.findOne({ email }).populate('companyId');

        if (!user || user.password !== password) {
            return res.status(401).json({ error: "الإيميل أو كلمة المرور غير صحيحة" });
        }

        res.json({
            success: true,
            user: {
                email: user.email,
                role: user.role,
                companyId: user.companyId ? user.companyId._id : null,
                companyName: user.companyId ? user.companyId.name : "System"
            }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "فشل تسجيل الدخول" });
    }
});

// 3. بوابة المطور السرية (Developer Core Login)
app.post("/api/settings/dev-login", (req, res) => {
    const { password } = req.body;
    // الباسورد: CO.Sedawy.2026
    if (password === "CO.Sedawy.2026") {
        return res.json({ success: true, token: "dev-session-valid-2026" });
    }
    res.status(401).json({ success: false, message: "Unauthorized" });
});

// --- [APIs الموظفين والرواتب] ---

app.post("/api/employees", async (req, res) => {
    try {
        const employeeData = {
            name: req.body.name,
            nationalId: req.body.nationalId,
            hiringDate: req.body.hiringDate,
            insSalary: Number(req.body.insSalary) || 0,
            jobType: req.body.jobType || "Full Time",
            resignationDate: req.body.resignationDate || "",
            companyId: req.body.companyId // ربط الموظف بالشركة
        };

        const newEmp = new Employee(employeeData);
        const savedEmp = await newEmp.save();
        res.status(201).json(savedEmp);
    } catch (err) {
        console.error("Critical Save Error:", err);
        res.status(400).json({ error: "فشل الحفظ: " + err.message });
    }
});

app.get("/api/employees", async (req, res) => {
    try {
        const filter = req.query.companyId ? { companyId: req.query.companyId } : {};
        const employees = await Employee.find(filter).sort({_id: -1});
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: "Error fetching employees" });
    }
});

app.get("/api/employees/:id/details", async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id);
        const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
        
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => { 
            pDays += (Number(r.payload.days) || 0); 
            pTaxable += (Number(r.payload.currentTaxable) || 0); 
            pTaxes += (Number(r.payload.monthlyTax) || 0); 
        });
        
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (err) {
        res.status(404).json({ error: "Employee not found" });
    }
});

app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions, prevData, hiringDate, resignationDate, companyId } = req.body;
        
        const emp = await Employee.findById(empId);
        const company = await Company.findById(companyId);

        const settings = company ? company.settings : { medicalLimit: 10000, taxExemptionLimit: 20000 };

        const MAX_INS = 16700;
        const MIN_INS = 5384.62;
        let effectiveInsSalary = Math.min(MAX_INS, Math.max(MIN_INS, emp.insSalary || 0));
        
        const empForCalc = { ...emp.toObject(), insSalary: effectiveInsSalary };

        if (resignationDate) {
            await Employee.findByIdAndUpdate(empId, { resignationDate: resignationDate });
        }

        const result = runPayrollLogic(
            { fullBasic, fullTrans, days, additions, deductions, month, hiringDate, resignationDate }, 
            prevData, 
            empForCalc
        );

        const record = await new Payroll({ 
            employeeId: empId, 
            month, 
            payload: result 
        }).save();
        
        res.json(record);
    } catch (err) {
        console.error("Calculation Error:", err);
        res.status(500).json({ error: "Calculation error occurred" });
    }
});

app.post("/api/payroll/net-to-gross", async (req, res) => {
    try {
        const { targetNet } = req.body;
        let estimateGross = Number(targetNet);
        let finalResult = {};
        
        const MAX_INS = 16700; 
        const MIN_INS = 5384.62;

        for (let i = 0; i < 100; i++) {
            let cappedIns = Math.min(MAX_INS, Math.max(MIN_INS, estimateGross));

            finalResult = runPayrollLogic({
                fullBasic: estimateGross,
                fullTrans: 0,
                days: 30,
                additions: [],
                deductions: [],
                month: new Date().toISOString().substring(0, 7),
                hiringDate: null,
                resignationDate: null
            }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: cappedIns });

            let diff = Number(targetNet) - finalResult.net;
            if (Math.abs(diff) < 0.01) break; 
            estimateGross += diff; 
        }

        res.json({
            gross: Math.round(estimateGross * 100) / 100,
            insSalary: Math.min(MAX_INS, Math.max(MIN_INS, estimateGross)),
            insEmployee: finalResult.insuranceEmployee,
            taxes: finalResult.monthlyTax,
            net: finalResult.net
        });
    } catch (err) {
        console.error("NetToGross Error:", err);
        res.status(500).json({ error: "Net to Gross conversion failed" });
    }
});

app.delete("/api/employees/:id", async (req, res) => {
    try {
        await Employee.findByIdAndDelete(req.params.id);
        await Payroll.deleteMany({ employeeId: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => { 
    res.sendFile(path.join(publicPath, "index.html")); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));

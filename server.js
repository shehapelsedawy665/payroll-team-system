const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const connectDB = require("./db");
const { runPayrollLogic } = require("./calculations");
const auth = require("./middleware/auth"); 
// تأكد أن اسم الملف في GitHub هو company.js بحروف صغيرة كما في الصورة
const Company = require("./models/company"); 

const app = express();
app.use(cors());
app.use(express.json());

// 1. الاتصال بقاعدة البيانات
connectDB();

// 2. التعريفات (Schemas) داخل الملف
const employeeSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    email: { type: String, unique: true },
    password: { type: String }, // للباسورد الخاص بالـ Login
    role: { type: String, enum: ['Admin', 'HR', 'Employee'], default: 'Employee' },
    nationalId: String, // التأكد من كتابتها هكذا لتجنب undefined في الـ Frontend
    hiringDate: String, 
    resignationDate: String, 
    insSalary: Number, 
    jobType: String
});
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

const payrollSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    employeeId: mongoose.Schema.Types.ObjectId, 
    month: String, 
    payload: Object 
});
const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema);

// --- [Auth APIs] ---

// تسجيل شركة جديدة وأدمن للشركة
app.post("/api/auth/register", async (req, res) => {
    try {
        const { companyName, adminEmail, password } = req.body;
        
        if (!companyName || !adminEmail || !password) {
            return res.status(400).json({ error: "برجاء إدخال اسم الشركة، البريد، وكلمة المرور" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newCompany = new Company({ 
            name: companyName, 
            adminEmail: adminEmail.toLowerCase(),
            email: adminEmail.toLowerCase(), 
            password: hashedPassword         
        });
        const savedCompany = await newCompany.save();

        const adminUser = new Employee({
            companyId: savedCompany._id,
            name: "Admin",
            email: adminEmail.toLowerCase(),
            password: hashedPassword,
            role: "Admin",
            nationalId: "N/A" // قيمة افتراضية للأدمن
        });
        await adminUser.save();

        res.json({ success: true, message: "تم إنشاء الشركة وحساب المسؤول بنجاح!" });
    } catch (err) {
        console.error("Register Error:", err.message);
        if (err.code === 11000) {
            return res.status(400).json({ error: "هذا البريد الإلكتروني مسجل بالفعل" });
        }
        res.status(500).json({ error: err.message });
    }
});

// تسجيل الدخول
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await Employee.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(400).json({ error: "الحساب غير موجود" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "بيانات الدخول غير صحيحة" });

        const secret = process.env.JWT_SECRET || 'SEDAY_ERP_SECRET_2026';
        const payload = { 
            user: { 
                id: user.id, 
                companyId: user.companyId, 
                role: user.role 
            } 
        };

        jwt.sign(payload, secret, { expiresIn: "10h" }, (err, token) => {
            if (err) throw err;
            res.json({ token, role: user.role });
        });
    } catch (err) {
        res.status(500).json({ error: "فشل عملية تسجيل الدخول" });
    }
});

// --- [Main APIs] ---

app.get("/api/employees", auth, async (req, res) => {
    try {
        const employees = await Employee.find({ companyId: req.user.companyId }).sort({_id: -1});
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: "Error fetching employees" });
    }
});

app.post("/api/employees", auth, async (req, res) => {
    try {
        const data = { ...req.body, companyId: req.user.companyId };
        const newEmp = new Employee(data);
        res.json(await newEmp.save());
    } catch (err) {
        res.status(500).json({ error: "Save failed" });
    }
});

app.get("/api/employees/:id/details", auth, async (req, res) => {
    try {
        const emp = await Employee.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!emp) return res.status(404).json({ error: "Not found" });

        const history = await Payroll.find({ employeeId: req.params.id, companyId: req.user.companyId }).sort({ month: 1 });
        
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => { 
            pDays += (Number(r.payload.days) || 0); 
            pTaxable += (Number(r.payload.currentTaxable) || 0); 
            pTaxes += (Number(r.payload.monthlyTax) || 0); 
        });
        
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (err) {
        res.status(404).json({ error: "Process failed" });
    }
});

app.post("/api/payroll/calculate", auth, async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions, prevData, hiringDate, resignationDate } = req.body;
        const [emp, company] = await Promise.all([
            Employee.findOne({ _id: empId, companyId: req.user.companyId }),
            Company.findById(req.user.companyId)
        ]);

        if (!emp || !company) return res.status(404).json({ error: "بيانات غير مكتملة" });

        if (resignationDate) {
            await Employee.findByIdAndUpdate(empId, { resignationDate: resignationDate });
        }

        const result = runPayrollLogic(
            { fullBasic, fullTrans, days, additions, deductions, month, hiringDate, resignationDate }, 
            prevData, 
            emp.toObject(),
            company.settings 
        );

        const record = await new Payroll({ 
            companyId: req.user.companyId,
            employeeId: empId, 
            month, 
            payload: result 
        }).save();
        
        res.json(record);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "خطأ في حساب المرتب" });
    }
});

app.post("/api/payroll/net-to-gross", auth, async (req, res) => {
    try {
        const { targetNet } = req.body;
        const company = await Company.findById(req.user.companyId);
        
        // إعدادات افتراضية لو الإعدادات مش موجودة في الشركة
        const settings = company.settings || { 
            insEmployeePercent: 0.11, 
            maxInsSalary: 16700, 
            personalExemption: 15000 
        };

        let estimateGross = Number(targetNet);
        let finalResult = {};
        
        for (let i = 0; i < 100; i++) {
            finalResult = runPayrollLogic({
                fullBasic: estimateGross, 
                days: 30, 
                additions: [], 
                deductions: [],
                month: new Date().toISOString().substring(0, 7)
            }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: estimateGross }, settings);

            let diff = Number(targetNet) - finalResult.net;
            if (Math.abs(diff) < 0.01) break; 
            estimateGross += diff; 
        }

        // إرجاع البيانات بالمسميات التي يتوقعها الـ UI في الصور المرفقة
        res.json({
            grossSalary: Math.round(estimateGross * 100) / 100, // ليظهر في خانة Gross Salary
            insBase: finalResult.insBase, // ليظهر في خانة Insurance Salary
            insuranceEmployee: finalResult.insuranceEmployee, // ليظهر في خانة التأمينات
            monthlyTax: finalResult.monthlyTax, // ليظهر في خانة الضرائب
            net: finalResult.net
        });
    } catch (err) {
        console.error("Net to Gross Error:", err);
        res.status(500).json({ error: "Net to Gross conversion failed" });
    }
});

app.delete("/api/employees/:id", auth, async (req, res) => {
    try {
        const deleted = await Employee.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
        if (deleted) await Payroll.deleteMany({ employeeId: req.params.id, companyId: req.user.companyId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => { res.sendFile(path.join(publicPath, "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));

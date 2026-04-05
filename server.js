const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const connectDB = require("./db");
const { runPayrollLogic } = require("./calculations");
const auth = require("./middleware/auth"); 
const Company = require("./models/company"); 

const app = express();
app.use(cors());
app.use(express.json());

// 1. الاتصال بقاعدة البيانات
connectDB();

// 2. التعريفات (Schemas)
const employeeSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    email: { type: String, unique: true },
    password: { type: String }, 
    role: { type: String, enum: ['Admin', 'HR', 'Employee'], default: 'Employee' },
    nationalId: String, 
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

app.post("/api/auth/register", async (req, res) => {
    try {
        const { companyName, adminEmail, password } = req.body;
        if (!companyName || !adminEmail || !password) {
            return res.status(400).json({ error: "برجاء إدخال البيانات كاملة" });
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
            nationalId: "N/A"
        });
        await adminUser.save();
        res.json({ success: true, message: "تم التسجيل بنجاح" });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ error: "البريد مسجل بالفعل" });
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await Employee.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(400).json({ error: "الحساب غير موجود" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "خطأ في كلمة المرور" });

        const secret = process.env.JWT_SECRET || 'SEDAY_ERP_SECRET_2026';
        const payload = { user: { id: user.id, companyId: user.companyId, role: user.role } };

        jwt.sign(payload, secret, { expiresIn: "10h" }, (err, token) => {
            if (err) throw err;
            res.json({ token, role: user.role });
        });
    } catch (err) {
        res.status(500).json({ error: "فشل تسجيل الدخول" });
    }
});

// --- [Main APIs] ---

app.get("/api/employees", auth, async (req, res) => {
    try {
        const employees = await Employee.find({ companyId: req.user.companyId }).sort({_id: -1});
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: "خطأ في جلب الموظفين" });
    }
});

app.post("/api/employees", auth, async (req, res) => {
    try {
        const data = { ...req.body, companyId: req.user.companyId };
        const newEmp = new Employee(data);
        res.json(await newEmp.save());
    } catch (err) {
        res.status(500).json({ error: "فشل الحفظ" });
    }
});

app.get("/api/employees/:id/details", auth, async (req, res) => {
    try {
        const emp = await Employee.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });

        const history = await Payroll.find({ 
            employeeId: req.params.id, 
            companyId: req.user.companyId 
        }).sort({ month: 1 });
        
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => { 
            pDays += (Number(r.payload.days) || 0); 
            pTaxable += (Number(r.payload.currentTaxable) || 0); 
            pTaxes += (Number(r.payload.monthlyTax) || 0); 
        });
        
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (err) {
        res.status(500).json({ error: "فشل جلب البيانات" });
    }
});

app.post("/api/payroll/calculate", auth, async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions, prevData, hiringDate, resignationDate } = req.body;
        const [emp, company] = await Promise.all([
            Employee.findOne({ _id: empId, companyId: req.user.companyId }),
            Company.findById(req.user.companyId)
        ]);

        if (!emp || !company) return res.status(404).json({ error: "بيانات ناقصة" });

        // تحديث تاريخ الاستقالة لو موجود
        if (resignationDate) {
            await Employee.findByIdAndUpdate(empId, { resignationDate });
        }

        const result = runPayrollLogic(
            { fullBasic, fullTrans, days, additions, deductions, month, hiringDate, resignationDate }, 
            prevData, 
            emp.toObject(),
            company.settings || {}
        );

        // مسح أي حسابات قديمة لنفس الشهر لتجنب التكرار
        await Payroll.deleteOne({ employeeId: empId, month, companyId: req.user.companyId });

        const record = await new Payroll({ 
            companyId: req.user.companyId,
            employeeId: empId, 
            month, 
            payload: result 
        }).save();
        
        res.json(record);
    } catch (err) {
        res.status(500).json({ error: "خطأ في حساب المرتب" });
    }
});

app.post("/api/payroll/net-to-gross", auth, async (req, res) => {
    try {
        const { targetNet } = req.body;
        const company = await Company.findById(req.user.companyId);
        
        const settings = company?.settings || { 
            insEmployeePercent: 0.11, 
            maxInsSalary: 16700, 
            personalExemption: 20000 
        };

        let estimateGross = Number(targetNet);
        let finalResult = {};
        
        // Loop تقاربي للوصول للصافي المطلوب بدقة 100%
        for (let i = 0; i < 50; i++) {
            finalResult = runPayrollLogic({
                fullBasic: estimateGross, 
                days: 30, 
                additions: [], 
                deductions: [],
                month: new Date().toISOString().substring(0, 7)
            }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: estimateGross }, settings);

            let diff = Number(targetNet) - finalResult.net;
            if (Math.abs(diff) < 0.05) break; 
            estimateGross += diff; 
        }

        res.json({
            grossSalary: Math.round(estimateGross), 
            insBase: finalResult.insBase,
            insuranceEmployee: finalResult.insuranceEmployee,
            monthlyTax: finalResult.monthlyTax,
            net: finalResult.net
        });
    } catch (err) {
        res.status(500).json({ error: "فشل التحويل العكسي" });
    }
});

app.delete("/api/employees/:id", auth, async (req, res) => {
    try {
        const deleted = await Employee.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
        if (deleted) await Payroll.deleteMany({ employeeId: req.params.id, companyId: req.user.companyId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "فشل الحذف" });
    }
});

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => { res.sendFile(path.join(publicPath, "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db"); // موجود عندك في الصورة
const auth = require("./middleware/auth"); // موجود عندك في الصورة

// الموديلز (بناءً على صورك)
const Company = require("./models/company"); 
const Employee = require("./models/employee");
const Payroll = require("./models/payroll"); // الملف اللي هننشئه فوق

// ملف الحسابات
const { runPayrollLogic } = require("./calculations"); // موجود عندك في الصورة

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

// الرووتس اللي ظهرت في فولدر routes عندك
app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/payroll", require("./routes/payroll")); 

// حساب المرتب وحفظه في الموديل الجديد
app.post("/api/payroll/calculate", auth, async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions } = req.body;
        
        const [emp, company, history] = await Promise.all([
            Employee.findOne({ _id: empId, companyId: req.user.companyId }),
            Company.findById(req.user.companyId),
            Payroll.find({ employeeId: empId, companyId: req.user.companyId, month: { $lt: month } })
        ]);

        // تجميع البيانات السابقة للحساب التراكمي
        let pData = { pDays: 0, pTaxable: 0, pTaxes: 0 };
        history.forEach(r => {
            pData.pDays += (r.payload.days || 0);
            pData.pTaxable += (r.payload.currentTaxable || 0);
            pData.pTaxes += (r.payload.monthlyTax || 0);
        });

        const result = runPayrollLogic({ fullBasic, fullTrans, days, additions, deductions, month }, pData, emp.toObject(), company.settings);
        
        // مسح أي حسبة قديمة لنفس الشهر وحفظ الجديدة
        await Payroll.deleteOne({ employeeId: empId, month, companyId: req.user.companyId });
        const record = new Payroll({ companyId: req.user.companyId, employeeId: empId, month, payload: result });
        await record.save();
        
        res.json(record);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on ${PORT}`));

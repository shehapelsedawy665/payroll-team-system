const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");
const auth = require("./middleware/auth"); 

const Company = require("./models/company"); 
const Employee = require("./models/employee");
const Department = require("./models/department");
const Payroll = require("./models/payroll"); // تأكد من استيراد موديل الرواتب

const { runPayrollLogic, calculateNetToGross } = require("./calculations"); 

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/payroll", require("./routes/payroll"));

app.get("/api/company/settings", auth, async (req, res) => {
    try {
        const company = await Company.findById(req.user.companyId).select('settings');
        if (!company) return res.status(404).json({ error: "الشركة غير موجودة" });
        res.json(company.settings);
    } catch (err) { res.status(500).json({ error: "فشل جلب الإعدادات" }); }
});

app.post("/api/company/settings", auth, async (req, res) => {
    try {
        const { personalExemption, maxInsSalary, insEmployeePercent } = req.body;
        const updatedCompany = await Company.findByIdAndUpdate(
            req.user.companyId,
            {
                $set: {
                    "settings.personalExemption": Number(personalExemption),
                    "settings.maxInsSalary": Number(maxInsSalary),
                    "settings.insEmployeePercent": Number(insEmployeePercent),
                    "lastSettingsUpdate": Date.now()
                }
            },
            { new: true }
        );
        res.json({ success: true, settings: updatedCompany.settings });
    } catch (err) { res.status(500).json({ error: "فشل تحديث الإعدادات" }); }
});

app.post("/api/payroll/calculate", auth, async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions } = req.body;
        
        const [emp, company, history] = await Promise.all([
            Employee.findOne({ _id: empId, companyId: req.user.companyId }),
            Company.findById(req.user.companyId),
            Payroll.find({ employeeId: empId, companyId: req.user.companyId, month: { $lt: month } })
        ]);

        if (!emp || !company) return res.status(404).json({ error: "بيانات ناقصة" });

        // حساب البيانات التراكمية من الهيستوري
        let pData = { pDays: 0, pTaxable: 0, pTaxes: 0 };
        history.forEach(r => {
            pData.pDays += (r.payload.days || 0);
            pData.pTaxable += (r.payload.currentTaxable || 0);
            pData.pTaxes += (r.payload.monthlyTax || 0);
        });

        const result = runPayrollLogic(
            { fullBasic, fullTrans, days, additions, deductions, month },
            pData,
            emp.toObject(),
            company.settings
        );

        // حفظ أو تحديث السجل
        await Payroll.deleteOne({ employeeId: empId, month, companyId: req.user.companyId });
        const newRecord = new Payroll({
            companyId: req.user.companyId,
            employeeId: empId,
            month,
            payload: result
        });
        await newRecord.save();

        res.json({ success: true, result });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "خطأ في حساب المرتب" }); 
    }
});

app.post("/api/payroll/net-to-gross", auth, async (req, res) => {
    try {
        const { targetNet } = req.body;
        const company = await Company.findById(req.user.companyId);
        const settings = company?.settings || { insEmployeePercent: 0.11, maxInsSalary: 16700, personalExemption: 20000 };
        
        const grossSalary = calculateNetToGross(
            targetNet, 
            { month: new Date().toISOString().substring(0, 7) }, 
            { pDays: 0, pTaxable: 0, pTaxes: 0 }, 
            { insSalary: 0 }, 
            settings
        );

        // لإرجاع تفاصيل الضريبة والتأمينات مع الصافي
        const details = runPayrollLogic({ fullBasic: grossSalary, days: 30 }, {pDays:0, pTaxable:0, pTaxes:0}, {insSalary: grossSalary}, settings);

        res.json({ 
            success: true, 
            grossSalary, 
            monthlyTax: details.monthlyTax, 
            insuranceEmployee: details.insuranceEmployee,
            insBase: grossSalary > settings.maxInsSalary ? settings.maxInsSalary : grossSalary
        });
    } catch (err) { res.status(500).json({ error: "فشل التحويل العكسي" }); }
});

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => { res.sendFile(path.join(publicPath, "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));

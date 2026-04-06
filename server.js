const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");
const auth = require("./middleware/auth"); 

const Company = require("./models/company"); 
const Employee = require("./models/employee");
const Payroll = require("./models/payroll"); // تأكد من وجود الموديل ده

const { runPayrollLogic, calculateNetToGross } = require("./calculations"); 

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/departments", require("./routes/departments"));

app.get("/api/company/settings", auth, async (req, res) => {
    try {
        const company = await Company.findById(req.user.companyId).select('settings');
        res.json(company.settings);
    } catch (err) { res.status(500).json({ error: "Settings Error" }); }
});

app.post("/api/payroll/calculate", auth, async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions } = req.body;
        const [emp, company, history] = await Promise.all([
            Employee.findOne({ _id: empId, companyId: req.user.companyId }),
            Company.findById(req.user.companyId),
            require("./models/payroll").find({ employeeId: empId, companyId: req.user.companyId, month: { $lt: month } })
        ]);

        let pData = { pDays: 0, pTaxable: 0, pTaxes: 0 };
        history.forEach(r => {
            pData.pDays += Number(r.payload.days || 0);
            pData.pTaxable += Number(r.payload.currentTaxable || 0);
            pData.pTaxes += Number(r.payload.monthlyTax || 0);
        });

        const result = runPayrollLogic({ fullBasic, fullTrans, days, additions, deductions, month }, pData, emp.toObject(), company.settings);
        
        await require("./models/payroll").deleteOne({ employeeId: empId, month, companyId: req.user.companyId });
        const record = await new (require("./models/payroll"))({ 
            companyId: req.user.companyId, employeeId: empId, month, payload: result 
        }).save();
        
        res.json(record);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/payroll/net-to-gross", auth, async (req, res) => {
    try {
        const { targetNet } = req.body;
        const company = await Company.findById(req.user.companyId);
        const grossSalary = calculateNetToGross(targetNet, { month: new Date().toISOString().substring(0, 7) }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: 0 }, company.settings);
        const details = runPayrollLogic({ fullBasic: grossSalary, days: 30 }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: grossSalary }, company.settings);
        res.json({ grossSalary, ...details });
    } catch (err) { res.status(500).json({ error: "Calculation Error" }); }
});

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => { res.sendFile(path.join(publicPath, "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));

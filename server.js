const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");
const auth = require("./middleware/auth"); 

const Company = require("./models/company"); 
const Employee = require("./models/employee");
const Payroll = require("./models/payroll"); // لازم يكون الموديل ده موجود عندك

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
        res.json(company.settings);
    } catch (err) { res.status(500).json({ error: "Settings Error" }); }
});

app.post("/api/company/settings", auth, async (req, res) => {
    try {
        const { personalExemption, maxInsSalary, insEmployeePercent } = req.body;
        const updated = await Company.findByIdAndUpdate(
            req.user.companyId,
            { $set: { 
                "settings.personalExemption": Number(personalExemption),
                "settings.maxInsSalary": Number(maxInsSalary),
                "settings.insEmployeePercent": Number(insEmployeePercent) 
            }},
            { new: true }
        );
        res.json(updated.settings);
    } catch (err) { res.status(500).json({ error: "Update Error" }); }
});

app.post("/api/payroll/calculate", auth, async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions } = req.body;
        const [emp, company, history] = await Promise.all([
            Employee.findOne({ _id: empId, companyId: req.user.companyId }),
            Company.findById(req.user.companyId),
            Payroll.find({ employeeId: empId, companyId: req.user.companyId, month: { $lt: month } })
        ]);

        let pData = { pDays: 0, pTaxable: 0, pTaxes: 0 };
        history.forEach(r => {
            pData.pDays += (r.payload.days || 0);
            pData.pTaxable += (r.payload.currentTaxable || 0);
            pData.pTaxes += (r.payload.monthlyTax || 0);
        });

        const result = runPayrollLogic({ fullBasic, fullTrans, days, additions, deductions, month }, pData, emp.toObject(), company.settings);
        
        await Payroll.deleteOne({ employeeId: empId, month, companyId: req.user.companyId });
        const record = new Payroll({ companyId: req.user.companyId, employeeId: empId, month, payload: result });
        await record.save();
        res.json(record);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/payroll/net-to-gross", auth, async (req, res) => {
    try {
        const { targetNet } = req.body;
        const company = await Company.findById(req.user.companyId);
        const grossSalary = calculateNetToGross(targetNet, { month: new Date().toISOString().substring(0, 7) }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: 0 }, company.settings);
        const details = runPayrollLogic({ fullBasic: grossSalary, days: 30 }, {pDays:0, pTaxable:0, pTaxes:0}, {insSalary: grossSalary}, company.settings);
        res.json({ grossSalary, ...details, insBase: details.insuranceEmployee / company.settings.insEmployeePercent });
    } catch (err) { res.status(500).json({ error: "Calculation Error" }); }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT}`));

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./db");
const { runPayrollLogic } = require("./calculations");

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

// Schemas
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: String, nationalId: String, hiringDate: Date, insSalary: { type: Number, default: 0 }, jobType: { type: String, default: "Full Time" }
}));

const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, month: String, days: Number,
    gross: Number, taxableIncome: Number, monthlyTax: Number, insurance: Number, martyrs: Number, net: Number
}));

// Routes
app.get("/api/employees", async (req, res) => {
    try { res.json(await Employee.find().sort({_id: -1})); } catch(e) { res.status(500).send(e.message); }
});

app.post("/api/employees", async (req, res) => {
    try { res.json(await new Employee(req.body).save()); } catch(e) { res.status(500).send(e.message); }
});

app.get("/api/employees/:id/details", async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id);
        const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => { pDays += r.days; pTaxable += r.taxableIncome; pTaxes += r.monthlyTax; });
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch(e) { res.status(500).send(e.message); }
});

app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { empId, month, days, basicGross, prevData } = req.body;
        const emp = await Employee.findById(empId);
        const result = runPayrollLogic({ basicGross, days }, prevData, emp);
        const record = await new Payroll({ employeeId: empId, month, days, ...result }).save();
        res.json(record);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

// Root Route to serve UI
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

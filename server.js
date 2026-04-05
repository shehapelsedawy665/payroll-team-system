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
    name: String, 
    nationalId: String, 
    hiringDate: Date, 
    insSalary: { type: Number, default: 0 }, 
    jobType: { type: String, default: "Full Time" }
}));

const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, 
    month: String, 
    payload: Object // هنا بنخزن الـ 20 خانة اللي طالعين من الـ calculations.js
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
        history.forEach(r => { 
            pDays += r.payload.days; 
            pTaxable += r.payload.currentTaxable; 
            pTaxes += r.payload.monthlyTax; 
        });
        
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch(e) { res.status(500).send(e.message); }
});

app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions, prevData } = req.body;
        const emp = await Employee.findById(empId);
        
        // استدعاء الحسبة المتقدمة
        const result = runPayrollLogic({ fullBasic, fullTrans, days, additions, deductions }, prevData, emp);
        
        const record = await new Payroll({ employeeId: empId, month, payload: result }).save();
        res.json(record);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

// Serve HTML from Public folder
app.get("/", (req, res) => { res.sendFile(__dirname + "/public/index.html"); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

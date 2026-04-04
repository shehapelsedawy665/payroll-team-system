const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 10000 });
        isConnected = true;
    } catch (err) { console.log("DB Connection Error"); }
};

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number,
    insSalary: Number, calcType: String
}));

const R = (n) => Math.round(n * 100) / 100;

// دالة حساب الضرائب (G2N) بنفس منطق الإكسيل الدقيق
function calculateG2N(d) {
    const basicFull = Number(d.basic) || 0;
    const days = Number(d.days) || 30;
    const trans = Number(d.transport) || 0;
    const comm = Number(d.comm) || 0;
    const insSalary = Number(d.insSalary) || 0;
    
    const prevDays = Number(d.prevDays) || 0;
    const prevTaxable = Number(d.prevTaxable) || 0;
    const prevTaxes = Number(d.prevTaxes) || 0;

    const actualBasic = R((basicFull / 30) * days);
    const actualGross = actualBasic + trans + comm;
    const insurance = R(insSalary * 0.11);
    const martyrs = R(actualGross * 0.0005);
    
    const currentTaxable = actualGross - insurance;
    const totalDays = days + prevDays;
    const totalTaxable = currentTaxable + prevTaxable;
    
    // معادلة الإكسيل السنوية
    const annualTaxable = Math.floor((totalTaxable / totalDays * 360) / 10) * 10;
    
    let annualTax = 0;
    let temp = Math.max(0, annualTaxable - 20000); // إعفاء شخصي

    // منطق الشرائح لعام 2024/2025
    if (annualTaxable <= 600000) {
        if (temp > 40000) { let x = Math.min(temp - 40000, 15000); annualTax += x * 0.10; }
        if (temp > 55000) { let x = Math.min(temp - 55000, 15000); annualTax += x * 0.15; }
        if (temp > 70000) { let x = Math.min(temp - 70000, 130000); annualTax += x * 0.20; }
        if (temp > 200000) { let x = Math.min(temp - 200000, 200000); annualTax += x * 0.225; }
        if (temp > 400000) { let x = Math.min(temp - 400000, 200000); annualTax += x * 0.25; }
        if (temp > 600000) { annualTax += (temp - 600000) * 0.275; }
    } else if (annualTaxable <= 700000) {
        if (temp > 0) { let x = Math.min(temp, 55000); annualTax += x * 0.10; }
        if (temp > 55000) { let x = Math.min(temp - 55000, 15000); annualTax += x * 0.15; }
        if (temp > 70000) { let x = Math.min(temp - 70000, 130000); annualTax += x * 0.20; }
        if (temp > 200000) { let x = Math.min(temp - 200000, 200000); annualTax += x * 0.225; }
        if (temp > 400000) { annualTax += (temp - 400000) * 0.25; }
    } else if (annualTaxable <= 800000) {
        if (temp > 0) { let x = Math.min(temp, 70000); annualTax += x * 0.15; }
        if (temp > 70000) { let x = Math.min(temp - 70000, 130000); annualTax += x * 0.20; }
        if (temp > 200000) { let x = Math.min(temp - 200000, 200000); annualTax += x * 0.225; }
        if (temp > 400000) { annualTax += (temp - 400000) * 0.25; }
    } else if (annualTaxable <= 900000) {
        if (temp > 0) { let x = Math.min(temp, 200000); annualTax += x * 0.20; }
        if (temp > 200000) { let x = Math.min(temp - 200000, 200000); annualTax += x * 0.225; }
        if (temp > 400000) { annualTax += (temp - 400000) * 0.25; }
    } else {
        if (temp > 0) { let x = Math.min(temp, 400000); annualTax += x * 0.225; }
        if (temp > 400000) { let x = Math.min(temp - 400000, 800000); annualTax += x * 0.25; }
        if (temp > 1200000) { annualTax += (temp - 1200000) * 0.275; }
    }

    const totalTaxDueUntilNow = (annualTax / 360) * totalDays;
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - prevTaxes));
    const net = R(actualGross - insurance - monthlyTax - martyrs);
    
    return { gross: actualGross, insurance, tax: monthlyTax, martyrs, net, currentTaxable };
}

// دالة البحث عن موظف وجلب بياناته التراكمية
app.get("/api/check-employee/:nid", async (req, res) => {
    await connectDB();
    const history = await Payroll.find({ nationalId: req.params.nid }).sort({_id: 1}).lean();
    if (history.length > 0) {
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => {
            pDays += (r.days || 0);
            pTaxable += (r.taxableIncome || 0);
            pTaxes += (r.monthlyTax || 0);
        });
        const lastRecord = history[history.length - 1];
        res.json({ 
            status: "old", 
            name: lastRecord.employee_name, 
            lastInsSalary: lastRecord.insSalary,
            pDays, pTaxable, pTaxes 
        });
    } else {
        res.json({ status: "new" });
    }
});

app.post("/api/calculate", async (req, res) => {
    await connectDB();
    const d = req.body;
    let resObj;
    if (d.type === 'N2G') {
        let low = Number(d.netInput), high = low * 5;
        for (let i = 0; i < 40; i++) {
            let mid = (low + high) / 2;
            d.basic = mid; d.transport = 0; d.comm = 0;
            resObj = calculateG2N(d);
            if (resObj.net < d.netInput) low = mid; else high = mid;
        }
    } else {
        resObj = calculateG2N(d);
    }
    await new Payroll({ 
        ...d, employee_name: d.name, gross: resObj.gross, 
        taxableIncome: resObj.currentTaxable, monthlyTax: resObj.tax, 
        insurance: resObj.insurance, martyrs: resObj.martyrs, 
        net: resObj.net, calcType: d.type 
    }).save();
    res.json(resObj);
});

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll System | Sedawy</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --dark: #2c3e50; }
        body { font-family: 'Segoe UI', sans-serif; background: #f4f7f6; margin: 0; padding: 20px; }
        .container { max-width: 1000px; margin: auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; margin-bottom: 10px; font-weight: bold; }
        .status-new { background: #e8f5e9; color: #2e7d32; }
        .status-old { background: #e3f2fd; color: #1565c0; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .card { border: 1px solid #eee; padding: 15px; border-radius: 10px; }
        label { display: block; margin: 10px 0 5px; font-size: 13px; color: #555; }
        input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
        .btn { width: 100%; padding: 15px; background: var(--success); color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; margin-top: 20px; }
        .res-box { margin-top: 20px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; background: var(--dark); color: white; padding: 15px; border-radius: 10px; text-align: center; }
        .res-box span { display: block; font-size: 18px; color: #f1c40f; }
    </style>
</head>
<body>
    <div class="container">
        <div id="empStatus" class="status-badge">أدخل الرقم القومي للبدء...</div>
        <div class="grid">
            <div class="card">
                <h3>| الموظف</h3>
                <label>الرقم القومي</label><input type="text" id="nid" onblur="checkEmp()">
                <label>الاسم</label><input type="text" id="name">
                <label>الشهر</label><input type="month" id="month">
            </div>
            <div class="card">
                <h3>| المدخلات</h3>
                <label>الأجر التأميني</label><input type="number" id="insSalary" value="0">
                <label>الراتب الأساسي (Gross)</label><input type="number" id="basic" value="0">
                <label>أيام العمل</label><input type="number" id="days" value="30">
            </div>
        </div>
        <input type="hidden" id="pDays" value="0"><input type="hidden" id="pTaxable" value="0"><input type="hidden" id="pTaxes" value="0">
        <button class="btn" onclick="calculate()">حفظ وحساب المرتب</button>
        <div class="res-box">
            <div>Gross<span id="oG">0</span></div>
            <div>Insurance<span id="oI">0</span></div>
            <div>Tax<span id="oT">0</span></div>
            <div>Martyr<span id="oM">0</span></div>
            <div>NET<span id="oN">0</span></div>
        </div>
    </div>

    <script>
        async function checkEmp() {
            const nid = document.getElementById('nid').value;
            if(nid.length < 5) return;
            const res = await fetch('/api/check-employee/' + nid);
            const d = await res.json();
            const badge = document.getElementById('empStatus');
            
            if(d.status === "old") {
                badge.innerText = "Employee Found: Old Employee";
                badge.className = "status-badge status-old";
                document.getElementById('name').value = d.name;
                document.getElementById('insSalary').value = d.lastInsSalary;
                document.getElementById('pDays').value = d.pDays;
                document.getElementById('pTaxable').value = d.pTaxable;
                document.getElementById('pTaxes').value = d.pTaxes;
            } else {
                badge.innerText = "New Record: New Employee";
                badge.className = "status-badge status-new";
                document.getElementById('pDays').value = 0;
                document.getElementById('pTaxable').value = 0;
                document.getElementById('pTaxes').value = 0;
            }
        }

        async function calculate() {
            const data = {
                type: 'G2N',
                nationalId: document.getElementById('nid').value,
                name: document.getElementById('name').value,
                month: document.getElementById('month').value,
                insSalary: document.getElementById('insSalary').value,
                basic: document.getElementById('basic').value,
                days: document.getElementById('days').value,
                prevDays: document.getElementById('pDays').value,
                prevTaxable: document.getElementById('pTaxable').value,
                prevTaxes: document.getElementById('pTaxes').value
            };
            const res = await fetch('/api/calculate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const r = await res.json();
            document.getElementById('oG').innerText = r.gross.toLocaleString();
            document.getElementById('oI').innerText = r.insurance.toLocaleString();
            document.getElementById('oT').innerText = r.tax.toLocaleString(undefined, {minimumFractionDigits: 2});
            document.getElementById('oM').innerText = r.martyrs.toLocaleString();
            document.getElementById('oN').innerText = r.net.toLocaleString();
            alert("Success!");
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Running on Port " + PORT));
module.exports = app;

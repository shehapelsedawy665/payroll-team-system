const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// 1. الاتصال بقاعدة البيانات (تأكد من البيانات دي)
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";
mongoose.connect(mongoURI).then(() => console.log("✅ DB Connected"));

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number
}));

const R = (n) => Math.round(n * 100) / 100;

// 2. الـ Routes (ترتيبهم مهم جداً)

app.get("/history/:id", async (req, res) => {
    try {
        const history = await Payroll.find({ nationalId: req.params.id });
        let prevDays = 0, prevTaxable = 0, prevTaxes = 0;
        history.forEach(r => { 
            prevDays += (r.days || 0); 
            prevTaxable += (r.taxableIncome || 0); 
            prevTaxes += (r.monthlyTax || 0); 
        });
        res.json({ found: history.length > 0, prevDays, prevTaxable, prevTaxes, name: history.length > 0 ? history[0].employee_name : "" });
    } catch (err) { res.status(500).json(err); }
});

app.post("/calculate", async (req, res) => {
    try {
        const d = req.body;
        const actualBasic = R((d.basic / 30) * d.days);
        const gross = actualBasic + d.transport + d.comm;
        
        // حساب التأمينات (11% بحد أقصى 16700)
        const insurance = R(Math.min((d.basic + d.transport + d.comm), 16700) * 0.11);
        
        // الوعاء الضريبي للفترة الحالية
        const currentTaxable = R(gross - insurance - (20000 / 360 * d.days));
        
        // الحساب التراكمي
        const totalDays = d.days + d.prevDays;
        const totalTaxable = currentTaxable + d.prevTaxable;
        const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
        
        let annualTax = 0;
        let temp = annualTaxable;
        if (temp <= 600000) {
            temp = Math.max(0, temp - 40000);
            if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.1; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.15; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 130000); annualTax += x * 0.2; temp -= x; }
        }
        
        const taxDueToDate = R(annualTax / 360 * totalDays);
        const monthlyTax = R(taxDueToDate - d.prevTaxes);
        const martyrs = R(gross * 0.0005);
        const net = R(gross - insurance - monthlyTax - martyrs);

        await new Payroll({ employee_name: d.name, nationalId: d.nationalId, month: d.month, gross, taxableIncome: currentTaxable, monthlyTax, days: d.days, insurance, martyrs, net }).save();
        res.json({ gross, insurance, tax: monthlyTax, martyrs, net });
    } catch (err) { res.status(500).json(err); }
});

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll System | Payroll Team</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --dark: #2c3e50; --warning: #f1c40f; }
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; padding: 20px; margin: 0; }
        .container { max-width: 1000px; margin: auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { border: 1px solid #e1e4e8; padding: 20px; border-radius: 12px; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
        .btn { width: 100%; padding: 18px; background: var(--success); color: white; border: none; border-radius: 10px; font-size: 18px; cursor: pointer; }
        .results { margin-top: 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; background: var(--dark); color: white; padding: 20px; border-radius: 12px; text-align: center; }
        .res-item span { display: block; font-size: 22px; color: var(--warning); font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="text-align:center">📊 نظام إدارة الرواتب المتكامل</h1>
        <div class="grid">
            <div class="card">
                <h3>البيانات</h3>
                <input type="text" id="nid" placeholder="الرقم القومي" onblur="check()">
                <input type="text" id="name" placeholder="الاسم">
                <input type="month" id="month">
            </div>
            <div class="card">
                <h3>الماليات</h3>
                <input type="number" id="basic" value="10000">
                <input type="number" id="trans" value="0" placeholder="بدلات">
                <input type="number" id="comm" value="0" placeholder="عمولات">
            </div>
            <div class="card">
                <h3>التراكمي</h3>
                <input type="number" id="days" value="30">
                <input type="number" id="pDays" value="0" readonly>
                <input type="number" id="pTaxable" value="0" readonly>
                <input type="hidden" id="pTaxes" value="0">
            </div>
        </div>
        <button class="btn" onclick="calc()">💾 حساب واعتماد الراتب</button>
        <div class="results">
            <div class="res-item">Gross<span id="outG">0</span></div>
            <div class="res-item">Insurance<span id="outI">0</span></div>
            <div class="res-item">Tax<span id="outT">0</span></div>
            <div class="res-item">Martyrs<span id="outM">0</span></div>
            <div class="res-item">NET<span id="outN">0</span></div>
        </div>
    </div>
    <script>
        async function check() {
            const id = document.getElementById('nid').value;
            if(id.length < 14) return;
            const res = await fetch('/history/' + id);
            const data = await res.json();
            if(data.found) {
                document.getElementById('name').value = data.name;
                document.getElementById('pDays').value = data.prevDays;
                document.getElementById('pTaxable').value = data.prevTaxable;
                document.getElementById('pTaxes').value = data.prevTaxes;
            }
        }
        async function calc() {
            const data = {
                nationalId: document.getElementById('nid').value,
                name: document.getElementById('name').value,
                month: document.getElementById('month').value,
                basic: Number(document.getElementById('basic').value),
                transport: Number(document.getElementById('trans').value),
                comm: Number(document.getElementById('comm').value),
                days: Number(document.getElementById('days').value),
                prevDays: Number(document.getElementById('pDays').value),
                prevTaxable: Number(document.getElementById('pTaxable').value),
                prevTaxes: Number(document.getElementById('pTaxes').value)
            };
            const res = await fetch('/calculate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const r = await res.json();
            document.getElementById('outG').innerText = r.gross.toLocaleString();
            document.getElementById('outI').innerText = r.insurance.toLocaleString();
            document.getElementById('outT').innerText = r.tax.toLocaleString();
            document.getElementById('outM').innerText = r.martyrs.toLocaleString();
            document.getElementById('outN').innerText = r.net.toLocaleString();
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Running"));
module.exports = app;

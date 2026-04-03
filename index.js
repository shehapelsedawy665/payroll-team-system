const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// الربط بقاعدة البيانات
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";
mongoose.connect(mongoURI).then(() => console.log("DB Connected"));

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, net: Number
}));

// --- الجزء الخاص بالحسابات ---
app.get("/history/:id", async (req, res) => {
    const history = await Payroll.find({ nationalId: req.params.id });
    let prevDays = 0, prevTaxable = 0, prevTaxes = 0;
    history.forEach(r => { prevDays += r.days; prevTaxable += r.taxableIncome; prevTaxes += r.monthlyTax; });
    res.json({ found: history.length > 0, prevDays, prevTaxable, prevTaxes, name: history.length > 0 ? history[0].employee_name : "" });
});

app.post("/calculate", async (req, res) => {
    const d = req.body;
    const R = (n) => Math.round(n * 100) / 100;
    const gross = R((d.basic / 30) * d.days) + d.transport + d.comm;
    const insurance = R(Math.min((d.basic + d.transport + d.comm), 16700) * 0.11);
    const currentTaxable = R(gross - insurance - (20000 / 360 * d.days));
    const annualTaxable = Math.floor((((currentTaxable + d.prevTaxable) / (d.days + d.prevDays)) * 360) / 10) * 10;
    let annualTax = 0; let temp = annualTaxable;
    if (temp <= 600000) {
        temp = Math.max(0, temp - 40000);
        if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.1; temp -= x; }
        if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.15; temp -= x; }
        if (temp > 0) { let x = Math.min(temp, 130000); annualTax += x * 0.2; temp -= x; }
    }
    const monthlyTax = R((annualTax / 360 * (d.days + d.prevDays)) - d.prevTaxes);
    const net = R(gross - insurance - monthlyTax - (gross * 0.0005));
    await new Payroll({ employee_name: d.name, nationalId: d.nationalId, month: d.month, gross, taxableIncome: currentTaxable, monthlyTax, days: d.days, net }).save();
    res.json({ gross, insurance, tax: monthlyTax, martyrs: R(gross * 0.0005), net });
});

// --- الجزء الخاص بعرض الـ HTML (التصميم الشيك) ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll System</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --dark: #2c3e50; }
        body { font-family: sans-serif; background: #f0f2f5; padding: 20px; }
        .container { max-width: 1000px; margin: auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .card { border: 1px solid #ddd; padding: 15px; border-radius: 10px; }
        input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; text-align: center; }
        button { width: 100%; padding: 15px; background: var(--success); color: white; border: none; border-radius: 8px; font-size: 18px; cursor: pointer; }
        .results { background: var(--dark); color: white; padding: 20px; border-radius: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); text-align: center; margin-top: 20px; }
        .results span { display: block; font-size: 20px; color: #f1c40f; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="text-align:center">📊 نظام رواتب شهاب السداوي</h1>
        <div class="grid">
            <div class="card">
                <h3>البيانات</h3>
                <input type="text" id="nid" placeholder="الرقم القومي" onblur="check()">
                <input type="text" id="name" placeholder="الاسم">
                <input type="month" id="month">
            </div>
            <div class="card">
                <h3>الماليات</h3>
                <input type="number" id="basic" value="10000" placeholder="الأساسي">
                <input type="number" id="trans" value="0" placeholder="بدلات">
                <input type="number" id="comm" value="0" placeholder="عمولات">
            </div>
            <div class="card">
                <h3>أيام العمل</h3>
                <input type="number" id="days" value="30">
                <input type="number" id="pDays" value="0" readonly style="background:#eee">
                <input type="number" id="pTaxable" value="0" readonly style="background:#eee">
                <input type="hidden" id="pTaxes" value="0">
            </div>
        </div>
        <button onclick="calc()">💾 حساب وحفظ</button>
        <div class="results">
            <div>Gross<span id="outG">0</span></div>
            <div>Tax<span id="outT">0</span></div>
            <div>Net<span id="outN">0</span></div>
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
            document.getElementById('outG').innerText = r.gross;
            document.getElementById('outT').innerText = r.tax;
            document.getElementById('outN').innerText = r.net;
            alert("تم الحساب!");
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
module.exports = app;
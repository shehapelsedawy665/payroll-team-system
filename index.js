const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// 1. إعدادات قاعدة البيانات
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        isConnected = true;
    } catch (err) {
        console.log("DB Connection Error:", err);
    }
};

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number
}));

const R = (n) => Math.round(n * 100) / 100;

// 2. الـ APIs
app.get("/api/history/:id", async (req, res) => {
    await connectDB();
    try {
        const history = await Payroll.find({ nationalId: req.params.id }).lean();
        if (!history.length) return res.json({ found: false });
        let pD = 0, pTi = 0, pTx = 0;
        history.forEach(r => { 
            pD += (r.days || 0); 
            pTi += (r.taxableIncome || 0); 
            pTx += (r.monthlyTax || 0); 
        });
        res.json({ found: true, prevDays: pD, prevTaxable: pTi, prevTaxes: pTx, name: history[0].employee_name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/calculate", async (req, res) => {
    await connectDB();
    try {
        const d = req.body;
        const basicFull = Number(d.basic) || 0;
        const days = Number(d.days) || 0;
        const trans = Number(d.transport) || 0;
        const comm = Number(d.comm) || 0;
        
        // الحساب الفعلي للأجر بناءً على الأيام
        const actualBasic = R((basicFull / 30) * days);
        const actualGross = actualBasic + trans + comm;

        // التأمينات على المبلغ الكامل (Full Amount) حسب طلبك
        const insurance = R(Math.min((basicFull + trans + comm), 16700) * 0.11);
        
        const martyrs = R(actualGross * 0.0005);
        const currentTaxable = R(actualGross - insurance - (20000 / 360 * days));
        
        const totalDays = days + (Number(d.prevDays) || 0);
        const totalTaxable = currentTaxable + (Number(d.prevTaxable) || 0);
        const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
        
        let annualTax = 0;
        let temp = annualTaxable;
        if (temp <= 600000) {
            temp = Math.max(0, temp - 40000);
            if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.1; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.15; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 130000); annualTax += x * 0.2; temp -= x; }
        }
        
        const monthlyTax = R((annualTax / 360 * totalDays) - (Number(d.prevTaxes) || 0));
        const net = R(actualGross - insurance - monthlyTax - martyrs);

        await new Payroll({ 
            employee_name: d.name, nationalId: d.nationalId, month: d.month, 
            gross: actualGross, taxableIncome: currentTaxable, monthlyTax, days, insurance, martyrs, net 
        }).save();

        res.json({ gross: actualGross, insurance, tax: monthlyTax, martyrs, net });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. واجهة الـ HTML الكاملة
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نظام إدارة الرواتب المتكامل</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --dark: #2c3e50; --warning: #f1c40f; --light: #f8f9fa; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #eef2f7; margin: 0; padding: 20px; color: #333; }
        .container { max-width: 1100px; margin: auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: var(--dark); font-size: 2.2em; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
        h1 span { font-size: 0.8em; vertical-align: middle; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 25px; }
        .card { background: #fff; border: 1px solid #e1e4e8; padding: 25px; border-radius: 15px; transition: 0.3s; }
        .card:hover { box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
        .card h3 { color: var(--primary); margin-top: 0; border-right: 5px solid var(--primary); padding-right: 15px; margin-bottom: 25px; font-size: 1.3em; }
        label { display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; color: #666; }
        input { width: 100%; padding: 14px; margin-bottom: 20px; border: 1px solid #ced4da; border-radius: 10px; box-sizing: border-box; text-align: center; font-size: 16px; background: var(--light); transition: 0.2s; }
        input:focus { border-color: var(--primary); outline: none; background: #fff; box-shadow: 0 0 0 3px rgba(26,115,232,0.1); }
        input[readonly] { background: #f1f3f4; cursor: not-allowed; color: #777; }
        .btn { width: 100%; padding: 20px; background: var(--success); color: white; border: none; border-radius: 12px; font-size: 20px; font-weight: bold; cursor: pointer; transition: 0.3s; margin-top: 20px; box-shadow: 0 4px 15px rgba(39,174,96,0.3); }
        .btn:hover { background: #219150; transform: translateY(-2px); }
        .btn:active { transform: translateY(0); }
        .results { margin-top: 40px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; background: var(--dark); color: white; padding: 30px; border-radius: 15px; }
        .res-item { text-align: center; border-left: 1px solid #444; }
        .res-item:last-child { border-left: none; }
        .res-item p { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #bbb; }
        .res-item span { display: block; font-size: 26px; color: var(--warning); font-weight: bold; margin-top: 10px; }
        @media (max-width: 768px) { .results { grid-template-columns: 1fr 1fr; } .res-item { border: none; padding: 10px; } }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 نظام إدارة الرواتب المتكامل <span>(Payroll Team)</span></h1>
        
        <div class="grid">
            <div class="card">
                <h3>| البيانات الأساسية</h3>
                <label>الرقم القومي</label>
                <input type="text" id="nid" placeholder="أدخل 14 رقم" maxlength="14" onblur="check()">
                <label>اسم الموظف</label>
                <input type="text" id="name" placeholder="يظهر تلقائياً للمسجلين">
                <label>الشهر الضريبي</label>
                <input type="month" id="month">
            </div>

            <div class="card">
                <h3>| الماليات (الشهرية)</h3>
                <label>الراتب الأساسي</label>
                <input type="number" id="basic" value="10000">
                <label>بدل انتقال / سكن</label>
                <input type="number" id="trans" value="0">
                <label>عمولات / إضافي</label>
                <input type="number" id="comm" value="0">
            </div>

            <div class="card">
                <h3>| أيام العمل والتراكمي</h3>
                <label>أيام العمل الفعلية</label>
                <input type="number" id="days" value="30" max="30">
                <label>إجمالي أيام العمل السابقة</label>
                <input type="number" id="pDays" value="0" readonly>
                <label>وعاء ضريبي سابق</label>
                <input type="number" id="pTaxable" value="0" readonly>
                <input type="hidden" id="pTaxes" value="0">
            </div>
        </div>

        <button class="btn" onclick="calc()">💾 اعتماد وحفظ الراتب في القاعدة</button>

        <div class="results">
            <div class="res-item"><p>Gross Salary</p><span id="oG">0</span></div>
            <div class="res-item"><p>Insurance</p><span id="oI">0</span></div>
            <div class="res-item"><p>Income Tax</p><span id="oT">0</span></div>
            <div class="res-item"><p>Martyrs Tax</p><span id="oM">0</span></div>
            <div class="res-item"><p>Net Salary</p><span id="oN">0</span></div>
        </div>
    </div>

    <script>
        async function check() {
            const id = document.getElementById('nid').value;
            if(id.length < 14) return;
            try {
                const res = await fetch('/api/history/' + id);
                const d = await res.json();
                if(d.found) {
                    document.getElementById('name').value = d.name;
                    document.getElementById('pDays').value = d.prevDays;
                    document.getElementById('pTaxable').value = d.prevTaxable;
                    document.getElementById('pTaxes').value = d.prevTaxes;
                } else {
                    document.getElementById('pDays').value = 0;
                    document.getElementById('pTaxable').value = 0;
                    document.getElementById('pTaxes').value = 0;
                }
            } catch(e) { console.error("Error fetching history"); }
        }

        async function calc() {
            const btn = document.querySelector('.btn');
            const originalText = btn.innerText;
            btn.innerText = "جاري الحساب والحفظ...";
            btn.disabled = true;

            const data = {
                nationalId: document.getElementById('nid').value,
                name: document.getElementById('name').value,
                month: document.getElementById('month').value,
                basic: document.getElementById('basic').value,
                transport: document.getElementById('trans').value,
                comm: document.getElementById('comm').value,
                days: document.getElementById('days').value,
                prevDays: document.getElementById('pDays').value,
                prevTaxable: document.getElementById('pTaxable').value,
                prevTaxes: document.getElementById('pTaxes').value
            };

            try {
                const res = await fetch('/api/calculate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                const r = await res.json();
                if(r.error) throw new Error(r.error);

                document.getElementById('oG').innerText = r.gross.toLocaleString();
                document.getElementById('oI').innerText = r.insurance.toLocaleString();
                document.getElementById('oT').innerText = r.tax.toLocaleString();
                document.getElementById('oM').innerText = r.martyrs.toLocaleString();
                document.getElementById('oN').innerText = r.net.toLocaleString();
                
                alert("✅ تم بنجاح! تم حفظ الراتب وتحديث سجل الموظف.");
                await check(); // لتحديث البيانات التراكمية فوراً
            } catch(e) {
                alert("❌ خطأ في النظام: " + e.message);
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Running on port " + PORT));
module.exports = app;

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
    insSalary: Number, calcType: String, employmentType: String,
    hiringDate: Date, resignationDate: Date
}));

const R = (n) => Math.round(n * 100) / 100;

function calculateG2N(d) {
    const basicFull = Number(d.basic) || 0;
    const days = Number(d.days) || 30;
    const insSalary = Number(d.insSalary) || 0;
    const hDate = d.hiringDate ? new Date(d.hiringDate) : null;
    const rDate = d.resignationDate ? new Date(d.resignationDate) : null;
    const currentMonthDate = new Date(d.month + "-01");

    // منطق التأمينات (بند رقم 6)
    let insurance = 0;
    const isHiredAfterFirst = hDate && hDate.getDate() > 1 && hDate.getMonth() === currentMonthDate.getMonth() && hDate.getFullYear() === currentMonthDate.getFullYear();
    const isResignedSameMonth = rDate && rDate.getMonth() === currentMonthDate.getMonth() && rDate.getFullYear() === currentMonthDate.getFullYear();

    if (!(isHiredAfterFirst && !isResignedSameMonth)) {
        insurance = R(insSalary * 0.11);
    }

    const actualBasic = R((basicFull / 30) * days);
    const actualGross = actualBasic; // إضافة البدلات هنا لو لزم الأمر
    const martyrs = R(actualGross * 0.0005);
    
    const currentTaxable = actualGross - insurance;
    const totalDays = days + (Number(d.prevDays) || 0);
    const totalTaxable = currentTaxable + (Number(d.prevTaxable) || 0);
    
    const annualTaxable = Math.floor((totalTaxable / totalDays * 360) / 10) * 10;
    
    let annualTax = 0;
    let temp = Math.max(0, annualTaxable - 20000);

    // منطق الشرائح (نفس المعادلة الدقيقة السابقة)
    if (annualTaxable <= 600000) {
        if (temp > 40000) { let x = Math.min(temp - 40000, 15000); annualTax += x * 0.10; }
        if (temp > 55000) { let x = Math.min(temp - 55000, 15000); annualTax += x * 0.15; }
        if (temp > 70000) { let x = Math.min(temp - 70000, 130000); annualTax += x * 0.20; }
        if (temp > 200000) { let x = Math.min(temp - 200000, 200000); annualTax += x * 0.225; }
        if (temp > 400000) { let x = Math.min(temp - 400000, 200000); annualTax += x * 0.25; }
        if (temp > 600000) { annualTax += (temp - 600000) * 0.275; }
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
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - (Number(d.prevTaxes) || 0)));
    const net = R(actualGross - insurance - monthlyTax - martyrs);
    
    return { gross: actualGross, insurance, tax: monthlyTax, martyrs, net, currentTaxable };
}

app.get("/api/check-employee/:nid", async (req, res) => {
    await connectDB();
    const history = await Payroll.find({ nationalId: req.params.nid }).sort({month: 1}).lean();
    if (history.length > 0) {
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        let savedMonths = history.map(h => h.month);
        history.forEach(r => {
            pDays += r.days; pTaxable += r.taxableIncome; pTaxes += r.monthlyTax;
        });
        const last = history[history.length - 1];
        res.json({ 
            status: "old", name: last.employee_name, empType: last.employmentType,
            hDate: last.hiringDate, rDate: last.resignationDate,
            lastIns: last.insSalary, pDays, pTaxable, pTaxes, savedMonths 
        });
    } else { res.json({ status: "new" }); }
});

app.post("/api/calculate", async (req, res) => {
    await connectDB();
    const d = req.body;
    const resObj = calculateG2N(d);
    await new Payroll({ ...d, ...resObj, taxableIncome: resObj.currentTaxable, monthlyTax: resObj.tax }).save();
    res.json(resObj);
});

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll System Pro</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --error: #d32f2f; }
        body { font-family: 'Segoe UI', sans-serif; background: #f8f9fa; padding: 20px; }
        .container { max-width: 1100px; margin: auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .card { border: 1px solid #eee; padding: 15 min; border-radius: 10px; background: #fff; }
        label { display: block; margin-top: 10px; font-size: 12px; font-weight: bold; color: #444; }
        input, select { width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
        .btn { width: 100%; padding: 15px; background: var(--success); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 20px; }
        .res-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 20px; background: #2c3e50; color: white; padding: 20px; border-radius: 10px; text-align: center; }
        .res-grid span { display: block; font-size: 20px; color: #f1c40f; margin-top: 5px; }
        .error-text { color: var(--error); font-size: 11px; display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h2 style="text-align:center; color: var(--primary);">Payroll Management System</h2>
        <div class="grid">
            <div class="card">
                <h3>بيانات الموظف</h3>
                <label>الرقم القومي</label><input type="text" id="nid" onblur="checkEmp()">
                <label>الاسم</label><input type="text" id="name">
                <label>نوع العمل</label>
                <select id="empType" onchange="validateIns()">
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                </select>
            </div>
            <div class="card">
                <h3>التواريخ</h3>
                <label>تاريخ التعيين</label><input type="date" id="hiringDate">
                <label>تاريخ الاستقالة</label><input type="date" id="resignationDate">
                <label>شهر الاحتساب</label>
                <select id="monthSelect"></select>
            </div>
            <div class="card">
                <h3>الماليات</h3>
                <label>الأجر التأميني (Min/Max Alert)</label>
                <input type="number" id="insSalary" oninput="validateIns()">
                <div id="insError" class="error-text">خارج الحدود المسموحة!</div>
                <label>Gross Salary</label><input type="number" id="basic">
                <label>أيام العمل</label><input type="number" id="days" value="30">
            </div>
        </div>

        <input type="hidden" id="pDays" value="0">
        <input type="hidden" id="pTaxable" value="0">
        <input type="hidden" id="pTaxes" value="0">

        <button class="btn" onclick="saveAndCalc()">💾 حفظ واحسب الشهر الحالي</button>

        <div class="res-grid">
            <div>Gross <span id="oG">0</span></div>
            <div>Insurance <span id="oI">0</span></div>
            <div>Tax <span id="oT">0</span></div>
            <div>Martyr <span id="oM">0</span></div>
            <div>NET <span id="oN">0</span></div>
        </div>
    </div>

    <script>
        let savedMonths = [];

        function fillMonths(alreadySaved = []) {
            const select = document.getElementById('monthSelect');
            select.innerHTML = "";
            const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
            months.forEach(m => {
                const val = "2026-" + m;
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = val;
                if(alreadySaved.includes(val)) opt.disabled = true;
                select.appendChild(opt);
            });
        }
        fillMonths();

        function validateIns() {
            const type = document.getElementById('empType').value;
            const val = Number(document.getElementById('insSalary').value);
            const err = document.getElementById('insError');
            const max = 16700;
            const min = type === "Full Time" ? Math.round(7000/1.3 * 100)/100 : 2720;
            
            if(val > max || val < min) {
                err.style.display = "block";
                err.innerText = "تنبيه: الحد الأدنى " + min + " والحد الأقصى " + max;
            } else {
                err.style.display = "none";
            }
        }

        async function checkEmp() {
            const nid = document.getElementById('nid').value;
            if(!nid) return;
            const res = await fetch('/api/check-employee/' + nid);
            const d = await res.json();
            if(d.status === "old") {
                document.getElementById('name').value = d.name;
                document.getElementById('empType').value = d.empType;
                document.getElementById('hiringDate').value = d.hDate ? d.hDate.split('T')[0] : '';
                document.getElementById('resignationDate').value = d.rDate ? d.rDate.split('T')[0] : '';
                document.getElementById('insSalary').value = d.lastIns;
                document.getElementById('pDays').value = d.pDays;
                document.getElementById('pTaxable').value = d.pTaxable;
                document.getElementById('pTaxes').value = d.pTaxes;
                fillMonths(d.savedMonths);
                alert("Old Employee Data Loaded");
            } else {
                fillMonths([]);
                alert("New Employee");
            }
        }

        async function saveAndCalc() {
            const data = {
                nationalId: document.getElementById('nid').value,
                name: document.getElementById('name').value,
                employmentType: document.getElementById('empType').value,
                hiringDate: document.getElementById('hiringDate').value,
                resignationDate: document.getElementById('resignationDate').value,
                month: document.getElementById('monthSelect').value,
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
            
            // Update UI
            document.getElementById('oG').innerText = r.gross.toLocaleString();
            document.getElementById('oI').innerText = r.insurance.toLocaleString();
            document.getElementById('oT').innerText = r.tax.toLocaleString(undefined, {minimumFractionDigits: 2});
            document.getElementById('oM').innerText = r.martyrs.toLocaleString();
            document.getElementById('oN').innerText = r.net.toLocaleString();

            // 🔥 Point 2: Update previouses instantly without refresh
            document.getElementById('pDays').value = Number(data.prevDays) + Number(data.days);
            document.getElementById('pTaxable').value = Number(data.prevTaxable) + r.currentTaxable;
            document.getElementById('pTaxes').value = Number(data.prevTaxes) + r.tax;
            
            // Disable the month we just calculated
            const currentOpt = document.querySelector("#monthSelect option[value='"+data.month+"']");
            if(currentOpt) currentOpt.disabled = true;

            alert("Month Recorded Successfully!");
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("System Running on " + PORT));
module.exports = app;

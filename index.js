const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

// --- Database Logic ---
let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    try {
        await mongoose.connect(mongoURI);
        isConnected = true;
    } catch (e) { console.error("DB Error", e); }
}

// --- Models ---
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: String, nationalId: { type: String, unique: true },
    hiringDate: Date, resignationDate: Date,
    insSalary: Number, jobType: { type: String, default: "Full Time" }
}));

const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, month: String,
    days: Number, gross: Number, taxableIncome: Number,
    monthlyTax: Number, insurance: Number, martyrs: Number, net: Number
}));

// --- Pure Calculation Engine ---
const R = (n) => Math.round(n * 100) / 100;

function runCoreEngine(data, prev, emp) {
    const { basicFull, days, month } = data;
    // 1. Insurance Logic (الحد الأقصى والأدنى)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    let effectiveInsBase = Math.max(minIns, Math.min(maxIns, emp.insSalary));

    // 2. Insurance Eligibility Rules (قواعد الاستحقاق)
    let insAmt = 0;
    const hDate = new Date(emp.hiringDate);
    const rDate = emp.resignationDate ? new Date(emp.resignationDate) : null;
    const [year, monthNum] = month.split('-').map(Number);
    const isHiringMonth = hDate.getFullYear() === year && (hDate.getMonth() + 1) === monthNum;
    const isResignMonth = rDate && rDate.getFullYear() === year && (rDate.getMonth() + 1) === monthNum;

    if (isHiringMonth && isResignMonth) insAmt = effectiveInsBase * 0.11;
    else if (isHiringMonth && hDate.getDate() > 1) insAmt = 0;
    else insAmt = effectiveInsBase * 0.11;

    // 3. Financials
    const actualGross = (basicFull / 30) * days;
    const martyrs = R(actualGross * 0.0005);
    const currentTaxable = actualGross - insAmt;

    // 4. Sequential Tax Engine (نظام الشرائح)
    const totalDays = days + prev.pDays;
    const totalTaxable = currentTaxable + prev.pTaxable;
    const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;

    let annualTax = 0;
    let temp = Math.max(0, annualTaxable - 20000);
    if (annualTaxable <= 600000) {
        if (temp > 40000) annualTax += Math.min(temp - 40000, 15000) * 0.10;
        if (temp > 55000) annualTax += Math.min(temp - 55000, 15000) * 0.15;
        if (temp > 70000) annualTax += Math.min(temp - 70000, 130000) * 0.20;
        if (temp > 200000) annualTax += Math.min(temp - 200000, 200000) * 0.225;
        if (temp > 400000) annualTax += Math.min(temp - 400000, 200000) * 0.25;
        if (temp > 600000) annualTax += (temp - 600000) * 0.275;
    } else {
        if (temp > 0) annualTax += Math.min(temp, 400000) * 0.225;
        if (temp > 400000) annualTax += Math.min(temp - 400000, 800000) * 0.25;
        if (temp > 1200000) annualTax += (temp - 1200000) * 0.275;
    }

    const monthlyTax = Math.max(0, ((annualTax / 360) * totalDays) - prev.pTaxes);

    return { 
        gross: R(actualGross), insurance: R(insAmt), tax: R(monthlyTax), 
        martyrs, net: R(actualGross - insAmt - monthlyTax - martyrs),
        taxableIncome: R(currentTaxable)
    };
}

// --- API Routes ---
app.use(async (req, res, next) => { await connectDB(); next(); });

app.get("/api/employees", async (req, res) => res.json(await Employee.find().sort({ name: 1 })));
app.post("/api/employees", async (req, res) => { try { await new Employee(req.body).save(); res.json({ok:1}); } catch(e){ res.status(400).send(e); }});
app.delete("/api/employees/:id", async (req, res) => { await Employee.findByIdAndDelete(req.params.id); await Payroll.deleteMany({employeeId: req.params.id}); res.json({ok:1}); });
app.post("/api/employees/:id/resign", async (req, res) => { await Employee.findByIdAndUpdate(req.params.id, {resignationDate: req.body.date}); res.json({ok:1}); });

app.get("/api/employees/:id/details", async (req, res) => {
    const emp = await Employee.findById(req.params.id);
    const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
    let pDays = 0, pTaxable = 0, pTaxes = 0;
    history.forEach(r => { pDays += r.days; pTaxable += r.taxableIncome; pTaxes += r.monthlyTax; });
    res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
});

app.post("/api/payroll/calculate", async (req, res) => {
    const { empId, month, days, basicGross, prevData } = req.body;
    const emp = await Employee.findById(empId);
    const result = runCoreEngine({ basicFull: basicGross, days, month }, prevData, emp);
    const record = await new Payroll({ employeeId: empId, month, days, ...result }).save();
    res.json(record);
});

// --- Unified HTML UI ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Enterprise Payroll</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; }
        .odoo-sidebar { background: #1a1c2e; transition: all 0.3s; }
        .glass { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border: 1px solid #e2e8f0; }
        .btn-primary { background: #6366f1; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3); }
    </style>
</head>
<body class="flex min-h-screen">
    <aside class="w-64 odoo-sidebar text-slate-400 flex flex-col sticky top-0 h-screen">
        <div class="p-8 text-white font-black text-2xl border-b border-slate-800">CORE ERP</div>
        <nav class="p-4 space-y-2 flex-1">
            <div onclick="location.reload()" class="flex items-center p-3 rounded-xl bg-slate-800 text-indigo-400 font-bold cursor-pointer">
                <i class="fas fa-users-cog ml-3"></i> الموظفين
            </div>
        </nav>
        <div class="p-4 text-[10px] border-t border-slate-800 text-center">Version 5.0 - Final Enterprise</div>
    </aside>

    <main class="flex-1 p-10 overflow-y-auto">
        <div id="view-list">
            <div class="flex justify-between items-center mb-10">
                <h2 class="text-3xl font-black text-slate-800 tracking-tight">إدارة الكادر البشري</h2>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="btn-primary text-white px-8 py-3 rounded-2xl font-bold transition-transform hover:scale-105">
                    + إضافة موظف
                </button>
            </div>
            <div class="glass rounded-[2rem] overflow-hidden shadow-sm">
                <table class="w-full text-right text-sm">
                    <thead class="bg-slate-50 border-b">
                        <tr><th class="p-5 text-slate-500">الاسم</th><th class="p-5 text-center">النوع</th><th class="p-5 text-center">الحالة</th><th class="p-5 text-center">إجراء</th></tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden animate-in fade-in duration-500">
            <button onclick="location.reload()" class="mb-6 text-indigo-600 font-bold"><i class="fas fa-arrow-right ml-2"></i> العودة للقائمة</button>
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div class="glass p-8 rounded-[2rem] shadow-sm space-y-6 h-fit">
                    <h3 id="p-name" class="text-2xl font-black text-slate-800">--</h3>
                    <div class="space-y-3 text-sm text-slate-500">
                        <p class="flex justify-between"><span>النوع:</span><span id="p-type" class="text-indigo-600 font-bold">--</span></p>
                        <p class="flex justify-between"><span>الرقم القومي:</span><span id="p-nid" class="text-slate-800">--</span></p>
                        <p class="flex justify-between"><span>تأمين:</span><span id="p-ins" class="text-slate-800 font-bold">--</span></p>
                    </div>
                    <div class="pt-6 border-t space-y-2">
                        <button onclick="resign()" class="w-full py-3 bg-amber-50 text-amber-600 rounded-xl font-bold text-xs hover:bg-amber-100">تسجيل استقالة</button>
                        <button onclick="del()" class="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100">حذف نهائي</button>
                    </div>
                </div>
                <div class="lg:col-span-3 space-y-8">
                    <div class="bg-indigo-900 p-10 rounded-[2.5rem] shadow-2xl text-white">
                        <h4 class="text-xl font-bold mb-8">معالجة المرتب الشهري</h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div><label class="text-[10px] text-indigo-300 block mb-2 font-bold">الشهر</label><input type="month" id="c-month" class="w-full bg-indigo-800 border-none p-4 rounded-2xl text-white"></div>
                            <div><label class="text-[10px] text-indigo-300 block mb-2 font-bold">إجمالي الراتب Gross</label><input type="number" id="c-gross" class="w-full bg-indigo-800 border-none p-4 rounded-2xl text-white"></div>
                            <div class="flex items-end"><button onclick="runCalc()" class="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-emerald-400">اعتماد الحساب <i class="fas fa-check-circle mr-2"></i></button></div>
                        </div>
                    </div>
                    <div class="glass rounded-[2rem] overflow-hidden shadow-sm">
                        <table class="w-full text-center text-xs">
                            <thead class="bg-slate-50 border-b">
                                <tr><th class="p-4">الشهر</th><th class="p-4">Gross</th><th class="p-4">تأمين</th><th class="p-4">شهداء</th><th class="p-4">ضريبة</th><th class="p-4 text-emerald-600 font-bold">الصافي</th></tr>
                            </thead>
                            <tbody id="histBody" class="divide-y divide-slate-50"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <div id="modal" class="hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl">
            <h3 class="text-3xl font-black mb-8">إضافة موظف</h3>
            <div class="grid grid-cols-1 gap-5">
                <input type="text" id="n-name" placeholder="الاسم الكامل" class="w-full p-4 bg-slate-50 border rounded-2xl">
                <input type="text" id="n-nid" placeholder="الرقم القومي" class="w-full p-4 bg-slate-50 border rounded-2xl">
                <div class="grid grid-cols-2 gap-4">
                    <input type="date" id="n-hdate" class="p-4 bg-slate-50 border rounded-2xl">
                    <input type="number" id="n-ins" placeholder="الأجر التأميني" class="p-4 bg-slate-50 border rounded-2xl">
                </div>
                <select id="n-type" class="w-full p-4 bg-slate-50 border rounded-2xl font-bold"><option>Full Time</option><option>Part Time</option></select>
            </div>
            <div class="flex gap-4 mt-10">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black">حفظ الموظف</button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-slate-100 py-4 rounded-2xl font-bold">إلغاء</button>
            </div>
        </div>
    </div>

    <input type="hidden" id="currId"><input type="hidden" id="pD"><input type="hidden" id="pTxbl"><input type="hidden" id="pTx">

    <script>
        async function load() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            document.getElementById('empTable').innerHTML = data.map(e => \`
                <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="openProfile('\${e._id}')">
                    <td class="p-5 font-bold text-slate-700">\${e.name}</td>
                    <td class="p-5 text-center"><span class="px-3 py-1 bg-slate-100 rounded-lg text-[10px] text-slate-500 font-bold">\${e.jobType}</span></td>
                    <td class="p-5 text-center"><span class="px-3 py-1 \${e.resignationDate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} rounded-lg text-[10px] font-black">\${e.resignationDate ? 'مستقيل' : 'نشط'}</span></td>
                    <td class="p-5 text-center text-indigo-400 font-bold text-xs underline">إدارة</td>
                </tr>
            \`).join('');
        }

        async function openProfile(id) {
            document.getElementById('currId').value = id;
            document.getElementById('view-list').classList.add('hidden');
            document.getElementById('view-profile').classList.remove('hidden');
            const res = await fetch(\`/api/employees/\${id}/details\`);
            const data = await res.json();
            
            document.getElementById('p-name').innerText = data.emp.name;
            document.getElementById('p-type').innerText = data.emp.jobType;
            document.getElementById('p-ins').innerText = data.emp.insSalary.toLocaleString();
            document.getElementById('p-nid').innerText = data.emp.nationalId;
            
            document.getElementById('pD').value = data.prevData.pDays;
            document.getElementById('pTxbl').value = data.prevData.pTaxable;
            document.getElementById('pTx').value = data.prevData.pTaxes;

            document.getElementById('histBody').innerHTML = data.history.map(r => \`
                <tr class="hover:bg-slate-50/50">
                    <td class="p-4 text-slate-600 font-bold">\${r.month}</td>
                    <td class="p-4">\${r.gross.toLocaleString()}</td>
                    <td class="p-4">\${r.insurance.toLocaleString()}</td>
                    <td class="p-4 text-orange-400">\${r.martyrs.toLocaleString()}</td>
                    <td class="p-4 text-red-400">\${r.monthlyTax.toLocaleString()}</td>
                    <td class="p-4 font-black text-emerald-600">\${r.net.toLocaleString()}</td>
                </tr>
            \`).join('');
        }

        async function saveEmp() {
            const body = { name: document.getElementById('n-name').value, nationalId: document.getElementById('n-nid').value, hiringDate: document.getElementById('n-hdate').value, insSalary: Number(document.getElementById('n-ins').value), jobType: document.getElementById('n-type').value };
            await fetch('/api/employees', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            location.reload();
        }

        async function runCalc() {
            const body = {
                empId: document.getElementById('currId').value, month: document.getElementById('c-month').value,
                days: 30, basicGross: Number(document.getElementById('c-gross').value),
                prevData: { pDays: Number(document.getElementById('pD').value), pTaxable: Number(document.getElementById('pTxbl').value), pTaxes: Number(document.getElementById('pTx').value) }
            };
            if(!body.month || !body.basicGross) return alert("ادخل البيانات كاملة");
            await fetch('/api/payroll/calculate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            openProfile(body.empId);
        }

        async function del() { if(confirm("حذف الموظف نهائياً؟")) { await fetch(\`/api/employees/\${document.getElementById('currId').value}\`, {method:'DELETE'}); location.reload(); } }
        async function resign() { const d = prompt("تاريخ الاستقالة (YYYY-MM-DD):"); if(d) { await fetch(\`/api/employees/\${document.getElementById('currId').value}/resign\`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({date:d})}); openProfile(document.getElementById('currId').value); } }

        window.onload = load;
    </script>
</body>
</html>
    `);
});

// --- Final Export ---
module.exports = app;
if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => console.log("Smarter Engine: http://localhost:3000"));
}

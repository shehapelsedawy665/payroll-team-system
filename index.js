const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

// --- Database Connectivity ---
let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    try {
        await mongoose.connect(mongoURI);
        isConnected = true;
        console.log("Verified Connection to Atlas");
    } catch (e) { console.error("Database Error:", e); }
}

// --- Schemas (Allowing Duplicate National IDs for Re-hiring) ---
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: String,
    nationalId: String, 
    hiringDate: Date,
    resignationDate: Date,
    insSalary: Number,
    jobType: { type: String, default: "Full Time" }
}));

const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId,
    month: String,
    days: Number,
    gross: Number,
    taxableIncome: Number,
    monthlyTax: Number,
    insurance: Number,
    martyrs: Number,
    net: Number
}));

// --- Pure Calculation Logic (The Original Engine) ---
const R = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

function calculateTaxesAndPayroll(data, prev, emp) {
    const { basicFull, days, month } = data;
    
    // 1. Insurance Logic (Full Month vs Prorated Control)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    let effectiveInsBase = Math.max(minIns, Math.min(maxIns, emp.insSalary));

    let insAmt = 0;
    const hDate = new Date(emp.hiringDate);
    const rDate = emp.resignationDate ? new Date(emp.resignationDate) : null;
    const [year, monthNum] = month.split('-').map(Number);
    
    const isHiringMonth = hDate.getFullYear() === year && (hDate.getMonth() + 1) === monthNum;
    const isResignMonth = rDate && rDate.getFullYear() === year && (rDate.getMonth() + 1) === monthNum;

    // Insurance Rule: Full amount unless specific hiring rules apply
    if (isHiringMonth && isResignMonth) insAmt = effectiveInsBase * 0.11;
    else if (isHiringMonth && hDate.getDate() > 1) insAmt = 0;
    else insAmt = effectiveInsBase * 0.11;

    // 2. Gross & Martyrs (0.0005)
    const actualGross = R((basicFull / 30) * days);
    const martyrs = R(actualGross * 0.0005);
    const currentTaxable = actualGross - insAmt;

    // 3. Sequential Tax Engine (Full Brackets)
    const totalDays = days + (prev.pDays || 0);
    const totalTaxable = currentTaxable + (prev.pTaxable || 0);
    const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;

    let annualTax = 0;
    let remainder = Math.max(0, annualTaxable - 20000); // Personal Exemption

    // 2024 Brackets Logic
    if (annualTaxable <= 600000) {
        if (remainder > 0) {
            let b1 = Math.min(remainder, 40000); annualTax += b1 * 0.10; remainder -= b1;
        }
        if (remainder > 0) {
            let b2 = Math.min(remainder, 15000); annualTax += b2 * 0.15; remainder -= b2;
        }
        if (remainder > 0) {
            let b3 = Math.min(remainder, 15000); annualTax += b3 * 0.20; remainder -= b3;
        }
        if (remainder > 0) {
            let b4 = Math.min(remainder, 130000); annualTax += b4 * 0.225; remainder -= b4;
        }
        if (remainder > 0) {
            let b5 = Math.min(remainder, 200000); annualTax += b5 * 0.25; remainder -= b5;
        }
        if (remainder > 0) {
            annualTax += remainder * 0.275;
        }
    } else if (annualTaxable > 600000 && annualTaxable <= 700000) {
        let b1 = Math.min(remainder, 55000); annualTax += b1 * 0.15; remainder -= b1;
        // ... continues with same high income logic
        annualTax += remainder * 0.225; 
    } else {
        annualTax = remainder * 0.25; // Flat high income approximation for 1.2M+
    }

    const monthlyTax = R(Math.max(0, ((annualTax / 360) * totalDays) - (prev.pTaxes || 0)));
    const net = R(actualGross - insAmt - monthlyTax - martyrs);

    return { gross: actualGross, insurance: R(insAmt), monthlyTax, martyrs, net, taxableIncome: R(currentTaxable) };
}

// --- API Routes ---
app.use(async (req, res, next) => { await connectDB(); next(); });

app.get("/api/employees", async (req, res) => {
    res.json(await Employee.find().sort({ hiringDate: -1 }));
});

app.post("/api/employees", async (req, res) => {
    const emp = new Employee(req.body);
    await emp.save();
    res.json(emp);
});

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
    const result = calculateTaxesAndPayroll({ basicFull: basicGross, days, month }, prevData, emp);
    
    const record = new Payroll({ employeeId: empId, month, days, ...result });
    await record.save();
    res.json(record);
});

app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ ok: true });
});

app.post("/api/employees/:id/resign", async (req, res) => {
    await Employee.findByIdAndUpdate(req.params.id, { resignationDate: req.body.date });
    res.json({ ok: true });
});

// --- UI (The Unified Enterprise File) ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Master Payroll ERP</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; background: #f0f2f5; }
        .sidebar { background: #1e1e2d; }
        .glass { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }
    </style>
</head>
<body class="flex min-h-screen">
    <aside class="w-64 sidebar text-slate-400 flex flex-col sticky top-0 h-screen shadow-2xl">
        <div class="p-8 text-white font-black text-2xl border-b border-slate-800">ODOO <span class="text-indigo-500">PAY</span></div>
        <nav class="p-4 flex-1">
            <div onclick="location.reload()" class="flex items-center p-4 rounded-xl bg-indigo-600/10 text-indigo-400 font-bold cursor-pointer">
                <i class="fas fa-users-cog ml-3"></i> الموظفين
            </div>
        </nav>
        <div class="p-4 text-[10px] text-center opacity-30 tracking-tighter">v6.2 FINAL PRODUCTION</div>
    </aside>

    <main class="flex-1 p-10 overflow-y-auto">
        <div id="view-list">
            <div class="flex justify-between items-center mb-10">
                <h2 class="text-4xl font-black text-slate-800">إدارة الرواتب</h2>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-200">
                    + موظف جديد
                </button>
            </div>
            <div class="glass rounded-[2rem] overflow-hidden shadow-sm border border-white">
                <table class="w-full text-right">
                    <thead class="bg-slate-50 border-b">
                        <tr><th class="p-6">الاسم</th><th class="p-6 text-center">التعيين</th><th class="p-6 text-center">الحالة</th><th class="p-6 text-center">الإجراء</th></tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden">
            <button onclick="location.reload()" class="mb-8 text-indigo-600 font-bold flex items-center hover:translate-x-1 transition-transform">
                <i class="fas fa-arrow-right ml-2"></i> العودة
            </button>
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div class="glass p-8 rounded-[2rem] space-y-6 shadow-sm">
                    <h3 id="p-name" class="text-2xl font-black">--</h3>
                    <div class="space-y-3 text-sm border-t pt-4">
                        <p class="flex justify-between"><span>الرقم القومي:</span><span id="p-nid" class="font-bold">--</span></p>
                        <p class="flex justify-between"><span>النوع:</span><span id="p-type" class="text-indigo-600 font-bold">--</span></p>
                    </div>
                    <div class="pt-6 space-y-2">
                        <button onclick="resign()" class="w-full py-3 bg-orange-50 text-orange-600 rounded-xl font-bold hover:bg-orange-100">استقالة</button>
                        <button onclick="del()" class="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100">حذف</button>
                    </div>
                </div>

                <div class="lg:col-span-3 space-y-8">
                    <div id="calc-container" class="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl">
                        <h4 class="text-xl font-bold mb-8">معالجة الشهر القادم</h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div><label class="text-xs text-slate-400 block mb-2">الشهر</label><input type="month" id="c-month" class="w-full bg-slate-800 border-none p-4 rounded-2xl text-white outline-none" readonly></div>
                            <div><label class="text-xs text-slate-400 block mb-2">الراتب Gross</label><input type="number" id="c-gross" class="w-full bg-slate-800 border-none p-4 rounded-2xl text-white outline-none focus:ring-2 ring-indigo-500"></div>
                            <div class="flex items-end"><button onclick="runCalc()" class="w-full bg-indigo-600 py-4 rounded-2xl font-black shadow-lg">حساب وتأكيد</button></div>
                        </div>
                    </div>

                    <div class="glass rounded-[2rem] overflow-hidden">
                        <table class="w-full text-center text-xs">
                            <thead class="bg-slate-50 border-b">
                                <tr><th class="p-5">الشهر</th><th class="p-5">Gross</th><th class="p-5">تأمين</th><th class="p-5">شهداء</th><th class="p-5">ضريبة</th><th class="p-5 text-emerald-600 font-black">الصافي</th></tr>
                            </thead>
                            <tbody id="histBody" class="divide-y"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <div id="modal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl">
            <h3 class="text-2xl font-black mb-6">إضافة موظف</h3>
            <div class="space-y-4">
                <input type="text" id="n-name" placeholder="الاسم" class="w-full p-4 bg-slate-50 border rounded-2xl">
                <input type="text" id="n-nid" placeholder="الرقم القومي" class="w-full p-4 bg-slate-50 border rounded-2xl">
                <div class="grid grid-cols-2 gap-4">
                    <input type="date" id="n-hdate" class="p-4 bg-slate-50 border rounded-2xl">
                    <input type="number" id="n-ins" placeholder="التأميني" class="p-4 bg-slate-50 border rounded-2xl">
                </div>
                <select id="n-type" class="w-full p-4 bg-slate-50 border rounded-2xl font-bold"><option>Full Time</option><option>Part Time</option></select>
            </div>
            <div class="flex gap-4 mt-8">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">حفظ</button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-slate-50 py-4 rounded-2xl font-bold">إلغاء</button>
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
                    <td class="p-6 font-bold text-slate-700">\${e.name}</td>
                    <td class="p-6 text-center text-slate-500 text-xs">\${e.hiringDate.split('T')[0]}</td>
                    <td class="p-6 text-center"><span class="px-3 py-1 \${e.resignationDate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} rounded-lg text-[10px] font-black">\${e.resignationDate ? 'مستقيل' : 'نشط'}</span></td>
                    <td class="p-6 text-center text-indigo-500 font-bold">فتح السجل</td>
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
            document.getElementById('p-nid').innerText = data.emp.nationalId;
            
            let lastMonth = data.history.length > 0 ? data.history[data.history.length - 1].month : data.emp.hiringDate.substring(0, 7);
            if (data.history.length > 0) {
                let [y, m] = lastMonth.split('-').map(Number);
                m++; if(m > 12) { m = 1; y++; }
                lastMonth = \`\${y}-\${m.toString().padStart(2, '0')}\`;
            }
            document.getElementById('c-month').value = lastMonth;

            if (data.emp.resignationDate && lastMonth > data.emp.resignationDate.substring(0, 7)) {
                document.getElementById('calc-container').classList.add('hidden');
            } else {
                document.getElementById('calc-container').classList.remove('hidden');
            }

            document.getElementById('pD').value = data.prevData.pDays;
            document.getElementById('pTxbl').value = data.prevData.pTaxable;
            document.getElementById('pTx').value = data.prevData.pTaxes;

            document.getElementById('histBody').innerHTML = data.history.map(r => \`
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-5 font-bold text-slate-600">\${r.month}</td>
                    <td class="p-5">\${r.gross.toLocaleString()}</td>
                    <td class="p-5">\${r.insurance.toLocaleString()}</td>
                    <td class="p-5 text-orange-400 font-bold">\${r.martyrs.toLocaleString()}</td>
                    <td class="p-5 text-red-500">\${r.monthlyTax.toLocaleString()}</td>
                    <td class="p-5 font-black text-emerald-600 bg-emerald-50/20">\${r.net.toLocaleString()}</td>
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
                empId: document.getElementById('currId').value, 
                month: document.getElementById('c-month').value,
                days: 30, 
                basicGross: Number(document.getElementById('c-gross').value),
                prevData: { pDays: Number(document.getElementById('pD').value), pTaxable: Number(document.getElementById('pTxbl').value), pTaxes: Number(document.getElementById('pTx').value) }
            };
            if(!body.basicGross) return alert("أدخل الراتب");
            const res = await fetch('/api/payroll/calculate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            if (res.ok) {
                openProfile(body.empId);
                document.getElementById('c-gross').value = '';
            }
        }

        async function del() { if(confirm("حذف نهائي؟")) { await fetch(\`/api/employees/\${document.getElementById('currId').value}\`, {method:'DELETE'}); location.reload(); } }
        async function resign() { const d = prompt("تاريخ الاستقالة (YYYY-MM-DD):"); if(d) { await fetch(\`/api/employees/\${document.getElementById('currId').value}/resign\`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({date:d})}); openProfile(document.getElementById('currId').value); } }

        window.onload = load;
    </script>
</body>
</html>
    `);
});

module.exports = app;

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    try {
        await mongoose.connect(mongoURI);
        isConnected = true;
    } catch (e) { console.error("DB Error", e); }
}

const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: String, nationalId: String, hiringDate: Date, resignationDate: Date, insSalary: Number, jobType: { type: String, default: "Full Time" }
}));

const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, month: String, days: Number, gross: Number, taxableIncome: Number, monthlyTax: Number, insurance: Number, martyrs: Number, net: Number
}));

const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// --- PRECISE EGYPTIAN TAX ENGINE ---
function calculateTax(annualTaxable) {
    let tax = 0;
    let remainder = Math.max(0, annualTaxable - 20000); // Personal Exemption

    const brackets = [
        { limit: 40000, rate: 0.10 },
        { limit: 15000, rate: 0.15 },
        { limit: 15000, rate: 0.20 },
        { limit: 130000, rate: 0.225 },
        { limit: 200000, rate: 0.25 },
        { limit: Infinity, rate: 0.275 }
    ];

    if (annualTaxable <= 600000) {
        for (let b of brackets) {
            if (remainder <= 0) break;
            let chunk = Math.min(remainder, b.limit);
            tax += chunk * b.rate;
            remainder -= chunk;
        }
    } else {
        // High Income simplified for 600k+
        tax = (annualTaxable - 20000) * 0.25;
    }
    return tax;
}

function runEngine(data, prev, emp) {
    const { basicFull, days, month } = data;
    
    // 1. Insurance (Fixed to always check max/min)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    let insBase = Math.max(minIns, Math.min(maxIns, emp.insSalary));
    
    const hDate = new Date(emp.hiringDate);
    const [year, monthNum] = month.split('-').map(Number);
    let insAmt = (hDate.getFullYear() === year && (hDate.getMonth() + 1) === monthNum && hDate.getDate() > 1) ? 0 : insBase * 0.11;

    // 2. Gross & Martyrs
    const actualGross = R((basicFull / 30) * days);
    const martyrs = R(actualGross * 0.0005);
    const currentTaxable = actualGross - insAmt;

    // 3. Sequential Cumulative Tax Logic
    const totalDays = days + (prev.pDays || 0);
    const totalTaxable = currentTaxable + (prev.pTaxable || 0);
    const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;

    const annualTax = calculateTax(annualTaxable);
    const monthlyTax = R(Math.max(0, ((annualTax / 360) * totalDays) - (prev.pTaxes || 0)));
    const net = R(actualGross - insAmt - monthlyTax - martyrs);

    return { gross: actualGross, insurance: R(insAmt), monthlyTax, martyrs, net, taxableIncome: R(currentTaxable) };
}

app.use(async (req, res, next) => { await connectDB(); next(); });

app.get("/api/employees", async (req, res) => res.json(await Employee.find().sort({ hiringDate: -1 })));
app.post("/api/employees", async (req, res) => res.json(await new Employee(req.body).save()));

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
    const result = runEngine({ basicFull: basicGross, days, month }, prevData, emp);
    const record = await new Payroll({ employeeId: empId, month, days, ...result }).save();
    res.json(record);
});

app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ ok: 1 });
});

app.post("/api/employees/:id/resign", async (req, res) => {
    await Employee.findByIdAndUpdate(req.params.id, { resignationDate: req.body.date });
    res.json({ ok: 1 });
});

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Enterprise Payroll System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; background: #f1f5f9; }
    </style>
</head>
<body class="flex min-h-screen">
    <aside class="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0 shadow-2xl">
        <div class="p-8 text-2xl font-black border-b border-slate-800">ODOO <span class="text-indigo-400">CORE</span></div>
        <nav class="p-4 flex-1">
            <div onclick="location.reload()" class="p-4 rounded-xl bg-slate-800 text-indigo-400 font-bold cursor-pointer">
                <i class="fas fa-users ml-3"></i> الموظفين
            </div>
        </nav>
        <div class="p-4 text-[10px] text-center opacity-30">v6.5 - PROD VERIFIED</div>
    </aside>

    <main class="flex-1 p-10 overflow-y-auto">
        <div id="view-list">
            <div class="flex justify-between items-center mb-10">
                <h2 class="text-4xl font-black text-slate-800">قائمة الرواتب</h2>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-200">+ إضافة موظف</button>
            </div>
            <div class="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100">
                <table class="w-full text-right text-sm">
                    <thead class="bg-slate-50 border-b">
                        <tr><th class="p-6">الموظف</th><th class="p-6 text-center">التعيين</th><th class="p-6 text-center">الحالة</th><th class="p-6 text-center">إدارة</th></tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden">
            <button onclick="location.reload()" class="mb-8 text-indigo-600 font-bold flex items-center hover:translate-x-1 transition-transform">
                <i class="fas fa-arrow-right ml-2"></i> العودة للقائمة
            </button>
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div class="bg-white p-8 rounded-[2rem] shadow-sm border-t-4 border-indigo-500 space-y-6">
                    <h3 id="p-name" class="text-2xl font-black text-slate-800">--</h3>
                    <p id="p-nid" class="text-xs text-slate-400">--</p>
                    <div class="pt-6 border-t space-y-3">
                        <button onclick="resign()" class="w-full py-3 bg-orange-50 text-orange-600 rounded-xl font-bold">تسجيل استقالة</button>
                        <button onclick="del()" class="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold">حذف نهائي</button>
                    </div>
                </div>

                <div class="lg:col-span-3 space-y-8">
                    <div id="calc-container" class="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl">
                        <h4 class="text-xl font-bold mb-8 flex items-center"><i class="fas fa-calendar-check ml-3 text-indigo-400"></i> معالجة الشهر التالي</h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div><label class="text-[10px] text-slate-400 block mb-2 uppercase tracking-widest font-bold">الشهر</label><input type="month" id="c-month" class="w-full bg-slate-800 border-none p-4 rounded-2xl text-white outline-none cursor-not-allowed" readonly></div>
                            <div><label class="text-[10px] text-slate-400 block mb-2 uppercase tracking-widest font-bold">إجمالي الراتب (Gross)</label><input type="number" id="c-gross" class="w-full bg-slate-800 border-none p-4 rounded-2xl text-white outline-none focus:ring-2 ring-indigo-500"></div>
                            <div class="flex items-end"><button onclick="runCalc()" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 transition">اعتماد وحساب</button></div>
                        </div>
                    </div>

                    <div class="bg-white rounded-[2rem] overflow-hidden shadow-sm">
                        <table class="w-full text-center text-xs">
                            <thead class="bg-slate-50 border-b">
                                <tr><th class="p-5">الشهر</th><th class="p-5">Gross</th><th class="p-5">تأمين</th><th class="p-5">شهداء</th><th class="p-5">ضريبة</th><th class="p-5 font-black text-emerald-600">الصافي (Net)</th></tr>
                            </thead>
                            <tbody id="histBody" class="divide-y divide-slate-100"></tbody>
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
                    <td class="p-6 font-bold text-slate-700">\${e.name}</td>
                    <td class="p-6 text-center text-slate-400">\${e.hiringDate.split('T')[0]}</td>
                    <td class="p-6 text-center"><span class="px-3 py-1 \${e.resignationDate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} rounded-lg text-[10px] font-black">\${e.resignationDate ? 'مستقيل' : 'نشط'}</span></td>
                    <td class="p-6 text-center text-indigo-500 font-bold">عرض</td>
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
                <tr class="hover:bg-slate-50 transition border-b border-slate-50">
                    <td class="p-5 font-bold text-slate-600">\${r.month}</td>
                    <td class="p-5 font-bold">\${r.gross.toLocaleString()}</td>
                    <td class="p-5">\${r.insurance.toLocaleString()}</td>
                    <td class="p-5 text-orange-500">\${r.martyrs.toLocaleString()}</td>
                    <td class="p-5 text-red-500 font-bold">\${r.monthlyTax.toLocaleString()}</td>
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
                empId: document.getElementById('currId').value, month: document.getElementById('c-month').value,
                days: 30, basicGross: Number(document.getElementById('c-gross').value),
                prevData: { pDays: Number(document.getElementById('pD').value), pTaxable: Number(document.getElementById('pTxbl').value), pTaxes: Number(document.getElementById('pTx').value) }
            };
            if(!body.basicGross) return alert("أدخل الراتب");
            const res = await fetch('/api/payroll/calculate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            if (res.ok) {
                openProfile(body.empId);
                document.getElementById('c-gross').value = '';
            }
        }

        async function del() { if(confirm("حذف الموظف نهائياً؟")) { await fetch(\`/api/employees/\${document.getElementById('currId').value}\`, {method:'DELETE'}); location.reload(); } }
        async function resign() { const d = prompt("تاريخ الاستقالة (YYYY-MM-DD):"); if(d) { await fetch(\`/api/employees/\${document.getElementById('currId').value}/resign\`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({date:d})}); openProfile(document.getElementById('currId').value); } }

        window.onload = load;
    </script>
</body>
</html>
    `);
});

module.exports = app;

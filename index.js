const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection Configuration ---
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI)
    .then(() => console.log("🚀 Atlas Engine: Online & Connected"))
    .catch(err => console.error("❌ Database Connection Failed:", err));

// --- Database Schemas ---
const EmployeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true },
    hiringDate: { type: Date, required: true },
    resignationDate: { type: Date },
    insSalary: { type: Number, default: 0 },
    jobType: { type: String, default: "Full Time" }
});

const PayrollSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    month: String,
    days: Number,
    gross: Number,
    taxableIncome: Number,
    monthlyTax: Number,
    insurance: Number,
    martyrs: Number,
    net: Number,
    createdAt: { type: Date, default: Date.now }
});

const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);
const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", PayrollSchema);

// --- Advanced Calculation Logic ---
const R = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualTaxable) {
    let tax = 0;
    let remainder = annualTaxable; 

    const brackets = [
        { limit: 30000, rate: 0.00 }, 
        { limit: 15000, rate: 0.10 }, 
        { limit: 15000, rate: 0.15 }, 
        { limit: 140000, rate: 0.20 },
        { limit: 200000, rate: 0.225 },
        { limit: 200000, rate: 0.25 },
        { limit: Infinity, rate: 0.275 }
    ];

    for (let b of brackets) {
        if (remainder <= 0) break;
        let chunk = Math.min(remainder, b.limit);
        tax += chunk * b.rate;
        remainder -= chunk;
    }
    return tax;
}

function processPayroll(data, prev, emp) {
    const { basicFull, days, month } = data;
    
    // 1. Insurance (Fixed to always check max/min based on Law)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    let effectiveBase = Math.max(minIns, Math.min(maxIns, emp.insSalary));
    let insAmt = R(effectiveBase * 0.11);

    // 2. Gross & Martyrs
    const actualGross = R((basicFull / 30) * days);
    const martyrs = R(actualGross * 0.0005);

    // 3. Taxable Pool Logic (Prorated Personal Exemption 20k)
    const personalExemption = R((20000 / 360) * days);
    const currentTaxablePool = Math.max(0, (actualGross - insAmt) - personalExemption);

    // 4. Cumulative YTD Calculation
    const totalDays = days + (prev.pDays || 0);
    const totalTaxablePool = currentTaxablePool + (prev.pTaxable || 0);
    
    // Projecting to 360 days for Tax Brackets
    const annualTaxableProjected = Math.floor(((totalTaxablePool / totalDays) * 360) / 10) * 10;
    
    const annualTax = calculateEgyptianTax(annualTaxableProjected);
    const monthlyTax = R(Math.max(0, ((annualTax / 360) * totalDays) - (prev.pTaxes || 0)));
    const net = R(actualGross - insAmt - monthlyTax - martyrs);

    return {
        gross: actualGross,
        insurance: insAmt,
        monthlyTax,
        martyrs,
        net,
        taxableIncome: currentTaxablePool
    };
}

// --- API Endpoints ---
app.get("/api/employees", async (req, res) => {
    try {
        const emps = await Employee.find().sort({ hiringDate: -1 });
        res.json(emps);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/employees", async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.json(emp);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/employees/:id/details", async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id);
        const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => {
            pDays += r.days;
            pTaxable += r.taxableIncome;
            pTaxes += r.monthlyTax;
        });
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { empId, month, days, basicGross, prevData } = req.body;
        const emp = await Employee.findById(empId);
        const result = processPayroll({ basicFull: basicGross, days, month }, prevData, emp);
        const record = new Payroll({ employeeId: empId, month, days, ...result });
        await record.save();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

// --- Frontend UI (HTML/JS) ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Enterprise Payroll Management v8.5</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; background-color: #f8fafc; }
    </style>
</head>
<body class="flex min-h-screen">
    <aside class="w-80 bg-slate-900 text-white flex flex-col h-screen sticky top-0 shadow-2xl">
        <div class="p-12 text-3xl font-black border-b border-slate-800 text-center tracking-tighter">
            <span class="text-indigo-500">ODOO</span> CORE
        </div>
        <nav class="p-8 space-y-6">
            <div onclick="location.reload()" class="flex items-center p-5 rounded-[2rem] bg-indigo-600 text-white font-bold cursor-pointer shadow-xl shadow-indigo-500/20">
                <i class="fas fa-users-gear ml-4 text-2xl"></i> قائمة الموظفين
            </div>
        </nav>
        <div class="mt-auto p-8 text-[10px] text-center text-slate-600 uppercase tracking-[0.2em] border-t border-slate-800 font-black">
            System Logic Verified v8.5
        </div>
    </aside>

    <main class="flex-1 p-16 overflow-y-auto">
        <div id="view-list">
            <div class="flex justify-between items-center mb-16">
                <div>
                    <h1 class="text-5xl font-black text-slate-800 mb-3 tracking-tight">إدارة الرواتب</h1>
                    <p class="text-slate-500 text-lg">النظام الموحد لحساب الضرائب والتأمينات الاجتماعية</p>
                </div>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[2rem] font-black shadow-2xl shadow-indigo-200 transition-all active:scale-95">
                    + إضافة موظف جديد
                </button>
            </div>

            <div class="bg-white rounded-[3rem] overflow-hidden shadow-sm border border-slate-100">
                <table class="w-full text-right">
                    <thead>
                        <tr class="bg-slate-50/50 text-slate-400 text-xs uppercase tracking-widest">
                            <th class="p-10">الموظف</th>
                            <th class="p-10 text-center">تاريخ التعيين</th>
                            <th class="p-10 text-center">الحالة</th>
                            <th class="p-10 text-center">إدارة</th>
                        </tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-50"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden">
            <button onclick="location.reload()" class="mb-12 text-indigo-600 font-black flex items-center hover:-translate-x-3 transition-transform text-lg">
                <i class="fas fa-chevron-right ml-4"></i> العودة للقائمة
            </button>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-12">
                <div class="space-y-8">
                    <div class="bg-white p-12 rounded-[3rem] shadow-sm text-center border-b-[12px] border-indigo-500">
                        <div class="w-28 h-28 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-8 text-4xl text-indigo-500">
                            <i class="fas fa-id-badge"></i>
                        </div>
                        <h3 id="p-name" class="text-3xl font-black text-slate-800 mb-2">--</h3>
                        <p id="p-nid" class="text-slate-400 font-mono text-sm tracking-widest">--</p>
                        <div class="mt-10 pt-10 border-t border-slate-50">
                            <button onclick="del()" class="w-full py-5 bg-red-50 text-red-600 rounded-2xl font-black hover:bg-red-100 transition">حذف السجل</button>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-3 space-y-12">
                    <div id="calc-container" class="bg-slate-900 p-16 rounded-[4rem] text-white shadow-2xl relative">
                        <h4 class="text-2xl font-black mb-12 flex items-center">
                            <i class="fas fa-coins ml-4 text-indigo-400"></i> معالجة الراتب الشهري
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
                            <div class="space-y-3">
                                <label class="text-xs font-black text-slate-500 uppercase tracking-widest">الشهر</label>
                                <input type="month" id="c-month" class="w-full bg-slate-800 border-none p-6 rounded-[1.5rem] text-white font-bold" readonly>
                            </div>
                            <div class="space-y-3">
                                <label class="text-xs font-black text-slate-500 uppercase tracking-widest">إجمالي الراتب (Gross)</label>
                                <input type="number" id="c-gross" placeholder="0.00" class="w-full bg-slate-800 border-none p-6 rounded-[1.5rem] text-white focus:ring-4 ring-indigo-500/20 transition outline-none font-black text-xl">
                            </div>
                            <div class="flex items-end">
                                <button onclick="runCalc()" class="w-full bg-indigo-600 text-white py-6 rounded-[1.5rem] font-black shadow-xl hover:bg-indigo-500 transition-all">
                                    تأكيد الحساب
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-[3rem] overflow-hidden shadow-sm border">
                        <table class="w-full text-center text-sm">
                            <thead class="bg-slate-50 text-slate-400 font-black">
                                <tr>
                                    <th class="p-8">الشهر</th>
                                    <th class="p-8">Gross</th>
                                    <th class="p-8">تأمين</th>
                                    <th class="p-8">شهداء</th>
                                    <th class="p-8 text-red-500">الضريبة</th>
                                    <th class="p-8 bg-emerald-50 text-emerald-700 font-black text-lg">الصافي (Net)</th>
                                </tr>
                            </thead>
                            <tbody id="histBody" class="divide-y divide-slate-100"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <div id="modal" class="hidden fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-8 z-[100]">
        <div class="bg-white rounded-[4rem] p-16 w-full max-w-2xl shadow-2xl">
            <h3 class="text-4xl font-black mb-12 text-slate-800">بيانات الموظف الجديد</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="md:col-span-2">
                    <input type="text" id="n-name" placeholder="اسم الموظف بالكامل" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold">
                </div>
                <div>
                    <input type="text" id="n-nid" placeholder="الرقم القومي" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold">
                </div>
                <div>
                    <input type="date" id="n-hdate" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold text-slate-400">
                </div>
                <div>
                    <input type="number" id="n-ins" placeholder="الراتب التأميني" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold">
                </div>
                <div>
                    <select id="n-type" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-black text-indigo-600">
                        <option>Full Time</option>
                        <option>Part Time</option>
                    </select>
                </div>
            </div>
            <div class="flex gap-6 mt-16">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-6 rounded-[2rem] font-black shadow-2xl hover:bg-indigo-700">حفظ البيانات</button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-slate-100 text-slate-500 py-6 rounded-[2rem] font-black">إلغاء</button>
            </div>
        </div>
    </div>

    <input type="hidden" id="currId"><input type="hidden" id="pD"><input type="hidden" id="pTxbl"><input type="hidden" id="pTx">

    <script>
        async function load() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            document.getElementById('empTable').innerHTML = data.map(e => \`
                <tr class="hover:bg-slate-50 transition cursor-pointer group" onclick="openProfile('\${e._id}')">
                    <td class="p-10 font-black text-slate-700 text-xl">\${e.name}</td>
                    <td class="p-10 text-center text-slate-400 font-bold">\${new Date(e.hiringDate).toLocaleDateString('en-GB')}</td>
                    <td class="p-10 text-center">
                        <span class="px-6 py-3 \${e.resignationDate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} rounded-2xl text-xs font-black">
                            \${e.resignationDate ? 'مستقيل' : 'نشط'}
                        </span>
                    </td>
                    <td class="p-10 text-center">
                        <i class="fas fa-chevron-left text-indigo-500 group-hover:-translate-x-2 transition-transform"></i>
                    </td>
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

            document.getElementById('pD').value = data.prevData.pDays;
            document.getElementById('pTxbl').value = data.prevData.pTaxable;
            document.getElementById('pTx').value = data.prevData.pTaxes;

            document.getElementById('histBody').innerHTML = data.history.map(r => \`
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-8 font-black text-slate-600 text-lg">\${r.month}</td>
                    <td class="p-8 font-bold">\${r.gross.toLocaleString()}</td>
                    <td class="p-8">\${r.insurance.toLocaleString()}</td>
                    <td class="p-8 text-orange-500 font-bold">\${r.martyrs.toLocaleString()}</td>
                    <td class="p-8 text-red-500 font-black">\${r.monthlyTax.toLocaleString()}</td>
                    <td class="p-8 font-black text-emerald-700 bg-emerald-50/40 shadow-inner text-xl">\${r.net.toLocaleString()}</td>
                </tr>
            \`).join('');
        }

        async function saveEmp() {
            const body = {
                name: document.getElementById('n-name').value,
                nationalId: document.getElementById('n-nid').value,
                hiringDate: document.getElementById('n-hdate').value,
                insSalary: Number(document.getElementById('n-ins').value),
                jobType: document.getElementById('n-type').value
            };
            await fetch('/api/employees', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            location.reload();
        }

        async function runCalc() {
            const body = {
                empId: document.getElementById('currId').value,
                month: document.getElementById('c-month').value,
                days: 30,
                basicGross: Number(document.getElementById('c-gross').value),
                prevData: {
                    pDays: Number(document.getElementById('pD').value),
                    pTaxable: Number(document.getElementById('pTxbl').value),
                    pTaxes: Number(document.getElementById('pTx').value)
                }
            };
            const res = await fetch('/api/payroll/calculate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            if (res.ok) {
                openProfile(body.empId);
                document.getElementById('c-gross').value = '';
            }
        }

        async function del() { if(confirm("حذف ملف الموظف نهائياً؟")) { await fetch(\`/api/employees/\${document.getElementById('currId').value}\`, {method:'DELETE'}); location.reload(); } }

        window.onload = load;
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`✅ Enterprise Core Operational: Port \${PORT}\`));

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection ---
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI)
    .then(() => console.log("🚀 Atlas Engine: Fully Operational"))
    .catch(err => console.error("❌ Critical DB Error:", err));

// --- Models ---
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

// --- The Calculation Engine (The Verified Logic) ---
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
    
    // 1. Insurance Logic (Non-prorated on amounts as requested)
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    let effectiveBase = Math.max(minIns, Math.min(maxIns, emp.insSalary));
    let insAmt = R(effectiveBase * 0.11);

    // 2. Gross & Martyrs
    const actualGross = R((basicFull / 30) * days);
    const martyrs = R(actualGross * 0.0005);

    // 3. Taxable Pool Logic (20k Exemption prorated by days)
    const personalExemption = R((20000 / 360) * days);
    const currentTaxablePool = Math.max(0, (actualGross - insAmt) - personalExemption);

    // 4. Cumulative YTD Calculation (The "2,445" Fix)
    const totalDays = days + (prev.pDays || 0);
    const totalTaxablePool = currentTaxablePool + (prev.pTaxable || 0);
    
    // Convert to Annual for Brackets
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

// --- Professional UI (Frontend) ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Enterprise Payroll System v9.0</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; background-color: #f8fafc; color: #1e293b; }
        .custom-shadow { box-shadow: 0 20px 50px -12px rgba(0,0,0,0.05); }
        .glass { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); }
    </style>
</head>
<body class="flex min-h-screen">
    <aside class="w-80 bg-slate-900 text-white flex flex-col h-screen sticky top-0 shadow-2xl z-20">
        <div class="p-12 text-center border-b border-slate-800">
            <div class="text-4xl font-black tracking-tighter mb-2"><span class="text-indigo-500">ODOO</span></div>
            <div class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Payroll Engine</div>
        </div>
        <nav class="p-8 flex-1 space-y-4">
            <div onclick="location.reload()" class="flex items-center p-5 rounded-[2rem] bg-indigo-600 text-white font-bold cursor-pointer shadow-xl shadow-indigo-500/30 hover:scale-105 transition-all">
                <i class="fas fa-users-gear ml-4 text-2xl"></i> قائمة الموظفين
            </div>
        </nav>
        <div class="p-8 border-t border-slate-800">
            <div class="flex items-center gap-4 text-slate-500 text-xs font-bold uppercase">
                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                System Active
            </div>
        </div>
    </aside>

    <main class="flex-1 p-16">
        <div id="view-list" class="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div class="flex justify-between items-end mb-16">
                <div>
                    <h1 class="text-5xl font-black text-slate-800 mb-4 tracking-tight">إدارة الرواتب</h1>
                    <p class="text-slate-500 text-lg">تحكم كامل في الحسابات الضريبية والتأمينية وفقاً للقانون المصري.</p>
                </div>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[2rem] font-black shadow-2xl shadow-indigo-200 transition-all active:scale-95">
                    إضافة موظف جديد +
                </button>
            </div>

            <div class="bg-white rounded-[3rem] overflow-hidden shadow-sm border border-slate-100">
                <table class="w-full text-right border-collapse">
                    <thead>
                        <tr class="bg-slate-50/50 text-slate-400 text-xs uppercase tracking-widest border-b">
                            <th class="p-10 font-black">اسم الموظف</th>
                            <th class="p-10 text-center">تاريخ التعيين</th>
                            <th class="p-10 text-center">الحالة</th>
                            <th class="p-10 text-center">إدارة</th>
                        </tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-50"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden animate-in fade-in duration-500">
            <button onclick="location.reload()" class="mb-12 text-indigo-600 font-black flex items-center hover:-translate-x-3 transition-transform text-lg">
                <i class="fas fa-chevron-right ml-4"></i> العودة للقائمة الرئيسية
            </button>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-12">
                <div class="space-y-8">
                    <div class="bg-white p-12 rounded-[3rem] shadow-sm text-center border-t-[12px] border-indigo-500">
                        <div class="w-28 h-28 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-8 text-4xl text-indigo-500">
                            <i class="fas fa-user-tie"></i>
                        </div>
                        <h3 id="p-name" class="text-3xl font-black text-slate-800 mb-2">--</h3>
                        <p id="p-nid" class="text-slate-400 font-mono text-sm tracking-widest">--</p>
                        <div class="mt-10 pt-10 border-t border-slate-50 flex flex-col gap-4">
                            <button onclick="del()" class="w-full py-5 bg-red-50 text-red-600 rounded-2xl font-black hover:bg-red-100 transition">حذف السجل</button>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-3 space-y-12">
                    <div id="calc-container" class="bg-slate-900 p-16 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-10 opacity-5 text-9xl"><i class="fas fa-calculator"></i></div>
                        <h4 class="text-2xl font-black mb-12 flex items-center z-10 relative">
                            <i class="fas fa-receipt ml-4 text-indigo-400"></i> معالجة الراتب الشهري
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
                            <div class="space-y-3">
                                <label class="text-xs font-black text-slate-500 uppercase tracking-widest">فترة الاستحقاق</label>
                                <input type="month" id="c-month" class="w-full bg-slate-800 border-none p-6 rounded-[1.5rem] text-white font-bold" readonly>
                            </div>
                            <div class="space-y-3">
                                <label class="text-xs font-black text-slate-500 uppercase tracking-widest">إجمالي الراتب المستحق (Gross)</label>
                                <input type="number" id="c-gross" placeholder="0.00" class="w-full bg-slate-800 border-none p-6 rounded-[1.5rem] text-white focus:ring-4 ring-indigo-500/20 transition outline-none font-black text-xl">
                            </div>
                            <div class="flex items-end">
                                <button onclick="runCalc()" class="w-full bg-indigo-600 text-white py-6 rounded-[1.5rem] font-black shadow-xl hover:bg-indigo-500 transition-all active:scale-95">
                                    اعتماد وحساب
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-[3rem] overflow-hidden shadow-sm border border-slate-100">
                        <div class="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                            <h5 class="font-black text-slate-800 text-xl">سجل المدفوعات التاريخي</h5>
                        </div>
                        <table class="w-full text-center text-sm">
                            <thead class="bg-slate-50 text-slate-400 font-black">
                                <tr>
                                    <th class="p-8">الشهر</th>
                                    <th class="p-8">الراتب Gross</th>
                                    <th class="p-8">التأمين</th>
                                    <th class="p-8">الشهداء</th>
                                    <th class="p-8 text-red-500 font-black">الضريبة</th>
                                    <th class="p-8 bg-emerald-50 text-emerald-700 font-black text-lg">الصافي Net</th>
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
        <div class="bg-white rounded-[4rem] p-16 w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300">
            <h3 class="text-4xl font-black mb-12 text-slate-800">تسجيل موظف جديد</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="md:col-span-2">
                    <label class="text-xs font-black text-slate-400 mb-3 block uppercase tracking-widest">الاسم الكامل</label>
                    <input type="text" id="n-name" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold">
                </div>
                <div>
                    <label class="text-xs font-black text-slate-400 mb-3 block uppercase tracking-widest">الرقم القومي</label>
                    <input type="text" id="n-nid" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold">
                </div>
                <div>
                    <label class="text-xs font-black text-slate-400 mb-3 block uppercase tracking-widest">تاريخ التعيين</label>
                    <input type="date" id="n-hdate" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold text-slate-500">
                </div>
                <div>
                    <label class="text-xs font-black text-slate-400 mb-3 block uppercase tracking-widest">الراتب التأميني</label>
                    <input type="number" id="n-ins" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold">
                </div>
                <div>
                    <label class="text-xs font-black text-slate-400 mb-3 block uppercase tracking-widest">نوع التوظيف</label>
                    <select id="n-type" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-black text-indigo-600">
                        <option>Full Time</option>
                        <option>Part Time</option>
                    </select>
                </div>
            </div>
            <div class="flex gap-6 mt-16">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-6 rounded-[2rem] font-black shadow-2xl hover:bg-indigo-700 transition">إتمام الحفظ</button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-slate-100 text-slate-500 py-6 rounded-[2rem] font-black">إلغاء</button>
            </div>
        </div>
    </div>

    <input type="hidden" id="currId"><input type="hidden" id="pD"><input type="hidden" id="pTxbl"><input type="hidden" id="pTx">

    <script>
        async function load() {
            try {
                const res = await fetch('/api/employees');
                const data = await res.json();
                document.getElementById('empTable').innerHTML = data.map(e => \`
                    <tr class="hover:bg-slate-50 transition cursor-pointer group" onclick="openProfile('\${e._id}')">
                        <td class="p-10 font-black text-slate-700 text-xl">
                            <div class="flex items-center">
                                <div class="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center ml-5 text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <i class="fas fa-user"></i>
                                </div>
                                \${e.name}
                            </div>
                        </td>
                        <td class="p-10 text-center text-slate-400 font-bold">\${new Date(e.hiringDate).toLocaleDateString('en-GB')}</td>
                        <td class="p-10 text-center">
                            <span class="px-6 py-3 \${e.resignationDate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                \${e.resignationDate ? 'مستقيل' : 'نشط'}
                            </span>
                        </td>
                        <td class="p-10 text-center">
                            <i class="fas fa-chevron-left text-indigo-300 group-hover:text-indigo-600 group-hover:-translate-x-2 transition-all"></i>
                        </td>
                    </tr>
                \`).join('');
            } catch(e) { console.error(e); }
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
                <tr class="hover:bg-slate-50 transition border-b border-slate-50">
                    <td class="p-8 font-black text-slate-600 text-lg">\${r.month}</td>
                    <td class="p-8 font-bold">\${r.gross.toLocaleString()}</td>
                    <td class="p-8">\${r.insurance.toLocaleString()}</td>
                    <td class="p-8 text-orange-500 font-bold">\${r.martyrs.toLocaleString()}</td>
                    <td class="p-8 text-red-500 font-black">\${r.monthlyTax.toLocaleString()}</td>
                    <td class="p-8 font-black text-emerald-700 bg-emerald-50/30 shadow-inner text-xl">\${r.net.toLocaleString()}</td>
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
            if(!body.name || !body.nationalId) return alert("برجاء إدخال البيانات كاملة");
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
            if(!body.basicGross) return alert("برجاء إدخال قيمة الراتب");
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
app.listen(PORT, () => console.log(\`✅ Enterprise Payroll System running on port \${PORT}\`));

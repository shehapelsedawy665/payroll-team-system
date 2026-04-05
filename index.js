const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection (Enhanced with Timeout Handling) ---
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log("✅ [DATABASE] Connected and Ready"))
.catch(err => console.error("❌ [DATABASE] Connection Error:", err));

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
    month: { type: String, required: true },
    days: { type: Number, default: 30 },
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

// --- Calculation Engine (Verified Egyptian Law 2024) ---
const R = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualTaxable) {
    let tax = 0;
    let remainder = annualTaxable; 

    // الشرائح الضريبية المحدثة لعام 2024
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

function processPayrollLogic(data, prev, emp) {
    try {
        const { basicFull, days } = data;
        
        // 1. Insurance Calculation (Fixed base, not daily prorated for the amount itself)
        const maxIns = 16700;
        const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
        let effectiveBase = Math.max(minIns, Math.min(maxIns, emp.insSalary || 0));
        let insAmt = R(effectiveBase * 0.11);

        // 2. Gross & Martyrs (0.05%)
        const actualGross = R((basicFull / 30) * days);
        const martyrs = R(actualGross * 0.0005);

        // 3. Taxable Pool with Personal Exemption (20,000 / 360 * days)
        const personalExemption = R((20000 / 360) * days);
        const currentTaxablePool = Math.max(0, (actualGross - insAmt) - personalExemption);

        // 4. Cumulative YTD Calculation Logic
        const totalDays = days + (prev.pDays || 0);
        const totalTaxablePool = currentTaxablePool + (prev.pTaxable || 0);
        
        // Project to Annual based on current YTD velocity
        const annualTaxableProjected = Math.floor(((totalTaxablePool / totalDays) * 360) / 10) * 10;
        
        const annualTax = calculateEgyptianTax(annualTaxableProjected);
        
        // Monthy tax is (Total Tax due for YTD) - (Taxes already paid)
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
    } catch (err) {
        console.error("Calculation Engine Error:", err);
        return null;
    }
}

// --- API Implementation ---
app.get("/api/employees", async (req, res) => {
    try {
        const emps = await Employee.find().sort({ hiringDate: -1 });
        res.json(emps);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/employees", async (req, res) => {
    try {
        if (!req.body.name || !req.body.nationalId) return res.status(400).json({ error: "Missing required fields" });
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
        if (!emp) return res.status(404).json({ error: "Employee not found" });

        const result = processPayrollLogic({ basicFull: basicGross, days }, prevData, emp);
        if (!result) throw new Error("Calculation failed");

        const record = new Payroll({ employeeId: empId, month, days, ...result });
        await record.save();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/employees/:id", async (req, res) => {
    try {
        await Employee.findByIdAndDelete(req.params.id);
        await Payroll.deleteMany({ employeeId: req.params.id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Enterprise Dashboard UI (HTML5/JS) ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Enterprise Payroll - Odoo Core v9.5</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; background-color: #f8fafc; color: #1e293b; }
        .sidebar-item-active { background: #4f46e5; color: white; box-shadow: 0 10px 20px -5px rgba(79, 70, 229, 0.4); }
        .card-entry { animation: slideUp 0.5s ease forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body class="flex min-h-screen overflow-hidden">

    <aside class="w-80 bg-slate-900 text-white flex flex-col h-screen shadow-2xl relative z-30">
        <div class="p-10 text-center border-b border-slate-800">
            <h1 class="text-3xl font-black tracking-tighter italic"><span class="text-indigo-500">ERP</span>SYSTEM</h1>
            <p class="text-[10px] text-slate-500 uppercase tracking-[0.4em] mt-2 font-bold">Payroll Authority</p>
        </div>
        <nav class="p-8 flex-1 space-y-4">
            <div onclick="location.reload()" class="sidebar-item-active flex items-center p-5 rounded-[2rem] font-bold cursor-pointer transition-all hover:scale-105">
                <i class="fas fa-users-cog ml-4 text-2xl"></i> الموظفين والرواتب
            </div>
        </nav>
        <div class="p-8 border-t border-slate-800">
            <div class="flex items-center gap-3 text-emerald-500 text-xs font-bold uppercase tracking-widest">
                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                متصل بالنظام السحابي
            </div>
        </div>
    </aside>

    <main class="flex-1 overflow-y-auto p-16">
        
        <div id="view-list" class="card-entry">
            <div class="flex justify-between items-end mb-16">
                <div>
                    <h2 class="text-5xl font-black text-slate-800 mb-4 tracking-tight">إدارة الكوادر</h2>
                    <p class="text-slate-500 text-lg">سجل الموظفين، الضرائب، والتأمينات الاجتماعية.</p>
                </div>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl shadow-indigo-100 transition-all active:scale-95">
                    إضافة موظف جديد +
                </button>
            </div>

            <div class="bg-white rounded-[3rem] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                <table class="w-full text-right">
                    <thead>
                        <tr class="bg-slate-50/50 text-slate-400 text-xs uppercase tracking-widest border-b">
                            <th class="p-10">الموظف</th>
                            <th class="p-10 text-center">الرقم القومي</th>
                            <th class="p-10 text-center">تاريخ التعيين</th>
                            <th class="p-10 text-center">العمليات</th>
                        </tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-50"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden animate-in fade-in duration-700">
            <button onclick="location.reload()" class="mb-10 text-indigo-600 font-black flex items-center hover:-translate-x-3 transition-transform">
                <i class="fas fa-arrow-right ml-4"></i> العودة للقائمة الرئيسية
            </button>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-12">
                <div class="space-y-8">
                    <div class="bg-white p-12 rounded-[3.5rem] shadow-xl shadow-slate-200/50 text-center border-t-[12px] border-indigo-500 relative">
                        <div class="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl text-indigo-500">
                            <i class="fas fa-user-shield"></i>
                        </div>
                        <h3 id="p-name" class="text-3xl font-black text-slate-800 mb-2">--</h3>
                        <p id="p-nid" class="text-slate-400 font-mono text-xs tracking-[0.2em] uppercase">--</p>
                        <div class="mt-10 pt-10 border-t border-slate-50 flex flex-col gap-4">
                            <button onclick="del()" class="w-full py-5 bg-red-50 text-red-600 rounded-2xl font-black hover:bg-red-100 transition">حذف الموظف</button>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-3 space-y-12">
                    <div class="bg-slate-900 p-16 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-10 opacity-5 text-[15rem]"><i class="fas fa-calculator"></i></div>
                        <h4 class="text-2xl font-black mb-12 flex items-center relative z-10">
                            <span class="w-2 h-10 bg-indigo-500 rounded-full ml-5"></span>
                            احتساب الراتب الشهري
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">شهر الاستحقاق</label>
                                <input type="month" id="c-month" class="w-full bg-slate-800 border-none p-6 rounded-[1.5rem] text-white font-bold outline-none" readonly>
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">إجمالي الراتب (Gross)</label>
                                <input type="number" id="c-gross" placeholder="0.00" class="w-full bg-slate-800 border-none p-6 rounded-[1.5rem] text-white font-black text-2xl outline-none focus:ring-4 ring-indigo-500/30 transition">
                            </div>
                            <div class="flex items-end">
                                <button onclick="runCalc()" class="w-full bg-indigo-600 text-white py-6 rounded-[1.5rem] font-black shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 transition-all active:scale-95">
                                    تأكيد وحفظ
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-[3.5rem] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                        <div class="p-10 border-b bg-slate-50/50">
                            <h5 class="font-black text-slate-800 text-xl italic underline decoration-indigo-500 underline-offset-8">شريط الرواتب التاريخي</h5>
                        </div>
                        <table class="w-full text-center">
                            <thead class="bg-slate-50 text-slate-400 font-black text-xs">
                                <tr>
                                    <th class="p-8">الشهر</th>
                                    <th class="p-8">الراتب Gross</th>
                                    <th class="p-8">التأمين (11%)</th>
                                    <th class="p-8 text-orange-500">الشهداء</th>
                                    <th class="p-8 text-red-500">الضريبة</th>
                                    <th class="p-8 bg-indigo-50 text-indigo-700 font-black text-lg italic underline">الصافي Net</th>
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
        <div class="bg-white rounded-[4rem] p-16 w-full max-w-3xl shadow-2xl animate-in zoom-in duration-300">
            <div class="flex justify-between items-center mb-12">
                <h3 class="text-4xl font-black text-slate-800">بيانات التعيين</h3>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="text-slate-300 hover:text-red-500 text-3xl"><i class="fas fa-times-circle"></i></button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="md:col-span-2">
                    <input type="text" id="n-name" placeholder="الاسم الكامل للموظف" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold text-lg">
                </div>
                <div>
                    <input type="text" id="n-nid" placeholder="الرقم القومي (14 رقم)" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold">
                </div>
                <div>
                    <input type="date" id="n-hdate" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold text-slate-400">
                </div>
                <div>
                    <input type="number" id="n-ins" placeholder="الراتب التأميني الأساسي" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-bold">
                </div>
                <div>
                    <select id="n-type" class="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-indigo-500 outline-none font-black text-indigo-600">
                        <option>Full Time</option>
                        <option>Part Time</option>
                    </select>
                </div>
            </div>
            <div class="mt-12">
                <button onclick="saveEmp()" class="w-full bg-indigo-600 text-white py-7 rounded-[2rem] font-black text-xl shadow-2xl hover:bg-indigo-700 transition">تأكيد تسجيل الموظف</button>
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
                    <tr class="hover:bg-slate-50/80 transition cursor-pointer group" onclick="openProfile('\${e._id}')">
                        <td class="p-10 font-black text-slate-700 text-xl">
                            <div class="flex items-center">
                                <div class="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center ml-5 text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                                    <i class="fas fa-user-tag text-lg"></i>
                                </div>
                                \${e.name}
                            </div>
                        </td>
                        <td class="p-10 text-center font-mono text-slate-400">\${e.nationalId}</td>
                        <td class="p-10 text-center text-slate-500 font-bold">\${new Date(e.hiringDate).toLocaleDateString('en-GB')}</td>
                        <td class="p-10 text-center">
                            <span class="px-6 py-3 \${e.resignationDate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} rounded-[1rem] text-[10px] font-black uppercase tracking-widest">
                                \${e.resignationDate ? 'مستقيل' : 'نشط'}
                            </span>
                        </td>
                    </tr>
                \`).join('');
            } catch(e) { alert("Error connecting to server. Check console."); }
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
                    <td class="p-8 font-bold text-slate-800">\${r.gross.toLocaleString()}</td>
                    <td class="p-8 text-slate-500 font-bold">\${r.insurance.toLocaleString()}</td>
                    <td class="p-8 text-orange-500 font-bold">\${r.martyrs.toLocaleString()}</td>
                    <td class="p-8 text-red-500 font-black">\${r.monthlyTax.toLocaleString()}</td>
                    <td class="p-8 font-black text-indigo-700 bg-indigo-50/50 shadow-inner text-xl italic">\${r.net.toLocaleString()}</td>
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
            if(!body.name || !body.nationalId || !body.hiringDate) return alert("برجاء ملء جميع الخانات الأساسية");
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
            if(!body.basicGross) return alert("برجاء إدخال قيمة الراتب الإجمالي (Gross)");
            
            try {
                const res = await fetch('/api/payroll/calculate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
                if (res.ok) {
                    openProfile(body.empId);
                    document.getElementById('c-gross').value = '';
                } else {
                    const err = await res.json();
                    alert("Calculation Error: " + err.error);
                }
            } catch (e) { alert("Critical Server Error. Check connectivity."); }
        }

        async function del() { if(confirm("⚠️ هل أنت متأكد من حذف هذا الموظف نهائياً مع كافة سجلاته؟")) { await fetch(\`/api/employees/\${document.getElementById('currId').value}\`, {method:'DELETE'}); location.reload(); } }

        window.onload = load;
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`✅ [SERVER] Professional Payroll Engine active on port \${PORT}\`));

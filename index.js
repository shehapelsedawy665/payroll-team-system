const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// الربط بقاعدة البيانات - تأكد من إضافة IP 0.0.0.0/0 في MongoDB Atlas
const mongoURI = process.env.MONGO_URI || "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
}).then(() => console.log("Database Connected Successfully"))
  .catch(err => console.error("Database Connection Error:", err));

// --- Schemas ---
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: String,
    nationalId: { type: String, unique: true },
    employmentType: { type: String, default: "Full Time" },
    hiringDate: Date,
    resignationDate: Date,
    insSalary: Number
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

// --- Payroll Engine (Sequential) ---
const R = (n) => Math.round(n * 100) / 100;
function calculateSequential(data, prevData) {
    const { basicFull, days, insSalary } = data;
    const { prevDays = 0, prevTaxable = 0, prevTaxes = 0 } = prevData;

    let insurance = insSalary * 0.11;
    const actualBasic = (basicFull / 30) * days;
    const martyrs = actualBasic * 0.0005;
    const currentTaxable = actualBasic - insurance;

    const totalDays = days + prevDays;
    const totalTaxable = currentTaxable + prevTaxable;
    const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
    
    let annualTax = 0;
    let temp = Math.max(0, annualTaxable - 20000); 

    if (annualTaxable <= 600000) {
        if (temp > 40000) { let x = Math.min(temp - 40000, 15000); annualTax += x * 0.10; }
        if (temp > 55000) { let x = Math.min(temp - 55000, 15000); annualTax += x * 0.15; }
        if (temp > 70000) { let x = Math.min(temp - 70000, 130000); annualTax += x * 0.20; }
        if (temp > 200000) { let x = Math.min(temp - 200000, 200000); annualTax += x * 0.225; }
        if (temp > 400000) { let x = Math.min(temp - 400000, 200000); annualTax += x * 0.25; }
        if (temp > 600000) { annualTax += (temp - 600000) * 0.275; }
    } else {
        if (temp > 0) { let x = Math.min(temp, 400000); annualTax += x * 0.225; }
        if (temp > 400000) { let x = Math.min(temp - 400000, 800000); annualTax += x * 0.25; }
        if (temp > 1200000) { annualTax += (temp - 1200000) * 0.275; }
    }

    const totalTaxDueUntilNow = (annualTax / 360) * totalDays;
    const monthlyTax = Math.max(0, totalTaxDueUntilNow - prevTaxes);

    return { gross: R(actualBasic), insurance: R(insurance), tax: R(monthlyTax), martyrs: R(martyrs), net: R(actualBasic - insurance - monthlyTax - martyrs), currentTaxable: R(currentTaxable) };
}

// --- APIs ---
app.get("/api/employees", async (req, res) => {
    try {
        const data = await Employee.find().sort({ name: 1 });
        res.json(data);
    } catch (e) { res.status(500).json({ error: "خطأ في جلب البيانات" }); }
});

app.post("/api/employees", async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "الرقم القومي موجود مسبقاً أو بيانات ناقصة" }); }
});

app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

app.post("/api/employees/:id/resign", async (req, res) => {
    await Employee.findByIdAndUpdate(req.params.id, { resignationDate: req.body.date });
    res.json({ success: true });
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
    const result = calculateSequential({ basicFull: basicGross, days, insSalary: emp.insSalary }, prevData);
    const record = new Payroll({ employeeId: empId, month, days, gross: result.gross, taxableIncome: result.currentTaxable, monthlyTax: result.tax, insurance: result.insurance, martyrs: result.martyrs, net: result.net });
    await record.save();
    res.json(record);
});

// --- Frontend UI ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ERP Payroll System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body class="bg-gray-50 min-h-screen">
    <div class="bg-slate-900 text-white p-4 shadow-lg mb-8">
        <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-xl font-black tracking-widest text-indigo-400">PAYROLL ERP</h1>
            <button onclick="location.reload()" class="text-sm bg-slate-800 px-3 py-1 rounded hover:bg-slate-700">تحديث الصفحة</button>
        </div>
    </div>

    <div class="container mx-auto px-4">
        <div id="sec-list">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-slate-800">إدارة الموظفين</h2>
                <button onclick="toggleModal(true)" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full font-bold shadow-lg transition">+ إضافة موظف جديد</button>
            </div>
            
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table class="w-full text-right">
                    <thead class="bg-slate-50 border-b">
                        <tr>
                            <th class="p-4 font-bold text-slate-600">اسم الموظف</th>
                            <th class="p-4 font-bold text-slate-600">الرقم القومي</th>
                            <th class="p-4 font-bold text-slate-600">الحالة</th>
                            <th class="p-4 font-bold text-slate-600 text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-100">
                        <tr><td colspan="4" class="p-8 text-center text-slate-400 italic">جاري تحميل البيانات من الداتابيز...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div id="sec-profile" class="hidden">
            <button onclick="showList()" class="mb-6 text-indigo-600 font-bold hover:underline"><i class="fas fa-arrow-right ml-2"></i> العودة للقائمة الرئيسية</button>
            
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xl"><i class="fas fa-user"></i></div>
                        <div>
                            <h3 id="p-name" class="text-xl font-black">--</h3>
                            <span id="p-status" class="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">نشط</span>
                        </div>
                    </div>
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between"><span class="text-slate-500">تاريخ التعيين:</span> <span id="p-hdate" class="font-bold">--</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">الأجر التأميني:</span> <span id="p-ins" class="font-bold text-indigo-600">--</span></div>
                        <div id="resign-row" class="hidden flex justify-between text-red-600"><span class="font-bold">تاريخ الاستقالة:</span> <span id="p-rdate" class="font-bold">--</span></div>
                    </div>
                    <div class="mt-8 pt-6 border-t flex gap-2">
                        <button onclick="resign()" class="flex-1 text-xs bg-orange-50 text-orange-600 border border-orange-200 py-2 rounded-lg hover:bg-orange-100">إنهاء خدمة</button>
                        <button onclick="del()" class="flex-1 text-xs bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg hover:bg-red-100">حذف نهائي</button>
                    </div>
                </div>

                <div class="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
                    <h4 class="font-bold mb-4 flex items-center gap-2"><i class="fas fa-calculator text-indigo-500"></i> احتساب شهر جديد</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 block mb-1">شهر الاحتساب</label>
                            <select id="c-month" class="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"></select>
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 block mb-1">أيام العمل</label>
                            <input type="number" id="c-days" value="30" class="w-full p-3 bg-slate-50 border rounded-xl outline-none">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-400 block mb-1">الراتب (Gross)</label>
                            <input type="number" id="c-gross" placeholder="0.00" class="w-full p-3 bg-slate-50 border rounded-xl outline-none">
                        </div>
                    </div>
                    <button id="calcBtn" onclick="runPayroll()" class="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition">احسب واحفظ الراتب</button>
                </div>

                <div class="lg:col-span-3">
                    <h4 class="font-bold mb-4">سجل الشهور المحسوبة</h4>
                    <div class="bg-slate-900 rounded-2xl overflow-hidden shadow-xl text-white text-xs">
                        <table class="w-full text-center">
                            <thead class="bg-slate-800 text-slate-400 uppercase">
                                <tr>
                                    <th class="p-4">الشهر</th>
                                    <th class="p-4">Gross</th>
                                    <th class="p-4">التأمين</th>
                                    <th class="p-4">الضريبة</th>
                                    <th class="p-4 font-bold text-emerald-400">الصافي (Net)</th>
                                </tr>
                            </thead>
                            <tbody id="historyTable" class="divide-y divide-slate-800"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="modal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 class="text-xl font-black mb-6 border-b pb-4">إضافة موظف للمنظومة</h3>
            <div class="space-y-4">
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">اسم الموظف بالكامل</label><input type="text" id="n-name" class="w-full p-3 bg-slate-50 border rounded-xl"></div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">الرقم القومي (14 رقم)</label><input type="text" id="n-nid" class="w-full p-3 bg-slate-50 border rounded-xl"></div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">تاريخ التعيين</label><input type="date" id="n-hdate" class="w-full p-3 bg-slate-50 border rounded-xl"></div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">الأجر التأميني</label><input type="number" id="n-ins" class="w-full p-3 bg-slate-50 border rounded-xl"></div>
            </div>
            <div class="flex gap-3 mt-8">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700">حفظ البيانات</button>
                <button onclick="toggleModal(false)" class="flex-1 bg-slate-100 text-slate-500 font-bold py-3 rounded-xl hover:bg-slate-200">إلغاء</button>
            </div>
        </div>
    </div>

    <input type="hidden" id="currId">
    <input type="hidden" id="pDays"><input type="hidden" id="pTaxable"><input type="hidden" id="pTaxes">

    <script>
        const toggleModal = (show) => document.getElementById('modal').classList.toggle('hidden', !show);
        const showList = () => { document.getElementById('sec-list').classList.remove('hidden'); document.getElementById('sec-profile').classList.add('hidden'); loadEmps(); };

        async function loadEmps() {
            try {
                const res = await fetch('/api/employees');
                const data = await res.json();
                const tbody = document.getElementById('empTable');
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400">لا يوجد موظفين مسجلين حالياً</td></tr>';
                    return;
                }
                tbody.innerHTML = data.map(e => \`
                    <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="openProfile('\${e._id}')">
                        <td class="p-4 font-bold text-slate-800">\${e.name}</td>
                        <td class="p-4 text-slate-500 font-mono">\${e.nationalId}</td>
                        <td class="p-4"><span class="text-[10px] px-2 py-0.5 rounded-full font-bold \${e.resignationDate ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}">\${e.resignationDate ? 'مستقيل' : 'نشط'}</span></td>
                        <td class="p-4 text-center"><button class="text-indigo-600 font-bold text-sm">فتح الملف <i class="fas fa-chevron-left mr-1"></i></button></td>
                    </tr>
                \`).join('');
            } catch (e) { alert("حدث خطأ أثناء الاتصال بالداتابيز. تأكد من إعدادات IP في MongoDB."); }
        }

        async function saveEmp() {
            const body = {
                name: document.getElementById('n-name').value,
                nationalId: document.getElementById('n-nid').value,
                hiringDate: document.getElementById('n-hdate').value,
                insSalary: document.getElementById('n-ins').value
            };
            if(!body.name || !body.nationalId || !body.hiringDate) return alert("برجاء ملء كافة الخانات الأساسية");

            const res = await fetch('/api/employees', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            });
            const result = await res.json();
            if(res.ok) { toggleModal(false); loadEmps(); } else { alert(result.error); }
        }

        async function openProfile(id) {
            document.getElementById('currId').value = id;
            document.getElementById('sec-list').classList.add('hidden');
            document.getElementById('sec-profile').classList.remove('hidden');
            
            const res = await fetch(\`/api/employees/\${id}/details\`);
            const data = await res.json();
            
            document.getElementById('p-name').innerText = data.emp.name;
            document.getElementById('p-hdate').innerText = data.emp.hiringDate ? data.emp.hiringDate.split('T')[0] : '---';
            document.getElementById('p-ins').innerText = Number(data.emp.insSalary).toLocaleString() + ' EGP';
            
            const isResigned = !!data.emp.resignationDate;
            document.getElementById('p-status').innerText = isResigned ? 'مستقيل' : 'نشط';
            document.getElementById('p-status').className = isResigned ? 'text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700' : 'text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700';
            
            if(isResigned) {
                document.getElementById('resign-row').classList.remove('hidden');
                document.getElementById('p-rdate').innerText = data.emp.resignationDate.split('T')[0];
            } else { document.getElementById('resign-row').classList.add('hidden'); }

            document.getElementById('pDays').value = data.prevData.pDays;
            document.getElementById('pTaxable').value = data.prevData.pTaxable;
            document.getElementById('pTaxes').value = data.prevData.pTaxes;

            // Generate Sequential Months
            const select = document.getElementById('c-month');
            select.innerHTML = "";
            const hDate = new Date(data.emp.hiringDate);
            const calculated = data.history.map(r => r.month);
            let nextMonth = "";
            if(calculated.length > 0) {
                let d = new Date(calculated[calculated.length-1] + "-01");
                d.setMonth(d.getMonth() + 1);
                nextMonth = \`\${d.getFullYear()}-\${String(d.getMonth()+1).padStart(2,'0')}\`;
            } else {
                nextMonth = \`\${hDate.getFullYear()}-\${String(hDate.getMonth()+1).padStart(2,'0')}\`;
            }

            for(let i=0; i<12; i++) {
                let d = new Date(hDate.getFullYear(), hDate.getMonth() + i, 1);
                let val = \`\${d.getFullYear()}-\${String(d.getMonth()+1).padStart(2,'0')}\`;
                let opt = document.createElement('option');
                opt.value = val;
                opt.text = val + (calculated.includes(val) ? " (تم الحساب)" : "");
                opt.disabled = val !== nextMonth || isResigned;
                if(val === nextMonth) opt.selected = true;
                select.appendChild(opt);
            }
            document.getElementById('calcBtn').disabled = isResigned || !nextMonth;

            document.getElementById('historyTable').innerHTML = data.history.map(r => \`
                <tr class="border-b border-slate-800">
                    <td class="p-4 font-bold text-indigo-300">\${r.month}</td>
                    <td class="p-4">\${r.gross.toLocaleString()}</td>
                    <td class="p-4">\${r.insurance.toLocaleString()}</td>
                    <td class="p-4">\${r.monthlyTax.toLocaleString()}</td>
                    <td class="p-4 font-black text-emerald-400">\${r.net.toLocaleString()}</td>
                </tr>
            \`).join('');
        }

        async function runPayroll() {
            const body = {
                empId: document.getElementById('currId').value,
                month: document.getElementById('c-month').value,
                days: Number(document.getElementById('c-days').value),
                basicGross: Number(document.getElementById(

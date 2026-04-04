const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة البيانات
const mongoURI = process.env.MONGO_URI || "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log("ERP DB Connected"))
    .catch(err => console.log("DB Error:", err));

// --- Schemas ---
const Employee = mongoose.model("Employee", new mongoose.Schema({
    name: String,
    nationalId: { type: String, unique: true },
    employmentType: { type: String, default: "Full Time" },
    hiringDate: Date,
    resignationDate: Date,
    insSalary: Number
}));

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
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

// --- Payroll Engine ---
const R = (n) => Math.round(n * 100) / 100;

function calculateSequential(data, prevData) {
    const { basicFull, days, insSalary } = data;
    const { prevDays, prevTaxable, prevTaxes } = prevData;

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

    return {
        gross: R(actualBasic),
        insurance: R(insurance),
        tax: R(monthlyTax),
        martyrs: R(martyrs),
        net: R(actualBasic - insurance - monthlyTax - martyrs),
        currentTaxable: R(currentTaxable)
    };
}

// --- APIs ---
app.get("/api/employees", async (req, res) => {
    res.json(await Employee.find().sort({ name: 1 }).lean());
});

app.post("/api/employees", async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.json({ success: true, emp });
    } catch(e) { res.status(400).json({ error: "خطأ في الحفظ" }); }
});

// مسح الموظف نهائياً من MongoDB
app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

// إنهاء خدمة (استقالة)
app.post("/api/employees/:id/resign", async (req, res) => {
    const { date } = req.body;
    await Employee.findByIdAndUpdate(req.params.id, { resignationDate: date });
    res.json({ success: true });
});

app.get("/api/employees/:id/payroll-details", async (req, res) => {
    const emp = await Employee.findById(req.params.id).lean();
    const history = await Payroll.find({ employeeId: emp._id }).sort({ month: 1 }).lean();
    
    let pDays = 0, pTaxable = 0, pTaxes = 0;
    history.forEach(r => { 
        pDays += r.days; 
        pTaxable += r.taxableIncome; 
        pTaxes += r.monthlyTax; 
    });

    res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
});

app.post("/api/payroll/calculate", async (req, res) => {
    const { empId, month, days, basicGross, prevData } = req.body;
    const emp = await Employee.findById(empId);

    const result = calculateSequential({ basicFull: basicGross, days, insSalary: emp.insSalary }, prevData);

    const record = new Payroll({
        employeeId: emp._id, month, days,
        gross: result.gross, taxableIncome: result.currentTaxable,
        monthlyTax: result.tax, insurance: result.insurance,
        martyrs: result.martyrs, net: result.net
    });
    await record.save();
    res.json(record);
});

// --- UI Dashboard ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Professional ERP Payroll</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body class="bg-slate-50 flex min-h-screen text-slate-800">
    
    <div class="w-64 bg-indigo-900 text-white fixed h-full p-6 shadow-xl z-10">
        <h1 class="text-2xl font-black mb-8 text-indigo-300 border-b border-indigo-700 pb-4">ERP SYSTEM</h1>
        <nav class="space-y-3">
            <button onclick="showSection('employees')" class="w-full text-right p-3 rounded-lg bg-indigo-800 font-bold"><i class="fas fa-users ml-3"></i> إدارة الموظفين</button>
        </nav>
    </div>

    <div class="mr-64 w-full p-8">
        <div id="sec-employees">
            <div class="flex justify-between items-center mb-8">
                <h2 class="text-3xl font-extrabold text-slate-800">سجل الموظفين</h2>
                <button onclick="openEmpModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-md">+ موظف جديد</button>
            </div>
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table class="w-full text-right">
                    <thead class="bg-slate-100 border-b border-slate-200">
                        <tr>
                            <th class="p-4 font-bold">الاسم</th>
                            <th class="p-4 font-bold">الرقم القومي</th>
                            <th class="p-4 font-bold">حالة الموظف</th>
                            <th class="p-4 font-bold">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>

        <div id="sec-profile" class="hidden">
            <div class="flex justify-between mb-6">
                <button onclick="showSection('employees')" class="text-indigo-600 font-bold hover:underline"><i class="fas fa-arrow-right ml-2"></i> عودة للقائمة</button>
                <div>
                    <button onclick="resignEmployee()" class="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-bold hover:bg-orange-200 ml-2"><i class="fas fa-user-slash ml-1"></i> إنهاء خدمة</button>
                    <button onclick="deleteEmployee()" class="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold hover:bg-red-200"><i class="fas fa-trash ml-1"></i> حذف نهائي</button>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 class="text-xl font-bold mb-4 border-b pb-2 text-indigo-800" id="p-name">--</h3>
                    <div class="space-y-2 text-sm">
                        <p><span class="font-bold text-slate-500">الرقم القومي:</span> <span id="p-nid">--</span></p>
                        <p><span class="font-bold text-slate-500">نوع العمل:</span> <span id="p-type">--</span></p>
                        <p><span class="font-bold text-slate-500">تاريخ التعيين:</span> <span id="p-hdate" class="text-blue-600 font-bold">--</span></p>
                        <p><span class="font-bold text-slate-500">تاريخ الاستقالة:</span> <span id="p-rdate" class="text-red-600 font-bold">--</span></p>
                        <p><span class="font-bold text-slate-500">الأجر التأميني:</span> <span id="p-ins" class="font-bold text-green-600">--</span></p>
                    </div>
                </div>

                <div class="col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-indigo-200 border-t-4 border-t-indigo-500">
                    <h3 class="text-xl font-bold mb-4">احتساب راتب (Sequential Logic)</h3>
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">شهر الاحتساب</label>
                            <select id="c-month" class="w-full p-2 border rounded-lg bg-slate-50 outline-none"></select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">أيام العمل</label>
                            <input type="number" id="c-days" value="30" class="w-full p-2 border rounded-lg bg-slate-50">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">Gross Salary</label>
                            <input type="number" id="c-gross" class="w-full p-2 border rounded-lg bg-slate-50">
                        </div>
                    </div>
                    <button id="calcBtn" onclick="runPayroll()" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition shadow-md"><i class="fas fa-calculator ml-2"></i> احسب واحفظ الراتب</button>
                    <input type="hidden" id="prevDays"><input type="hidden" id="prevTaxable"><input type="hidden" id="prevTaxes"><input type="hidden" id="currentEmpId">
                </div>
            </div>

            <h3 class="text-xl font-bold mb-4">سجل الرواتب المحفوظة</h3>
            <div class="bg-slate-800 text-white rounded-2xl overflow-hidden shadow-lg">
                <table class="w-full text-center">
                    <thead class="bg-slate-900 text-slate-400 text-sm">
                        <tr>
                            <th class="p-4">الشهر</th>
                            <th class="p-4">الأيام</th>
                            <th class="p-4">Gross</th>
                            <th class="p-4">Insurance</th>
                            <th class="p-4">Tax</th>
                            <th class="p-4">Martyr</th>
                            <th class="p-4 font-bold text-emerald-400">NET</th>
                        </tr>
                    </thead>
                    <tbody id="historyTable" class="divide-y divide-slate-700"></tbody>
                </table>
            </div>
        </div>
    </div>

    <div id="addEmpModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div class="bg-white rounded-2xl w-[600px] p-8 shadow-2xl">
            <h3 class="text-2xl font-bold mb-6 border-b pb-4">إضافة موظف</h3>
            <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2"><label class="text-xs font-bold text-slate-500">الاسم</label><input type="text" id="n-name" class="w-full p-3 bg-slate-50 border rounded-xl"></div>
                <div><label class="text-xs font-bold text-slate-500">الرقم القومي</label><input type="text" id="n-nid" class="w-full p-3 bg-slate-50 border rounded-xl"></div>
                <div><label class="text-xs font-bold text-slate-500">نوع العمل</label><select id="n-type" class="w-full p-3 bg-slate-50 border rounded-xl"><option>Full Time</option><option>Part Time</option></select></div>
                <div><label class="text-xs font-bold text-slate-500">تاريخ التعيين</label><input type="date" id="n-hdate" class="w-full p-3 bg-slate-50 border rounded-xl"></div>
                <div><label class="text-xs font-bold text-slate-500">الأجر التأميني</label><input type="number" id="n-ins" class="w-full p-3 bg-slate-50 border rounded-xl"></div>
            </div>
            <div class="flex gap-4 mt-8">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold">حفظ</button>
                <button onclick="closeEmpModal()" class="flex-1 bg-slate-200 text-slate-600 py-3 rounded-xl font-bold">إلغاء</button>
            </div>
        </div>
    </div>

    <script>
        function showSection(id) {
            document.getElementById('sec-employees').classList.add('hidden');
            document.getElementById('sec-profile').classList.add('hidden');
            document.getElementById('sec-' + id).classList.remove('hidden');
            if(id === 'employees') loadEmps();
        }

        const openEmpModal = () => document.getElementById('addEmpModal').classList.remove('hidden');
        const closeEmpModal = () => document.getElementById('addEmpModal').classList.add('hidden');

        async function loadEmps() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            document.getElementById('empTable').innerHTML = data.map(e => \`
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-4 font-bold text-indigo-900">\${e.name}</td>
                    <td class="p-4 text-slate-500">\${e.nationalId}</td>
                    <td class="p-4 font-bold \${e.resignationDate ? 'text-red-500' : 'text-green-500'}">\${e.resignationDate ? 'مستقيل' : 'على قوة العمل'}</td>
                    <td class="p-4">
                        <button onclick="openProfile('\${e._id}')" class="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold hover:bg-indigo-200"><i class="fas fa-folder-open ml-1"></i> فتح الملف</button>
                    </td>
                </tr>
            \`).join('');
        }

        async function saveEmp() {
            await fetch('/api/employees', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    name: document.getElementById('n-name').value, nationalId: document.getElementById('n-nid').value,
                    employmentType: document.getElementById('n-type').value, hiringDate: document.getElementById('n-hdate').value,
                    insSalary: document.getElementById('n-ins').value
                })
            });
            closeEmpModal(); loadEmps();
        }

        async function deleteEmployee() {
            if(!confirm("هل أنت متأكد من الحذف النهائي؟ سيتم مسح الموظف وكل سجلات رواتبه ولا يمكن التراجع.")) return;
            const id = document.getElementById('currentEmpId').value;
            await fetch(\`/api/employees/\${id}\`, { method: 'DELETE' });
            showSection('employees');
        }

        async function resignEmployee() {
            const date = prompt("أدخل تاريخ الاستقالة (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
            if(!date) return;
            const id = document.getElementById('currentEmpId').value;
            await fetch(\`/api/employees/\${id}/resign\`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({date}) });
            openProfile(id);
        }

        async function openProfile(id) {
            document.getElementById('currentEmpId').value = id;
            showSection('profile');
            const res = await fetch(\`/api/employees/\${id}/payroll-details\`);
            const data = await res.json();
            
            document.getElementById('p-name').innerText = data.emp.name;
            document.getElementById('p-nid').innerText = data.emp.nationalId;
            document.getElementById('p-type').innerText = data.emp.employmentType;
            document.getElementById('p-hdate').innerText = data.emp.hiringDate ? data.emp.hiringDate.split('T')[0] : '---';
            document.getElementById('p-rdate').innerText = data.emp.resignationDate ? data.emp.resignationDate.split('T')[0] : '---';
            document.getElementById('p-ins').innerText = data.emp.insSalary.toLocaleString();

            document.getElementById('prevDays').value = data.prevData.pDays;
            document.getElementById('prevTaxable').value = data.prevData.pTaxable;
            document.getElementById('prevTaxes').value = data.prevData.pTaxes;

            // --- Month Lock Logic ---
            const select = document.getElementById('c-month');
            select.innerHTML = "";
            const hDate = new Date(data.emp.hiringDate || new Date());
            const rDate = data.emp.resignationDate ? new Date(data.emp.resignationDate) : null;
            const calculated = data.history.map(r => r.month);

            let nextMonth = "";
            if (calculated.length > 0) {
                let lastStr = calculated[calculated.length - 1];
                let d = new Date(lastStr + "-01");
                d.setMonth(d.getMonth() + 1);
                nextMonth = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0');
            } else {
                nextMonth = hDate.getFullYear() + "-" + String(hDate.getMonth() + 1).padStart(2, '0');
            }

            let startYear = hDate.getFullYear();
            let allDisabled = true;

            for (let y = startYear; y <= startYear + 1; y++) {
                for (let m = 1; m <= 12; m++) {
                    let mStr = String(m).padStart(2, '0');
                    let val = \`\${y}-\${mStr}\`;
                    let option = document.createElement('option');
                    option.value = val; option.text = val;

                    let optDate = new Date(y, m - 1, 1);
                    let hLimit = new Date(hDate.getFullYear(), hDate.getMonth(), 1);
                    let isDisabled = false;

                    if (optDate < hLimit) isDisabled = true;
                    if (rDate) { let rLimit = new Date(rDate.getFullYear(), rDate.getMonth(), 1); if (optDate > rLimit) isDisabled = true; }
                    if (calculated.includes(val)) isDisabled = true;
                    if (val !== nextMonth && !calculated.includes(val)) isDisabled = true; // Strict Sequential

                    option.disabled = isDisabled;
                    if (val === nextMonth && !isDisabled) { option.selected = true; allDisabled = false; }
                    
                    if(isDisabled) {
                        if(calculated.includes(val)) option.text += " (محسوب)";
                        else option.text += " (مغلق)";
                    }
                    select.appendChild(option);
                }
            }
            
            document.getElementById('calcBtn').disabled = allDisabled;
            if(allDisabled) document.getElementById('calcBtn').classList.add('opacity-50', 'cursor-not-allowed');
            else document.getElementById('calcBtn').classList.remove('opacity-50', 'cursor-not-allowed');

            const tbody = document.getElementById('historyTable');
            if(data.history.length === 0) tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-slate-500">لا توجد رواتب مسجلة</td></tr>';
            else tbody.innerHTML = data.history.map(r => \`<tr class="hover:bg-slate-700"><td class="p-4 font-bold text-indigo

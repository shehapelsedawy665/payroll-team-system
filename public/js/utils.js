// public/js/utils.js

// --- الإعدادات العامة ---
const BASE = ''; // سيبها فاضية لو الـ API على نفس الدومين في Vercel
let AUTH_TOKEN = localStorage.getItem('pp_token') || '';
let CURRENT_USER = JSON.parse(localStorage.getItem('pp_user') || 'null');
let CURRENT_SUB = JSON.parse(localStorage.getItem('pp_sub') || 'null');
let EMPLOYEES = [];
let CURRENT_PAGE = 'dashboard';

// --- دالة التواصل مع السيرفر (API Wrapper) ---
async function api(method, path, body) {
    const opts = { 
        method, 
        headers: { 'Content-Type': 'application/json' } 
    };
    if (AUTH_TOKEN) opts.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    if (body) opts.body = JSON.stringify(body);

    const r = await fetch(BASE + path, opts);
    const data = await r.json();
    
    if (!r.ok) throw new Error(data.error || 'حدث خطأ في السيرفر');
    return data;
}

// --- أدوات الواجهة (UI Tools) ---
function showLoading() { document.getElementById('loading').classList.add('show'); }
function hideLoading() { document.getElementById('loading').classList.remove('show'); }

// تنبيهات النجاح والفشل
function toast(msg, type = 'success') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// تنسيق الأرقام والعملة
function fmt(n) { 
    return Number(n || 0).toLocaleString('ar-EG', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
    }); 
}

// التحكم في المودالز
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// التنقل بين الصفحات
function navigate(page) {
    CURRENT_PAGE = page;
    
    // إخفاء كل الصفحات وإظهار المطلوبة
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) targetPage.classList.add('active');

    // تفعيل العنصر في السايد بار
    const nav = document.querySelector(`.nav-item[onclick="navigate('${page}')"]`);
    if (nav) nav.classList.add('active');

    // تحديث العناوين في الهيدر
    const titles = {
        dashboard:  ['لوحة التحكم', 'نظرة عامة على الشركة'],
        employees:  ['إدارة الموظفين', 'قاعدة بيانات الموظفين'],
        attendance: ['الحضور والغياب', 'سجل الحضور اليومي'],
        leaves:     ['الإجازات', 'طلبات وأرصدة الإجازات'],
        payroll:    ['مسير الرواتب', 'احتساب الرواتب الشهرية'],
        calculator: ['الآلة الحاسبة', 'حسابات ضريبية فورية'],
        settings:   ['إعدادات الشركة', 'ضبط إعدادات النظام']
    };

    const [t, s] = titles[page] || ['', ''];
    document.getElementById('header-title').textContent = t;
    document.getElementById('header-subtitle').textContent = s;

    // إظهار زرار "إضافة موظف" فقط في صفحة الموظفين
    const btn = document.getElementById('header-action-btn');
    if (page === 'employees') {
        btn.style.display = 'flex';
        btn.textContent = '+ موظف جديد';
        btn.onclick = openAddEmployee;
    } else {
        btn.style.display = 'none';
    }

    // تحميل بيانات الصفحة لو محتاجة Fetch
    if (page === 'dashboard') loadDashboard();
    if (page === 'employees') loadEmployees();
}

function toggleSidebar() { 
    document.getElementById('sidebar').classList.toggle('open'); 
}

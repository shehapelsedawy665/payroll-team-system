// public/js/utils.js

const BASE = ''; 
let AUTH_TOKEN = localStorage.getItem('pp_token') || '';
let CURRENT_USER = JSON.parse(localStorage.getItem('pp_user') || 'null');
let EMPLOYEES = [];
let CURRENT_PAGE = 'dashboard';

async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (AUTH_TOKEN) opts.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    if (body) opts.body = JSON.stringify(body);

    try {
        const r = await fetch(BASE + path, opts);
        let data;
        try {
            data = await r.json();
        } catch (e) {
            throw new Error(`Server error: ${r.status} ${r.statusText}`);
        }
        
        if (!r.ok) {
            throw new Error(data.error || data.message || `Server error: ${r.status}`);
        }
        return data;
    } catch (e) {
        if (e instanceof TypeError) {
            throw new Error('Network error - please check your connection');
        }
        throw e;
    }
}

function showLoading() { document.getElementById('loading').classList.add('show'); }
function hideLoading() { document.getElementById('loading').classList.remove('show'); }
function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

function fmt(n) { return Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function navigate(page) {
    CURRENT_PAGE = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) targetPage.classList.add('active');

    const nav = document.querySelector(`.nav-item[onclick="navigate('${page}')"]`);
    if (nav) nav.classList.add('active');

    const titles = {
        dashboard:  ['لوحة التحكم', 'نظرة عامة على الشركة'],
        employees:  ['إدارة الموظفين', 'قاعدة بيانات الموظفين'],
        attendance: ['الحضور والغياب', 'سجل الحضور اليومي'],
        payroll:    ['مسير الرواتب', 'احتساب الرواتب الشهرية'],
        settings:   ['إعدادات الشركة', 'ضبط النظام']
    };
    
    document.getElementById('header-title').textContent = titles[page]?.[0] || '';
    document.getElementById('header-subtitle').textContent = titles[page]?.[1] || '';

    const btn = document.getElementById('header-action-btn');
    if (page === 'employees') {
        btn.style.display = 'flex';
        btn.textContent = '+ موظف جديد';
        btn.onclick = openAddEmployee;
    } else {
        btn.style.display = 'none';
    }

    if (page === 'dashboard') loadDashboard();
    if (page === 'employees') loadEmployees();
    if (page === 'attendance' || page === 'payroll') initAttendancePage();
}

function loadDashboard() {
    const stats = document.getElementById('dashboard-stats');
    if (stats) stats.innerHTML = `<div class="stat-card green"><div class="stat-value">${EMPLOYEES.length}</div><div class="stat-label">إجمالي الموظفين</div></div>`;
}

function populateEmpSelects() {
    const options = EMPLOYEES.map(e => `<option value="${e._id}">${e.name}</option>`).join('');
    ['att-emp-select', 'payroll-emp-select'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<option value="">-- اختر الموظف --</option>' + options;
    });
}
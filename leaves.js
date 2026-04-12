// public/js/leaves.js

let leaveTab = 'pending';

// 1. التبديل بين التبويبات (طلبات معلقة / إجازات موظف / طلب جديد)
function switchLeaveTab(tab) {
    leaveTab = tab;
    document.querySelectorAll('#page-leaves .tab').forEach((t, i) => {
        t.classList.toggle('active', ['pending', 'employee', 'new'][i] === tab);
    });
    
    ['pending', 'employee', 'new'].forEach(t => {
        const el = document.getElementById(`leave-tab-${t}`);
        if (el) el.style.display = t === tab ? '' : 'none';
    });

    if (tab === 'pending') loadPendingLeaves();
}

// 2. تحميل الطلبات اللي مستنية موافقة الـ HR
async function loadPendingLeaves() {
    showLoading();
    try {
        const leaves = await api('GET', '/api/leaves/pending');
        const tbody = document.getElementById('pending-leaves-tbody');
        
        if (!leaves.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🎉</div><p>لا توجد طلبات معلقة حالياً</p></div></td></tr>`;
            return;
        }

        const typeNames = { annual: 'سنوية', sick: 'مرضية', emergency: 'عارضة', unpaid: 'بدون راتب' };
        
        tbody.innerHTML = leaves.map(l => `
            <tr>
                <td style="font-weight:600;">${l.employeeId?.name || '-'}</td>
                <td><span class="badge blue">${typeNames[l.type] || l.type}</span></td>
                <td style="font-family:monospace;">${l.startDate}</td>
                <td style="font-family:monospace;">${l.endDate}</td>
                <td><span class="badge gold">${l.days} أيام</span></td>
                <td style="font-size:12px; color:var(--text3);">${l.reason || '-'}</td>
                <td style="display:flex; gap:6px;">
                    <button class="btn btn-ghost" style="color:var(--green);" onclick="approveLeave('${l._id}', 'approved')">✅ موافقة</button>
                    <button class="btn btn-ghost" style="color:var(--red);" onclick="approveLeave('${l._id}', 'rejected')">❌ رفض</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 3. الموافقة أو الرفض
async function approveLeave(id, status) {
    showLoading();
    try {
        await api('PUT', `/api/leaves/approve?id=${id}`, { status });
        toast(status === 'approved' ? 'تمت الموافقة ✅' : 'تم رفض الطلب ❌');
        loadPendingLeaves();
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 4. تحميل رصيد وسجل إجازات موظف معين
async function loadEmployeeLeaves() {
    const empId = document.getElementById('leave-emp-select').value;
    if (!empId) return;

    showLoading();
    try {
        const data = await api('GET', `/api/leaves/employee?id=${empId}`);
        const { leaves, balance } = data;

        // رسم كروت الرصيد (العدادات)
        const cards = document.getElementById('leave-balance-cards');
        if (balance) {
            cards.innerHTML = `
                <div class="leave-balance-card">
                    <div class="leave-type">سنوية 🌴</div>
                    <div class="leave-count" style="color:var(--green);">${balance.annual - balance.annualUsed}</div>
                    <div class="leave-used">مستخدم ${balance.annualUsed} من ${balance.annual}</div>
                </div>
                <div class="leave-balance-card">
                    <div class="leave-type">مرضية 🏥</div>
                    <div class="leave-count" style="color:var(--blue);">${balance.sick - balance.sickUsed}</div>
                    <div class="leave-used">مستخدم ${balance.sickUsed} من ${balance.sick}</div>
                </div>
            `;
        }
        
        // رسم جدول تاريخ الإجازات للموظف
        const tbody = document.getElementById('employee-leaves-tbody');
        tbody.innerHTML = leaves.map(l => `
            <tr>
                <td>${l.type}</td>
                <td>${l.startDate}</td>
                <td>${l.days}</td>
                <td><span class="badge ${l.status === 'approved' ? 'green' : 'gold'}">${l.status}</span></td>
            </tr>
        `).join('');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 5. حساب عدد الأيام تلقائياً عند اختيار التاريخ
function calcLeaveDays() {
    const start = document.getElementById('new-leave-start').value;
    const end = document.getElementById('new-leave-end').value;
    if (start && end) {
        const diff = new Date(end) - new Date(start);
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
        if (days > 0) document.getElementById('new-leave-days').value = days;
    }
}

// 6. تقديم طلب جديد
async function submitLeave() {
    const body = {
        employeeId: document.getElementById('new-leave-emp').value,
        type: document.getElementById('new-leave-type').value,
        startDate: document.getElementById('new-leave-start').value,
        endDate: document.getElementById('new-leave-end').value,
        days: Number(document.getElementById('new-leave-days').value),
        reason: document.getElementById('new-leave-reason').value
    };

    if (!body.employeeId || !body.startDate || !body.days) return toast('كمل البيانات يا هندسة', 'error');

    showLoading();
    try {
        await api('POST', '/api/leaves', body);
        toast('تم تقديم الطلب بنجاح، مستني موافقتك ✅');
        switchLeaveTab('pending');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

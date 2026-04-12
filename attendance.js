// public/js/attendance.js

let ATT_DATA = {}; // مخزن بيانات الحضور للشهر الحالي
let attCurrentDate = '';

// 1. تشغيل الصفحة وتحميل الموظفين في القائمة
function initAttendancePage() {
    if (!EMPLOYEES.length) {
        loadEmployees().then(() => populateEmpSelects());
    } else {
        populateEmpSelects();
    }
}

// 2. تحميل سجل الحضور لموظف معين في شهر معين
async function loadAttendance() {
    const empId = document.getElementById('att-emp-select').value;
    const month = document.getElementById('att-month').value;
    
    if (!empId || !month) return;

    showLoading();
    try {
        // بننادي الـ API بتاع الحضور (لازم يتكريت في الـ api folder)
        const records = await api('GET', `/api/attendance?employeeId=${empId}&month=${month}`);
        
        ATT_DATA = {};
        records.forEach(r => { ATT_DATA[r.date] = r; });
        
        renderCalendar(month);
        renderAttStats(records);
    } catch (e) {
        toast(e.message, 'error');
        // في حالة مفيش داتا لسه، بنرسم كلندر فاضية
        renderCalendar(month);
    } finally {
        hideLoading();
    }
}

// 3. رسم التقويم الشهري
function renderCalendar(month) {
    const cal = document.getElementById('att-calendar');
    const [year, mon] = month.split('-').map(Number);
    
    const firstDay = new Date(year, mon - 1, 1).getDay();
    const daysInMonth = new Date(year, mon, 0).getDate();
    
    const headers = `
        <div class="cal-day-header">أح</div><div class="cal-day-header">ن</div>
        <div class="cal-day-header">ث</div><div class="cal-day-header">ر</div>
        <div class="cal-day-header">خ</div><div class="cal-day-header">ج</div>
        <div class="cal-day-header">س</div>
    `;

    const statusMap = { 
        present: 'حضور', absent: 'غياب', late: 'تأخير', 
        half: 'نصف يوم', holiday: 'إجازة', weekend: 'عطلة' 
    };

    let cells = '';
    // الأيام الفاضية قبل بداية الشهر
    for (let i = 0; i < firstDay; i++) {
        cells += '<div class="cal-day empty"></div>';
    }

    // أيام الشهر
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        const rec = ATT_DATA[dateStr];
        const status = rec?.status || '';
        
        cells += `
            <div class="cal-day ${status}" onclick="openAttDay('${dateStr}')">
                <div class="day-num">${d}</div>
                ${status ? `<div class="day-status">${statusMap[status] || ''}</div>` : ''}
            </div>
        `;
    }
    
    cal.innerHTML = headers + cells;
}

// 4. فتح المودال لتسجيل حالة يوم معين
function openAttDay(date) {
    attCurrentDate = date;
    const rec = ATT_DATA[date] || {};
    
    document.getElementById('att-day-title').textContent = `تسجيل الحضور — ${date}`;
    document.getElementById('att-day-date').value = date;
    document.getElementById('att-day-status').value = rec.status || 'present';
    document.getElementById('att-day-checkin').value = rec.checkIn || '09:00';
    document.getElementById('att-day-checkout').value = rec.checkOut || '17:00';
    document.getElementById('att-day-late').value = rec.lateMinutes || 0;
    document.getElementById('att-day-ot').value = rec.overtimeHours || 0;
    
    openModal('modal-att-day');
}

// 5. حفظ بيانات اليوم للسيرفر
async function saveAttDayModal() {
    const empId = document.getElementById('att-emp-select').value;
    const date = document.getElementById('att-day-date').value;
    
    const body = {
        employeeId: empId,
        date: date,
        status: document.getElementById('att-day-status').value,
        checkIn: document.getElementById('att-day-checkin').value,
        checkOut: document.getElementById('att-day-checkout').value,
        lateMinutes: Number(document.getElementById('att-day-late').value) || 0,
        overtimeHours: Number(document.getElementById('att-day-ot').value) || 0
    };

    showLoading();
    try {
        await api('POST', '/api/attendance', body);
        ATT_DATA[date] = body; // تحديث الذاكرة المحلية
        closeModal('modal-att-day');
        renderCalendar(document.getElementById('att-month').value);
        toast('تم حفظ الحضور بنجاح ✅');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 6. حساب ملخص الشهر (统计)
function renderAttStats(records) {
    const stats = document.getElementById('att-stats');
    const counts = { present: 0, absent: 0, late: 0, half: 0, holiday: 0 };
    
    records.forEach(r => {
        if (counts[r.status] !== undefined) counts[r.status]++;
    });

    stats.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:var(--text3);">✅ حضور</span><span style="font-weight:700;">${counts.present}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:var(--text3);">❌ غياب</span><span style="font-weight:700;">${counts.absent}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:var(--text3);">⏰ تأخير</span><span style="font-weight:700;">${counts.late}</span></div>
    `;
}

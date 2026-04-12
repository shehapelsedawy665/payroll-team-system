// public/js/settings.js

// 1. تحميل الإعدادات الحالية من السيرفر
async function loadSettings() {
    showLoading();
    try {
        const settings = await api('GET', '/api/settings');
        
        // تعبئة الفورم بالبيانات
        document.getElementById('settings-company-name').value = settings.companyName || '';
        document.getElementById('settings-absent-rate').value  = settings.absentDayRate || 1;
        document.getElementById('settings-ot-rate').value      = settings.overtimeRate || 1.5;
        document.getElementById('settings-work-days').value    = settings.workDaysPerWeek || 5;
        document.getElementById('settings-work-hours').value   = settings.dailyWorkHours || 8;
        document.getElementById('settings-late-thresh').value  = settings.lateThreshold || 120;

        // عرض معلومات الاشتراك
        renderSubscriptionInfo(CURRENT_SUB);
    } catch (e) {
        toast('خطأ في تحميل الإعدادات: ' + e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 2. حفظ التعديلات
async function saveSettings() {
    const body = {
        companyName: document.getElementById('settings-company-name').value.trim(),
        absentDayRate: Number(document.getElementById('settings-absent-rate').value) || 1,
        overtimeRate: Number(document.getElementById('settings-ot-rate').value) || 1.5,
        workDaysPerWeek: Number(document.getElementById('settings-work-days').value) || 5,
        dailyWorkHours: Number(document.getElementById('settings-work-hours').value) || 8,
        lateThreshold: Number(document.getElementById('settings-late-thresh').value) || 120
    };

    showLoading();
    try {
        await api('PUT', '/api/settings', body);
        toast('تم حفظ الإعدادات بنجاح ✅');
        
        // تحديث اسم الشركة في السايد بار فوراً
        document.getElementById('company-name-sidebar').textContent = body.companyName;
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 3. عرض حالة الاشتراك
function renderSubscriptionInfo(sub) {
    const container = document.getElementById('sub-info');
    if (!sub) return;

    const planNames = { trial: 'تجريبي 🔓', starter: 'Starter 🥉', growth: 'Growth 🥈', enterprise: 'Enterprise 🏆' };
    
    container.innerHTML = `
        <div style="display:flex; gap:15px; flex-wrap:wrap;">
            <div class="stat-card" style="padding:10px; flex:1; min-width:120px;">
                <div class="stat-label">الباقة</div>
                <div class="badge gold">${planNames[sub.plan] || sub.plan}</div>
            </div>
            <div class="stat-card" style="padding:10px; flex:1; min-width:120px;">
                <div class="stat-label">الحالة</div>
                <div class="badge green">نشط ✅</div>
            </div>
        </div>
    `;
}

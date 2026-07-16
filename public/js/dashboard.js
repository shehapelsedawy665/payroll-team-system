document.addEventListener('DOMContentLoaded', async () => {
    // 1. حماية الشاشة: التأكد إن المستخدم مسجل دخول (معاه Token)
    const token = localStorage.getItem('token');
    if (!token) {
        // لو مفيش توكن، نطرده لصفحة الدخول فوراً
        window.location.href = '/index.html';
        return;
    }

    // 2. تفعيل زرار تسجيل الخروج
    const logout = (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        window.location.href = '/index.html';
    };
    
    // ربط زرار الخروج في الشاشات الكبيرة والموبايل
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutBtnMobile = document.getElementById('logoutBtnMobile');
    
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', logout);

    // 3. سحب بيانات لعرضها في الداشبورد (داتا للعرض مؤقتاً لحد ما نربطها بمسارات الباك إند المجمعة)
    try {
        // تحديث الأرقام في الكروت
        document.getElementById('totalEmployees').textContent = '15';
        document.getElementById('todayAttendance').textContent = '12';
        document.getElementById('pendingLeaves').textContent = '3';
        
        // تحديث جدول الموظفين الجداد
        const tbody = document.getElementById('recentEmployeesTable');
        tbody.innerHTML = `
            <tr>
                <td>أحمد محمود</td>
                <td>EMP-001</td>
                <td>IT</td>
                <td>15-01-2026</td>
            </tr>
            <tr>
                <td>سارة خالد</td>
                <td>EMP-002</td>
                <td>HR</td>
                <td>20-03-2026</td>
            </tr>
            <tr>
                <td>محمود طارق</td>
                <td>EMP-003</td>
                <td>Finance</td>
                <td>10-04-2026</td>
            </tr>
        `;
    } catch (error) {
        console.error('خطأ في تحميل بيانات الداشبورد:', error);
    }
});

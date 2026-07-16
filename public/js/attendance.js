document.addEventListener('DOMContentLoaded', () => {
    // 1. حماية الشاشة والتأكد من تسجيل الدخول
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    const companyId = payload.companyId;

    // 2. تفعيل زرار الخروج
    const logout = (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = '/index.html';
    };
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('logoutBtnMobile')?.addEventListener('click', logout);

    // 3. جلب الموظفين لوضعهم في القائمة المنسدلة (لتسجيل حركة يدوي)
    const loadEmployeesDropdown = async () => {
        try {
            const fetchId = companyId || 'DUMMY_COMPANY_ID';
            const response = await fetch(`/api/employees/company/${fetchId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            const select = document.getElementById('attEmployeeId');
            select.innerHTML = '<option value="">اختر الموظف...</option>';
            
            if (result.success) {
                result.data.forEach(emp => {
                    select.innerHTML += `<option value="${emp._id}">${emp.name} (${emp.jobId})</option>`;
                });
            }
        } catch (error) {
            console.error('خطأ في جلب الموظفين:', error);
        }
    };
    loadEmployeesDropdown();

    // وضع تاريخ اليوم كافتراضي في الفلتر
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filterDate').value = today;

    // 4. جلب سجلات الحضور لتاريخ معين
    const fetchAttendance = async () => {
        const date = document.getElementById('filterDate').value;
        if (!date) return alert('برجاء اختيار التاريخ');

        try {
            const fetchId = companyId || 'DUMMY_COMPANY_ID';
            const response = await fetch(`/api/attendance/company/${fetchId}?date=${date}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            const tbody = document.getElementById('attendanceTableBody');
            tbody.innerHTML = '';

            if (result.success && result.data.length > 0) {
                result.data.forEach(record => {
                    // تظبيط شكل الحالة
                    let statusBadge = '';
                    if (record.status === 'Present') statusBadge = '<span class="badge bg-success">حاضر</span>';
                    else if (record.status === 'Absent') statusBadge = '<span class="badge bg-danger">غائب</span>';
                    else statusBadge = '<span class="badge bg-warning text-dark">إجازة</span>';
                    
                    // تظبيط شكل الوقت
                    const checkInTime = record.checkIn ? new Date(record.checkIn).toLocaleTimeString('ar-EG') : '--';
                    const checkOutTime = record.checkOut ? new Date(record.checkOut).toLocaleTimeString('ar-EG') : '--';

                    tbody.innerHTML += `
                        <tr>
                            <td class="fw-bold">${record.employeeId ? record.employeeId.name : 'غير معروف'}</td>
                            <td>${new Date(record.date).toLocaleDateString('ar-EG')}</td>
                            <td>${statusBadge}</td>
                            <td>${checkInTime}</td>
                            <td>${checkOutTime}</td>
                            <td>${record.lateMinutes || 0}</td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">لا يوجد سجلات حضور لهذا اليوم.</td></tr>';
            }
        } catch (error) {
            console.error('خطأ في جلب السجلات:', error);
            document.getElementById('attendanceTableBody').innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">حدث خطأ في الاتصال بالسيرفر.</td></tr>';
        }
    };

    // تشغيل الدالة عند الضغط على زرار "عرض السجلات"
    document.getElementById('filterBtn').addEventListener('click', fetchAttendance);
    
    // تشغيلها مرة أول ما الشاشة تفتح عشان تجيب غياب وحضور اليوم
    fetchAttendance();

    // 5. تسجيل حركة حضور أو غياب يدوياً
    document.getElementById('addAttendanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saveBtnText = document.getElementById('saveBtnText');
        const saveBtnLoader = document.getElementById('saveBtnLoader');
        const saveAttBtn = document.getElementById('saveAttBtn');

        const empId = document.getElementById('attEmployeeId').value;
        const date = document.getElementById('attDate').value;
        const status = document.getElementById('attStatus').value;
        const checkInVal = document.getElementById('attCheckIn').value;
        const checkOutVal = document.getElementById('attCheckOut').value;

        // دمج التاريخ مع الوقت عشان الداتابيز تقبله
        const checkIn = checkInVal ? new Date(`${date}T${checkInVal}`) : null;
        const checkOut = checkOutVal ? new Date(`${date}T${checkOutVal}`) : null;

        const payloadData = {
            employeeId: empId,
            companyId: companyId || 'DUMMY_COMPANY_ID',
            date: date,
            status: status,
            checkIn: checkIn,
            checkOut: checkOut
        };

        saveBtnText.textContent = 'جاري الحفظ...';
        saveBtnLoader.classList.remove('d-none');
        saveAttBtn.disabled = true;

        try {
            const response = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payloadData)
            });

            const result = await response.json();

            if (result.success) {
                alert('تم تسجيل الحركة بنجاح!');
                document.getElementById('addAttendanceForm').reset();
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('addAttendanceModal'));
                modal.hide();
                
                // نخلي الفلتر على نفس اليوم اللي لسه مسجلين فيه ونحدث الجدول
                document.getElementById('filterDate').value = date;
                fetchAttendance();
            } else {
                alert(result.message || 'حدث خطأ أثناء التسجيل.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('حدث خطأ في الاتصال بالسيرفر.');
        } finally {
            saveBtnText.textContent = 'حفظ الحركة';
            saveBtnLoader.classList.add('d-none');
            saveAttBtn.disabled = false;
        }
    });
});

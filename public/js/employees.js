// public/js/employees.js

// 1. تحميل قائمة الموظفين من السيرفر
async function loadEmployees() {
    showLoading();
    try {
        // بننادي الـ API اللي عملناه في الفولدر التاني
        EMPLOYEES = await api('GET', '/api/employees');
        renderEmployees(EMPLOYEES);
        populateDeptFilter();
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 2. عرض الموظفين في الجدول
function renderEmployees(list) {
    const tbody = document.getElementById('employees-tbody');
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><p>لا يوجد موظفين حالياً</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(e => `
    <tr>
      <td>
        <div style="font-weight:600;color:var(--text);">${e.name}</div>
        <div style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">${e.nationalId}</div>
      </td>
      <td>${e.department ? `<span class="dept-chip">${e.department}</span>` : '<span style="color:var(--text3);">-</span>'}</td>
      <td><span style="color:var(--text2);">${e.position || '-'}</span></td>
      <td><span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text3);">${e.hiringDate ? e.hiringDate.split('T')[0] : '-'}</span></td>
      <td>${e.status === 'active' ? `<span class="badge green">نشط</span>` : `<span class="badge red">غير نشط</span>`}</td>
      <td style="display:flex;gap:6px;">
        <button class="action-btn view" onclick="viewEmployee('${e._id}')" title="عرض">👁</button>
        <button class="action-btn edit" onclick="editEmployee('${e._id}')" title="تعديل">✏️</button>
        <button class="action-btn delete" onclick="deleteEmployee('${e._id}','${e.name.replace(/'/g, "\\\\'")}')" title="حذف">🗑</button>
      </td>
    </tr>
  `).join('');
}

// 3. فلترة الموظفين بالبحث
function filterEmployees(q) {
    const query = q.toLowerCase();
    const filtered = EMPLOYEES.filter(e => 
        e.name.toLowerCase().includes(query) || 
        e.nationalId.includes(query) || 
        (e.department && e.department.toLowerCase().includes(query))
    );
    renderEmployees(filtered);
}

// 4. فتح مودال إضافة موظف جديد
function openAddEmployee() {
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-modal-title').textContent = 'إضافة موظف جديد';
    
    // تصفير الفورم
    ['emp-name', 'emp-national-id', 'emp-hiring-date', 'emp-department', 'emp-position', 'emp-ins-salary'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id === 'emp-ins-salary' ? '5384' : '');
    });
    
    openModal('modal-employee');
}

// 5. حفظ البيانات (إضافة أو تعديل)
async function saveEmployee() {
    const id = document.getElementById('emp-id').value;
    const body = {
        name: document.getElementById('emp-name').value.trim(),
        nationalId: document.getElementById('emp-national-id').value.trim(),
        hiringDate: document.getElementById('emp-hiring-date').value,
        department: document.getElementById('emp-department').value.trim(),
        position: document.getElementById('emp-position').value.trim(),
        insSalary: Number(document.getElementById('emp-ins-salary').value) || 5384,
        status: 'active'
    };

    if (!body.name || !body.nationalId || !body.hiringDate) {
        return toast('برجاء إكمال البيانات الأساسية (الاسم، الرقم القومي، تاريخ التعيين)', 'error');
    }

    showLoading();
    try {
        const method = id ? 'PUT' : 'POST';
        const path = id ? `/api/employees?id=${id}` : '/api/employees';
        
        await api(method, path, body);
        toast(id ? 'تم تحديث بيانات الموظف' : 'تم إضافة الموظف بنجاح');
        closeModal('modal-employee');
        loadEmployees(); // تحديث الجدول
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 6. حذف موظف
async function deleteEmployee(id, name) {
    if (!confirm(`هل أنت متأكد من حذف الموظف "${name}"؟`)) return;

    showLoading();
    try {
        await api('DELETE', `/api/employees?id=${id}`);
        toast('تم حذف الموظف بنجاح');
        loadEmployees();
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 7. عرض تفاصيل موظف (مستقبلاً)
function viewEmployee(id) {
    toast('سيتم عرض التفاصيل والـ YTD في التحديث القادم', 'info');
}

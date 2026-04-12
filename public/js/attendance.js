/**
 * @file public/js/attendance.js
 * @description Advanced attendance tracking and dashboard
 */

const ATTENDANCE_API = '/api/attendance';

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', async () => {
    const authToken = localStorage.getItem('AUTH_TOKEN');
    if (!authToken) {
        window.location.href = '/';
        return;
    }

    loadAttendanceTab();
    
    // Setup event listeners
    document.getElementById('todayCheckin')?.addEventListener('click', handleCheckIn);
    document.getElementById('todayCheckout')?.addEventListener('click', handleCheckOut);
    document.getElementById('monthFilter')?.addEventListener('change', loadAttendanceRecords);
    document.getElementById('manualEntryForm')?.addEventListener('submit', handleManualEntry);
});

// ==================== CHECK-IN/OUT ====================
async function handleCheckIn() {
    try {
        const employeeId = localStorage.getItem('EMPLOYEE_ID');
        const time = new Date().toTimeString().slice(0, 5); // HH:MM format

        // Try to get geolocation
        let lat, lng;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    lat = pos.coords.latitude;
                    lng = pos.coords.longitude;
                },
                err => console.log('Geolocation denied:', err.message)
            );
        }

        const response = await fetch(`${ATTENDANCE_API}/checkin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            },
            body: JSON.stringify({
                employeeId,
                time,
                source: 'manual',
                latitude: lat,
                longitude: lng
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            showNotification('✓ Check-in recorded successfully', 'success');
            document.getElementById('checkinStatus').innerHTML = `
                <div class="status-badge present">
                    <strong>Checked In:</strong> ${time}
                </div>
            `;
            document.getElementById('todayCheckin').disabled = true;
            document.getElementById('todayCheckout').disabled = false;
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Check-in error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function handleCheckOut() {
    try {
        const employeeId = localStorage.getItem('EMPLOYEE_ID');
        const time = new Date().toTimeString().slice(0, 5); // HH:MM format

        const response = await fetch(`${ATTENDANCE_API}/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            },
            body: JSON.stringify({
                employeeId,
                time,
                source: 'manual'
            })
        });

        const data = await response.json();

        if (response.ok) {
            const att = data.attendance;
            showNotification('✓ Check-out recorded. Attendance calculated.', 'success');
            
            document.getElementById('checkoutStatus').innerHTML = `
                <div class="status-badge ${att.status}">
                    <strong>Status:</strong> ${att.status.toUpperCase()}<br>
                    <strong>Work Hours:</strong> ${att.workHours}h<br>
                    <strong>Checked Out:</strong> ${time}
                    ${att.lateMinutes > 0 ? `<br><strong>Late:</strong> ${att.lateMinutes} min` : ''}
                    ${att.overtime > 0 ? `<br><strong>Overtime:</strong> ${att.overtime}h` : ''}
                    ${att.requiresApproval ? '<br><span style="color: orange;">Pending HR approval</span>' : ''}
                </div>
            `;
            
            document.getElementById('todayCheckout').disabled = true;
            
            // Reload records
            setTimeout(() => loadAttendanceRecords(), 1000);
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Check-out error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// ==================== LOAD ATTENDANCE RECORDS ====================
async function loadAttendanceRecords() {
    try {
        const month = document.getElementById('monthFilter')?.value || new Date().toISOString().slice(0, 7);

        const response = await fetch(`${ATTENDANCE_API}/my-records?month=${month}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        // Render attendance table
        const tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;

        tbody.innerHTML = data.records.map(r => `
            <tr class="status-${r.status}">
                <td>${r.date}</td>
                <td>${r.checkInTime || '-'}</td>
                <td>${r.checkOutTime || '-'}</td>
                <td><span class="badge badge-${r.status}">${r.status}</span></td>
                <td>${r.workHours?.toFixed(2) || '-'}</td>
                <td>${r.overtime?.toFixed(2) || '-'}</td>
                <td>${r.lateMinutes || '-'}</td>
                <td>${r.bonus || '-'}</td>
                <td>${r.requiresApproval ? '⚠️ Pending' : '✓'}</td>
            </tr>
        `).join('');

        // Render summary
        if (data.summary) {
            const summ = data.summary;
            document.getElementById('attendanceSummary').innerHTML = `
                <div class="summary-grid">
                    <div class="summary-card">
                        <h4>Present Days</h4>
                        <p class="big-number" style="color: #27ae60;">${summ.presentDays}</p>
                    </div>
                    <div class="summary-card">
                        <h4>Absent Days</h4>
                        <p class="big-number" style="color: #e74c3c;">${summ.absentDays}</p>
                    </div>
                    <div class="summary-card">
                        <h4>Late Days</h4>
                        <p class="big-number" style="color: #f39c12;">${summ.lateDays}</p>
                    </div>
                    <div class="summary-card">
                        <h4>Overtime Hours</h4>
                        <p class="big-number" style="color: #3498db;">${summ.totalOvertimeHours.toFixed(2)}</p>
                    </div>
                    <div class="summary-card">
                        <h4>Total Bonus</h4>
                        <p class="big-number" style="color: #27ae60;">LE${summ.totalBonus}</p>
                    </div>
                    <div class="summary-card">
                        <h4>Late Penalty Days</h4>
                        <p class="big-number" style="color: #e74c3c;">${summ.totalLatePenaltyDays.toFixed(2)}</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load records error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// ==================== ATTENDANCE TAB ====================
function loadAttendanceTab() {
    const content = document.getElementById('tabContent');
    if (!content) return;

    const userRole = localStorage.getItem('USER_ROLE');
    const isHR = userRole === 'hr' || userRole === 'manager' || userRole === 'admin';

    content.innerHTML = `
        <div class="attendance-container">
            ${!isHR ? `
                <!-- EMPLOYEE VIEW -->
                <div class="section">
                    <h2>📍 Today's Check-in/out</h2>
                    <div style="display: flex; gap: 15px; margin: 20px 0;">
                        <button id="todayCheckin" class="btn btn-primary">✓ Check In</button>
                        <button id="todayCheckout" class="btn btn-success" disabled>✗ Check Out</button>
                    </div>
                    <div id="checkinStatus"></div>
                    <div id="checkoutStatus" style="margin-top: 15px;"></div>
                </div>

                <div class="section">
                    <h2>📊 My Attendance Records</h2>
                    <div style="margin-bottom: 15px;">
                        <select id="monthFilter" style="padding: 8px 12px; border-radius: 5px; border: 1px solid #ddd;">
                            <option value="${new Date().toISOString().slice(0, 7)}">Current Month</option>
                            <option value="${new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 7)}">Last Month</option>
                            <option value="${new Date(Date.now() - 60*24*60*60*1000).toISOString().slice(0, 7)}">2 Months Ago</option>
                        </select>
                    </div>
                    <div id="attendanceSummary" style="margin-bottom: 30px;"></div>
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Check In</th>
                                <th>Check Out</th>
                                <th>Status</th>
                                <th>Work Hours</th>
                                <th>Overtime</th>
                                <th>Late (min)</th>
                                <th>Bonus</th>
                                <th>Approved</th>
                            </tr>
                        </thead>
                        <tbody id="attendanceTableBody">
                            <tr><td colspan="9">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            ` : `
                <!-- HR/MANAGER VIEW -->
                <div class="section">
                    <h2>⚙️ HR Attendance Management</h2>
                    <div style="display: flex; gap: 15px; margin: 20px 0;">
                        <input type="text" id="employeeSearchHR" placeholder="Search employee by name/ID" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                        <select id="departmentFilterHR" style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            <option value="">All Departments</option>
                        </select>
                        <button class="btn btn-info" onclick="loadHRDashboard()">Refresh</button>
                    </div>
                </div>

                <div class="section">
                    <h2>📈 Attendance Dashboard</h2>
                    <div id="hrDashboard"></div>
                </div>

                <div class="section">
                    <h2>⚠️ Pending Approvals</h2>
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Date</th>
                                <th>Issue</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="pendingApprovalsBody">
                            <tr><td colspan="5">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <h2>➕ Manual Entry</h2>
                    <form id="manualEntryForm" style="display: grid; gap: 12px; max-width: 400px;">
                        <select id="manualEmp" required style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            <option value="">Select Employee</option>
                        </select>
                        <input type="date" id="manualDate" required style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                        <select id="manualStatus" required style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            <option value="">Select Status</option>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="half-day">Half Day</option>
                            <option value="leave">Leave</option>
                        </select>
                        <input type="number" id="manualHours" placeholder="Work Hours" min="0" max="12" step="0.5" style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                        <textarea id="manualNotes" placeholder="Notes" style="padding: 10px; border: 1px solid #ddd; border-radius: 5px; height: 80px;"></textarea>
                        <button type="submit" class="btn btn-success">Save Entry</button>
                    </form>
                </div>
            `}
        </div>
    `;

    // Attach event listeners after rendering
    document.getElementById('todayCheckin')?.addEventListener('click', handleCheckIn);
    document.getElementById('todayCheckout')?.addEventListener('click', handleCheckOut);
    document.getElementById('monthFilter')?.addEventListener('change', loadAttendanceRecords);
    document.getElementById('manualEntryForm')?.addEventListener('submit', handleManualEntry);

    if (isHR) {
        loadHRDashboard();
        loadPendingApprovals();
        loadEmployeeList();
    } else {
        loadAttendanceRecords();
    }
}

// ==================== HR FUNCTIONS ====================
async function loadHRDashboard() {
    try {
        const month = new Date().toISOString().slice(0, 7);
        const response = await fetch(`${ATTENDANCE_API}/dashboard?month=${month}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const stats = data.stats;

        document.getElementById('hrDashboard').innerHTML = `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h4>Total Employees</h4>
                    <p class="big-number">${stats.totalEmployees}</p>
                </div>
                <div class="dashboard-card">
                    <h4>Present</h4>
                    <p class="big-number" style="color: #27ae60;">${stats.presentDays}</p>
                </div>
                <div class="dashboard-card">
                    <h4>Absent</h4>
                    <p class="big-number" style="color: #e74c3c;">${stats.absentDays}</p>
                </div>
                <div class="dashboard-card">
                    <h4>Late</h4>
                    <p class="big-number" style="color: #f39c12;">${stats.lateDays}</p>
                </div>
                <div class="dashboard-card">
                    <h4>Avg Work Hours</h4>
                    <p class="big-number" style="color: #3498db;">${stats.averageWorkHours}h</p>
                </div>
                <div class="dashboard-card">
                    <h4>Overtime Hours</h4>
                    <p class="big-number" style="color: #9b59b6;">${stats.totalOvertimeHours}h</p>
                </div>
                <div class="dashboard-card">
                    <h4>Pending Approvals</h4>
                    <p class="big-number" style="color: #e67e22;">${stats.attendanceRequiringApproval}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

async function loadPendingApprovals() {
    try {
        // This would require a separate endpoint
        // For now, show placeholder
        const tbody = document.getElementById('pendingApprovalsBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5">Feature available with pending approvals endpoint</td></tr>';
        }
    } catch (error) {
        console.error('Pending approvals error:', error);
    }
}

async function loadEmployeeList() {
    try {
        // Load from employees endpoint
        const response = await fetch('/api/employees', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });
        const data = await response.json();
        
        if (data.employees) {
            const select = document.getElementById('manualEmp');
            select.innerHTML = '<option value="">Select Employee</option>' + 
                data.employees.map(e => `<option value="${e._id}">${e.name} (${e.jobId})</option>`).join('');
        }
    } catch (error) {
        console.error('Load employees error:', error);
    }
}

// ==================== MANUAL ENTRY ====================
async function handleManualEntry(e) {
    try {
        e.preventDefault();

        const response = await fetch(`${ATTENDANCE_API}/manual-entry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            },
            body: JSON.stringify({
                employeeId: document.getElementById('manualEmp').value,
                date: document.getElementById('manualDate').value,
                status: document.getElementById('manualStatus').value,
                workHours: parseFloat(document.getElementById('manualHours').value) || 0,
                notes: document.getElementById('manualNotes').value
            })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✓ Manual entry saved', 'success');
            e.target.reset();
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Manual entry error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// ==================== UTILITY ====================
function showNotification(message, type = 'info') {
    const div = document.createElement('div');
    div.className = `notification notification-${type}`;
    div.textContent = message;
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        border-radius: 5px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(div);
    
    setTimeout(() => div.remove(), 4000);
}
}

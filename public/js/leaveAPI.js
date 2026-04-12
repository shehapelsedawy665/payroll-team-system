/**
 * @file public/js/leaveAPI.js
 * @description Enhanced leave management UI with approval workflow
 */

const LEAVE_API = '/api/leave';

// ==================== INITIALIZE ====================
function initLeaveTab() {
    const content = document.getElementById('tabContent');
    if (!content) return;

    const userRole = localStorage.getItem('USER_ROLE');
    const isHR = userRole === 'hr' || userRole === 'manager' || userRole === 'admin';

    content.innerHTML = `
        <div class="leave-management">
            <!-- TAB NAVIGATION -->
            <div class="tab-pills" style="margin-bottom: 20px;">
                <button class="pill-btn active" onclick="switchLeaveTab('my-requests')">📋 My Requests</button>
                <button class="pill-btn" onclick="switchLeaveTab('new-request')">➕ New Request</button>
                <button class="pill-btn" onclick="switchLeaveTab('balance')">📊 My Balance</button>
                ${isHR ? `
                    <button class="pill-btn" onclick="switchLeaveTab('pending')">⏳ Pending</button>
                    <button class="pill-btn" onclick="switchLeaveTab('reports')">📈 Reports</button>
                ` : ''}
            </div>

            <!-- MY REQUESTS TAB -->
            <div id="leaveTab-my-requests" class="leave-tab active">
                <div class="section">
                    <h2>📋 My Leave Requests</h2>
                    <div style="margin-bottom: 15px;">
                        <select id="leaveStatusFilter" onchange="loadMyLeaveRequests()" style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            <option value="">All Statuses</option>
                            <option value="submitted">Submitted</option>
                            <option value="pending_manager">Pending Manager Approval</option>
                            <option value="pending_hr">Pending HR Approval</option>
                            <option value="approved">✓ Approved</option>
                            <option value="rejected">✗ Rejected</option>
                            <option value="cancelled">⊘ Cancelled</option>
                        </select>
                    </div>
                    <div id="myLeaveRequestsList"></div>
                </div>
            </div>

            <!-- NEW REQUEST TAB -->
            <div id="leaveTab-new-request" class="leave-tab" style="display: none;">
                <div class="section">
                    <h2>➕ Submit New Leave Request</h2>
                    <form id="newLeaveForm" style="display: grid; gap: 15px; max-width: 500px;">
                        <div>
                            <label>Leave Type *</label>
                            <select id="leaveTypeSelect" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                <option value="">Select Leave Type...</option>
                            </select>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <label>Start Date *</label>
                                <input type="date" id="leaveStartDate" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            </div>
                            <div>
                                <label>End Date *</label>
                                <input type="date" id="leaveEndDate" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            </div>
                        </div>

                        <div>
                            <label>Total Days: <strong id="leaveTotalDays">0</strong></label>
                            <p style="font-size: 12px; color: #666; margin-top: 5px;">Available: <strong id="leaveAvailable">0</strong> days</p>
                        </div>

                        <div>
                            <label>Reason for Leave</label>
                            <textarea id="leaveReason" placeholder="Explain your reason for leave (optional)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; height: 100px;"></textarea>
                        </div>

                        <div id="leaveEligibilityCheck" style="padding: 12px; border-radius: 5px; margin-bottom: 10px; display: none;"></div>

                        <div style="display: flex; gap: 10px;">
                            <button type="submit" class="btn btn-success" style="flex: 1;">✓ Submit Request</button>
                            <button type="button" class="btn btn-secondary" onclick="resetLeaveForm()" style="flex: 1;">✕ Clear</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- BALANCE TAB -->
            <div id="leaveTab-balance" class="leave-tab" style="display: none;">
                <div class="section">
                    <h2>📊 My Leave Balance</h2>
                    <div id="leaveBalanceCards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;"></div>
                </div>
            </div>

            <!-- PENDING REQUESTS (HR ONLY) -->
            ${isHR ? `
                <div id="leaveTab-pending" class="leave-tab" style="display: none;">
                    <div class="section">
                        <h2>⏳ Pending Approval</h2>
                        <div style="margin-bottom: 15px;">
                            <button class="btn btn-info" onclick="loadPendingLeaveRequests()">🔄 Refresh</button>
                        </div>
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Leave Type</th>
                                    <th>Dates</th>
                                    <th>Days</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="pendingLeaveTableBody">
                                <tr><td colspan="6">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- REPORTS (HR ONLY) -->
                <div id="leaveTab-reports" class="leave-tab" style="display: none;">
                    <div class="section">
                        <h2>📈 Leave Reports</h2>
                        <div id="leaveReportsContent" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;"></div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Setup event listeners
    document.getElementById('newLeaveForm')?.addEventListener('submit', submitLeaveRequest);
    document.getElementById('leaveStartDate')?.addEventListener('change', calculateLeaveDays);
    document.getElementById('leaveEndDate')?.addEventListener('change', calculateLeaveDays);
    document.getElementById('leaveTypeSelect')?.addEventListener('change', checkLeaveEligibility);

    // Load initial data
    loadLeaveTypes();
    loadMyLeaveRequests();
    loadLeaveBalance();
    
    if (isHR) {
        loadPendingLeaveRequests();
        loadLeaveReports();
    }
}

// ==================== TAB SWITCHING ====================
function switchLeaveTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.leave-tab').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    const tab = document.getElementById(`leaveTab-${tabName}`);
    if (tab) {
        tab.style.display = 'block';
        document.querySelector(`button[onclick="switchLeaveTab('${tabName}')"]`)?.classList.add('active');
    }

    // Load data for tab
    if (tabName === 'pending') {
        loadPendingLeaveRequests();
    } else if (tabName === 'reports') {
        loadLeaveReports();
    }
}

// ==================== LEAVE TYPES ====================
async function loadLeaveTypes() {
    try {
        const response = await fetch(`${LEAVE_API}/types`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const select = document.getElementById('leaveTypeSelect');
        if (select && data.types) {
            select.innerHTML = '<option value="">Select Leave Type...</option>' +
                data.types.map(t => `<option value="${t._id}">${t.name} (${t.nameEn})</option>`).join('');
        }
    } catch (error) {
        console.error('Load leave types error:', error);
    }
}

// ==================== MY LEAVE REQUESTS ====================
async function loadMyLeaveRequests() {
    try {
        const status = document.getElementById('leaveStatusFilter')?.value;
        const query = status ? `?status=${status}` : '';

        const response = await fetch(`${LEAVE_API}/my-requests${query}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const list = document.getElementById('myLeaveRequestsList');

        if (!data.requests || data.requests.length === 0) {
            list.innerHTML = '<p style="color: #999;">No leave requests found</p>';
            return;
        }

        list.innerHTML = data.requests.map(req => `
            <div class="leave-request-card" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 12px; background: #fafafa;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <div>
                        <h4 style="margin: 0 0 5px 0;">${req.leaveTypeId.nameEn}</h4>
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            ${new Date(req.startDate).toLocaleDateString()} → ${new Date(req.endDate).toLocaleDateString()}
                        </p>
                    </div>
                    <div>
                        <span class="badge badge-${req.status}" style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                            ${req.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666; margin-bottom: 10px;">
                    <span>📅 <strong>${req.totalDays}</strong> days</span>
                    <span>📝 ${req.reason ? req.reason.substring(0, 40) + '...' : 'No reason'}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    ${req.status !== 'approved' && req.status !== 'rejected' && req.status !== 'cancelled' ? `
                        <button class="btn btn-sm btn-danger" onclick="cancelLeaveRequest('${req._id}')">🗑️ Cancel</button>
                    ` : ''}
                    <button class="btn btn-sm btn-info" onclick="viewLeaveDetails('${req._id}')">👁️ View</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load leave requests error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// ==================== NEW LEAVE REQUEST ====================
function calculateLeaveDays() {
    const startDate = new Date(document.getElementById('leaveStartDate').value);
    const endDate = new Date(document.getElementById('leaveEndDate').value);

    if (!startDate || !endDate) return;

    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        // Count all days except Friday (5) and Saturday (6) - Egypt weekend
        if (dayOfWeek !== 5 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    document.getElementById('leaveTotalDays').textContent = count;
    checkLeaveEligibility();
}

async function checkLeaveEligibility() {
    try {
        const leaveTypeId = document.getElementById('leaveTypeSelect').value;
        const startDate = document.getElementById('leaveStartDate').value;
        const endDate = document.getElementById('leaveEndDate').value;
        const totalDays = parseInt(document.getElementById('leaveTotalDays').textContent) || 0;

        if (!leaveTypeId || !startDate || !endDate) {
            document.getElementById('leaveEligibilityCheck').style.display = 'none';
            return;
        }

        const response = await fetch(`${LEAVE_API}/check-eligibility?leaveTypeId=${leaveTypeId}&startDate=${startDate}&endDate=${endDate}&totalDays=${totalDays}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const checkDiv = document.getElementById('leaveEligibilityCheck');

        if (data.eligible) {
            checkDiv.innerHTML = `
                <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 5px;">
                    ✓ You are eligible for this leave.<br>
                    Available days: <strong>${data.availableDays}</strong><br>
                    Remaining after approval: <strong>${data.balanceRemaining}</strong>
                </div>
            `;
            checkDiv.style.display = 'block';
        } else {
            checkDiv.innerHTML = `
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 12px; border-radius: 5px;">
                    ✗ Not eligible: ${data.reason}<br>
                    Available days: <strong>${data.availableDays}</strong>
                </div>
            `;
            checkDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Check eligibility error:', error);
    }
}

async function submitLeaveRequest(e) {
    try {
        e.preventDefault();

        const response = await fetch(`${LEAVE_API}/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            },
            body: JSON.stringify({
                leaveTypeId: document.getElementById('leaveTypeSelect').value,
                startDate: document.getElementById('leaveStartDate').value,
                endDate: document.getElementById('leaveEndDate').value,
                reason: document.getElementById('leaveReason').value
            })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✓ Leave request submitted successfully!', 'success');
            resetLeaveForm();
            loadMyLeaveRequests();
            loadLeaveBalance();
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Submit leave error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function resetLeaveForm() {
    document.getElementById('newLeaveForm').reset();
    document.getElementById('leaveTotalDays').textContent = '0';
    document.getElementById('leaveAvailable').textContent = '0';
    document.getElementById('leaveEligibilityCheck').style.display = 'none';
}

async function cancelLeaveRequest(requestId) {
    if (!confirm('Cancel this leave request?')) return;

    try {
        const response = await fetch(`${LEAVE_API}/request/${requestId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            },
            body: JSON.stringify({
                reason: 'Employee cancelled'
            })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✓ Leave request cancelled', 'success');
            loadMyLeaveRequests();
            loadLeaveBalance();
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// ==================== LEAVE BALANCE ====================
async function loadLeaveBalance() {
    try {
        const response = await fetch(`${LEAVE_API}/balance`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const cardsDiv = document.getElementById('leaveBalanceCards');

        if (!data.balances || data.balances.length === 0) {
            cardsDiv.innerHTML = '<p style="color: #999;">No leave balances configured</p>';
            return;
        }

        cardsDiv.innerHTML = data.balances.map(balance => `
            <div class="balance-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
                <h4 style="margin: 0 0 10px 0;">${balance.leaveType}</h4>
                <p style="margin: 5px 0; font-size: 12px; opacity: 0.9;">Allocated: <strong>${balance.allocated}</strong></p>
                <p style="margin: 5px 0; font-size: 12px; opacity: 0.9;">Used: <strong>${balance.approved}</strong></p>
                <div style="margin-top: 15px; font-size: 24px; font-weight: 800;">${balance.remaining}</div>
                <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">Days Remaining</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load balance error:', error);
    }
}

// ==================== HR FUNCTIONS ====================
async function loadPendingLeaveRequests() {
    try {
        const response = await fetch(`${LEAVE_API}/pending`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const tbody = document.getElementById('pendingLeaveTableBody');

        if (!data.requests || data.requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No pending requests</td></tr>';
            return;
        }

        tbody.innerHTML = data.requests.map(req => `
            <tr>
                <td>${req.employeeId.name}</td>
                <td>${req.leaveTypeId.nameEn}</td>
                <td>${new Date(req.startDate).toLocaleDateString()} - ${new Date(req.endDate).toLocaleDateString()}</td>
                <td>${req.totalDays}</td>
                <td><span class="badge badge-${req.status}">${req.status.replace(/_/g, ' ')}</span></td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="approveLeaveRequest('${req._id}', 'approved')">✓ Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="approveLeaveRequest('${req._id}', 'rejected')">✗ Reject</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Load pending error:', error);
    }
}

async function approveLeaveRequest(requestId, action) {
    try {
        const note = prompt(`Enter ${action} note:`, '');
        if (note === null) return;

        let endpoint;
        const userRole = localStorage.getItem('USER_ROLE');
        
        if (userRole === 'manager') {
            endpoint = `${LEAVE_API}/request/${requestId}/manager-approve`;
        } else {
            endpoint = `${LEAVE_API}/request/${requestId}/hr-approve`;
        }

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            },
            body: JSON.stringify({
                action,
                notes: note
            })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification(`✓ Leave request ${action}`, 'success');
            loadPendingLeaveRequests();
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function loadLeaveReports() {
    try {
        const response = await fetch(`${LEAVE_API}/company-report`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const content = document.getElementById('leaveReportsContent');

        if (data.reports) {
            content.innerHTML = `
                <div class="report-card" style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; text-align: center;">
                    <h3 style="margin: 0 0 10px 0; color: #155724;">✓ Approved</h3>
                    <p style="margin: 0; font-size: 28px; font-weight: 800; color: #155724;">${data.reports.approved}</p>
                </div>
                <div class="report-card" style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; text-align: center;">
                    <h3 style="margin: 0 0 10px 0; color: #856404;">⏳ Pending</h3>
                    <p style="margin: 0; font-size: 28px; font-weight: 800; color: #856404;">${data.reports.pending}</p>
                </div>
                <div class="report-card" style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; text-align: center;">
                    <h3 style="margin: 0 0 10px 0; color: #721c24;">✗ Rejected</h3>
                    <p style="margin: 0; font-size: 28px; font-weight: 800; color: #721c24;">${data.reports.rejected}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load reports error:', error);
    }
}

// ==================== UTILITY ====================
function viewLeaveDetails(requestId) {
    // Placeholder for detailed view
    showNotification(`Opening details for request: ${requestId}`, 'info');
}

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

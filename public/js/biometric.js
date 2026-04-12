/**
 * @file public/js/biometric.js
 * @description Biometric device management interface
 */

const BIOMETRIC_API = '/api/biometric';

// ==================== INITIALIZE ====================
function initBiometricTab() {
    const content = document.getElementById('tabContent');
    if (!content) return;

    const userRole = localStorage.getItem('USER_ROLE');
    const isHR = userRole === 'hr' || userRole === 'manager' || userRole === 'admin';

    if (!isHR) {
        content.innerHTML = '<div class="section"><p>❌ Only HR/Managers can access biometric management</p></div>';
        return;
    }

    content.innerHTML = `
        <div class="biometric-management">
            <!-- TAB NAVIGATION -->
            <div class="tab-pills" style="margin-bottom: 20px;">
                <button class="pill-btn active" onclick="switchBioTab('devices')">📱 Devices</button>
                <button class="pill-btn" onclick="switchBioTab('enrollments')">👥 Enrollments</button>
                <button class="pill-btn" onclick="switchBioTab('sync-status')">🔄 Sync Status</button>
            </div>

            <!-- DEVICES TAB -->
            <div id="bioTab-devices" class="bio-tab active">
                <div class="section">
                    <h2>📱 Biometric Devices</h2>
                    <button class="btn btn-primary" onclick="openDeviceModal('register')">+ Register New Device</button>
                    <div id="deviceList" style="margin-top: 20px;"></div>
                </div>
            </div>

            <!-- ENROLLMENTS TAB -->
            <div id="bioTab-enrollments" class="bio-tab" style="display: none;">
                <div class="section">
                    <h2>👥 Employee Enrollments</h2>
                    <div style="margin-bottom: 15px;">
                        <select id="enrollmentDeviceFilter" onchange="loadEnrollments()" style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            <option value="">Select Device...</option>
                        </select>
                    </div>
                    <div id="enrollmentList" style="margin-top: 20px;"></div>
                </div>
            </div>

            <!-- SYNC STATUS TAB -->
            <div id="bioTab-sync-status" class="bio-tab" style="display: none;">
                <div class="section">
                    <h2>🔄 Device Sync Status</h2>
                    <button class="btn btn-success" onclick="loadSyncStatus()">🔄 Refresh</button>
                    <div id="syncStatusList" style="margin-top: 20px;"></div>
                </div>
            </div>
        </div>
    `;

    // Load initial data
    loadDevices();
    loadEnrollmentDeviceList();
    loadSyncStatus();

    // Setup form listeners
    setupBiometricListeners();
}

// ==================== TAB SWITCHING ====================
function switchBioTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.bio-tab').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    const tab = document.getElementById(`bioTab-${tabName}`);
    if (tab) {
        tab.style.display = 'block';
        document.querySelector(`button[onclick="switchBioTab('${tabName}')"]`).classList.add('active');
    }

    // Load data for tab
    if (tabName === 'enrollments') {
        loadEnrollments();
    } else if (tabName === 'sync-status') {
        loadSyncStatus();
    }
}

// ==================== DEVICE MANAGEMENT ====================
async function loadDevices() {
    try {
        const response = await fetch(`${BIOMETRIC_API}/devices`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const deviceList = document.getElementById('deviceList');

        if (!data.devices || data.devices.length === 0) {
            deviceList.innerHTML = '<p style="color: #999;">No devices registered yet</p>';
            return;
        }

        deviceList.innerHTML = data.devices.map(device => `
            <div class="device-card" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #f9f9f9;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4 style="margin: 0 0 8px 0;">${device.deviceName}</h4>
                        <p style="margin: 5px 0; font-size: 12px; color: #666;">
                            <strong>Type:</strong> ${device.deviceType}<br>
                            <strong>Serial:</strong> ${device.serialNumber}<br>
                            <strong>Location:</strong> ${device.location || 'N/A'}<br>
                            <strong>Enrolled:</strong> ${device.enrolledEmployees?.length || 0} employees<br>
                            <strong>Status:</strong> <span style="color: ${device.isActive ? '#27ae60' : '#e74c3c'};">
                                ${device.isActive ? '✓ Active' : '✗ Inactive'}
                            </span>
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px; flex-direction: column;">
                        <button class="btn btn-sm btn-info" onclick="testDeviceConnection('${device._id}')">Test</button>
                        <button class="btn btn-sm btn-warning" onclick="editDevice('${device._id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteDevice('${device._id}')">Delete</button>
                        <button class="btn btn-sm btn-success" onclick="syncDevice('${device._id}')">Sync</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load devices error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function openDeviceModal(action, deviceId = null) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>${action === 'register' ? 'Register New Device' : 'Edit Device'}</h3>
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <form id="deviceForm" style="display: grid; gap: 12px;">
                <input type="hidden" id="deviceId" value="${deviceId || ''}">
                
                <div>
                    <label>Device Name *</label>
                    <input type="text" id="deviceName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                </div>

                <div>
                    <label>Device Type *</label>
                    <select id="deviceType" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                        <option value="">Select Type</option>
                        <option value="fingerprint">🔍 Fingerprint</option>
                        <option value="face-recognition">😊 Face Recognition</option>
                        <option value="iris">👁️ Iris Scanner</option>
                        <option value="rfid">📡 RFID</option>
                        <option value="qr-code">📱 QR Code</option>
                        <option value="manual">✋ Manual</option>
                    </select>
                </div>

                <div>
                    <label>Serial Number *</label>
                    <input type="text" id="serialNumber" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;" ${action === 'edit' ? 'disabled' : ''}>
                </div>

                <div>
                    <label>Location</label>
                    <input type="text" id="location" placeholder="e.g., Main Gate, Floor 2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label>Latitude</label>
                        <input type="number" id="latitude" step="0.0001" placeholder="30.0444" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                    </div>
                    <div>
                        <label>Longitude</label>
                        <input type="number" id="longitude" step="0.0001" placeholder="31.2357" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                    </div>
                </div>

                <div>
                    <label>Allowed Radius (meters)</label>
                    <input type="number" id="allowedRadius" value="100" min="0" max="1000" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                </div>

                <div>
                    <label>API Endpoint</label>
                    <input type="url" id="apiEndpoint" placeholder="https://device-api.example.com" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                </div>

                <div>
                    <label>API Key</label>
                    <input type="text" id="apiKey" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                </div>

                <div>
                    <label>API Secret</label>
                    <input type="password" id="apiSecret" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                </div>

                <div style="display: flex; gap: 10px;">
                    <button type="submit" class="btn btn-success" style="flex: 1;">Save Device</button>
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex: 1;">Cancel</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Load existing data if edit mode
    if (action === 'edit' && deviceId) {
        loadDeviceData(deviceId);
    }

    document.getElementById('deviceForm').addEventListener('submit', saveDevice);
}

async function loadDeviceData(deviceId) {
    // This would load existing device data to populate the form
    // For simplicity, skipping for now
}

async function saveDevice(e) {
    try {
        e.preventDefault();

        const deviceId = document.getElementById('deviceId').value;
        const action = deviceId ? 'PUT' : 'POST';
        const endpoint = deviceId ? `/api/biometric/device/${deviceId}` : '/api/biometric/device/register';

        const body = {
            deviceName: document.getElementById('deviceName').value,
            deviceType: document.getElementById('deviceType').value,
            serialNumber: document.getElementById('serialNumber').value,
            location: document.getElementById('location').value,
            latitude: parseFloat(document.getElementById('latitude').value) || null,
            longitude: parseFloat(document.getElementById('longitude').value) || null,
            allowedRadius: parseInt(document.getElementById('allowedRadius').value) || 100,
            apiEndpoint: document.getElementById('apiEndpoint').value,
            apiKey: document.getElementById('apiKey').value,
            apiSecret: document.getElementById('apiSecret').value
        };

        const response = await fetch(endpoint, {
            method: action,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (response.ok) {
            showNotification(`✓ Device ${deviceId ? 'updated' : 'registered'} successfully`, 'success');
            document.querySelector('.modal-overlay').remove();
            loadDevices();
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Save device error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function testDeviceConnection(deviceId) {
    try {
        const response = await fetch(`${BIOMETRIC_API}/test-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            },
            body: JSON.stringify({ deviceId })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('✓ Device is online and responding', 'success');
        } else {
            showNotification(`⚠️ ${data.message}`, 'error');
        }
    } catch (error) {
        showNotification(`Connection test error: ${error.message}`, 'error');
    }
}

async function syncDevice(deviceId) {
    try {
        const response = await fetch(`${BIOMETRIC_API}/device/${deviceId}/sync-employees`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();

        if (data.success) {
            showNotification('🔄 Sync triggered successfully', 'success');
            loadSyncStatus();
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Sync error: ${error.message}`, 'error');
    }
}

async function deleteDevice(deviceId) {
    if (!confirm('Are you sure you want to delete this device?')) return;

    try {
        const response = await fetch(`${BIOMETRIC_API}/device/${deviceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        if (response.ok) {
            showNotification('✓ Device deleted', 'success');
            loadDevices();
        } else {
            const data = await response.json();
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Delete error: ${error.message}`, 'error');
    }
}

function editDevice(deviceId) {
    openDeviceModal('edit', deviceId);
}

// ==================== ENROLLMENT MANAGEMENT ====================
async function loadEnrollmentDeviceList() {
    try {
        const response = await fetch(`${BIOMETRIC_API}/devices`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const select = document.getElementById('enrollmentDeviceFilter');
        if (select && data.devices) {
            select.innerHTML = '<option value="">Select Device...</option>' +
                data.devices.map(d => `<option value="${d._id}">${d.deviceName}</option>`).join('');
        }
    } catch (error) {
        console.error('Load device list error:', error);
    }
}

async function loadEnrollments() {
    try {
        const deviceId = document.getElementById('enrollmentDeviceFilter')?.value;
        if (!deviceId) {
            document.getElementById('enrollmentList').innerHTML = '<p style="color: #999;">Select a device to view enrollments</p>';
            return;
        }

        const response = await fetch(`${BIOMETRIC_API}/device/${deviceId}/enrollments`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const list = document.getElementById('enrollmentList');

        if (!data.enrollments || data.enrollments.length === 0) {
            list.innerHTML = '<p style="color: #999;">No employees enrolled in this device</p>';
            return;
        }

        list.innerHTML = `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Employee Name</th>
                        <th>Job ID</th>
                        <th>Email</th>
                        <th>Enrolled Date</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.enrollments.map(enr => `
                        <tr>
                            <td>${enr.employeeId.name}</td>
                            <td>${enr.employeeId.jobId}</td>
                            <td>${enr.employeeId.email}</td>
                            <td>${new Date(enr.enrolledAt).toLocaleDateString()}</td>
                            <td><span class="badge badge-${enr.enrollmentStatus}">${enr.enrollmentStatus}</span></td>
                            <td>
                                <button class="btn btn-sm btn-danger" onclick="unenrollEmployee('${document.getElementById('enrollmentDeviceFilter').value}', '${enr.employeeId._id}')">Unenroll</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Load enrollments error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function unenrollEmployee(deviceId, employeeId) {
    if (!confirm('Unenroll this employee from the device?')) return;

    try {
        const response = await fetch(`${BIOMETRIC_API}/device/${deviceId}/enroll/${employeeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✓ Employee unenrolled', 'success');
            loadEnrollments();
        } else {
            showNotification(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Unenroll error: ${error.message}`, 'error');
    }
}

// ==================== SYNC STATUS ====================
async function loadSyncStatus() {
    try {
        const response = await fetch(`${BIOMETRIC_API}/sync-status`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('AUTH_TOKEN')}`
            }
        });

        const data = await response.json();
        const list = document.getElementById('syncStatusList');

        if (!data.devices || data.devices.length === 0) {
            list.innerHTML = '<p style="color: #999;">No devices configured</p>';
            return;
        }

        list.innerHTML = `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Device Name</th>
                        <th>Status</th>
                        <th>Enrolled</th>
                        <th>Last Synced</th>
                        <th>Time Since Sync</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.devices.map(dev => `
                        <tr style="background: ${dev.minutesSinceSync === 'Never' || dev.minutesSinceSync > 60 ? '#fff3cd' : '#f0f0f0'};">
                            <td><strong>${dev.deviceName}</strong></td>
                            <td><span style="color: ${dev.isActive ? '#27ae60' : '#e74c3c'};">${dev.isActive ? '✓ Active' : '✗ Inactive'}</span></td>
                            <td>${dev.enrolledCount}</td>
                            <td>${dev.lastSyncedAt ? new Date(dev.lastSyncedAt).toLocaleString() : 'Never'}</td>
                            <td>${typeof dev.minutesSinceSync === 'number' ? `${dev.minutesSinceSync} min ago` : dev.minutesSinceSync}</td>
                            <td>
                                <button class="btn btn-sm btn-success" onclick="syncDevice('${dev.deviceId}')">Sync Now</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Load sync status error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// ==================== UTILITY ====================
function setupBiometricListeners() {
    // Additional setup if needed
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

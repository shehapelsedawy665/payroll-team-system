/**
 * @file public/js/appraisal.js
 * @description Frontend appraisal management interface
 */

class AppraisalManager {
    constructor() {
        this.currentCycle = null;
        this.currentAppraisal = null;
        this.appraisalForm = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadCycles();
    }

    setupEventListeners() {
        // Cycle management
        document.getElementById('newCycleBtn')?.addEventListener('click', () => this.showNewCycleModal());
        document.getElementById('saveCycleBtn')?.addEventListener('click', () => this.createCycle());
        document.getElementById('closeCycleBtn')?.addEventListener('click', () => this.closeCycle());

        // Appraisal form
        document.getElementById('startAppraisalBtn')?.addEventListener('click', () => this.startAppraisal());
        document.getElementById('submitSelfAssessmentBtn')?.addEventListener('click', () => this.submitSelfAssessment());
        document.getElementById('submitManagerRatingBtn')?.addEventListener('click', () => this.submitManagerRating());
        document.getElementById('saveDraftBtn')?.addEventListener('click', () => this.saveDraft());

        // Tab navigation
        document.querySelectorAll('.appraisal-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.value));
        });
    }

    /**
     * Load all appraisal cycles
     */
    async loadCycles() {
        try {
            const response = await fetch('/api/appraisal/cycles', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!response.ok) throw new Error('Failed to load cycles');

            const data = await response.json();
            this.renderCycles(data.cycles);
        } catch (error) {
            showAlert('خطأ في تحميل الدورات: ' + error.message, 'error');
        }
    }

    /**
     * Render cycles list
     */
    renderCycles(cycles) {
        const container = document.getElementById('cyclesContainer');
        if (!container) return;

        if (cycles.length === 0) {
            container.innerHTML = '<p class="text-muted">لا توجد دورات تقييم</p>';
            return;
        }

        container.innerHTML = cycles.map(cycle => `
            <div class="cycle-card" onclick="appraisalManager.selectCycle('${cycle._id}')">
                <h4>${cycle.name}</h4>
                <p class="text-muted">من ${new Date(cycle.startDate).toLocaleDateString('ar')} إلى ${new Date(cycle.endDate).toLocaleDateString('ar')}</p>
                <div class="status-badge badge-${cycle.status.toLowerCase()}">${this.getStatusLabel(cycle.status)}</div>
                <div class="progress" style="margin-top: 10px;">
                    <div class="progress-bar" style="width: ${cycle.completionPercentage || 0}%"></div>
                </div>
                <small>${cycle.completionPercentage || 0}% مكتمل</small>
            </div>
        `).join('');
    }

    /**
     * Show modal to create new cycle
     */
    showNewCycleModal() {
        const today = new Date().toISOString().split('T')[0];
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        document.getElementById('cycleModal').innerHTML = `
            <div class="modal-content">
                <h3>إنشاء دورة تقييم جديدة</h3>
                <form id="cycleForm">
                    <div class="form-group">
                        <label>اسم الدورة</label>
                        <input type="text" id="cycleName" class="form-control" required>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>تاريخ البداية</label>
                                <input type="date" id="cycleStart" class="form-control" value="${today}" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>تاريخ النهاية</label>
                                <input type="date" id="cycleEnd" class="form-control" value="${nextMonth.toISOString().split('T')[0]}" required>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>نموذج التقييم</label>
                        <select id="templateId" class="form-control" required></select>
                    </div>
                    <div class="form-group">
                        <label>الوصف</label>
                        <textarea id="cycleDescription" class="form-control" rows="3"></textarea>
                    </div>
                    <div class="button-group">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-content').remove()">إلغاء</button>
                        <button type="submit" class="btn btn-primary">إنشاء</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('cycleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCycle();
        });

        this.loadTemplates('templateId');
        document.getElementById('cycleModal').style.display = 'block';
    }

    /**
     * Create new appraisal cycle
     */
    async createCycle() {
        try {
            const cycleData = {
                name: document.getElementById('cycleName').value,
                startDate: document.getElementById('cycleStart').value,
                endDate: document.getElementById('cycleEnd').value,
                templateId: document.getElementById('templateId').value,
                description: document.getElementById('cycleDescription').value
            };

            const response = await fetch('/api/appraisal/cycles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(cycleData)
            });

            if (!response.ok) throw new Error('Failed to create cycle');

            showAlert('تم إنشاء دورة التقييم بنجاح', 'success');
            document.getElementById('cycleModal').style.display = 'none';
            await this.loadCycles();
        } catch (error) {
            showAlert('خطأ: ' + error.message, 'error');
        }
    }

    /**
     * Select a cycle and load its appraisals
     */
    async selectCycle(cycleId) {
        this.currentCycle = cycleId;
        await this.loadAppraisalsByCycle(cycleId);
        await this.loadCycleSummary(cycleId);
    }

    /**
     * Load appraisals for selected cycle
     */
    async loadAppraisalsByCycle(cycleId) {
        try {
            const response = await fetch(`/api/appraisal/cycles/${cycleId}/appraisals`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!response.ok) throw new Error('Failed to load appraisals');

            const data = await response.json();
            this.renderAppraisalsList(data.appraisals);
        } catch (error) {
            showAlert('خطأ: ' + error.message, 'error');
        }
    }

    /**
     * Render appraisals list
     */
    renderAppraisalsList(appraisals) {
        const container = document.getElementById('appraisalsContainer');
        if (!container) return;

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>الموظف</th>
                        <th>المدير</th>
                        <th>الحالة</th>
                        <th>التقييم</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${appraisals.map(a => `
                        <tr>
                            <td>${a.employeeId?.name || 'N/A'}</td>
                            <td>${a.managerId?.name || 'لم يتم التعيين'}</td>
                            <td><span class="badge badge-${a.status.toLowerCase()}">${this.getStatusLabel(a.status)}</span></td>
                            <td>
                                <span class="rating-badge badge-${a.scores?.finalRating?.toLowerCase() || 'pending'}">
                                    ${a.scores?.finalRating || '-'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="appraisalManager.openAppraisal('${a._id}')">عرض</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * Load and display cycle summary
     */
    async loadCycleSummary(cycleId) {
        try {
            const response = await fetch(`/api/appraisal/cycles/${cycleId}/summary`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!response.ok) throw new Error('Failed to load summary');

            const summary = await response.json();
            this.renderCycleSummary(summary);
        } catch (error) {
            console.log('Could not load summary:', error.message);
        }
    }

    /**
     * Render cycle summary
     */
    renderCycleSummary(summary) {
        const container = document.getElementById('cycleSummary');
        if (!container) return;

        const ratingPercentages = {
            exceptional: ((summary.ratingDistribution?.exceptional || 0) / summary.total * 100).toFixed(1),
            exceeds: ((summary.ratingDistribution?.exceeds || 0) / summary.total * 100).toFixed(1),
            meets: ((summary.ratingDistribution?.meets || 0) / summary.total * 100).toFixed(1),
            below: ((summary.ratingDistribution?.below || 0) / summary.total * 100).toFixed(1),
            unsatisfactory: ((summary.ratingDistribution?.unsatisfactory || 0) / summary.total * 100).toFixed(1)
        };

        container.innerHTML = `
            <div class="summary-grid">
                <div class="summary-card">
                    <h5>إجمالي التقييمات</h5>
                    <h2>${summary.total}</h2>
                </div>
                <div class="summary-card">
                    <h5>مكتملة</h5>
                    <h2>${summary.approved}</h2>
                </div>
                <div class="summary-card">
                    <h5>قيد المراجعة</h5>
                    <h2>${summary.managerSubmitted}</h2>
                </div>
                <div class="summary-card">
                    <h5>مسودات</h5>
                    <h2>${summary.draft}</h2>
                </div>
            </div>
            <div class="rating-distribution">
                <h5>توزيع التقييمات</h5>
                <div class="distribution-bars">
                    <div class="bar-item">
                        <span>استثنائي</span>
                        <div class="bar" style="width: ${ratingPercentages.exceptional}%">
                            ${ratingPercentages.exceptional}%
                        </div>
                    </div>
                    <div class="bar-item">
                        <span>يتجاوز</span>
                        <div class="bar" style="width: ${ratingPercentages.exceeds}%">
                            ${ratingPercentages.exceeds}%
                        </div>
                    </div>
                    <div class="bar-item">
                        <span>يفي بالمتطلبات</span>
                        <div class="bar" style="width: ${ratingPercentages.meets}%">
                            ${ratingPercentages.meets}%
                        </div>
                    </div>
                    <div class="bar-item">
                        <span>أقل من المطلوب</span>
                        <div class="bar" style="width: ${ratingPercentages.below}%">
                            ${ratingPercentages.below}%
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Open appraisal form
     */
    async openAppraisal(appraisalId) {
        try {
            const response = await fetch(`/api/appraisal/forms/${appraisalId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!response.ok) throw new Error('Failed to load appraisal');

            this.currentAppraisal = await response.json();
            this.renderAppraisalForm();
            document.getElementById('appraisalFormModal').style.display = 'block';
        } catch (error) {
            showAlert('خطأ: ' + error.message, 'error');
        }
    }

    /**
     * Render appraisal form
     */
    renderAppraisalForm() {
        const form = document.getElementById('appraisalForm');
        if (!form) return;

        const employeeName = this.currentAppraisal.employeeId?.name || 'Unknown';
        const templateId = this.currentAppraisal.templateId?._id;

        form.innerHTML = `
            <h3>نموذج التقييم - ${employeeName}</h3>
            <div class="form-tabs">
                <button type="button" class="appraisal-tab active" value="self">التقييم الذاتي</button>
                <button type="button" class="appraisal-tab" value="manager">تقييم المدير</button>
                <button type="button" class="appraisal-tab" value="goals">الأهداف</button>
            </div>

            <div class="tab-content">
                <!-- Self Assessment Tab -->
                <div id="self-tab" class="tab-pane active">
                    <h4>التقييم الذاتي</h4>
                    <div id="selfCompetencies"></div>
                </div>

                <!-- Manager Assessment Tab -->
                <div id="manager-tab" class="tab-pane">
                    <h4>تقييم المدير</h4>
                    <div id="managerCompetencies"></div>
                </div>

                <!-- Goals Tab -->
                <div id="goals-tab" class="tab-pane">
                    <h4>الأهداف والإنجازات</h4>
                    <div id="goalsContainer"></div>
                </div>
            </div>

            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('appraisalFormModal').style.display = 'none'">إغلاق</button>
                ${this.currentAppraisal.status === 'draft' ? `
                    <button type="button" class="btn btn-warning" id="saveDraftBtn">حفظ كمسودة</button>
                ` : ''}
                ${this.currentAppraisal.status === 'draft' || this.currentAppraisal.status === 'employee-submitted' ? `
                    <button type="button" class="btn btn-success" id="submitSelfAssessmentBtn">إرسال التقييم الذاتي</button>
                ` : ''}
                ${this.currentAppraisal.status === 'employee-submitted' && this.isManager() ? `
                    <button type="button" class="btn btn-success" id="submitManagerRatingBtn">إرسال تقييم المدير</button>
                ` : ''}
            </div>
        `;

        // Re-attach event listeners
        this.setupEventListeners();

        // Load competencies
        if (templateId) {
            this.loadCompetencies(templateId);
        }
    }

    /**
     * Load competencies from template
     */
    async loadCompetencies(templateId) {
        try {
            const response = await fetch(`/api/appraisal/templates/${templateId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!response.ok) throw new Error('Failed to load template');

            const template = await response.json();
            this.renderCompetencies(template.competencies);
        } catch (error) {
            console.log('Could not load competencies:', error.message);
        }
    }

    /**
     * Render competency ratings
     */
    renderCompetencies(competencies) {
        if (!competencies || competencies.length === 0) return;

        const selfContainer = document.getElementById('selfCompetencies');
        const managerContainer = document.getElementById('managerCompetencies');

        const selfHTML = competencies.map((comp, idx) => `
            <div class="competency-row">
                <h5>${comp.name}</h5>
                <p class="text-muted">${comp.description}</p>
                <div class="rating-scale">
                    ${comp.proficiencyLevels?.map(level => `
                        <label class="rating-option">
                            <input type="radio" name="self_${idx}" value="${level.level}" ${this.currentAppraisal.employeeSelfRating?.competencies?.[idx]?.rating == level.level ? 'checked' : ''}>
                            <span>${level.label}</span>
                        </label>
                    `).join('')}
                </div>
                <textarea class="form-control mt-2" placeholder="تعليقاتك..." rows="2" id="self_comment_${idx}">${this.currentAppraisal.employeeSelfRating?.competencies?.[idx]?.selfComment || ''}</textarea>
            </div>
        `).join('');

        const managerHTML = competencies.map((comp, idx) => `
            <div class="competency-row">
                <h5>${comp.name}</h5>
                <p class="text-muted">${comp.description}</p>
                <div class="rating-scale">
                    ${comp.proficiencyLevels?.map(level => `
                        <label class="rating-option">
                            <input type="radio" name="manager_${idx}" value="${level.level}" ${this.currentAppraisal.managerRating?.competencies?.[idx]?.rating == level.level ? 'checked' : ''}>
                            <span>${level.label}</span>
                        </label>
                    `).join('')}
                </div>
                <textarea class="form-control mt-2" placeholder="تعليقات المدير..." rows="2" id="manager_comment_${idx}">${this.currentAppraisal.managerRating?.competencies?.[idx]?.managerComment || ''}</textarea>
            </div>
        `).join('');

        if (selfContainer) selfContainer.innerHTML = selfHTML;
        if (managerContainer) managerContainer.innerHTML = managerHTML;
    }

    /**
     * Submit self-assessment
     */
    async submitSelfAssessment() {
        try {
            const competencies = [];
            const selfRatings = document.querySelectorAll('input[name^="self_"]:checked');
            
            selfRatings.forEach(radio => {
                const idx = radio.name.split('_')[1];
                competencies.push({
                    rating: parseInt(radio.value),
                    selfComment: document.getElementById(`self_comment_${idx}`)?.value || ''
                });
            });

            const response = await fetch(`/api/appraisal/forms/${this.currentAppraisal._id}/self-assessment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ competencies })
            });

            if (!response.ok) throw new Error('Failed to submit');

            showAlert('تم إرسال التقييم الذاتي بنجاح', 'success');
            document.getElementById('appraisalFormModal').style.display = 'none';
            await this.loadAppraisalsByCycle(this.currentCycle);
        } catch (error) {
            showAlert('خطأ: ' + error.message, 'error');
        }
    }

    /**
     * Submit manager rating
     */
    async submitManagerRating() {
        try {
            const competencies = [];
            const managerRatings = document.querySelectorAll('input[name^="manager_"]:checked');
            
            managerRatings.forEach(radio => {
                const idx = radio.name.split('_')[1];
                competencies.push({
                    rating: parseInt(radio.value),
                    managerComment: document.getElementById(`manager_comment_${idx}`)?.value || ''
                });
            });

            const response = await fetch(`/api/appraisal/forms/${this.currentAppraisal._id}/manager-rating`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ competencies })
            });

            if (!response.ok) throw new Error('Failed to submit');

            showAlert('تم إرسال تقييم المدير بنجاح', 'success');
            document.getElementById('appraisalFormModal').style.display = 'none';
            await this.loadAppraisalsByCycle(this.currentCycle);
        } catch (error) {
            showAlert('خطأ: ' + error.message, 'error');
        }
    }

    /**
     * Load templates for dropdown
     */
    async loadTemplates(selectId) {
        try {
            const response = await fetch('/api/appraisal/templates', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!response.ok) throw new Error('Failed to load templates');

            const data = await response.json();
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = data.templates.map(t => 
                    `<option value="${t._id}">${t.name}</option>`
                ).join('');
            }
        } catch (error) {
            console.log('Error loading templates:', error.message);
        }
    }

    /**
     * Switch tabs
     */
    switchTab(tabName) {
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        document.querySelectorAll('.appraisal-tab').forEach(tab => tab.classList.remove('active'));
        
        document.getElementById(`${tabName}-tab`)?.classList.add('active');
        event.target.classList.add('active');
    }

    /**
     * Get status label in Arabic
     */
    getStatusLabel(status) {
        const labels = {
            'draft': 'مسودة',
            'employee-submitted': 'مرسلة من الموظف',
            'manager-review': 'قيد مراجعة المدير',
            'manager-submitted': 'مرسلة من المدير',
            'calibration': 'قيد المعايرة',
            'approved': 'معتمدة',
            'archived': 'مؤرشفة',
            'active': 'نشطة',
            'pending': 'قيد الانتظار',
            'closed': 'مغلقة'
        };
        return labels[status] || status;
    }

    /**
     * Check if current user is manager
     */
    isManager() {
        // This should be obtained from the current user's role
        return true; // Placeholder
    }
}

// Initialize on page load
let appraisalManager;
document.addEventListener('DOMContentLoaded', () => {
    appraisalManager = new AppraisalManager();
});

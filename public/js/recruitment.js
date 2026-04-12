// Recruitment Management System
class RecruitmentManager {
    constructor() {
        this.apiBaseUrl = '/api/recruitment';
        this.onboardingUrl = '/api/onboarding';
        this.jobs = [];
        this.candidates = [];
        this.offers = [];
    }

    async loadJobs() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/job-postings`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await response.json();
            
            if (data.success) {
                this.jobs = data.jobPostings;
                this.renderJobs();
                this.updateJobFilters();
            }
        } catch (error) {
            console.error('Error loading jobs:', error);
            showAlert('Failed to load job postings', 'error');
        }
    }

    renderJobs() {
        const container = document.getElementById('jobsList');
        container.innerHTML = '';
        
        if (this.jobs.length === 0) {
            container.innerHTML = '<div class="card"><p>No job postings yet</p></div>';
            return;
        }
        
        this.jobs.forEach(job => {
            const statusClass = `status-${job.status}`;
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h3>${job.jobTitle}</h3>
                        <p><strong>Department:</strong> ${job.department}</p>
                        <p><strong>Experience:</strong> ${job.experience}</p>
                        <p>${job.description.substring(0, 100)}...</p>
                        <p><strong>Salary:</strong> SAR ${job.salaryRange?.min?.toLocaleString()} - ${job.salaryRange?.max?.toLocaleString()}</p>
                        <p><strong>Applicants:</strong> ${job.applicantsCount}</p>
                    </div>
                    <div>
                        <span class="status-badge ${statusClass}">${job.status.toUpperCase()}</span>
                        <div style="margin-top: 10px;">
                            ${job.status === 'draft' ? `<button class="btn btn-primary btn-sm" onclick="recruitmentMgr.publishJob('${job._id}')">Publish</button>` : ''}
                            <button class="btn btn-secondary btn-sm" onclick="recruitmentMgr.viewJobCandidates('${job._id}')">View Candidates</button>
                            <button class="btn btn-secondary btn-sm" onclick="recruitmentMgr.viewJobPipeline('${job._id}')">Pipeline</button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    async createJob() {
        const jobTitle = document.getElementById('jobTitle').value;
        const department = document.getElementById('jobDept').value;
        const description = document.getElementById('jobDesc').value;
        const experience = document.getElementById('jobExp').value;
        const salaryMin = document.getElementById('salaryMin').value;
        const salaryMax = document.getElementById('salaryMax').value;
        
        if (!jobTitle || !department || !description) {
            showAlert('Please fill required fields', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/job-postings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    jobTitle,
                    department,
                    description,
                    experience,
                    salaryRange: { min: parseInt(salaryMin), max: parseInt(salaryMax) },
                    skills: [],
                    requirements: []
                })
            });
            
            const data = await response.json();
            if (data.success) {
                showAlert('Job posting created successfully');
                closeModal('jobModal');
                this.loadJobs();
            }
        } catch (error) {
            console.error('Error creating job:', error);
            showAlert('Failed to create job posting', 'error');
        }
    }

    async publishJob(jobId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/job-postings/${jobId}/publish`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const data = await response.json();
            if (data.success) {
                showAlert('Job published successfully');
                this.loadJobs();
            }
        } catch (error) {
            console.error('Error publishing job:', error);
            showAlert('Failed to publish job', 'error');
        }
    }

    async viewJobCandidates(jobId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/job-postings/${jobId}/candidates`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const data = await response.json();
            if (data.success) {
                const job = this.jobs.find(j => j._id === jobId);
                alert(`${data.count} candidates applied for ${job.jobTitle}`);
            }
        } catch (error) {
            console.error('Error loading candidates:', error);
        }
    }

    async viewJobPipeline(jobId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/job-postings/${jobId}/pipeline`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const data = await response.json();
            if (data.success && data.pipeline) {
                const pipeline = data.pipeline.pipelineBreakdown;
                let summary = 'Hiring Pipeline:\n';
                Object.keys(pipeline).forEach(stage => {
                    summary += `${stage}: ${pipeline[stage]}\n`;
                });
                summary += `\nConversion Rate: ${data.pipeline.conversionRate}`;
                alert(summary);
            }
        } catch (error) {
            console.error('Error loading pipeline:', error);
        }
    }

    async loadCandidates() {
        const jobFilter = document.getElementById('jobFilter')?.value || '';
        try {
            const url = jobFilter ? 
                `${this.apiBaseUrl}/job-postings/${jobFilter}/candidates` : 
                `${this.apiBaseUrl}/job-postings`;
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.candidates = jobFilter ? data.candidates : [];
                if (!jobFilter) {
                    // Load all candidates
                    this.loadAllCandidates();
                } else {
                    this.renderCandidates();
                }
            }
        } catch (error) {
            console.error('Error loading candidates:', error);
        }
    }

    async loadAllCandidates() {
        try {
            const allCandidates = [];
            for (const job of this.jobs) {
                const response = await fetch(`${this.apiBaseUrl}/job-postings/${job._id}/candidates`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await response.json();
                if (data.success) {
                    allCandidates.push(...data.candidates);
                }
            }
            this.candidates = allCandidates;
            this.renderCandidates();
        } catch (error) {
            console.error('Error loading all candidates:', error);
        }
    }

    renderCandidates() {
        const tbody = document.getElementById('candidatesTable');
        tbody.innerHTML = '';
        
        const stageFilter = document.getElementById('stageFilter')?.value || '';
        let filtered = this.candidates;
        if (stageFilter) {
            filtered = this.candidates.filter(c => c.stage === stageFilter);
        }
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No candidates found</td></tr>';
            return;
        }
        
        filtered.forEach(candidate => {
            const row = document.createElement('tr');
            const score = candidate.rating?.overallScore || '—';
            row.innerHTML = `
                <td>${candidate.firstName} ${candidate.lastName}</td>
                <td>${candidate.email}</td>
                <td><span class="status-badge" style="background: #e3f2fd; color: #1976d2;">${candidate.stage}</span></td>
                <td>${new Date(candidate.appliedDate).toLocaleDateString()}</td>
                <td>${score}</td>
                <td>
                    <button class="btn btn-sm" onclick="recruitmentMgr.showCandidateDetail('${candidate._id}')" style="padding: 5px 10px; font-size: 12px;">View</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async showCandidateDetail(candidateId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/candidates/${candidateId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const data = await response.json();
            if (data.success) {
                const candidate = data.candidate;
                const score = data.score;
                
                document.getElementById('candidateDetail').innerHTML = `
                    <div style="margin: 15px 0;">
                        <h4>${candidate.firstName} ${candidate.lastName}</h4>
                        <p><strong>Email:</strong> ${candidate.email}</p>
                        <p><strong>Phone:</strong> ${candidate.phone || '—'}</p>
                        <p><strong>Current Position:</strong> ${candidate.currentDesignation || '—'}</p>
                        <p><strong>Experience:</strong> ${candidate.experience?.years || '—'} years</p>
                        <p><strong>Current Stage:</strong> ${candidate.stage}</p>
                        <p><strong>Applied Date:</strong> ${new Date(candidate.appliedDate).toLocaleDateString()}</p>
                        
                        <h5>Skill Match Analysis:</h5>
                        <div class="rating-display">
                            <div class="rating-box">
                                <strong>Overall Score</strong>
                                <p style="font-size: 24px; color: #667eea;">${score?.overallScore || '—'}</p>
                                <small>${score?.recommendation || '—'}</small>
                            </div>
                            <div class="rating-box">
                                <strong>Skills Match</strong>
                                <p>${score?.skillMatch?.matchPercentage || 0}%</p>
                                <small>${score?.skillMatch?.matchedSkills?.length || 0} matched</small>
                            </div>
                        </div>
                    </div>
                `;
                
                document.getElementById('newStage').value = candidate.stage;
                currentCandidateId = candidateId;
                showModal('candidateModal');
            }
        } catch (error) {
            console.error('Error loading candidate:', error);
        }
    }

    async updateCandidateStage() {
        if (!currentCandidateId) return;
        
        const newStage = document.getElementById('newStage').value;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/candidates/${currentCandidateId}/stage`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ stage: newStage })
            });
            
            const data = await response.json();
            if (data.success) {
                showAlert('Candidate stage updated');
                closeModal('candidateModal');
                this.loadCandidates();
            }
        } catch (error) {
            console.error('Error updating candidate:', error);
            showAlert('Failed to update candidate', 'error');
        }
    }

    async loadOffers() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/offers`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const data = await response.json();
            if (data.success) {
                this.offers = data.offers;
                this.renderOffers();
            }
        } catch (error) {
            console.error('Error loading offers:', error);
        }
    }

    renderOffers() {
        const tbody = document.getElementById('offersTable');
        tbody.innerHTML = '';
        
        if (this.offers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No offers created</td></tr>';
            return;
        }
        
        this.offers.forEach(offer => {
            const row = document.createElement('tr');
            const totalPackage = offer.compensation?.totalPackage || 0;
            row.innerHTML = `
                <td>${offer.candidateName}</td>
                <td>${offer.compensation?.baseSalary?.amount || '—'}</td>
                <td><span class="status-badge">${offer.status}</span></td>
                <td>SAR ${totalPackage.toLocaleString()}</td>
                <td>${new Date(offer.joinDate).toLocaleDateString()}</td>
                <td>
                    ${offer.status === 'Draft' ? `<button class="btn btn-sm" onclick="recruitmentMgr.sendOffer('${offer._id}')" style="padding: 5px 10px;">Send</button>` : ''}
                    <button class="btn btn-sm" onclick="alert('Offer details')" style="padding: 5px 10px;">Details</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async createOffer() {
        const candidateId = document.getElementById('offerCandidate').value;
        const salary = document.getElementById('offerSalary').value;
        const bonus = document.getElementById('offerBonus').value;
        const joinDate = document.getElementById('offerJoinDate').value;
        
        if (!candidateId || !salary || !joinDate) {
            showAlert('Please fill required fields', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/offers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    candidateId,
                    jobPostingId: this.jobs[0]._id,
                    compensation: {
                        baseSalary: { amount: parseInt(salary) },
                        bonus: parseInt(bonus),
                        allowances: []
                    },
                    joinDate
                })
            });
            
            const data = await response.json();
            if (data.success) {
                showAlert('Offer created successfully');
                closeModal('offerModal');
                this.loadOffers();
            }
        } catch (error) {
            console.error('Error creating offer:', error);
            showAlert('Failed to create offer', 'error');
        }
    }

    async sendOffer(offerId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/offers/${offerId}/send`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const data = await response.json();
            if (data.success) {
                showAlert('Offer sent to candidate');
                this.loadOffers();
            }
        } catch (error) {
            console.error('Error sending offer:', error);
            showAlert('Failed to send offer', 'error');
        }
    }

    async loadOnboarding() {
        try {
            const response = await fetch(`${this.onboardingUrl}/summary`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const data = await response.json();
            if (data.success) {
                this.renderOnboardingSummary(data.summary);
            }
        } catch (error) {
            console.error('Error loading onboarding:', error);
        }
    }

    renderOnboardingSummary(summary) {
        const container = document.getElementById('onboardingSummary');
        container.innerHTML = `
            <div class="rating-display">
                <div class="rating-box">
                    <strong>New This Month</strong>
                    <p style="font-size: 24px; color: #667eea;">${summary.newEmployeesThisMonth}</p>
                </div>
                <div class="rating-box">
                    <strong>Completed</strong>
                    <p style="font-size: 24px; color: #2e7d32;">${summary.completedThisMonth}</p>
                </div>
                <div class="rating-box">
                    <strong>In Progress</strong>
                    <p style="font-size: 24px; color: #f57c00;">${summary.inProgress}</p>
                </div>
                <div class="rating-box">
                    <strong>At Risk</strong>
                    <p style="font-size: 24px; color: #c62828;">${summary.atRisk}</p>
                </div>
            </div>
        `;
    }

    async loadAnalytics() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/job-postings`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const data = await response.json();
            if (data.success) {
                const select = document.getElementById('analyticsJobFilter');
                select.innerHTML = '<option value="">Select Job</option>';
                data.jobPostings.forEach(job => {
                    const option = document.createElement('option');
                    option.value = job._id;
                    option.textContent = job.jobTitle;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading jobs for analytics:', error);
        }
    }

    updateJobFilters() {
        const select = document.getElementById('jobFilter');
        if (select) {
            select.innerHTML = '<option value="">All Jobs</option>';
            this.jobs.forEach(job => {
                const option = document.createElement('option');
                option.value = job._id;
                option.textContent = `${job.jobTitle} (${job.applicantsCount} applicants)`;
                select.appendChild(option);
            });
        }
        
        const offerSelect = document.getElementById('offerCandidate');
        if (offerSelect) {
            offerSelect.innerHTML = '<option value="">-- Select --</option>';
            this.candidates.filter(c => c.stage === 'Interview2' || c.stage === 'Offer').forEach(candidate => {
                const option = document.createElement('option');
                option.value = candidate._id;
                option.textContent = `${candidate.firstName} ${candidate.lastName} (${candidate.stage})`;
                offerSelect.appendChild(option);
            });
        }
    }
}

// Global instance
const recruitmentMgr = new RecruitmentManager();

// Load jobs on page load
function loadJobs() {
    recruitmentMgr.loadJobs();
}

function loadCandidates() {
    recruitmentMgr.loadCandidates();
}

function loadOffers() {
    recruitmentMgr.loadOffers();
}

function loadOnboarding() {
    recruitmentMgr.loadOnboarding();
}

function loadAnalytics() {
    recruitmentMgr.loadAnalytics();
}

function createJob() {
    recruitmentMgr.createJob();
}

function createOffer() {
    recruitmentMgr.createOffer();
}

function updateCandidateStage() {
    recruitmentMgr.updateCandidateStage();
}

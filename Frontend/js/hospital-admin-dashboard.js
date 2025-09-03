// public/js/hospital-admin-dashboard.js
// Pagination state
let pendingApprovalsPage = 1;
let leaveRequestsPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (!token || userRole !== 'hospital_admin') {
        window.location.href = 'login.html';
        return;
    }

    // Initialize dashboard
    initializeDashboard();
    
    // Initialize event listeners
    initializeEventListeners();
});

function initializeDashboard() {
    // Update admin info
    updateAdminInfo();
    
    // Load dashboard data
    loadDashboardData();
    
    // Load pending approvals and leave requests
    loadPendingApprovals();
    loadLeaveRequests();
}

function initializeEventListeners() {
    // Pending approvals search and filters
    const pendingSearch = document.getElementById('pending-search');
    const pendingDeptFilter = document.getElementById('pending-department-filter');
    const pendingRefresh = document.getElementById('pending-refresh');
    
    if (pendingSearch) {
        pendingSearch.addEventListener('input', debounce(() => {
            pendingApprovalsPage = 1;
            loadPendingApprovals();
        }, 300));
    }
    
    if (pendingDeptFilter) {
        pendingDeptFilter.addEventListener('change', () => {
            pendingApprovalsPage = 1;
            loadPendingApprovals();
        });
    }
    
    if (pendingRefresh) {
        pendingRefresh.addEventListener('click', () => {
            pendingApprovalsPage = 1;
            loadPendingApprovals();
        });
    }
    
    // Leave requests search and filters
    const leaveSearch = document.getElementById('leave-search');
    const leaveStatusFilter = document.getElementById('leave-status-filter');
    const leaveTypeFilter = document.getElementById('leave-type-filter');
    const leaveRefresh = document.getElementById('leave-refresh');
    
    if (leaveSearch) {
        leaveSearch.addEventListener('input', debounce(() => {
            leaveRequestsPage = 1;
            loadLeaveRequests();
        }, 300));
    }
    
    if (leaveStatusFilter) {
        leaveStatusFilter.addEventListener('change', () => {
            leaveRequestsPage = 1;
            loadLeaveRequests();
        });
    }
    
    if (leaveTypeFilter) {
        leaveTypeFilter.addEventListener('change', () => {
            leaveRequestsPage = 1;
            loadLeaveRequests();
        });
    }
    
    if (leaveRefresh) {
        leaveRefresh.addEventListener('click', () => {
            leaveRequestsPage = 1;
            loadLeaveRequests();
        });
    }
    
    // Pagination event listeners
    const pendingPrevBtn = document.getElementById('pending-prev-btn');
    const pendingNextBtn = document.getElementById('pending-next-btn');
    const leavePrevBtn = document.getElementById('leave-prev-btn');
    const leaveNextBtn = document.getElementById('leave-next-btn');
    
    if (pendingPrevBtn) {
        pendingPrevBtn.addEventListener('click', () => {
            if (pendingApprovalsPage > 1) {
                pendingApprovalsPage--;
                loadPendingApprovals();
            }
        });
    }
    
    if (pendingNextBtn) {
        pendingNextBtn.addEventListener('click', () => {
            pendingApprovalsPage++;
            loadPendingApprovals();
        });
    }
    
    if (leavePrevBtn) {
        leavePrevBtn.addEventListener('click', () => {
            if (leaveRequestsPage > 1) {
                leaveRequestsPage--;
                loadLeaveRequests();
            }
        });
    }
    
    if (leaveNextBtn) {
        leaveNextBtn.addEventListener('click', () => {
            leaveRequestsPage++;
            loadLeaveRequests();
        });
    }
}

function updateAdminInfo() {
    const adminName = localStorage.getItem('userName') || 'Hospital Admin';
    const adminNameElement = document.getElementById('admin-name');
    if (adminNameElement) {
        adminNameElement.textContent = adminName;
    }
    
    // Update current date and time
    updateDateTime();
    setInterval(updateDateTime, 1000); // Update every second
}

function updateDateTime() {
    const now = new Date();
    const dateTimeElement = document.getElementById('current-datetime');
    if (dateTimeElement) {
        dateTimeElement.textContent = now.toLocaleString();
    }
}

function loadDashboardData() {
    const token = localStorage.getItem('token');
    
    // Load summary statistics
    fetch('/api/hospital-admin/dashboard/overview', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch dashboard statistics');
        }
        return response.json();
    })
    .then(data => {
        // Update summary cards
        updateSummaryCards(data);
    })
    .catch(error => {
        console.error('Error loading dashboard data:', error);
        // Set default values if API fails
        updateSummaryCards({
            totalDoctors: 0,
            pendingApprovals: 0,
            todaysAppointments: 0,
            totalPatients: 0
        });
    });
}

function updateSummaryCards(data) {
    // Update total doctors
    const totalDoctorsElement = document.getElementById('total-doctors');
    if (totalDoctorsElement) {
        totalDoctorsElement.textContent = data.totalDoctors || 0;
    }
    
    // Update pending approvals
    const pendingApprovalsElement = document.getElementById('pending-approvals');
    if (pendingApprovalsElement) {
        pendingApprovalsElement.textContent = data.pendingApprovals || 0;
    }
    
    // Update today's appointments
    const todaysAppointmentsElement = document.getElementById('todays-appointments');
    if (todaysAppointmentsElement) {
        todaysAppointmentsElement.textContent = data.todaysAppointments || 0;
    }
    
    // Update total patients
    const totalPatientsElement = document.getElementById('total-patients');
    if (totalPatientsElement) {
        totalPatientsElement.textContent = data.totalPatients || 0;
    }
}

// Load pending approvals with pagination and filters
function loadPendingApprovals() {
    const token = localStorage.getItem('token');
    const searchTerm = document.getElementById('pending-search')?.value || '';
    const department = document.getElementById('pending-department-filter')?.value || '';
    
    // Build query parameters
    const params = new URLSearchParams({
        page: pendingApprovalsPage,
        limit: itemsPerPage,
        search: searchTerm,
        department: department
    });
    
    // Show loading state
    showLoadingState('pending-approvals-tbody');
    
    fetch(`/api/hospital-admin/doctors/pending?${params}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch pending approvals');
        }
        return response.json();
    })
    .then(data => {
        console.log('Pending approvals response:', data);
        const doctors = data.doctors || [];
        const mappedDoctors = doctors.map(doctor => ({
            id: doctor.doctor_id,
            name: `${doctor.first_name} ${doctor.last_name}`,
            email: doctor.email,
            department: doctor.specialization,
            hospital: doctor.hospital_name,
            appliedDate: doctor.applied_date
        }));
        renderPendingApprovals(mappedDoctors);
        updatePendingPagination(data.totalCount || 0, data.page || 1);
        updatePendingTotalCount(data.totalCount || 0);
    })
    .catch(error => {
        console.error('Error loading pending approvals:', error);
        showErrorState('pending-approvals-tbody', 'Failed to load pending approvals');
    });
}

// Load leave requests with pagination and filters
function loadLeaveRequests() {
    const token = localStorage.getItem('token');
    const searchTerm = document.getElementById('leave-search')?.value || '';
    const status = document.getElementById('leave-status-filter')?.value || '';
    const type = document.getElementById('leave-type-filter')?.value || '';
    
    // Build query parameters
    const params = new URLSearchParams({
        page: leaveRequestsPage,
        limit: itemsPerPage,
        search: searchTerm,
        status: status,
        type: type
    });
    
    // Show loading state
    showLoadingState('leave-requests-tbody');
    
    fetch(`/api/hospital-admin/leave-requests?${params}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch leave requests');
        }
        return response.json();
    })
    .then(data => {
        console.log('Leave requests response:', data);
        const requests = data.requests || [];
        const mappedRequests = requests.map(request => ({
            id: request.leave_id,
            doctorName: `${request.first_name} ${request.last_name}`,
            doctorEmail: 'N/A', // Not provided in backend response
            department: request.specialization,
            leaveType: 'N/A', // Not provided in backend response
            startDate: request.requested_date,
            endDate: request.requested_date,
            duration: 1, // Default since not provided
            status: request.status?.toLowerCase() || 'pending',
            reason: request.reason
        }));
        renderLeaveRequests(mappedRequests);
        updateLeavePagination(data.totalCount || 0, data.page || 1);
        updateLeaveTotalCount(data.totalCount || 0);
    })
    .catch(error => {
        console.error('Error loading leave requests:', error);
        showErrorState('leave-requests-tbody', 'Failed to load leave requests');
    });
}

// Render pending approvals table
function renderPendingApprovals(doctors) {
    const tbody = document.getElementById('pending-approvals-tbody');
    if (!tbody) return;
    
    if (doctors.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <i class="bi bi-inbox fs-1 text-muted"></i>
                    <p class="text-muted mt-2">No pending approvals found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = doctors.map(doctor => `
        <tr>
            <td>
                <div class="doctor-info">
                    <div class="doctor-avatar" style="background-color: ${getAvatarColor(doctor.name)}">
                        ${getInitials(doctor.name)}
                    </div>
                    <div class="doctor-details">
                        <h6>${doctor.name}</h6>
                        <small>${doctor.email}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="dept-badge dept-${doctor.department?.toLowerCase() || 'general'}">
                    ${doctor.department || 'General'}
                </span>
            </td>
            <td>${doctor.hospital || 'N/A'}</td>
            <td>${formatDate(doctor.appliedDate)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-action btn-approve" onclick="approveDoctor('${doctor.id}')">
                        <i class="bi bi-check-circle"></i> Approve
                    </button>
                    <button class="btn btn-action btn-reject" onclick="rejectDoctor('${doctor.id}')">
                        <i class="bi bi-x-circle"></i> Reject
                    </button>
                    <button class="btn btn-action btn-view" onclick="viewDoctor('${doctor.id}')">
                        <i class="bi bi-eye"></i> View
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Render leave requests table
function renderLeaveRequests(leaveRequests) {
    const tbody = document.getElementById('leave-requests-tbody');
    if (!tbody) return;
    
    if (leaveRequests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="bi bi-calendar-x fs-1 text-muted"></i>
                    <p class="text-muted mt-2">No leave requests found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = leaveRequests.map(leave => `
        <tr>
            <td>
                <div class="doctor-info">
                    <div class="doctor-avatar" style="background-color: ${getAvatarColor(leave.doctorName)}">
                        ${getInitials(leave.doctorName)}
                    </div>
                    <div class="doctor-details">
                        <h6>${leave.doctorName}</h6>
                        <small>${leave.doctorEmail}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="dept-badge dept-${leave.department?.toLowerCase() || 'general'}">
                    ${leave.department || 'General'}
                </span>
            </td>
            <td>
                <span class="badge bg-light text-dark">${leave.leaveType}</span>
            </td>
            <td>
                <small class="text-muted">
                    ${formatDate(leave.startDate)} - ${formatDate(leave.endDate)}
                    <br>
                    <strong>${leave.duration} days</strong>
                </small>
            </td>
            <td>
                <span class="status-badge status-${leave.status}">
                    ${leave.status}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    ${leave.status === 'pending' ? `
                        <button class="btn btn-action btn-approve" onclick="approveLeave('${leave.id}')">
                            <i class="bi bi-check-circle"></i> Approve
                        </button>
                        <button class="btn btn-action btn-reject" onclick="rejectLeave('${leave.id}')">
                            <i class="bi bi-x-circle"></i> Reject
                        </button>
                    ` : ''}
                    <button class="btn btn-action btn-view" onclick="viewLeave('${leave.id}')">
                        <i class="bi bi-eye"></i> View
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Helper functions
function getAvatarColor(name) {
    const colors = [
        '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
        '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6610f2'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
    if (!name) return 'NA';
    const names = name.trim().split(' ');
    if (names.length === 1) {
        return names[0].substring(0, 2).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
}

function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

function showLoadingState(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const colspan = elementId.includes('leave') ? '6' : '5';
        element.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center py-4">
                    <div class="loading-spinner"></div>
                    <p class="text-muted mt-2">Loading...</p>
                </td>
            </tr>
        `;
    }
}

function showErrorState(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        const colspan = elementId.includes('leave') ? '6' : '5';
        element.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center py-4">
                    <i class="bi bi-exclamation-circle fs-1 text-danger"></i>
                    <p class="text-muted mt-2">${message}</p>
                    <button class="btn btn-outline-primary btn-sm mt-2" onclick="location.reload()">
                        <i class="bi bi-arrow-clockwise"></i> Retry
                    </button>
                </td>
            </tr>
        `;
    }
}

function updatePendingPagination(totalCount, currentPage) {
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalCount);
    
    // Update pagination info
    const paginationInfo = document.getElementById('pending-pagination-info');
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalCount} entries`;
    }
    
    // Update pagination buttons
    const prevBtn = document.getElementById('pending-prev-btn');
    const nextBtn = document.getElementById('pending-next-btn');
    const prevLi = document.getElementById('pending-prev-li');
    const nextLi = document.getElementById('pending-next-li');
    
    if (prevLi) {
        prevLi.className = currentPage === 1 ? 'page-item disabled' : 'page-item';
    }
    if (nextLi) {
        nextLi.className = currentPage >= totalPages ? 'page-item disabled' : 'page-item';
    }
}

function updateLeavePagination(totalCount, currentPage) {
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalCount);
    
    // Update pagination info
    const paginationInfo = document.getElementById('leave-pagination-info');
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalCount} entries`;
    }
    
    // Update pagination buttons
    const prevBtn = document.getElementById('leave-prev-btn');
    const nextBtn = document.getElementById('leave-next-btn');
    const prevLi = document.getElementById('leave-prev-li');
    const nextLi = document.getElementById('leave-next-li');
    
    if (prevLi) {
        prevLi.className = currentPage === 1 ? 'page-item disabled' : 'page-item';
    }
    if (nextLi) {
        nextLi.className = currentPage >= totalPages ? 'page-item disabled' : 'page-item';
    }
}

function updatePendingTotalCount(totalCount) {
    const totalCountElement = document.getElementById('pending-total-count');
    if (totalCountElement) {
        totalCountElement.textContent = totalCount;
    }
}

function updateLeaveTotalCount(totalCount) {
    const totalCountElement = document.getElementById('leave-total-count');
    if (totalCountElement) {
        totalCountElement.textContent = totalCount;
    }
}

// Action functions for pending doctor approvals
function approveDoctor(doctorId) {
    if (!confirm('Are you sure you want to approve this doctor?')) {
        return;
    }

    const token = localStorage.getItem('token');
    const button = document.querySelector(`button[onclick="approveDoctor('${doctorId}')"]`);
    
    if (button) {
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner"></div> Approving...';
    }

    fetch(`/api/hospital-admin/doctors/approve/${doctorId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to approve doctor');
        }
        return response.json();
    })
    .then(data => {
        showSuccessAlert('Doctor approved successfully!');
        loadPendingApprovals(); // Refresh the table
        loadDashboardData(); // Update summary cards
    })
    .catch(error => {
        console.error('Error approving doctor:', error);
        showErrorAlert('Failed to approve doctor. Please try again.');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-check-circle"></i> Approve';
        }
    });
}

function rejectDoctor(doctorId) {
    if (!confirm('Are you sure you want to reject this doctor? This action cannot be undone.')) {
        return;
    }

    const token = localStorage.getItem('token');
    const button = document.querySelector(`button[onclick="rejectDoctor('${doctorId}')"]`);
    
    if (button) {
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner"></div> Rejecting...';
    }

    fetch(`/api/hospital-admin/doctors/reject/${doctorId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to reject doctor');
        }
        return response.json();
    })
    .then(data => {
        showSuccessAlert('Doctor application rejected successfully.');
        loadPendingApprovals(); // Refresh the table
        loadDashboardData(); // Update summary cards
    })
    .catch(error => {
        console.error('Error rejecting doctor:', error);
        showErrorAlert('Failed to reject doctor. Please try again.');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-x-circle"></i> Reject';
        }
    });
}

function viewDoctor(doctorId) {
    const token = localStorage.getItem('token');
    
    fetch(`/api/hospital-admin/doctors/${doctorId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch doctor details');
        }
        return response.json();
    })
    .then(doctor => {
        showDoctorModal(doctor);
    })
    .catch(error => {
        console.error('Error fetching doctor details:', error);
        showErrorAlert('Failed to load doctor details. Please try again.');
    });
}

// Action functions for leave requests
function approveLeave(leaveId) {
    if (!confirm('Are you sure you want to approve this leave request?')) {
        return;
    }

    const token = localStorage.getItem('token');
    const button = document.querySelector(`button[onclick="approveLeave('${leaveId}')"]`);
    
    if (button) {
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner"></div> Approving...';
    }

    fetch(`/api/hospital-admin/leave-requests/${leaveId}/approve`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to approve leave request');
        }
        return response.json();
    })
    .then(data => {
        showSuccessAlert('Leave request approved successfully!');
        loadLeaveRequests(); // Refresh the table
    })
    .catch(error => {
        console.error('Error approving leave request:', error);
        showErrorAlert('Failed to approve leave request. Please try again.');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-check-circle"></i> Approve';
        }
    });
}

function rejectLeave(leaveId) {
    if (!confirm('Are you sure you want to reject this leave request?')) {
        return;
    }

    const token = localStorage.getItem('token');
    const button = document.querySelector(`button[onclick="rejectLeave('${leaveId}')"]`);
    
    if (button) {
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner"></div> Rejecting...';
    }

    fetch(`/api/hospital-admin/leave-requests/${leaveId}/reject`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to reject leave request');
        }
        return response.json();
    })
    .then(data => {
        showSuccessAlert('Leave request rejected successfully.');
        loadLeaveRequests(); // Refresh the table
    })
    .catch(error => {
        console.error('Error rejecting leave request:', error);
        showErrorAlert('Failed to reject leave request. Please try again.');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-x-circle"></i> Reject';
        }
    });
}

function viewLeave(leaveId) {
    const token = localStorage.getItem('token');
    
    fetch(`/api/hospital-admin/leave-requests/${leaveId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch leave request details');
        }
        return response.json();
    })
    .then(leaveRequest => {
        showLeaveModal(leaveRequest);
    })
    .catch(error => {
        console.error('Error fetching leave request details:', error);
        showErrorAlert('Failed to load leave request details. Please try again.');
    });
}

// Alert and modal functions
function showSuccessAlert(message) {
    const alertHtml = `
        <div class="alert alert-success alert-dismissible fade show position-fixed" 
             style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;" role="alert">
            <i class="bi bi-check-circle-fill me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        const alert = document.querySelector('.alert-success');
        if (alert) {
            alert.remove();
        }
    }, 3000);
}

function showErrorAlert(message) {
    const alertHtml = `
        <div class="alert alert-danger alert-dismissible fade show position-fixed" 
             style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        const alert = document.querySelector('.alert-danger');
        if (alert) {
            alert.remove();
        }
    }, 5000);
}

function showDoctorModal(doctor) {
    const modalHtml = `
        <div class="modal fade" id="doctorModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-person-circle me-2"></i>
                            Doctor Details
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-muted">Personal Information</h6>
                                <p><strong>Name:</strong> ${doctor.name}</p>
                                <p><strong>Email:</strong> ${doctor.email}</p>
                                <p><strong>Phone:</strong> ${doctor.phone || 'N/A'}</p>
                                <p><strong>Department:</strong> ${doctor.department}</p>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-muted">Professional Information</h6>
                                <p><strong>Hospital:</strong> ${doctor.hospital || 'N/A'}</p>
                                <p><strong>Specialization:</strong> ${doctor.specialization || 'N/A'}</p>
                                <p><strong>Experience:</strong> ${doctor.experience || 'N/A'} years</p>
                                <p><strong>Applied Date:</strong> ${formatDate(doctor.appliedDate)}</p>
                            </div>
                        </div>
                        ${doctor.documents ? `
                            <div class="mt-3">
                                <h6 class="text-muted">Documents</h6>
                                <div class="list-group">
                                    ${doctor.documents.map(doc => `
                                        <a href="${doc.url}" target="_blank" class="list-group-item list-group-item-action">
                                            <i class="bi bi-file-earmark-text me-2"></i>
                                            ${doc.name}
                                        </a>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-success" onclick="approveDoctor('${doctor.id}'); bootstrap.Modal.getInstance(document.getElementById('doctorModal')).hide();">
                            <i class="bi bi-check-circle"></i> Approve
                        </button>
                        <button type="button" class="btn btn-danger" onclick="rejectDoctor('${doctor.id}'); bootstrap.Modal.getInstance(document.getElementById('doctorModal')).hide();">
                            <i class="bi bi-x-circle"></i> Reject
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('doctorModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('doctorModal'));
    modal.show();
}

function showLeaveModal(leaveRequest) {
    const modalHtml = `
        <div class="modal fade" id="leaveModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-warning text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-calendar-event me-2"></i>
                            Leave Request Details
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-muted">Doctor Information</h6>
                                <p><strong>Name:</strong> ${leaveRequest.doctorName}</p>
                                <p><strong>Email:</strong> ${leaveRequest.doctorEmail}</p>
                                <p><strong>Department:</strong> ${leaveRequest.department}</p>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-muted">Leave Information</h6>
                                <p><strong>Type:</strong> ${leaveRequest.leaveType}</p>
                                <p><strong>Start Date:</strong> ${formatDate(leaveRequest.startDate)}</p>
                                <p><strong>End Date:</strong> ${formatDate(leaveRequest.endDate)}</p>
                                <p><strong>Duration:</strong> ${leaveRequest.duration} days</p>
                                <p><strong>Status:</strong> 
                                    <span class="status-badge status-${leaveRequest.status}">${leaveRequest.status}</span>
                                </p>
                            </div>
                        </div>
                        ${leaveRequest.reason ? `
                            <div class="mt-3">
                                <h6 class="text-muted">Reason</h6>
                                <p class="border p-3 rounded bg-light">${leaveRequest.reason}</p>
                            </div>
                        ` : ''}
                        ${leaveRequest.emergencyContact ? `
                            <div class="mt-3">
                                <h6 class="text-muted">Emergency Contact</h6>
                                <p><strong>Name:</strong> ${leaveRequest.emergencyContact.name}</p>
                                <p><strong>Phone:</strong> ${leaveRequest.emergencyContact.phone}</p>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        ${leaveRequest.status === 'pending' ? `
                            <button type="button" class="btn btn-success" onclick="approveLeave('${leaveRequest.id}'); bootstrap.Modal.getInstance(document.getElementById('leaveModal')).hide();">
                                <i class="bi bi-check-circle"></i> Approve
                            </button>
                            <button type="button" class="btn btn-danger" onclick="rejectLeave('${leaveRequest.id}'); bootstrap.Modal.getInstance(document.getElementById('leaveModal')).hide();">
                                <i class="bi bi-x-circle"></i> Reject
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('leaveModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('leaveModal'));
    modal.show();
}

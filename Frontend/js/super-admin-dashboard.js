// public/js/super-admin-dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'super_admin') {
        window.location.href = '/login.html';
        return;
    }

    const adminEmailDisplay = document.getElementById('admin-email-display');
    const adminInitialsEl = document.getElementById('admin-initials');
    const totalPendingApprovalsEl = document.getElementById('total-pending-approvals');
    const totalHospitalAdminsEl = document.getElementById('total-hospital-admins');
    const totalDoctorsEl = document.getElementById('total-doctors');
    const totalUsersEl = document.getElementById('total-users');
    const pendingAdminsTableBody = document.getElementById('pending-admins-table-body');
    const adminSearchInput = document.getElementById('admin-search');
    
    // pagination elements (if you have them, otherwise can be removed)
    const currentResultsStartEl = document.getElementById('current-results-start');
    const currentResultsEndEl = document.getElementById('current-results-end');
    const totalResultsEl = document.getElementById('total-results');

    // --- Main Fetch and Render Function ---
    const fetchAndRenderDashboard = async () => {
        try {
            // Fetch Overview Data
            const overviewResponse = await fetch('/api/super-admin/dashboard/overview', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!overviewResponse.ok) throw new Error('Failed to fetch overview data.');
            const overviewData = await overviewResponse.json();

            totalPendingApprovalsEl.textContent = overviewData.pendingAdminApprovals;
            totalHospitalAdminsEl.textContent = overviewData.totalHospitalAdmins;
            totalDoctorsEl.textContent = overviewData.totalDoctors;
            totalUsersEl.textContent = overviewData.totalUsers;

            // Fetch Pending Approvals for the table
            const search = adminSearchInput.value;
            pendingAdminsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading pending hospital admins...</td></tr>';

            const pendingResponse = await fetch(`/api/super-admin/hospital-admins/pending?search=${search}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!pendingResponse.ok) throw new Error('Failed to fetch pending hospital admins.');

            const result = await pendingResponse.json();
            const admins = result.admins || [];
            const totalCount = result.totalCount || 0;

            pendingAdminsTableBody.innerHTML = '';
            if (admins.length > 0) {
                admins.forEach(admin => {
                    const adminStatus = 'Pending';
                    const statusClass = 'pending';
                    const actionButtons = `<button class="btn btn-success btn-sm rounded-pill approve-btn me-1" data-id="${admin.admin_id}">Approve</button>
                                          <button class="btn btn-danger btn-sm rounded-pill reject-btn" data-id="${admin.admin_id}">Reject</button>`;
                    const row = `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center">
                                    <div class="initials rounded-circle bg-light d-flex justify-content-center align-items-center me-2" style="width: 40px; height: 40px;">${(admin.first_name.charAt(0) + admin.last_name.charAt(0)).toUpperCase()}</div>
                                    <div>
                                        <h6 class="fw-bold mb-0">${admin.first_name} ${admin.last_name}</h6>
                                    </div>
                                </div>
                            </td>
                            <td>${admin.hospital_name || 'N/A'}</td>
                            <td>${admin.email}</td>
                            <td>${new Date(admin.registration_date).toLocaleDateString('en-US')}</td>
                            <td><span class="badge ${statusClass}">${adminStatus}</span></td>
                            <td class="action-buttons">${actionButtons}</td>
                        </tr>
                    `;
                    pendingAdminsTableBody.insertAdjacentHTML('beforeend', row);
                });
                if (currentResultsStartEl && currentResultsEndEl && totalResultsEl) {
                    currentResultsStartEl.textContent = '1';
                    currentResultsEndEl.textContent = admins.length;
                    totalResultsEl.textContent = totalCount;
                }
            } else {
                pendingAdminsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No pending hospital admins found.</td></tr>';
                if (currentResultsStartEl && currentResultsEndEl && totalResultsEl) {
                    currentResultsStartEl.textContent = '0';
                    currentResultsEndEl.textContent = '0';
                    totalResultsEl.textContent = '0';
                }
            }
        } catch (error) {
            console.error('Error initializing Super Admin Dashboard:', error);
            pendingAdminsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load data. Please try again.</td></tr>';
        }
    };

    // --- Event Listeners for Actions (Approve/Reject) ---
    pendingAdminsTableBody.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        const adminId = target.dataset.id;
        const isApprove = target.classList.contains('approve-btn');
        const action = isApprove ? 'approve' : 'reject';

        if (confirm(`Are you sure you want to ${action} this Hospital Admin?`)) {
            try {
                const response = await fetch(`/api/super-admin/hospital-admins/${action}/${adminId}`, {
                    method: isApprove ? 'PUT' : 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    alert(`Hospital Admin ${action}d successfully!`);
                    fetchAndRenderDashboard();
                } else {
                    const errorData = await response.json();
                    alert(`Action failed: ${errorData.message}`);
                }
            } catch (error) {
                console.error(`Error ${action}ing Hospital Admin:`, error);
                alert(`An error occurred during the ${action} process.`);
            }
        }
    });

    // --- Filter/Search Event Listeners ---
    adminSearchInput.addEventListener('input', () => { fetchAndRenderDashboard(); });

    // --- Initial Load ---
    adminEmailDisplay.textContent = 'Admin@DocReserve.com';
    adminInitialsEl.textContent = 'AD';
    fetchAndRenderDashboard();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login.html';
}

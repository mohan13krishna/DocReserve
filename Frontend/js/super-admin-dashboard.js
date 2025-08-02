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

    // Summary cards
    const totalPendingApprovalsEl = document.getElementById('total-pending-approvals');
    const totalHospitalAdminsEl = document.getElementById('total-hospital-admins');
    const totalDoctorsEl = document.getElementById('total-doctors');
    const totalUsersEl = document.getElementById('total-users');

    // Pending admins table
    const pendingAdminsTableBody = document.getElementById('pending-admins-table-body');
    const adminSearchInput = document.getElementById('admin-search');
    const statusFilterSelect = document.getElementById('status-filter');
    const currentResultsStartEl = document.getElementById('current-results-start');
    const currentResultsEndEl = document.getElementById('current-results-end');
    const totalResultsEl = document.getElementById('total-results');


    // --- Initial Data Load ---
    try {
        // Set admin email and initials (Super Admin has universal credentials)
        adminEmailDisplay.textContent = 'Admin@DocReserve.com';
        adminInitialsEl.textContent = 'AD';

        // Fetch Dashboard Overview
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

        // --- Function to Load Hospital Admins ---
        const loadHospitalAdmins = async () => {
            pendingAdminsTableBody.innerHTML = '<tr><td colspan="6">Loading hospital admins...</td></tr>';
            try {
                const search = adminSearchInput.value;
                const status = statusFilterSelect.value; // 'Pending' or 'Approved'

                const response = await fetch(`/api/super-admin/hospital-admins/pending?search=${search}&status=${status}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch hospital admins.');
                const result = await response.json();
                const admins = result.admins || [];
                const totalCount = result.totalCount || 0;


                pendingAdminsTableBody.innerHTML = ''; // Clear loading message
                if (admins.length > 0) {
                    admins.forEach(admin => {
                        const adminStatus = admin.is_approved ? 'Approved' : 'Pending';
                        const statusClass = adminStatus.toLowerCase();
                        const actionButtons = admin.is_approved ?
                            '' : // No action buttons for approved admins in this view
                            `<button class="button primary small approve-btn" data-id="${admin.admin_id}">Approve</button>
                             <button class="button secondary small reject-btn" data-id="${admin.admin_id}">Reject</button>`;
                        const row = `
                            <tr>
                                <td>
                                    <div class="admin-profile-cell">
                                        <div class="initials">${(admin.first_name.charAt(0) + admin.last_name.charAt(0)).toUpperCase()}</div>
                                        <div>
                                            <h4>${admin.first_name} ${admin.last_name}</h4>
                                        </div>
                                    </div>
                                </td>
                                <td>${admin.hospital_name || 'N/A'}</td>
                                <td>${admin.email}</td>
                                <td>${new Date(admin.registration_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                <td><span class="status-badge ${statusClass}">${adminStatus}</span></td>
                                <td class="action-buttons">
                                    ${actionButtons}
                                </td>
                            </tr>
                        `;
                        pendingAdminsTableBody.insertAdjacentHTML('beforeend', row);
                    });
                    currentResultsStartEl.textContent = 1; // Simplistic pagination display
                    currentResultsEndEl.textContent = admins.length;
                    totalResultsEl.textContent = totalCount;
                } else {
                    pendingAdminsTableBody.innerHTML = '<tr><td colspan="6">No hospital admins found matching criteria.</td></tr>';
                    currentResultsStartEl.textContent = 0;
                    currentResultsEndEl.textContent = 0;
                    totalResultsEl.textContent = 0;
                }
            } catch (error) {
                console.error('Error loading hospital admins:', error);
                pendingAdminsTableBody.innerHTML = '<tr><td colspan="6" style="color:red;">Failed to load hospital admins.</td></tr>';
            }
        };

        // --- Event Listeners for Actions (Approve/Reject) ---
        pendingAdminsTableBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (target.classList.contains('approve-btn')) {
                const adminId = target.dataset.id;
                if (confirm('Are you sure you want to approve this Hospital Admin?')) {
                    try {
                        const response = await fetch(`/api/super-admin/hospital-admins/approve/${adminId}`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            alert('Hospital Admin approved successfully!');
                            loadHospitalAdmins(); // Reload list
                            // Refresh overview data
                            const updatedOverview = await (await fetch('/api/super-admin/dashboard/overview', {headers: {'Authorization': `Bearer ${token}`}})).json();
                            totalPendingApprovalsEl.textContent = updatedOverview.pendingAdminApprovals;
                            totalHospitalAdminsEl.textContent = updatedOverview.totalHospitalAdmins;
                        } else {
                            const errorData = await response.json();
                            alert(`Approval failed: ${errorData.message}`);
                        }
                    } catch (error) {
                        console.error('Error approving Hospital Admin:', error);
                        alert('An error occurred during approval.');
                    }
                }
            } else if (target.classList.contains('reject-btn')) {
                const adminId = target.dataset.id;
                if (confirm('Are you sure you want to reject this Hospital Admin? This action cannot be undone.')) {
                    try {
                        const response = await fetch(`/api/super-admin/hospital-admins/reject/${adminId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            alert('Hospital Admin request rejected and removed.');
                            loadHospitalAdmins(); // Reload list
                             // Refresh overview data
                            const updatedOverview = await (await fetch('/api/super-admin/dashboard/overview', {headers: {'Authorization': `Bearer ${token}`}})).json();
                            totalPendingApprovalsEl.textContent = updatedOverview.pendingAdminApprovals;
                            totalHospitalAdminsEl.textContent = updatedOverview.totalHospitalAdmins;
                        } else {
                            const errorData = await response.json();
                            alert(`Rejection failed: ${errorData.message}`);
                        }
                    } catch (error) {
                        console.error('Error rejecting hospital admin:', error);
                        alert('An error occurred during rejection.');
                    }
                }
            }
        });

        // --- Filter/Search Event Listeners ---
        adminSearchInput.addEventListener('input', loadHospitalAdmins);
        statusFilterSelect.addEventListener('change', loadHospitalAdmins);

        // Initial load for hospital admins
        loadHospitalAdmins();

    } catch (error) {
        console.error('Error initializing Super Admin Dashboard:', error);
        alert('Failed to load dashboard. Please try again.');
    }
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login.html';
}
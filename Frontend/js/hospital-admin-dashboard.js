// public/js/hospital-admin-dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'hospital_admin') {
        window.location.href = '/login.html';
        return;
    }

    // Elements for admin info
    const adminFullNameEl = document.getElementById('admin-full-name');
    const adminInitialsEl = document.getElementById('admin-initials');
    const currentDateTimeEl = document.getElementById('current-date-time');

    // Summary card elements
    const totalDoctorsEl = document.getElementById('total-doctors');
    const pendingApprovalsEl = document.getElementById('pending-approvals');
    const todayAppointmentsEl = document.getElementById('today-appointments');
    const totalPatientsEl = document.getElementById('total-patients');
    const pendingCountEl = document.getElementById('pending-count');
    const approvedCountEl = document.getElementById('approved-count');
    const totalApprovedDoctorsEl = document.getElementById('total-approved-doctors');

    // Tab and content elements
    const pendingApprovalsTab = document.getElementById('pending-approvals-tab');
    const approvedDoctorsTab = document.getElementById('approved-doctors-tab');
    const pendingApprovalsContent = document.getElementById('pending-approvals-content');
    const approvedDoctorsContent = document.getElementById('approved-doctors-content');

    // Table bodies
    const pendingDoctorsTableBody = document.getElementById('pending-doctors-table-body');
    const approvedDoctorsTableBody = document.getElementById('approved-doctors-table-body');

    // Filters (for approved doctors tab)
    const specializationFilter = document.getElementById('specialization-filter');
    const statusFilter = document.getElementById('status-filter');
    const doctorSearchInput = document.getElementById('doctor-search');


    // --- Initial Data Fetch ---
    try {
        // Fetch Admin Profile info (Name and Initials) from token
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const adminFirstName = decodedToken.first_name || 'Sarah'; // Default
        const adminLastName = decodedToken.last_name || 'Johnson'; // Default

        adminFullNameEl.textContent = `${adminFirstName} ${adminLastName}`;
        adminInitialsEl.textContent = `${adminFirstName.charAt(0)}${adminLastName.charAt(0)}`.toUpperCase();

        // Update current date and time
        const now = new Date();
        const dateTimeOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
        currentDateTimeEl.textContent = now.toLocaleDateString('en-US', dateTimeOptions);


        // Fetch Dashboard Overview
        const overviewResponse = await fetch('/api/hospital-admin/dashboard/overview', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (!overviewResponse.ok) throw new Error('Failed to fetch overview data.');
        const overviewData = await overviewResponse.json();

        totalDoctorsEl.textContent = overviewData.totalDoctors;
        pendingApprovalsEl.textContent = overviewData.pendingApprovals;
        todayAppointmentsEl.textContent = overviewData.todayAppointments;
        totalPatientsEl.textContent = overviewData.totalPatients;

        pendingCountEl.textContent = overviewData.pendingApprovals;


        // --- Functions to Load Data for Tabs ---
        const loadPendingDoctors = async () => {
            pendingDoctorsTableBody.innerHTML = '<tr><td colspan="5">Loading pending doctors...</td></tr>';
            try {
                const response = await fetch('/api/hospital-admin/doctors/pending', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch pending doctors.');
                const doctors = await response.json();

                pendingDoctorsTableBody.innerHTML = ''; // Clear loading message
                if (doctors.length > 0) {
                    doctors.forEach(doc => {
                        const row = `
                            <tr>
                                <td>
                                    <div class="doctor-profile-cell">
                                        <div class="initials">${(doc.first_name.charAt(0) + doc.last_name.charAt(0)).toUpperCase()}</div>
                                        <div>
                                            <h4>Dr. ${doc.first_name} ${doc.last_name}</h4>
                                            <span>${doc.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>${doc.specialization}</td>
                                <td>${doc.hospital_name || 'N/A'}</td>
                                <td>${new Date(doc.applied_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                <td class="action-buttons">
                                    <button class="button primary small approve-btn" data-id="${doc.doctor_id}">Approve</button>
                                    <button class="button secondary small reject-btn" data-id="${doc.doctor_id}">Reject</button>
                                    <button class="button tertiary small view-profile-btn" data-id="${doc.doctor_id}">View Profile</button>
                                </td>
                            </tr>
                        `;
                        pendingDoctorsTableBody.insertAdjacentHTML('beforeend', row);
                    });
                } else {
                    pendingDoctorsTableBody.innerHTML = '<tr><td colspan="5">No pending doctor approvals.</td></tr>';
                }
            } catch (error) {
                console.error('Error loading pending doctors:', error);
                pendingDoctorsTableBody.innerHTML = '<tr><td colspan="5" style="color:red;">Failed to load pending doctors.</td></tr>';
            }
        };

        const loadApprovedDoctors = async () => {
            approvedDoctorsTableBody.innerHTML = '<tr><td colspan="5">Loading approved doctors...</td></tr>';
            try {
                const search = doctorSearchInput.value;
                const specialization = specializationFilter.value;
                const status = statusFilter.value;

                const response = await fetch(`/api/hospital-admin/doctors/approved?search=${search}&specialization=${specialization}&status=${status}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch approved doctors.');
                const result = await response.json();
                const doctors = result.doctors || [];
                const totalApproved = result.totalCount || 0;

                approvedDoctorsTableBody.innerHTML = '';
                if (doctors.length > 0) {
                    doctors.forEach(doc => {
                        const statusText = doc.status ? 'Active' : 'Inactive'; // Assuming is_available is the status
                        const statusClass = statusText.toLowerCase().replace(' ', '-');
                        const row = `
                            <tr>
                                <td>
                                    <div class="doctor-profile-cell">
                                        <div class="initials">${(doc.first_name.charAt(0) + doc.last_name.charAt(0)).toUpperCase()}</div>
                                        <div>
                                            <h4>Dr. ${doc.first_name} ${doc.last_name}</h4>
                                            <span>${doc.specialization}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>${doc.specialization}</td>
                                <td>${doc.rating} (${doc.total_appointments || 0} reviews)</td>
                                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                                <td class="action-buttons">
                                    <button class="button tertiary small view-profile-btn" data-id="${doc.doctor_id}">View Profile</button>
                                </td>
                            </tr>
                        `;
                        approvedDoctorsTableBody.insertAdjacentHTML('beforeend', row);
                    });
                } else {
                    approvedDoctorsTableBody.innerHTML = '<tr><td colspan="5">No approved doctors found.</td></tr>';
                }
                approvedCountEl.textContent = totalApproved;
                totalApprovedDoctorsEl.textContent = totalApproved;

            } catch (error) {
                console.error('Error loading approved doctors:', error);
                approvedDoctorsTableBody.innerHTML = '<tr><td colspan="5" style="color:red;">Failed to load approved doctors.</td></tr>';
            }
        };

        // --- Event Listeners for Tabs ---
        pendingApprovalsTab.addEventListener('click', () => {
            pendingApprovalsTab.classList.add('active');
            approvedDoctorsTab.classList.remove('active');
            pendingApprovalsContent.classList.add('active');
            approvedDoctorsContent.classList.remove('active');
            statusFilter.classList.add('hidden'); // Hide status filter for pending
            loadPendingDoctors();
        });

        approvedDoctorsTab.addEventListener('click', () => {
            approvedDoctorsTab.classList.add('active');
            pendingApprovalsTab.classList.remove('active');
            approvedDoctorsContent.classList.add('active');
            pendingApprovalsContent.classList.remove('active');
            statusFilter.classList.remove('hidden'); // Show status filter for approved
            loadApprovedDoctors();
        });

        // Initial load for the active tab (Pending Approvals)
        loadPendingDoctors();
        // You would typically fetch specializations here and populate the filter
        // const specializationsResponse = await fetch('/api/doctors/specializations', ...);

        // --- Event Listeners for Actions (Approve/Reject) ---
        pendingDoctorsTableBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (target.classList.contains('approve-btn')) {
                const doctorId = target.dataset.id;
                if (confirm('Are you sure you want to approve this doctor?')) {
                    try {
                        const response = await fetch(`/api/hospital-admin/doctors/approve/${doctorId}`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            alert('Doctor approved successfully!');
                            loadPendingDoctors(); // Reload pending list
                            loadApprovedDoctors(); // Also reload approved list to show new doctor
                        } else {
                            const errorData = await response.json();
                            alert(`Approval failed: ${errorData.message}`);
                        }
                    } catch (error) {
                        console.error('Error approving doctor:', error);
                        alert('An error occurred during approval.');
                    }
                }
            } else if (target.classList.contains('reject-btn')) {
                const doctorId = target.dataset.id;
                if (confirm('Are you sure you want to reject this doctor? This action cannot be undone.')) {
                    try {
                        const response = await fetch(`/api/hospital-admin/doctors/reject/${doctorId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            alert('Doctor request rejected and removed.');
                            loadPendingDoctors(); // Reload pending list
                            loadApprovedDoctors(); // Re-sync approved list
                        } else {
                            const errorData = await response.json();
                            alert(`Rejection failed: ${errorData.message}`);
                        }
                    } catch (error) {
                        console.error('Error rejecting doctor:', error);
                        alert('An error occurred during rejection.');
                    }
                }
            } else if (target.classList.contains('view-profile-btn')) {
                const doctorId = target.dataset.id;
                alert(`Viewing profile for Doctor ID: ${doctorId} (logic not implemented yet).`);
                // Redirect to a doctor profile view page or open a modal
            }
        });

        // --- Filter/Search Event Listeners for Approved Doctors ---
        doctorSearchInput.addEventListener('input', loadApprovedDoctors);
        specializationFilter.addEventListener('change', loadApprovedDoctors);
        statusFilter.addEventListener('change', loadApprovedDoctors);


    } catch (error) {
        console.error('Error initializing hospital admin dashboard:', error);
        alert('Failed to load dashboard. Please try again.');
    }
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login.html';
}
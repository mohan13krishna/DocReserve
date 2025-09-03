// public/js/super-admin-hospital-management.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'super_admin') {
        window.location.href = '/login.html';
        return;
    }

    const approvedAdminsTableBody = document.getElementById('approved-admins-table-body');
    const hospitalsTableBody = document.getElementById('hospitals-table-body');
    let hospitalsPage = 1;
    const hospitalsLimit = 10;

    // Modals
    const adminDetailsModalElement = document.getElementById('adminDetailsModal');
    const adminDetailsModal = new bootstrap.Modal(adminDetailsModalElement);
    const adminEditModalElement = document.getElementById('adminEditModal');
    const adminEditModal = new bootstrap.Modal(adminEditModalElement);
    const hospitalDetailsModalElement = document.getElementById('hospitalDetailsModal');
    const hospitalDetailsModal = new bootstrap.Modal(hospitalDetailsModalElement);
    const hospitalEditModalElement = document.getElementById('hospitalEditModal');
    const hospitalEditModal = new bootstrap.Modal(hospitalEditModalElement);

    // --- Functions to Fetch and Render Data ---

    // Pagination state
    let adminsPage = 1;
    const adminsLimit = 10;

    const renderAdminsPagination = (page, totalPages) => {
        const containerId = 'approved-admins-pagination';
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'd-flex justify-content-end mt-2';
            approvedAdminsTableBody.parentElement.after(container);
        }
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = '<nav><ul class="pagination pagination-sm mb-0">';
        const disabledPrev = page <= 1 ? ' disabled' : '';
        const disabledNext = page >= totalPages ? ' disabled' : '';
        html += `<li class="page-item${disabledPrev}"><a class="page-link" href="#" data-page="${page-1}">Previous</a></li>`;
        const maxPagesToShow = 5;
        const start = Math.max(1, page - Math.floor(maxPagesToShow/2));
        const end = Math.min(totalPages, start + maxPagesToShow - 1);
        for (let p = start; p <= end; p++) {
            const active = p === page ? ' active' : '';
            html += `<li class="page-item${active}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`;
        }
        html += `<li class="page-item${disabledNext}"><a class="page-link" href="#" data-page="${page+1}">Next</a></li>`;
        html += '</ul></nav>';
        container.innerHTML = html;
        container.querySelectorAll('a.page-link').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const goto = parseInt(a.getAttribute('data-page'), 10);
                if (!isNaN(goto) && goto >= 1 && goto !== page) {
                    adminsPage = goto;
                    fetchAndRenderApprovedAdmins();
                }
            });
        });
    };

    const fetchAndRenderApprovedAdmins = async () => {
        approvedAdminsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading approved admins...</td></tr>';
        try {
            const response = await fetch(`/api/super-admin/approved-hospital-admins?page=${adminsPage}&limit=${adminsLimit}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch approved hospital admins.');
            const result = await response.json();
            const admins = result.admins || [];

            approvedAdminsTableBody.innerHTML = '';
            if (admins.length > 0) {
                admins.forEach(admin => {
                    const row = `
                        <tr>
                            <td>${admin.first_name} ${admin.last_name}</td>
                            <td>${admin.email}</td>
                            <td>${admin.hospital_name}</td>
                            <td>${new Date(admin.created_at).toLocaleDateString('en-US')}</td>
                            <td>
                                <button class="btn btn-info btn-sm view-admin-btn" data-id="${admin.admin_id}">View</button>
                                <button class="btn btn-warning btn-sm edit-admin-btn" data-id="${admin.admin_id}">Edit</button>
                                <button class="btn btn-danger btn-sm remove-admin-btn" data-id="${admin.admin_id}">Remove</button>
                            </td>
                        </tr>
                    `;
                    approvedAdminsTableBody.insertAdjacentHTML('beforeend', row);
                });
            } else {
                approvedAdminsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No approved hospital admins found.</td></tr>';
            }
            renderAdminsPagination(result.page || 1, result.totalPages || 1);
        } catch (error) {
            console.error('Error fetching approved hospital admins:', error);
            approvedAdminsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load data.</td></tr>';
        }
    };

    const renderHospitalsPagination = (page, totalPages) => {
        const containerId = 'hospitals-pagination';
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'd-flex justify-content-end mt-2';
            hospitalsTableBody.parentElement.after(container);
        }
        let html = '';
        if (totalPages > 1) {
            html += `<nav><ul class="pagination pagination-sm mb-0">`;
            html += `<li class="page-item ${page<=1?'disabled':''}"><a href="#" class="page-link" data-page="prev">Previous</a></li>`;
            html += `<li class="page-item disabled"><span class="page-link">Page ${page} of ${totalPages}</span></li>`;
            html += `<li class="page-item ${page>=totalPages?'disabled':''}"><a href="#" class="page-link" data-page="next">Next</a></li>`;
            html += `</ul></nav>`;
        }
        container.innerHTML = html;
        container.querySelectorAll('a.page-link').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const dir = a.getAttribute('data-page');
                if (dir === 'prev' && hospitalsPage > 1) hospitalsPage -= 1;
                if (dir === 'next') hospitalsPage += 1;
                fetchAndRenderHospitals();
            });
        });
    };

    const fetchAndRenderHospitals = async () => {
        hospitalsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading hospitals...</td></tr>';
        try {
            const response = await fetch(`/api/super-admin/hospitals?page=${hospitalsPage}&limit=${hospitalsLimit}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch hospitals.');
            const result = await response.json();
            const hospitals = result.hospitals || [];

            hospitalsTableBody.innerHTML = '';
            if (hospitals.length > 0) {
                hospitals.forEach(hospital => {
                    const row = `
                        <tr>
                            <td>${hospital.hospital_name}</td>
                            <td>${hospital.total_doctors}</td>
                            <td>${hospital.total_patients_visited}</td>
                            <td>${hospital.avg_doctor_rating || 'N/A'}</td>
                            <td>
                                <button class="btn btn-info btn-sm view-hospital-btn" data-id="${hospital.hospital_id}">View</button>
                                <button class="btn btn-warning btn-sm edit-hospital-btn" data-id="${hospital.hospital_id}">Edit</button>
                                <button class="btn btn-danger btn-sm remove-hospital-btn" data-id="${hospital.hospital_id}">Remove</button>
                            </td>
                        </tr>
                    `;
                    hospitalsTableBody.insertAdjacentHTML('beforeend', row);
                });
            } else {
                hospitalsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No approved hospitals found.</td></tr>';
            }
            renderHospitalsPagination(result.page || 1, result.totalPages || 1);
        } catch (error) {
            console.error('Error fetching hospitals:', error);
            hospitalsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load data.</td></tr>';
        }
    };
    
    // --- Event Listeners for Tables ---

    // Hospital Admins Table
    approvedAdminsTableBody.addEventListener('click', async (event) => {
        const target = event.target;
        const id = target.dataset.id;

        if (target.classList.contains('view-admin-btn')) {
            try {
                const response = await fetch(`/api/super-admin/approved-hospital-admins/${id}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch admin details.');
                const details = await response.json();
                document.getElementById('modal-admin-name').textContent = `${details.first_name} ${details.last_name}`;
                document.getElementById('modal-admin-email').textContent = details.email;
                document.getElementById('modal-admin-phone').textContent = details.phone_number || 'N/A';
                document.getElementById('modal-admin-hospital').textContent = details.hospital_name;
                document.getElementById('modal-admin-created').textContent = new Date(details.created_at).toLocaleDateString();
                adminDetailsModal.show();
            } catch (error) {
                alert('Failed to load admin details.');
            }
        } else if (target.classList.contains('edit-admin-btn')) {
            try {
                const response = await fetch(`/api/super-admin/approved-hospital-admins/${id}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch admin details.');
                const details = await response.json();
                document.getElementById('edit-admin-id').value = id;
                document.getElementById('edit-admin-first-name').value = details.first_name;
                document.getElementById('edit-admin-last-name').value = details.last_name;
                document.getElementById('edit-admin-phone').value = details.phone_number;
                document.getElementById('edit-admin-email').value = details.email;
                adminEditModal.show();
            } catch (error) {
                alert('Failed to load admin details for editing.');
            }
        } else if (target.classList.contains('remove-admin-btn')) {
            if (confirm('Are you sure you want to remove this hospital admin? This action is irreversible.')) {
                try {
                    const response = await fetch(`/api/super-admin/approved-hospital-admins/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) throw new Error('Failed to remove admin.');
                    alert('Hospital admin removed successfully.');
                    fetchAndRenderApprovedAdmins();
                } catch (error) {
                    alert('An error occurred while removing the admin.');
                }
            }
        }
    });

    // Edit Admin Form Submission
document.getElementById('edit-admin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('edit-admin-id').value;
    const data = {
        first_name: document.getElementById('edit-admin-first-name').value,
        last_name: document.getElementById('edit-admin-last-name').value
        // Removed phone_number from data object
    };
    try {
        const response = await fetch(`/api/super-admin/approved-hospital-admins/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update admin.');
        alert('Admin details updated successfully.');
        adminEditModal.hide();
        fetchAndRenderApprovedAdmins();
    } catch (error) {
        alert('An error occurred while updating admin details.');
    }
});


    // Hospitals Table
    hospitalsTableBody.addEventListener('click', async (event) => {
        const target = event.target;
        const id = target.dataset.id;

        if (target.classList.contains('view-hospital-btn')) {
            try {
                const response = await fetch(`/api/super-admin/hospitals/${id}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch hospital details.');
                const details = await response.json();
                document.getElementById('modal-hospital-name').textContent = details.hospital_name;
                document.getElementById('modal-hospital-address').textContent = details.hospital_address;
                document.getElementById('modal-hospital-phone').textContent = details.hospital_phone;
                document.getElementById('modal-total-doctors').textContent = details.total_doctors;
                document.getElementById('modal-total-patients').textContent = details.total_patients_visited;
                hospitalDetailsModal.show();
            } catch (error) {
                alert('Failed to load hospital details.');
            }
        } else if (target.classList.contains('edit-hospital-btn')) {
            try {
                const response = await fetch(`/api/super-admin/hospitals/${id}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch hospital details.');
                const details = await response.json();
                document.getElementById('edit-hospital-id').value = id;
                document.getElementById('edit-hospital-name').value = details.hospital_name;
                document.getElementById('edit-hospital-address').value = details.hospital_address;
                document.getElementById('edit-hospital-phone').value = details.hospital_phone;
                hospitalEditModal.show();
            } catch (error) {
                alert('Failed to load hospital details for editing.');
            }
        } else if (target.classList.contains('remove-hospital-btn')) {
            if (confirm('Are you sure you want to delete this hospital? This will also remove all associated doctors and admins.')) {
                try {
                    const response = await fetch(`/api/super-admin/hospitals/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) throw new Error('Failed to delete hospital.');
                    alert('Hospital deleted successfully.');
                    fetchAndRenderHospitals();
                    fetchAndRenderApprovedAdmins(); // Re-render admins in case some were removed
                } catch (error) {
                    alert('An error occurred while deleting the hospital.');
                }
            }
        }
    });

    // Edit Hospital Form Submission
    document.getElementById('edit-hospital-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = document.getElementById('edit-hospital-id').value;
        const data = {
            hospital_name: document.getElementById('edit-hospital-name').value,
            hospital_address: document.getElementById('edit-hospital-address').value,
            hospital_phone: document.getElementById('edit-hospital-phone').value
        };
        try {
            const response = await fetch(`/api/super-admin/hospitals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to update hospital.');
            alert('Hospital details updated successfully.');
            hospitalEditModal.hide();
            fetchAndRenderHospitals();
        } catch (error) {
            alert('An error occurred while updating hospital details.');
        }
    });

    // Add Hospital Modal trigger and form handling
    const addHospitalBtn = document.getElementById('add-hospital-btn');
    const addHospitalModalElement = document.getElementById('hospitalAddModal');
    let addHospitalModal = null;
    if (addHospitalModalElement) {
        addHospitalModal = new bootstrap.Modal(addHospitalModalElement);
    }
    if (addHospitalBtn && addHospitalModal) {
        addHospitalBtn.addEventListener('click', () => addHospitalModal.show());
    }
    const addHospitalForm = document.getElementById('add-hospital-form');
    if (addHospitalForm) {
        addHospitalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                hospital_name: document.getElementById('add-hospital-name').value,
                hospital_code: document.getElementById('add-hospital-code').value,
                hospital_phone: document.getElementById('add-hospital-phone').value,
            };
            try {
                const response = await fetch('/api/super-admin/hospitals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error('Failed to add hospital.');
                alert('Hospital added successfully.');
                addHospitalModal.hide();
                fetchAndRenderHospitals();
            } catch (error) {
                alert('An error occurred while adding hospital.');
            }
        });
    }

    // Initial data load on page start
    fetchAndRenderApprovedAdmins();
    fetchAndRenderHospitals();
});

// Global logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login.html';
}

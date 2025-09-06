// public/js/hospital-admin-doctors-management.js

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('userRole');
  if (!token || role !== 'hospital_admin') { window.location.href = '/login.html'; return; }
  
  // Import the utility function for profile images
  if (typeof getProfileImageUrl !== 'function') {
    console.error('Profile image utility function not found. Make sure utils.js is loaded.');
  }

  const tableBody = document.getElementById('dm-table-body');
  const searchInput = document.getElementById('dm-search');
  const specSelect = document.getElementById('dm-specialization');
  const statusSelect = document.getElementById('dm-status');
  const prevBtn = document.getElementById('dm-prev');
  const nextBtn = document.getElementById('dm-next');
  const pageInfo = document.getElementById('dm-page-info');

  const modalEl = document.getElementById('doctorModal');
  const modal = new bootstrap.Modal(modalEl);
  const docIdInput = document.getElementById('doc-id');
  const docFirst = document.getElementById('doc-first');
  const docLast = document.getElementById('doc-last');
  const docSpec = document.getElementById('doc-spec');
  const docActive = document.getElementById('doc-active');
  const saveBtn = document.getElementById('save-doc-btn');

  let page = 1;
  const limit = 10;

  async function loadPage() {
    tableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search: searchInput.value || '',
      specialization: specSelect.value || '',
      status: statusSelect.value || ''
    });
    try {
      const resp = await fetch(`/api/hospital-admin/doctors/approved?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error('Failed to fetch doctors');
      const data = await resp.json();
      const doctors = data.doctors || [];
      const totalPages = data.totalPages || 1;
      const total = data.totalCount || 0;

      tableBody.innerHTML = '';
      if (doctors.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No doctors found.</td></tr>';
      } else {
        for (const d of doctors) {
          const statusText = d.status ? 'Active' : 'Inactive';
          
          // Create doctor avatar with initials and color
          const doctorInitials = `${d.first_name.charAt(0)}${d.last_name.charAt(0)}`.toUpperCase();
          const avatarColors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6610f2'];
          const avatarColor = avatarColors[d.doctor_id % avatarColors.length];
          
          // Get department badge class
          const deptClass = d.specialization ? `dept-${d.specialization.toLowerCase().replace(/\s+/g, '-')}` : 'dept-general';
          
          // Create rating display
          const ratingDisplay = d.rating ? 
            `<div class="d-flex align-items-center">
              <span class="badge bg-warning text-dark me-1">${d.rating}</span>
              <i class="bi bi-star-fill text-warning"></i>
            </div>` : 
            '<span class="text-muted">No rating</span>';
          
          const row = `
            <tr>
              <td>
                <div class="doctor-info">
                  <div class="doctor-avatar" style="background-color: ${avatarColor}">
                    ${doctorInitials}
                  </div>
                  <div class="doctor-details">
                    <h6>Dr. ${d.first_name} ${d.last_name}</h6>
                    <small class="text-muted">${d.specialization}</small>
                  </div>
                </div>
              </td>
              <td>
                <span class="dept-badge ${deptClass}">${d.specialization}</span>
              </td>
              <td>${ratingDisplay}</td>
              <td>
                <span class="status-badge status-${d.status ? 'approved' : 'rejected'}">
                  ${statusText}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn btn-action btn-view view-btn" data-id="${d.doctor_id}">
                    <i class="bi bi-eye"></i> View
                  </button>
                  <button class="btn btn-action btn-approve edit-btn" data-id="${d.doctor_id}">
                    <i class="bi bi-pencil"></i> Edit
                  </button>
                  <button class="btn btn-action btn-reject remove-btn" data-id="${d.doctor_id}">
                    <i class="bi bi-trash"></i> Remove
                  </button>
                </div>
              </td>
            </tr>`;
          tableBody.insertAdjacentHTML('beforeend', row);
        }
      }

      pageInfo.textContent = `Page ${page} of ${totalPages} — ${total} total`;
      prevBtn.disabled = page <= 1;
      nextBtn.disabled = page >= totalPages;
    } catch (e) {
      console.error(e);
      tableBody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Failed to load data.</td></tr>';
    }
  }

  // Pagination
  prevBtn.addEventListener('click', (e) => { 
    e.preventDefault();
    if (page > 1) { 
      page--; 
      loadPage(); 
    } 
  });
  nextBtn.addEventListener('click', (e) => { 
    e.preventDefault();
    page++; 
    loadPage(); 
  });

  // Filters
  searchInput.addEventListener('input', () => { page = 1; loadPage(); });
  specSelect.addEventListener('change', () => { page = 1; loadPage(); });
  statusSelect.addEventListener('change', () => { page = 1; loadPage(); });

  // Actions: view/edit/remove
  tableBody.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.view-btn');
    const editBtn = e.target.closest('.edit-btn');
    const removeBtn = e.target.closest('.remove-btn');

    if (viewBtn || editBtn) {
      const id = (viewBtn || editBtn).dataset.id;
      try {
        const r = await fetch(`/api/hospital-admin/doctors/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error('Failed to fetch doctor');
        const d = await r.json();
        docIdInput.value = d.doctor_id;
        docFirst.value = d.first_name || '';
        docLast.value = d.last_name || '';
        docSpec.value = d.specialization || '';
        docActive.checked = !!d.is_available;
        modal.show();
      } catch (err) {
        alert('Failed to load doctor.');
      }
    }

    if (removeBtn) {
      const id = removeBtn.dataset.id;
      if (confirm('Remove this doctor? This also deletes their user record.')) {
        try {
          const r = await fetch(`/api/hospital-admin/doctors/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) {
            const ejson = await r.json();
            alert(`Remove failed: ${ejson.message || 'Server error'}`);
          } else {
            alert('Doctor removed.');
            loadPage();
          }
        } catch (err) {
          alert('Remove failed.');
        }
      }
    }
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    const id = docIdInput.value;
    const payload = {
      first_name: docFirst.value || null,
      last_name: docLast.value || null,
      specialization: docSpec.value || null,
      is_available: docActive.checked
    };
    try {
      const r = await fetch(`/api/hospital-admin/doctors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const ejson = await r.json();
        alert(`Save failed: ${ejson.message || 'Server error'}`);
      } else {
        alert('Saved');
        modal.hide();
        loadPage();
      }
    } catch (err) {
      alert('Save failed.');
    }
  });

  // Initial load

  // Leave Requests pagination and actions
  const lrBody = document.getElementById('lr-table-body');
  const lrPrev = document.getElementById('lr-prev');
  const lrNext = document.getElementById('lr-next');
  const lrInfo = document.getElementById('lr-page-info');
  let lrPage = 1;
  const lrLimit = 10;

  async function loadLeaveRequests() {
    if (!lrBody) return;
    lrBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
    
    // Get filter values
    const searchInput = document.getElementById('lr-search');
    const statusFilter = document.getElementById('lr-status-filter');
    const typeFilter = document.getElementById('lr-type-filter');
    
    const params = new URLSearchParams({
      page: lrPage,
      limit: lrLimit,
      search: searchInput?.value || '',
      status: statusFilter?.value || '',
      type: typeFilter?.value || ''
    });
    
    try {
      const r = await fetch(`/api/hospital-admin/leave-requests?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Failed');
      const data = await r.json();
      const rows = data.requests || [];
      const totalPages = data.totalPages || 1;
      const total = data.totalCount || 0;
      lrBody.innerHTML = '';
      if (rows.length === 0) {
        lrBody.innerHTML = '<tr><td colspan="7" class="text-center">No leave requests.</td></tr>';
      } else {
        for (const x of rows) {
          const name = `Dr. ${x.first_name} ${x.last_name}`;
          const startDate = x.requested_date;
          const endDate = x.end_date || x.requested_date;
          const start = new Date(startDate);
          const end = new Date(endDate);
          const duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
          
          // Format leave type for display
          const leaveTypeDisplay = x.leave_type ? 
            x.leave_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
            'Personal Leave';
          
          // Get leave type class for colorful badge
          const leaveTypeClass = x.leave_type ? `leave-${x.leave_type}` : 'leave-personal-leave';
          
          const statusBadge = `<span class="status-badge status-${x.status.toLowerCase()}">${x.status.charAt(0).toUpperCase() + x.status.slice(1)}</span>`;
          
          // Create doctor avatar with initials
          const doctorInitials = `${x.first_name.charAt(0)}${x.last_name.charAt(0)}`.toUpperCase();
          const avatarColors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6610f2'];
          const avatarColor = avatarColors[name.length % avatarColors.length];
          
          lrBody.insertAdjacentHTML('beforeend', `
            <tr>
              <td>
                <div class="doctor-info">
                  <div class="doctor-avatar" style="background-color: ${avatarColor}">
                    ${doctorInitials}
                  </div>
                  <div class="doctor-details">
                    <h6>${name}</h6>
                    <small class="text-muted">${x.specialization}</small>
                  </div>
                </div>
              </td>
              <td><span class="leave-type-badge ${leaveTypeClass}">${leaveTypeDisplay}</span></td>
              <td><small class="text-muted d-block">${startDate ? new Date(startDate).toLocaleDateString() : '-'}</small></td>
              <td><small class="text-muted d-block">${endDate ? new Date(endDate).toLocaleDateString() : '-'}</small></td>
              <td><span class="badge bg-secondary">${duration} day${duration > 1 ? 's' : ''}</span></td>
              <td>${statusBadge}</td>
              <td><div class="reason-text" title="${x.reason}">${x.reason ? (x.reason.length > 30 ? x.reason.substring(0, 30) + '...' : x.reason) : 'No reason provided'}</div></td>
            </tr>`);
        }
      }
      lrInfo.textContent = `Page ${lrPage} of ${totalPages} — ${total} total`;
      lrPrev.disabled = lrPage <= 1;
      lrNext.disabled = lrPage >= totalPages;
    } catch (e) {
      lrBody.innerHTML = '<tr><td colspan="7" class="text-danger text-center">Failed to load leave requests.</td></tr>';
    }
  }

  lrPrev?.addEventListener('click', (e) => { 
    e.preventDefault();
    if (lrPage > 1) { 
      lrPage--; 
      loadLeaveRequests(); 
    } 
  });
  lrNext?.addEventListener('click', (e) => { 
    e.preventDefault();
    lrPage++; 
    loadLeaveRequests(); 
  });

  // Add event listeners for leave request filters
  const lrSearchInput = document.getElementById('lr-search');
  const lrStatusFilter = document.getElementById('lr-status-filter');
  const lrTypeFilter = document.getElementById('lr-type-filter');

  if (lrSearchInput) {
    lrSearchInput.addEventListener('input', () => {
      lrPage = 1;
      loadLeaveRequests();
    });
  }

  if (lrStatusFilter) {
    lrStatusFilter.addEventListener('change', () => {
      lrPage = 1;
      loadLeaveRequests();
    });
  }

  if (lrTypeFilter) {
    lrTypeFilter.addEventListener('change', () => {
      lrPage = 1;
      loadLeaveRequests();
    });
  }

  loadLeaveRequests();

  loadPage();
});


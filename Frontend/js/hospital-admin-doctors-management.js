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
          const row = `
            <tr>
              <td>
                <div class="doctor-profile-cell d-flex align-items-center">
                  <img src="${getProfileImageUrl(d.gender, d.doctor_id)}" class="rounded-circle me-3" alt="Dr. ${d.first_name} ${d.last_name}" style="width: 40px; height: 40px; object-fit: cover;">
                  <div>
                    <h4 class="fw-bold mb-0">Dr. ${d.first_name} ${d.last_name}</h4>
                    <span>${d.specialization}</span>
                  </div>
                </div>
              </td>
              <td>${d.specialization}</td>
              <td>${d.rating ?? '-'}</td>
              <td><span class="badge ${d.status ? 'bg-success' : 'bg-secondary'} rounded-pill">${statusText}</span></td>
              <td class="action-buttons">
                <button class="btn btn-outline-info btn-sm me-1 view-btn" data-id="${d.doctor_id}">View</button>
                <button class="btn btn-outline-primary btn-sm me-1 edit-btn" data-id="${d.doctor_id}">Edit</button>
                <button class="btn btn-outline-danger btn-sm remove-btn" data-id="${d.doctor_id}">Remove</button>
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
  prevBtn.addEventListener('click', () => { if (page > 1) { page--; loadPage(); } });
  nextBtn.addEventListener('click', () => { page++; loadPage(); });

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
    lrBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
    try {
      const r = await fetch(`/api/hospital-admin/leave-requests?page=${lrPage}&limit=${lrLimit}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Failed');
      const data = await r.json();
      const rows = data.requests || [];
      const totalPages = data.totalPages || 1;
      const total = data.totalCount || 0;
      lrBody.innerHTML = '';
      if (rows.length === 0) {
        lrBody.innerHTML = '<tr><td colspan="5" class="text-center">No leave requests.</td></tr>';
      } else {
        for (const x of rows) {
          const name = `Dr. ${x.first_name} ${x.last_name}`;
          const statusBadge = `<span class="badge ${x.status === 'Approved' ? 'bg-success' : x.status === 'Rejected' ? 'bg-danger' : 'bg-secondary'}">${x.status}</span>`;
          lrBody.insertAdjacentHTML('beforeend', `
            <tr>
              <td>${name}<br><span class="text-muted small">${x.specialization}</span></td>
              <td>${x.requested_date ? new Date(x.requested_date).toLocaleDateString() : '-'}</td>
              <td>${x.reason || '-'}</td>
              <td>${statusBadge}</td>
              <td>
                <button class="btn btn-outline-success btn-sm me-1 lr-approve" data-id="${x.leave_id}">Approve</button>
                <button class="btn btn-outline-danger btn-sm lr-reject" data-id="${x.leave_id}">Reject</button>
              </td>
            </tr>`);
        }
      }
      lrInfo.textContent = `Page ${lrPage} of ${totalPages} — ${total} total`;
      lrPrev.disabled = lrPage <= 1;
      lrNext.disabled = lrPage >= totalPages;
    } catch (e) {
      lrBody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Failed to load leave requests.</td></tr>';
    }
  }

  lrPrev?.addEventListener('click', () => { if (lrPage > 1) { lrPage--; loadLeaveRequests(); } });
  lrNext?.addEventListener('click', () => { lrPage++; loadLeaveRequests(); });

  lrBody?.addEventListener('click', async (e) => {
    const approveBtn = e.target.closest('.lr-approve');
    const rejectBtn = e.target.closest('.lr-reject');
    if (approveBtn) {
      const id = approveBtn.dataset.id;
      const r = await fetch(`/api/hospital-admin/leave-requests/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) alert('Approve failed');
      await loadLeaveRequests();
    } else if (rejectBtn) {
      const id = rejectBtn.dataset.id;
      const r = await fetch(`/api/hospital-admin/leave-requests/${id}/reject`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) alert('Reject failed');
      await loadLeaveRequests();
    }
  });

  loadLeaveRequests();

  loadPage();
});


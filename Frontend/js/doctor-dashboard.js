// public/js/doctor-dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'doctor') {
        window.location.href = '/login.html';
        return;
    }

    const doctorFullNameEl = document.getElementById('doctor-full-name');
    const doctorInitialsEl = document.getElementById('doctor-initials');
    const doctorAvailabilityToggle = document.getElementById('doctor-availability-toggle');
    const availabilityStatusEl = document.getElementById('availability-status');
    const todaysAppointmentsListEl = document.getElementById('todays-appointments-list');
    const calendarCurrentDateEl = document.getElementById('calendar-current-date');
    const currentAppointmentsDateEl = document.getElementById('current-date-appointments');
    const scheduleGridEl = document.getElementById('schedule-grid');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const prevDateBtn = document.getElementById('prev-date-btn');
    const nextDateBtn = document.getElementById('next-date-btn');
    const todayBtn = document.getElementById('today-btn');
    const viewToggles = document.querySelectorAll('.view-toggles .btn');

    // Dashboard stat tiles (if present)
    const statTotalPatientsEl = document.getElementById('stat-total-patients');
    const statTodayAppointmentsEl = document.getElementById('stat-today-appointments');
    const statUpcomingAppointmentsEl = document.getElementById('stat-upcoming-appointments');
    const statRecentPatientsEl = document.getElementById('stat-recent-patients');
    const recentPatientsListEl = document.getElementById('recent-patients-list');

    let currentScheduleDate = new Date(); // State variable to track the current date view
    let currentView = 'daily'; // 'daily', 'weekly'

    const fetchAndRenderDashboard = async () => {
        try {
            // Get the current date in YYYY-MM-DD format for the API call
            const dateString = currentScheduleDate.toISOString().split('T')[0];
            
            const response = await fetch(`/api/doctor/schedule?date=${dateString}&view=${currentView}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    alert('Session expired or unauthorized. Please log in again.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('userRole');
                    window.location.href = '/login.html';
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }

            const data = await response.json();
            console.log("Doctor Dashboard Data:", data);

            // --- Update Doctor Info ---
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            doctorFullNameEl.textContent = `Dr. ${decodedToken.first_name} ${decodedToken.last_name}`;
            doctorInitialsEl.textContent = `${decodedToken.first_name.charAt(0)}${decodedToken.last_name.charAt(0)}`.toUpperCase();
            doctorAvailabilityToggle.checked = data.doctorInfo.is_available;
            availabilityStatusEl.textContent = data.doctorInfo.is_available ? 'Available' : 'Busy';

            // --- Update KPI cards if on dashboard ---
            if (statTotalPatientsEl) statTotalPatientsEl.textContent = data.totalPatients ?? 0;
            if (statTodayAppointmentsEl) statTodayAppointmentsEl.textContent = data.todayAppointments?.length ?? 0;
            if (statUpcomingAppointmentsEl) statUpcomingAppointmentsEl.textContent = data.upcomingAppointmentsCount ?? 0;
            if (statRecentPatientsEl) statRecentPatientsEl.textContent = data.recentPatients?.length ?? 0;
            
            // --- Render Recent Patients Mini List ---
            if (recentPatientsListEl && data.recentPatients) {
                renderRecentPatientsMini(data.recentPatients.slice(0, 5)); // Show only the first 5 patients
            }

            // --- Render Today's Appointments Table ---
            const todaysTbody = document.getElementById('todays-appointments-tbody');
            if (todaysTbody) {
                const searchEl = document.getElementById('todays-search');
                const statusEl = document.getElementById('todays-status-filter');
                const prevBtn = document.getElementById('todays-prev');
                const nextBtn = document.getElementById('todays-next');
                const pageEl = document.getElementById('todays-page');
                const countEl = document.getElementById('todays-count');
                let page = 1;
                const pageSize = 10;

                function applyTableRender() {
                    const q = (searchEl?.value || '').toLowerCase();
                    const status = (statusEl?.value || '').toLowerCase();
                    const appointmentsToShow = data.todayAppointments || data.appointments || [];
                    // Dashboard should only show pending appointments waiting for approval
                    const filtered = appointmentsToShow.filter(a => {
                        const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
                        const matchesS = !status || (a.status || '').toLowerCase() === status;
                        const isPending = a.status === 'Pending'; // Only show pending appointments in dashboard
                        return matchesQ && matchesS && isPending;
                    });
                    const total = filtered.length;
                    const start = (page - 1) * pageSize;
                    const pageItems = filtered.slice(start, start + pageSize);

                    todaysTbody.innerHTML = '';
                    pageItems.forEach(a => {
                        const tr = document.createElement('tr');
                        tr.dataset.id = a.appointment_id;
                        
                        // Only show approve/reject actions for pending appointments
                        const actionButtons = `
                            <div class="d-flex gap-1 justify-content-start">
                                <button class="btn btn-sm btn-success appt-approve" title="Approve Appointment">
                                    <i class="bi bi-check-circle"></i> Approve
                                </button>
                                <button class="btn btn-sm btn-danger appt-reject" title="Reject Appointment">
                                    <i class="bi bi-x-circle"></i> Reject
                                </button>
                                <button class="btn btn-sm btn-outline-primary appt-view" data-bs-toggle="modal" data-bs-target="#appointmentModal" title="View Details">
                                    <i class="bi bi-eye"></i> View
                                </button>
                            </div>
                        `;
                        
                        // Format the date from appointment_date
                        const appointmentDate = new Date(a.appointment_date || a.date);
                        const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                        });
                        
                        tr.innerHTML = `
                            <td>${formattedDate}</td>
                            <td>${a.time}</td>
                            <td>${a.patientName}</td>
                            <td>${a.reason || ''}</td>
                            <td><span class="badge ${getStatusBadgeClass(a.status)}">${a.status}</span></td>
                            <td>${actionButtons}</td>
                        `;
                        
                        todaysTbody.appendChild(tr);
                        
                        // Add event listeners to action buttons
                        const apptId = a.appointment_id;
                        tr.querySelectorAll('.appt-view').forEach(btn => {
                            btn.addEventListener('click', () => viewAppointment(apptId));
                        });
                        tr.querySelectorAll('.appt-approve').forEach(btn => {
                            btn.addEventListener('click', () => approveAppointment(apptId));
                        });
                        tr.querySelector('.appt-reject')?.addEventListener('click', () => {
                            cancelAppointment(apptId);
                        });
                        tr.querySelector('.appt-cancel')?.addEventListener('click', () => {
                            cancelAppointment(apptId);
                        });
                        tr.querySelector('.appt-start')?.addEventListener('click', () => {
                            startAppointment(apptId);
                        });
                        tr.querySelector('.appt-complete')?.addEventListener('click', () => {
                            completeAppointment(apptId);
                        });
                    });

                    if (pageItems.length === 0) {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td colspan="6" class="text-center">No pending appointments found</td>`;
                        todaysTbody.appendChild(tr);
                    }

                    // Update pagination info
                    if (countEl) countEl.textContent = `Showing ${Math.min(start + 1, total)} to ${Math.min(start + pageSize, total)} of ${total} appointments`;
                    if (pageEl) pageEl.textContent = `Page ${page}`;
                    
                    // Update pagination buttons
                    if (prevBtn) prevBtn.disabled = page <= 1;
                    if (nextBtn) nextBtn.disabled = start + pageSize >= total;
                }

                // Initial render
                applyTableRender();

                // Event listeners for search and filter
                if (searchEl) searchEl.addEventListener('input', applyTableRender);
                if (statusEl) statusEl.addEventListener('change', applyTableRender);
                if (prevBtn) prevBtn.addEventListener('click', () => { page = Math.max(1, page - 1); applyTableRender(); });
                if (nextBtn) nextBtn.addEventListener('click', () => { page++; applyTableRender(); });
            }

            // --- Render Schedule Grid from real data (only if present on page) ---
            if (scheduleGridEl) {
                renderScheduleGrid(data.scheduleGrid || []);
                updateDateDisplay();
            }
            
            // --- Populate Quick Settings from real data ---
            // Update quick settings only if elements exist (schedule management page)
            if (data.quickSettings) {
                const slotDurationEl = document.getElementById('default-slot-duration');
                const breakSlotsEl = document.getElementById('break-between-slots');
                const autoConfirmEl = document.getElementById('auto-confirm-bookings');
                
                if (slotDurationEl) slotDurationEl.value = data.quickSettings.defaultSlotDuration;
                if (breakSlotsEl) breakSlotsEl.value = data.quickSettings.breakBetweenSlots;
                if (autoConfirmEl) autoConfirmEl.checked = data.quickSettings.autoConfirmBookings;
            }

        } catch (error) {
            console.error('Error fetching schedule data:', error);
            alert('Failed to load schedule data. Please try again later.');
        }
    }

    // Approve appointment function
    async function approveAppointment(appointmentId) {
        try {
            const response = await fetch(`/api/appointments/${appointmentId}/approve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            alert('Appointment approved successfully!');
            fetchAndRenderDashboard(); // Refresh the data
        } catch (error) {
            console.error('Error approving appointment:', error);
            alert('Failed to approve appointment. Please try again.');
        }
    }

    // Cancel appointment function
    async function cancelAppointment(appointmentId) {
        if (!confirm('Are you sure you want to cancel this appointment?')) {
            return;
        }

        try {
            const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            alert('Appointment cancelled successfully!');
            fetchAndRenderDashboard(); // Refresh the data
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            alert('Failed to cancel appointment. Please try again.');
        }
    }

    const renderScheduleGrid = (schedule) => {
        scheduleGridEl.innerHTML = ''; // Clear grid
        
        // Header
        const gridHeader = `
            <div class="grid-header time-header">Time</div>
            <div class="grid-header status-header">Status</div>
            <div class="grid-header details-header">Details</div>
            <div class="grid-header actions-header">Actions</div>
        `;
        scheduleGridEl.insertAdjacentHTML('beforeend', gridHeader);

        // Rows
        schedule.forEach(slot => {
            const row = `
                <div class="grid-row">
                    <div class="grid-cell time">${slot.time}</div>
                    <div class="grid-cell status ${slot.status.toLowerCase()}">${slot.status}</div>
                    <div class="grid-cell details text-muted">${slot.details}</div>
                    <div class="grid-cell actions">
                        ${slot.status === 'Available' ? `<button class="btn btn-secondary btn-sm">Add Slot</button>` : ''}
                        ${slot.status === 'Booked' ? `<button class="btn btn-secondary btn-sm">View Notes</button>` : ''}
                    </div>
                </div>
            `;
            scheduleGridEl.insertAdjacentHTML('beforeend', row);
        });
    };

    const updateDateDisplay = () => {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        calendarCurrentDateEl.textContent = currentScheduleDate.toLocaleDateString('en-US', options);
        currentAppointmentsDateEl.textContent = currentScheduleDate.toLocaleDateString('en-US', options);
    };

    // --- Event Listeners ---
    // Availability toggle
    doctorAvailabilityToggle.addEventListener('change', async (event) => {
        const isAvailable = event.target.checked;
        try {
            const updateResponse = await fetch('/api/doctor/availability', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ is_available: isAvailable })
            });
            if (updateResponse.ok) {
                // Update all availability indicators on the page
                availabilityStatusEl.textContent = isAvailable ? 'Available' : 'Busy';
                
                // Update dashboard availability toggle if it exists
                const dashboardToggle = document.getElementById('availability-toggle-dashboard');
                const dashboardStatus = document.getElementById('availability-status-dashboard');
                
                if (dashboardToggle) dashboardToggle.checked = isAvailable;
                if (dashboardStatus) dashboardStatus.textContent = isAvailable ? 'Available' : 'Busy';
                
                // Show a toast notification instead of an alert
                const toast = document.createElement('div');
                toast.className = 'position-fixed bottom-0 end-0 p-3';
                toast.style.zIndex = '11';
                toast.innerHTML = `
                    <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
                        <div class="toast-header">
                            <strong class="me-auto">Availability Updated</strong>
                            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                        <div class="toast-body">
                            Your status has been updated to: <strong>${isAvailable ? 'Available' : 'Busy'}</strong>
                        </div>
                    </div>
                `;
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.remove();
                }, 3000);
            } else {
                alert('Failed to update availability.');
                event.target.checked = !isAvailable;
            }
        } catch (error) {
            console.error('Error updating availability:', error);
            alert('An error occurred while updating availability.');
            event.target.checked = !isAvailable;
        }
    });

    // Date navigation buttons (only if they exist)
    if (prevDateBtn) {
        prevDateBtn.addEventListener('click', () => {
            currentScheduleDate.setDate(currentScheduleDate.getDate() - 1);
            fetchAndRenderDashboard();
        });
    }

    if (nextDateBtn) {
        nextDateBtn.addEventListener('click', () => {
            currentScheduleDate.setDate(currentScheduleDate.getDate() + 1);
            fetchAndRenderDashboard();
        });
    }

    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            currentScheduleDate = new Date();
            fetchAndRenderDashboard();
        });
    }

    // View toggles (Daily/Weekly/Monthly) - only if they exist
    if (viewToggles && viewToggles.length > 0) {
        viewToggles.forEach(button => {
            button.addEventListener('click', (event) => {
                viewToggles.forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
                currentView = event.target.dataset.view;
                fetchAndRenderDashboard();
            });
        });
    }
    
    // Quick settings save button (only if present on page)
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const defaultSlotDuration = document.getElementById('default-slot-duration').value;
            const breakBetweenSlots = document.getElementById('break-between-slots').value;
            const autoConfirmBookings = document.getElementById('auto-confirm-bookings').checked;

            const settingsData = { defaultSlotDuration, breakBetweenSlots, autoConfirmBookings };

            try {
                const response = await fetch('/api/doctor/settings', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(settingsData)
                });

                if (response.ok) {
                    alert('Quick settings saved successfully!');
                } else {
                    const errorData = await response.json();
                    alert(`Failed to save settings: ${errorData.message}`);
                }
            } catch (error) {
                console.error('Error saving settings:', error);
                alert('An error occurred while saving quick settings.');
            }
        });
    }

    // Initial load
    fetchAndRenderDashboard();

    // If KPI patients tile exists, fetch total patients count explicitly (more reliable)
    async function fetchAndSetPatientsCount() {
        if (!statTotalPatientsEl) return;
        try {
            const resp = await fetch('/api/doctor/patients?limit=1', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!resp.ok) return;
            const d = await resp.json();
            const total = d.totalPatients ?? d.total ?? (d.patients ? d.patients.length : 0);
            statTotalPatientsEl.textContent = total;
        } catch (e) { console.warn('Failed to load patients count', e); }
    }
    fetchAndSetPatientsCount();
    
    // Render recent patients mini list
    function renderRecentPatientsMini(patients) {
        if (!recentPatientsListEl || !patients || patients.length === 0) return;
        
        recentPatientsListEl.innerHTML = '';
        patients.forEach(patient => {
            const initials = patient.fullName.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
            const patientEl = document.createElement('div');
            patientEl.className = 'd-flex align-items-center mb-2';
            patientEl.innerHTML = `
                <div class="rounded-circle bg-secondary text-white d-flex justify-content-center align-items-center me-2" style="width:24px;height:24px;font-size:10px;">
                    ${initials}
                </div>
                <div class="flex-grow-1">
                    <div class="fw-semibold small">${patient.fullName}</div>
                    <div class="text-muted" style="font-size:10px;">${patient.lastVisit}</div>
                </div>
            `;
            recentPatientsListEl.appendChild(patientEl);
        });
    }
    
    // Medical Records Modal functionality
    function showMedicalRecordsModal() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('medicalRecordsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'medicalRecordsModal';
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Medical Records Search</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-md-8">
                                    <input type="text" class="form-control" id="patient-search-input" placeholder="Search by patient name...">
                                </div>
                                <div class="col-md-4">
                                    <button class="btn btn-primary w-100" id="search-patients-btn">
                                        <i class="bi bi-search me-2"></i>Search
                                    </button>
                                </div>
                            </div>
                            <div id="patients-search-results" class="mt-3"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Add search functionality
            const searchBtn = modal.querySelector('#search-patients-btn');
            const searchInput = modal.querySelector('#patient-search-input');
            const resultsDiv = modal.querySelector('#patients-search-results');
            
            const performSearch = async () => {
                const query = searchInput.value.trim();
                if (!query) return;
                
                resultsDiv.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
                
                try {
                    const response = await fetch(`/api/doctor/patients?search=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        renderPatientsSearchResults(data.patients || [], resultsDiv);
                    } else {
                        resultsDiv.innerHTML = '<div class="alert alert-warning">Failed to search patients. Please try again.</div>';
                    }
                } catch (error) {
                    console.error('Error searching patients:', error);
                    resultsDiv.innerHTML = '<div class="alert alert-danger">Error occurred while searching. Please try again.</div>';
                }
            };
            
            searchBtn.addEventListener('click', performSearch);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performSearch();
            });
        }
        
        // Show the modal
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }
    
    function renderPatientsSearchResults(patients, container) {
        if (!patients || patients.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No patients found matching your search.</div>';
            return;
        }
        
        container.innerHTML = '';
        patients.forEach(patient => {
            const initials = patient.fullName.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
            const patientCard = document.createElement('div');
            patientCard.className = 'card mb-2';
            patientCard.innerHTML = `
                <div class="card-body p-3">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center">
                            <div class="rounded-circle bg-primary text-white d-flex justify-content-center align-items-center me-3" style="width:40px;height:40px;">
                                ${initials}
                            </div>
                            <div>
                                <h6 class="mb-1">${patient.fullName}</h6>
                                <div class="text-muted small">Age: ${patient.age} • Last Visit: ${patient.lastVisit}</div>
                                ${patient.conditions.length > 0 ? `<div class="small"><strong>Conditions:</strong> ${patient.conditions.join(', ')}</div>` : ''}
                            </div>
                        </div>
                        <button class="btn btn-outline-primary btn-sm" onclick="viewPatientRecords(${patient.patient_id})">
                            <i class="bi bi-eye me-1"></i>View Records
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(patientCard);
        });
    }
    
    // View patient records function
    window.viewPatientRecords = function(patientId) {
        // For now, redirect to patient management page with patient ID
        window.location.href = `./doctor-patient-management.html?patient=${patientId}`;
    };
    
    // Render today's appointments in the dashboard
    function renderTodaysAppointments(appointments) {
        const appointmentsContainer = document.getElementById('todays-appointments-container');
        if (!appointmentsContainer) return;

        appointmentsContainer.innerHTML = '';

        if (!appointments || appointments.length === 0) {
            appointmentsContainer.innerHTML = '<div class="text-center py-4">No appointments scheduled for today.</div>';
            return;
        }

        // Add search and filter controls
        const controlsHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="input-group input-group-sm" style="max-width: 200px;">
                    <input type="text" class="form-control" id="appointment-search" placeholder="Search patient...">
                    <button class="btn btn-outline-secondary" type="button">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-primary dropdown-toggle" type="button" id="statusFilterDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                        Filter by Status
                    </button>
                    <ul class="dropdown-menu" aria-labelledby="statusFilterDropdown">
                        <li><a class="dropdown-item active" href="#" data-status="all">All</a></li>
                        <li><a class="dropdown-item" href="#" data-status="confirmed">Confirmed</a></li>
                        <li><a class="dropdown-item" href="#" data-status="pending">Pending</a></li>
                        <li><a class="dropdown-item" href="#" data-status="cancelled">Cancelled</a></li>
                        <li><a class="dropdown-item" href="#" data-status="completed">Completed</a></li>
                    </ul>
                </div>
            </div>
        `;
        appointmentsContainer.innerHTML = controlsHtml;

        // Create appointments list container
        const appointmentsList = document.createElement('div');
        appointmentsList.id = 'appointments-list';
        appointmentsList.className = 'appointments-list';
        appointmentsContainer.appendChild(appointmentsList);

        // Render appointments
        appointments.forEach(appointment => {
            const appointmentEl = document.createElement('div');
            appointmentEl.className = 'appointment-item p-3 border-bottom d-flex justify-content-between align-items-center';
            appointmentEl.dataset.status = appointment.status.toLowerCase();
            appointmentEl.dataset.patientName = appointment.patient_name.toLowerCase();
            
            // Status indicator
            const statusColor = getStatusBadgeColor(appointment.status);
            
            appointmentEl.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="status-indicator me-3" style="width: 10px; height: 10px; border-radius: 50%; background-color: var(--bs-${statusColor});"></div>
                    <div>
                        <h6 class="mb-1">${appointment.patient_name}</h6>
                        <p class="text-muted small mb-0">${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}</p>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <span class="badge bg-${statusColor} me-2">${appointment.status}</span>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-link text-dark" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="#" data-appointment-id="${appointment.id}" data-action="view">View Details</a></li>
                            <li><a class="dropdown-item" href="#" data-appointment-id="${appointment.id}" data-action="reschedule">Reschedule</a></li>
                            ${appointment.status !== 'cancelled' ? `<li><a class="dropdown-item text-danger" href="#" data-appointment-id="${appointment.id}" data-action="cancel">Cancel</a></li>` : ''}
                        </ul>
                    </div>
                </div>
            `;
            appointmentsList.appendChild(appointmentEl);
        });

        // Add pagination if needed
        if (appointments.length > 5) {
            const paginationHtml = `
                <nav aria-label="Appointments pagination" class="mt-3">
                    <ul class="pagination pagination-sm justify-content-center">
                        <li class="page-item disabled"><a class="page-link" href="#">Previous</a></li>
                        <li class="page-item active"><a class="page-link" href="#">1</a></li>
                        <li class="page-item"><a class="page-link" href="#">2</a></li>
                        <li class="page-item"><a class="page-link" href="#">Next</a></li>
                    </ul>
                </nav>
            `;
            appointmentsContainer.insertAdjacentHTML('beforeend', paginationHtml);
        }

        // Add event listeners for search and filter
        const searchInput = document.getElementById('appointment-search');
        if (searchInput) {
            searchInput.addEventListener('input', filterAppointments);
        }

        const statusFilters = document.querySelectorAll('[data-status]');
        statusFilters.forEach(filter => {
            filter.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove active class from all filters
                statusFilters.forEach(f => f.classList.remove('active'));
                // Add active class to clicked filter
                e.target.classList.add('active');
                filterAppointments();
            });
        });

        // Add event listeners for appointment actions
        const actionButtons = document.querySelectorAll('[data-action]');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = e.target.dataset.action;
                const appointmentId = e.target.dataset.appointmentId;
                handleAppointmentAction(action, appointmentId);
            });
        });
    }

    // Filter appointments based on search and status filter
    function filterAppointments() {
        const searchInput = document.getElementById('appointment-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const activeFilter = document.querySelector('[data-status].active');
        const statusFilter = activeFilter ? activeFilter.dataset.status : 'all';

        const appointmentItems = document.querySelectorAll('.appointment-item');
        appointmentItems.forEach(item => {
            const patientName = item.dataset.patientName;
            const status = item.dataset.status;

            const matchesSearch = !searchTerm || patientName.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || status === statusFilter;

            item.style.display = matchesSearch && matchesStatus ? 'flex' : 'none';
        });
    }

    // Handle appointment actions (view, reschedule, cancel)
    function handleAppointmentAction(action, appointmentId) {
        switch (action) {
            case 'view':
                // Implement view appointment details
                console.log(`View appointment ${appointmentId}`);
                // TODO: Show appointment details modal or navigate to details page
                break;
            case 'reschedule':
                // Implement reschedule functionality
                console.log(`Reschedule appointment ${appointmentId}`);
                // TODO: Show reschedule modal or navigate to reschedule page
                break;
            case 'cancel':
                // Implement cancel functionality
                console.log(`Cancel appointment ${appointmentId}`);
                if (confirm('Are you sure you want to cancel this appointment?')) {
                    // TODO: Send API request to cancel appointment
                    alert('Appointment cancelled successfully');
                }
                break;
            default:
                console.error(`Unknown action: ${action}`);
        }
    }
});

// Appointment action functions
async function viewAppointment(appointmentId) {
    try {
        const modalBody = document.getElementById('appointment-modal-body');
        if (modalBody) {
            modalBody.innerHTML = 'Loading appointment details...';
        }
        
        const response = await fetch(`/api/doctor/appointments/${appointmentId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const appointment = await response.json();
        
        // Format appointment details for display
        const appointmentDate = new Date(appointment.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = appointmentDate.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="appointment-details">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <h6 class="text-muted mb-1">Patient</h6>
                            <p class="mb-0 fw-bold">${appointment.patientName}</p>
                        </div>
                        <div class="col-md-6">
                            <h6 class="text-muted mb-1">Status</h6>
                            <p class="mb-0"><span class="badge ${getStatusBadgeClass(appointment.status)}">${appointment.status}</span></p>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <h6 class="text-muted mb-1">Date</h6>
                            <p class="mb-0">${formattedDate}</p>
                        </div>
                        <div class="col-md-6">
                            <h6 class="text-muted mb-1">Time</h6>
                            <p class="mb-0">${formattedTime}</p>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-12">
                            <h6 class="text-muted mb-1">Reason for Visit</h6>
                            <p class="mb-0">${appointment.reason || 'No reason specified'}</p>
                        </div>
                    </div>
                    ${appointment.notes ? `
                        <div class="row mb-3">
                            <div class="col-12">
                                <h6 class="text-muted mb-1">Notes</h6>
                                <p class="mb-0">${appointment.notes}</p>
                            </div>
                        </div>
                    ` : ''}
                    <div class="row mb-3">
                        <div class="col-md-4">
                            <h6 class="text-muted mb-1">Patient Age</h6>
                            <p class="mb-0">${appointment.patientAge}</p>
                        </div>
                        <div class="col-md-4">
                            <h6 class="text-muted mb-1">Gender</h6>
                            <p class="mb-0">${appointment.patientGender || 'Not specified'}</p>
                        </div>
                        <div class="col-md-4">
                            <h6 class="text-muted mb-1">Phone</h6>
                            <p class="mb-0">${appointment.patientPhone || 'Not provided'}</p>
                        </div>
                    </div>
                    ${appointment.medicalConditions ? `
                        <div class="row mb-3">
                            <div class="col-12">
                                <h6 class="text-muted mb-1">Medical Conditions</h6>
                                <p class="mb-0">${appointment.medicalConditions}</p>
                            </div>
                        </div>
                    ` : ''}
                    ${appointment.allergies ? `
                        <div class="row mb-3">
                            <div class="col-12">
                                <h6 class="text-muted mb-1">Allergies</h6>
                                <p class="mb-0">${appointment.allergies}</p>
                            </div>
                        </div>
                    ` : ''}
                    ${appointment.currentMedications ? `
                        <div class="row mb-3">
                            <div class="col-12">
                                <h6 class="text-muted mb-1">Current Medications</h6>
                                <p class="mb-0">${appointment.currentMedications}</p>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error fetching appointment details:', error);
        if (modalBody) {
            modalBody.innerHTML = '<div class="alert alert-danger">Failed to load appointment details. Please try again.</div>';
        }
    }
}

async function startAppointment(appointmentId) {
    try {
        const response = await fetch(`/api/doctor/appointments/${appointmentId}/start`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        alert('Appointment started successfully!');
        fetchAndRenderDashboard(); // Refresh the data
    } catch (error) {
        console.error('Error starting appointment:', error);
        alert('Failed to start appointment. Please try again.');
    }
}

async function completeAppointment(appointmentId) {
    const notes = prompt('Please enter any notes for this appointment (optional):');
    
    try {
        const response = await fetch(`/api/doctor/appointments/${appointmentId}/complete`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ notes })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        alert('Appointment completed successfully!');
        fetchAndRenderDashboard(); // Refresh the data
    } catch (error) {
        console.error('Error completing appointment:', error);
        alert('Failed to complete appointment. Please try again.');
    }
}

function getStatusBadgeClass(status) {
    switch (status?.toLowerCase()) {
        case 'pending': return 'bg-warning text-dark';
        case 'confirmed': return 'bg-info text-dark';
        case 'in progress': return 'bg-primary';
        case 'completed': return 'bg-success';
        case 'cancelled': return 'bg-secondary';
        default: return 'bg-light text-dark';
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login.html';
}

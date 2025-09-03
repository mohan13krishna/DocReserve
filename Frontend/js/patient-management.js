// Frontend/js/patient-management.js

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'doctor') {
        window.location.href = '/login.html';
        return;
    }

    // Initialize variables
    let currentPage = 1;
    const pageSize = 9; // 3x3 grid
    let currentFilters = {};
    let allPatients = [];

    // DOM elements
    const patientCardsContainer = document.getElementById('patient-cards-container');
    const patientSearchInput = document.getElementById('patient-search-input');
    const sortByFilter = document.getElementById('sort-by-filter');
    const bulkActionsToolbar = document.getElementById('bulk-actions');
    const selectAllCheckbox = document.getElementById('pm-select-all');
    const paginationCount = document.getElementById('pm-count');
    const paginationPage = document.getElementById('pm-page');
    const prevPageBtn = document.getElementById('pm-prev');
    const nextPageBtn = document.getElementById('pm-next');

    // Update doctor info in header
    updateDoctorInfo(token);

    // Initialize availability toggle
    initializeAvailabilityToggle();

    // Fetch and render patients
    await fetchAndRenderPatients();

    // Add event listeners
    addEventListeners();
    
    // Initialize schedule appointment modal
    initializeScheduleAppointmentModal();

    /**
     * Updates the doctor information in the header
     * @param {string} token - JWT token
     */
    function updateDoctorInfo(token) {
        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            document.getElementById('doctor-full-name').textContent = `Dr. ${decodedToken.first_name || ''} ${decodedToken.last_name || ''}`;
            document.getElementById('doctor-initials').textContent = `${(decodedToken.first_name || '').charAt(0)}${(decodedToken.last_name || '').charAt(0)}`.toUpperCase();
        } catch (error) {
            console.error('Error updating doctor info:', error);
        }
    }

    /**
     * Initializes the availability toggle functionality
     */
    function initializeAvailabilityToggle() {
        const doctorAvailabilityToggle = document.getElementById('doctor-availability-toggle');
        const availabilityStatusEl = document.getElementById('availability-status');
        
        // Fetch and set initial status
        fetchDoctorAvailability();

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
                    availabilityStatusEl.textContent = isAvailable ? 'Available' : 'Busy';
                    // Show toast notification instead of alert
                    showToast(`Your status has been updated to: ${isAvailable ? 'Available' : 'Busy'}`);
                } else {
                    showToast('Failed to update availability.', 'error');
                    event.target.checked = !isAvailable;
                }
            } catch (error) {
                console.error('Error updating availability:', error);
                showToast('An error occurred while updating availability.', 'error');
                event.target.checked = !isAvailable;
            }
        });
    }

    /**
     * Fetches the doctor's current availability status
     */
    async function fetchDoctorAvailability() {
        try {
            const response = await fetch('/api/doctor/availability', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                const doctorAvailabilityToggle = document.getElementById('doctor-availability-toggle');
                const availabilityStatusEl = document.getElementById('availability-status');
                
                doctorAvailabilityToggle.checked = data.is_available;
                availabilityStatusEl.textContent = data.is_available ? 'Available' : 'Busy';
            }
        } catch (error) {
            console.error('Error fetching availability:', error);
        }
    }

    /**
     * Fetches patients from the API and renders them
     */
    async function fetchAndRenderPatients() {
        try {
            // Build filters
            const params = buildFilterParams();
            
            const response = await fetch(`/api/doctor/patients?${params.toString()}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Failed to fetch patients.');
            
            const data = await response.json();
            allPatients = data.patients || [];
            const totalPatients = data.totalPatients || 0;
            
            renderPatientCards(allPatients);
            updatePagination(totalPatients);
            
        } catch (error) {
            console.error('Error fetching patients:', error);
            patientCardsContainer.innerHTML = '<div class="alert alert-danger">Failed to load patients. Please try again later.</div>';
        }
    }

    /**
     * Builds URL parameters based on current filters
     * @returns {URLSearchParams} - URL parameters
     */
    function buildFilterParams() {
        const genders = [];
        if (document.getElementById('filt-g-m')?.checked) genders.push('Male');
        if (document.getElementById('filt-g-f')?.checked) genders.push('Female');
        if (document.getElementById('filt-g-o')?.checked) genders.push('Other');
        
        const conditions = (document.getElementById('filt-conditions')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
        const lastFrom = document.getElementById('filt-last-from')?.value || '';
        const lastTo = document.getElementById('filt-last-to')?.value || '';
        const nextFrom = document.getElementById('filt-next-from')?.value || '';
        const nextTo = document.getElementById('filt-next-to')?.value || '';

        const params = new URLSearchParams();
        params.set('search', patientSearchInput.value || '');
        params.set('sortBy', sortByFilter.value || '');
        if (genders.length) params.set('gender', genders.join(','));
        if (conditions.length) params.set('conditions', conditions.join(','));
        if (lastFrom) params.set('last_from', lastFrom);
        if (lastTo) params.set('last_to', lastTo);
        if (nextFrom) params.set('next_from', nextFrom);
        if (nextTo) params.set('next_to', nextTo);
        params.set('page', String(currentPage));
        params.set('limit', String(pageSize));

        return params;
    }

    /**
     * Renders patient cards in the container
     * @param {Array} patients - Array of patient objects
     */
    function renderPatientCards(patients) {
        patientCardsContainer.innerHTML = '';
        
        if (patients.length === 0) {
            patientCardsContainer.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="text-muted">
                        <i class="bi bi-search fs-1 mb-3 d-block"></i>
                        <p>No patients found matching your criteria.</p>
                        <button class="btn btn-outline-primary btn-sm rounded-pill" id="pm-clear-filters">
                            <i class="bi bi-funnel-fill me-1"></i>Clear filters
                        </button>
                    </div>
                </div>
            `;
            
            document.getElementById('pm-clear-filters')?.addEventListener('click', clearFilters);
            return;
        }
        
        patients.forEach(patient => {
            const patientCard = createPatientCard(patient);
            patientCardsContainer.appendChild(patientCard);
        });
        
        // Add event listeners to the newly created cards
        addPatientCardEventListeners();
    }

    /**
     * Creates a patient card DOM element
     * @param {Object} patient - Patient data
     * @returns {HTMLElement} - Patient card element
     */
    function createPatientCard(patient) {
        // Clone the template
        const template = document.getElementById('patient-card-template');
        const card = template.cloneNode(true);
        
        // Remove template ID and make visible
        card.removeAttribute('id');
        card.classList.remove('d-none');
        
        // Set patient data
        const initials = (patient.fullName.match(/\b(\w)/g) || []).join('').toUpperCase();
        
        // Set avatar and basic info
        card.querySelector('.patient-initials').textContent = initials;
        card.querySelector('.patient-name').textContent = patient.fullName;
        card.querySelector('.patient-basic-info').textContent = `${patient.gender}, ${patient.age} years`;
        
        // Set contact info
        card.querySelector('.patient-phone').textContent = patient.phoneNumber;
        card.querySelector('.patient-email').textContent = patient.email;
        
        // Set medical info
        card.querySelector('.patient-last-visit').textContent = patient.lastVisit || 'No previous visits';
        card.querySelector('.patient-next-appt').textContent = patient.nextAppointment ? 
            `Next appointment: ${patient.nextAppointment}` : 'No upcoming appointments';
        card.querySelector('.patient-conditions').textContent = patient.conditions.join(', ') || 'None recorded';
        
        // Set data attributes for buttons
        const viewBtn = card.querySelector('.patient-view');
        const scheduleBtn = card.querySelector('.patient-schedule');
        viewBtn.setAttribute('data-patient-id', patient.patient_id);
        scheduleBtn.setAttribute('data-patient-id', patient.patient_id);
        
        // Set checkbox value
        const checkbox = card.querySelector('.patient-select');
        checkbox.value = patient.patient_id;
        
        // Create a column wrapper
        const colDiv = document.createElement('div');
        colDiv.className = 'col';
        colDiv.appendChild(card);
        
        return colDiv;
    }

    /**
     * Updates pagination controls
     * @param {number} totalPatients - Total number of patients
     */
    function updatePagination(totalPatients) {
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min((currentPage - 1) * pageSize + pageSize, totalPatients);
        
        if (paginationCount) {
            paginationCount.textContent = totalPatients > 0 ? 
                `Showing ${start}-${end} of ${totalPatients} patients` : 
                'No patients found';
        }
        
        if (paginationPage) {
            paginationPage.textContent = totalPatients > 0 ? `Page ${currentPage}` : '';
        }
        
        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage <= 1;
        }
        
        if (nextPageBtn) {
            nextPageBtn.disabled = end >= totalPatients;
        }
    }

    /**
     * Adds event listeners to various elements
     */
    function addEventListeners() {
        // Search and filter events
        patientSearchInput.addEventListener('input', debounce(() => {
            currentPage = 1;
            fetchAndRenderPatients();
        }, 500));
        
        sortByFilter.addEventListener('change', () => {
            currentPage = 1;
            fetchAndRenderPatients();
        });
        
        document.getElementById('apply-filters-btn').addEventListener('click', () => {
            currentPage = 1;
            fetchAndRenderPatients();
        });
        
        // Pagination events
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchAndRenderPatients();
            }
        });
        
        nextPageBtn.addEventListener('click', () => {
            currentPage++;
            fetchAndRenderPatients();
        });
        
        // Bulk action events
        document.getElementById('pm-bulk-message').addEventListener('click', handleBulkMessage);
        document.getElementById('pm-bulk-schedule').addEventListener('click', handleBulkSchedule);
        document.getElementById('pm-bulk-remove').addEventListener('click', handleBulkRemove);
        
        // Select all checkbox
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.patient-select');
            checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
            updateBulkActionsToolbar();
        });
    }

    /**
     * Adds event listeners to patient cards
     */
    function addPatientCardEventListeners() {
        // View patient details
        document.querySelectorAll('.patient-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const patientId = e.currentTarget.getAttribute('data-patient-id');
                openPatientDetailsModal(patientId);
            });
        });
        
        // Schedule appointment
        document.querySelectorAll('.patient-schedule').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const patientId = e.currentTarget.getAttribute('data-patient-id');
                openScheduleAppointmentModal(patientId);
            });
        });
        
        // Selection checkboxes
        document.querySelectorAll('.patient-select').forEach(checkbox => {
            checkbox.addEventListener('change', updateBulkActionsToolbar);
        });
    }

    /**
     * Opens the patient details modal
     * @param {string} patientId - Patient ID
     */
    function openPatientDetailsModal(patientId) {
        const patient = allPatients.find(p => String(p.patient_id) === String(patientId));
        const modalBody = document.getElementById('patient-details-body');
        
        if (!modalBody) return;
        if (!patient) {
            modalBody.textContent = 'Patient not found';
            return;
        }
        
        const initials = (patient.fullName.match(/\b(\w)/g) || []).join('').toUpperCase();
        
        modalBody.innerHTML = `
            <div class="d-flex align-items-start gap-3 mb-4">
                <div class="rounded-circle bg-primary text-white d-flex justify-content-center align-items-center fw-bold" style="width:64px;height:64px;">${initials}</div>
                <div>
                    <div class="fs-5 fw-bold">${patient.fullName}</div>
                    <div class="text-muted">${patient.gender}, ${patient.age} years</div>
                    <div class="mt-2 small"><i class="bi bi-telephone me-1"></i>${patient.phoneNumber} &nbsp;|&nbsp; <i class="bi bi-envelope me-1"></i>${patient.email}</div>
                    <div class="small"><i class="bi bi-heart-pulse-fill me-1 text-danger"></i>${patient.conditions.join(', ') || 'No conditions recorded'}</div>
                </div>
            </div>
            
            <div class="row g-3 mb-4">
                <div class="col-md-6">
                    <div class="p-3 bg-light rounded-3 h-100">
                        <div class="fw-semibold mb-2">Last Visit</div>
                        <div>${patient.lastVisit || 'No previous visits'}</div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="p-3 bg-light rounded-3 h-100">
                        <div class="fw-semibold mb-2">Next Appointment</div>
                        <div>${patient.nextAppointment || 'No upcoming appointments'}</div>
                    </div>
                </div>
            </div>
            
            <div class="mb-4">
                <h6 class="fw-bold mb-3">Medical History</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Diagnosis</th>
                                <th>Doctor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderMedicalHistory(patient.medicalHistory || [])}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div>
                <h6 class="fw-bold mb-3">Notes</h6>
                <div class="form-floating mb-3">
                    <textarea class="form-control" id="patient-notes" style="height: 100px">${patient.notes || ''}</textarea>
                    <label for="patient-notes">Add or update notes</label>
                </div>
                <button class="btn btn-primary btn-sm" id="save-patient-notes" data-patient-id="${patient.patient_id}">
                    <i class="bi bi-save me-1"></i>Save Notes
                </button>
            </div>
        `;
        
        // Add event listener to save notes button
        document.getElementById('save-patient-notes')?.addEventListener('click', async (e) => {
            const patientId = e.currentTarget.getAttribute('data-patient-id');
            const notes = document.getElementById('patient-notes').value;
            await savePatientNotes(patientId, notes);
        });
        
        // Set up modal action buttons
        document.getElementById('pdm-create-appointment').onclick = () => {
            openScheduleAppointmentModal(patient.patient_id);
        };
        
        document.getElementById('pdm-start-chat').onclick = () => {
            showToast('Chat feature coming soon!');
        };
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('patientDetailsModal'));
        modal.show();
    }

    /**
     * Opens the schedule appointment modal for a patient
     * @param {string} patientId - Patient ID
     */
    function openScheduleAppointmentModal(patientId) {
        const patient = allPatients.find(p => String(p.patient_id) === String(patientId));
        if (!patient) {
            showToast('Patient not found', 'error');
            return;
        }
        
        // Set patient info in the modal
        document.getElementById('schedule-patient-id').value = patient.patient_id;
        document.getElementById('schedule-patient-name').textContent = patient.fullName;
        document.getElementById('schedule-patient-details').textContent = `${patient.gender}, ${patient.age} years • ${patient.phoneNumber}`;
        
        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('appointment-date').value = tomorrow.toISOString().split('T')[0];
        
        // Clear previous time slots and fetch available slots
        const timeSelect = document.getElementById('appointment-time');
        timeSelect.innerHTML = '<option value="" selected disabled>Select a time</option>';
        fetchAvailableTimeSlots(tomorrow.toISOString().split('T')[0]);
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('scheduleAppointmentModal'));
        modal.show();
    }

    /**
     * Renders the medical history table rows
     * @param {Array} history - Medical history array
     * @returns {string} - HTML string of table rows
     */
    function renderMedicalHistory(history) {
        if (!history || history.length === 0) {
            return '<tr><td colspan="4" class="text-center text-muted">No medical history available</td></tr>';
        }
        
        return history.map(entry => `
            <tr>
                <td>${entry.date}</td>
                <td>${entry.type}</td>
                <td>${entry.diagnosis}</td>
                <td>${entry.doctor}</td>
            </tr>
        `).join('');
    }

    /**
     * Saves patient notes to the API
     * @param {string} patientId - Patient ID
     * @param {string} notes - Patient notes
     */
    async function savePatientNotes(patientId, notes) {
        try {
            const response = await fetch(`/api/doctor/patients/${patientId}/notes`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ notes })
            });
            
            if (response.ok) {
                showToast('Patient notes saved successfully');
                // Update the patient in the local array
                const patientIndex = allPatients.findIndex(p => String(p.patient_id) === String(patientId));
                if (patientIndex !== -1) {
                    allPatients[patientIndex].notes = notes;
                }
            } else {
                showToast('Failed to save patient notes', 'error');
            }
        } catch (error) {
            console.error('Error saving patient notes:', error);
            showToast('An error occurred while saving patient notes', 'error');
        }
    }

    /**
     * Updates the bulk actions toolbar visibility
     */
    function updateBulkActionsToolbar() {
        const selectedCheckboxes = document.querySelectorAll('.patient-select:checked');
        bulkActionsToolbar.style.display = selectedCheckboxes.length > 0 ? 'flex' : 'none';
    }

    /**
     * Handles bulk messaging action
     */
    async function handleBulkMessage() {
        const selectedIds = getSelectedPatientIds();
        if (selectedIds.length === 0) return;
        
        // For now, just show a toast notification
        showToast(`Messaging ${selectedIds.length} patients (feature coming soon)`);
    }

    /**
     * Handles bulk scheduling action
     */
    function handleBulkSchedule() {
        const selectedIds = getSelectedPatientIds();
        if (selectedIds.length === 0) return;
        
        if (selectedIds.length === 1) {
            // If only one patient is selected, open the schedule modal
            openScheduleAppointmentModal(selectedIds[0]);
        } else {
            // For multiple patients, navigate to the schedule management page
            window.location.href = `./doctor-schedule-management.html?patients=${encodeURIComponent(selectedIds.join(','))}`;
        }
    }

    /**
     * Handles bulk remove action
     */
    async function handleBulkRemove() {
        const selectedIds = getSelectedPatientIds();
        if (selectedIds.length === 0) return;
        
        if (!confirm(`Remove ${selectedIds.length} patients from your list?`)) return;
        
        try {
            const response = await fetch('/api/doctor/patients/bulk-remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ patient_ids: selectedIds })
            });
            
            if (response.ok) {
                showToast(`Successfully removed ${selectedIds.length} patients`);
                currentPage = 1;
                fetchAndRenderPatients();
            } else {
                showToast('Failed to remove patients', 'error');
            }
        } catch (error) {
            console.error('Error removing patients:', error);
            showToast('An error occurred while removing patients', 'error');
        }
    }

    /**
     * Gets the IDs of selected patients
     * @returns {Array} - Array of patient IDs
     */
    function getSelectedPatientIds() {
        return Array.from(document.querySelectorAll('.patient-select:checked')).map(checkbox => checkbox.value);
    }

    /**
     * Clears all filters and resets to default
     */
    function clearFilters() {
        document.getElementById('filt-g-m').checked = false;
        document.getElementById('filt-g-f').checked = false;
        document.getElementById('filt-g-o').checked = false;
        document.getElementById('filt-conditions').value = '';
        document.getElementById('filt-last-from').value = '';
        document.getElementById('filt-last-to').value = '';
        document.getElementById('filt-next-from').value = '';
        document.getElementById('filt-next-to').value = '';
        patientSearchInput.value = '';
        sortByFilter.value = 'name';
        
        currentPage = 1;
        fetchAndRenderPatients();
    }

    /**
     * Shows a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of toast (success, error, warning, info)
     */
    function showToast(message, type = 'success') {
        // Check if toast container exists, if not create it
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toastId = `toast-${Date.now()}`;
        const bgClass = type === 'error' ? 'bg-danger' : 
                       type === 'warning' ? 'bg-warning' : 
                       type === 'info' ? 'bg-info' : 'bg-success';
        
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header ${bgClass} text-white">
                    <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        // Initialize and show the toast
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();
        
        // Remove toast after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    /**
     * Debounce function to limit how often a function can be called
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Initializes the schedule appointment modal
     */
    function initializeScheduleAppointmentModal() {
        // Date change event
        document.getElementById('appointment-date')?.addEventListener('change', (e) => {
            const selectedDate = e.target.value;
            fetchAvailableTimeSlots(selectedDate);
        });
        
        // Save appointment button
        document.getElementById('save-appointment-btn')?.addEventListener('click', saveAppointment);
    }
    
    /**
     * Fetches available time slots for a given date
     * @param {string} date - Date in YYYY-MM-DD format
     */
    async function fetchAvailableTimeSlots(date) {
        const timeSelect = document.getElementById('appointment-time');
        timeSelect.innerHTML = '<option value="" selected disabled>Loading time slots...</option>';
        
        try {
            const response = await fetch(`/api/doctor/available-slots?date=${date}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Failed to fetch available time slots');
            
            const data = await response.json();
            timeSelect.innerHTML = '<option value="" selected disabled>Select a time</option>';
            
            if (!data.availableSlots || data.availableSlots.length === 0) {
                timeSelect.innerHTML += '<option value="" disabled>No available slots for this date</option>';
                return;
            }
            
            data.availableSlots.forEach(slot => {
                timeSelect.innerHTML += `<option value="${slot.time}">${slot.time}</option>`;
            });
        } catch (error) {
            console.error('Error fetching available time slots:', error);
            timeSelect.innerHTML = '<option value="" selected disabled>Failed to load time slots</option>';
        }
    }
    
    /**
     * Saves a new appointment
     */
    async function saveAppointment() {
        const patientId = document.getElementById('schedule-patient-id').value;
        const date = document.getElementById('appointment-date').value;
        const time = document.getElementById('appointment-time').value;
        const type = document.getElementById('appointment-type').value;
        const reason = document.getElementById('appointment-reason').value;
        const duration = document.getElementById('appointment-duration').value;
        const sendNotification = document.getElementById('send-notification').checked;
        
        // Validate required fields
        if (!patientId || !date || !time || !type || !duration) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/doctor/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patient_id: patientId,
                    date,
                    time,
                    type,
                    reason,
                    duration: parseInt(duration),
                    send_notification: sendNotification
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create appointment');
            }
            
            const data = await response.json();
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleAppointmentModal'));
            modal.hide();
            
            // Show success message
            showToast('Appointment scheduled successfully');
            
            // Refresh today's appointments
            initializeTodaysAppointments();
            
            // Update patient's next appointment in the list
            const patientIndex = allPatients.findIndex(p => String(p.patient_id) === String(patientId));
            if (patientIndex !== -1) {
                allPatients[patientIndex].nextAppointment = `${date} ${time}`;
                renderPatientCards(allPatients);
            }
        } catch (error) {
            console.error('Error creating appointment:', error);
            showToast(error.message || 'An error occurred while scheduling the appointment', 'error');
        }
    }

    // Initialize today's appointments section
    initializeTodaysAppointments();

    /**
     * Initializes the today's appointments section
     */
    async function initializeTodaysAppointments() {
        const pmTodayList = document.getElementById('pm-today-list');
        if (!pmTodayList) return;
        
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/doctor/schedule?date=${todayStr}&view=daily`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            pmTodayList.innerHTML = '';
            
            if (!data.todayAppointments || data.todayAppointments.length === 0) {
                pmTodayList.innerHTML = `
                    <div class="col-12 text-center py-3">
                        <p class="text-muted mb-0">No appointments scheduled for today</p>
                    </div>
                `;
                return;
            }
            
            data.todayAppointments.slice(0, 9).forEach(app => {
                const initials = (app.patientName.match(/\b(\w)/g) || []).join('').toUpperCase();
                const statusClass = app.status === 'Confirmed' ? 'text-success' : 
                                   app.status === 'Pending' ? 'text-warning' : 
                                   app.status === 'Cancelled' ? 'text-danger' : 'text-muted';
                
                pmTodayList.insertAdjacentHTML('beforeend', `
                    <div class="col">
                        <div class="card h-100 shadow-sm border-0 rounded-4 animate-hover">
                            <div class="card-body p-3">
                                <div class="d-flex align-items-center">
                                    <div class="rounded-circle bg-primary text-white d-flex justify-content-center align-items-center fw-bold me-3" style="width:44px;height:44px;">${initials}</div>
                                    <div>
                                        <div class="fw-bold">${app.patientName}</div>
                                        <div class="small text-muted">${app.time} • <span class="${statusClass}">${app.status}</span></div>
                                    </div>
                                </div>
                                <div class="mt-2 small text-muted">${app.reason || 'No reason specified'}</div>
                                <div class="mt-2 d-flex justify-content-end">
                                    <button class="btn btn-sm btn-outline-primary rounded-pill me-2" 
                                            onclick="window.location.href='./doctor-schedule-management.html?appointment=${app.appointment_id}'">
                                        <i class="bi bi-eye me-1"></i>View
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `);
            });
            
        } catch (error) {
            console.warn('Failed loading today\'s appointments', error);
            pmTodayList.innerHTML = `
                <div class="col-12 text-center py-3">
                    <p class="text-muted mb-0">Failed to load today's appointments</p>
                </div>
            `;
        }
    }
});

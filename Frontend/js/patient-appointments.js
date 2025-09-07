// public/js/patient-appointments.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Authentication and Elements ---
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'user') {
        window.location.href = '/login.html';
        return;
    }

    const patientFullNameEl = document.getElementById('patient-full-name');
    const patientInitialsEl = document.getElementById('patient-initials');
    const upcomingContent = document.getElementById('upcoming-appointments-tab-content');
    const pastContent = document.getElementById('past-appointments-tab-content');
    const cancelledContent = document.getElementById('cancelled-appointments-tab-content');
    const searchEl = document.getElementById('appt-search');
    
    // Pagination elements
    const upcomingPageSize = document.getElementById('upcoming-page-size');
    const pastPageSize = document.getElementById('past-page-size');
    const cancelledPageSize = document.getElementById('cancelled-page-size');
    const upcomingPagination = document.getElementById('upcoming-pagination');
    const pastPagination = document.getElementById('past-pagination');
    const cancelledPagination = document.getElementById('cancelled-pagination');

    let lastData = { upcoming: [], past: [], cancelled: [] };
    let currentPage = { upcoming: 1, past: 1, cancelled: 1 };
    let pageSize = { upcoming: 10, past: 10, cancelled: 10 };
    
    function filterApps(list) {
        const q = (searchEl?.value || '').toLowerCase();
        if (!q) return list;
        return list.filter(a => (a.doctorName||'').toLowerCase().includes(q) || (a.reason||'').toLowerCase().includes(q));
    }

    // Update patient info in header from JWT payload
    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    patientFullNameEl.textContent = `${decodedToken.first_name || ''} ${decodedToken.last_name || ''}`;
    patientInitialsEl.textContent = `${(decodedToken.first_name || '').charAt(0)}${(decodedToken.last_name || '').charAt(0)}`.toUpperCase();

    // --- Medical Records Functions ---
    async function viewMedicalRecords(appointmentId) {
        const modal = new bootstrap.Modal(document.getElementById('medicalRecordsModal'));
        const modalContent = document.getElementById('medicalRecordsContent');
        
        // Show loading spinner
        modalContent.innerHTML = `
            <div class="d-flex justify-content-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
        
        modal.show();
        
        try {
            console.log('Fetching medical records for appointment:', appointmentId);
            const response = await fetch(`/api/appointments/${appointmentId}/medical-records`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Response status:', response.status);

            if (response.status === 404) {
                // Medical records not found - show basic appointment info instead
                await showBasicAppointmentInfo(appointmentId, modalContent);
                return;
            }

            if (!response.ok) {
                const errorData = await response.text();
                console.error('Error response:', errorData);
                throw new Error(`HTTP error! status: ${response.status} - ${errorData}`);
            }

            const data = await response.json();
            const record = data.data;
            
            // Display medical records content
            modalContent.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <div class="card mb-3">
                            <div class="card-header bg-primary text-white">
                                <h6 class="mb-0"><i class="bi bi-calendar-check me-2"></i>Appointment Information</h6>
                            </div>
                            <div class="card-body">
                                <p><strong>Date:</strong> ${new Date(record.appointment_date).toLocaleDateString()}</p>
                                <p><strong>Doctor:</strong> ${record.doctor_name}</p>
                                <p><strong>Specialization:</strong> ${record.specialization}</p>
                                <p><strong>Reason:</strong> ${record.appointment_reason}</p>
                            </div>
                        </div>
                        
                        <div class="card mb-3">
                            <div class="card-header bg-info text-white">
                                <h6 class="mb-0"><i class="bi bi-person me-2"></i>Patient Information</h6>
                            </div>
                            <div class="card-body">
                                <p><strong>Name:</strong> ${record.patient_name}</p>
                                <p><strong>Date of Birth:</strong> ${new Date(record.date_of_birth).toLocaleDateString()}</p>
                                <p><strong>Gender:</strong> ${record.gender}</p>
                                <p><strong>Blood Type:</strong> ${record.blood_type || 'Not specified'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="card mb-3">
                            <div class="card-header bg-success text-white">
                                <h6 class="mb-0"><i class="bi bi-clipboard-pulse me-2"></i>Medical Details</h6>
                            </div>
                            <div class="card-body">
                                <p><strong>Symptoms:</strong> ${record.symptoms || 'Not recorded'}</p>
                                <p><strong>Diagnosis:</strong> ${record.diagnosis || 'Not recorded'}</p>
                                <p><strong>Treatment:</strong> ${record.treatment || 'Not recorded'}</p>
                                <p><strong>Prescribed Medicines:</strong> ${record.prescribed_medicines || 'None'}</p>
                                <p><strong>Follow-up Instructions:</strong> ${record.follow_up_instructions || 'None'}</p>
                                <p><strong>Doctor Notes:</strong> ${record.doctor_notes || 'None'}</p>
                            </div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header bg-warning text-dark">
                                <h6 class="mb-0"><i class="bi bi-heart-pulse me-2"></i>Medical History</h6>
                            </div>
                            <div class="card-body">
                                <p><strong>Allergies:</strong> ${record.allergies || 'None known'}</p>
                                <p><strong>Current Medications:</strong> ${record.current_medications || 'None'}</p>
                                <p><strong>Medical Conditions:</strong> ${record.medical_conditions || 'None'}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-3 d-flex justify-content-between">
                    <button type="button" class="btn btn-outline-primary" onclick="printMedicalRecord()">
                        <i class="bi bi-printer me-2"></i>Print Record
                    </button>
                    <button type="button" class="btn btn-primary" onclick="showRatingModal('${appointmentId}')">
                        <i class="bi bi-star me-2"></i>Rate Appointment
                    </button>
                </div>
            `;
            
        } catch (error) {
            console.error('Error fetching medical records:', error);
            let errorMessage = 'Failed to load medical records. Please try again later.';
            
            if (error.message.includes('404')) {
                errorMessage = 'Medical records not found for this appointment. The doctor may not have completed the medical documentation yet.';
            } else if (error.message.includes('403')) {
                errorMessage = 'Access denied. You can only view your own medical records.';
            } else if (error.message.includes('500')) {
                errorMessage = 'Server error occurred while loading medical records. Please try again later.';
            }
            
            modalContent.innerHTML = `
                <div class="alert alert-warning" role="alert">
                    <i class="bi bi-info-circle me-2"></i>
                    ${errorMessage}
                </div>
                <div class="text-center mt-3">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            `;
        }
    }

    // Print function for medical records
    window.printMedicalRecord = function() {
        const printContent = document.getElementById('medicalRecordsContent').innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Medical Record</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @media print {
                            .btn { display: none !important; }
                            .card { break-inside: avoid; }
                        }
                    </style>
                </head>
                <body class="p-4">
                    <h2 class="mb-4">Medical Record</h2>
                    ${printContent}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // Rating modal function
    window.showRatingModal = function(appointmentId) {
        // Close medical records modal first
        const medicalModal = bootstrap.Modal.getInstance(document.getElementById('medicalRecordsModal'));
        if (medicalModal) medicalModal.hide();
        
        // Find appointment data
        const appointmentInfo = findAppointmentById(appointmentId);
        
        if (appointmentInfo) {
            // Use existing openRatingModal function
            openRatingModal(appointmentInfo);
        } else {
            // Fallback: set appointment ID directly
            const ratingModal = document.getElementById('ratingModal');
            if (ratingModal) {
                document.getElementById('rating-appointment-id').value = appointmentId;
                const modal = new bootstrap.Modal(ratingModal);
                modal.show();
            }
        }
    };

    // Function to show basic appointment info when medical records aren't available
    async function showBasicAppointmentInfo(appointmentId, modalContent) {
        try {
            // Try to get basic appointment information from the appointments list
            const appointmentInfo = findAppointmentById(appointmentId);
            
            modalContent.innerHTML = `
                <div class="alert alert-info" role="alert">
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>Medical records not available yet.</strong><br>
                    The doctor has not completed the medical documentation for this appointment.
                </div>
                
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0"><i class="bi bi-calendar-check me-2"></i>Appointment Information</h6>
                    </div>
                    <div class="card-body">
                        ${appointmentInfo ? `
                            <p><strong>Doctor:</strong> ${appointmentInfo.doctorName}</p>
                            <p><strong>Specialization:</strong> ${appointmentInfo.specialization || 'Not specified'}</p>
                            <p><strong>Date/Time:</strong> ${appointmentInfo.dateTime}</p>
                            <p><strong>Reason:</strong> ${appointmentInfo.reason || 'Not specified'}</p>
                            <p><strong>Status:</strong> ${appointmentInfo.status}</p>
                        ` : `
                            <p><strong>Appointment ID:</strong> ${appointmentId}</p>
                            <p class="text-muted">Basic appointment details are not available at the moment.</p>
                        `}
                    </div>
                </div>
                
                <div class="mt-3 d-flex justify-content-between">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary" onclick="showRatingModal('${appointmentId}')">
                        <i class="bi bi-star me-2"></i>Rate Appointment
                    </button>
                </div>
            `;
        } catch (error) {
            console.error('Error showing basic appointment info:', error);
            modalContent.innerHTML = `
                <div class="alert alert-warning" role="alert">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Medical records are not available for this appointment yet.
                </div>
                <div class="text-center mt-3">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            `;
        }
    }

    // Helper function to find appointment by ID in the loaded data
    function findAppointmentById(appointmentId) {
        const allAppointments = [...lastData.past, ...lastData.cancelled, ...lastData.upcoming];
        return allAppointments.find(app => app.appointment_id == appointmentId);
    }

    // Make viewMedicalRecords globally available
    window.viewMedicalRecords = viewMedicalRecords;

    // --- Pagination Functions ---
    const createPagination = (type, totalItems) => {
        const paginationEl = document.getElementById(`${type}-pagination`);
        if (!paginationEl) return;
        
        paginationEl.innerHTML = '';
        
        const totalPages = Math.ceil(totalItems / pageSize[type]);
        if (totalPages <= 1) return;
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage[type] === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<button class="page-link" data-page="${currentPage[type] - 1}">&laquo;</button>`;
        paginationEl.appendChild(prevLi);
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${currentPage[type] === i ? 'active' : ''}`;
            li.innerHTML = `<button class="page-link" data-page="${i}">${i}</button>`;
            paginationEl.appendChild(li);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage[type] === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<button class="page-link" data-page="${currentPage[type] + 1}">&raquo;</button>`;
        paginationEl.appendChild(nextLi);
        
        // Add event listeners
        paginationEl.querySelectorAll('.page-link').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.parentElement.classList.contains('disabled')) return;
                
                const newPage = parseInt(btn.dataset.page);
                if (newPage !== currentPage[type]) {
                    currentPage[type] = newPage;
                    renderAppointments(document.getElementById(`${type}-appointments-tab-content`), lastData[type]);
                }
            });
        });
    };
    
    // --- Star Rating Component ---
    const createStarRating = (rating = 0, appointmentId) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            const starClass = i <= rating ? 'bi-star-fill text-warning' : 'bi-star text-muted';
            stars.push(`<i class="bi ${starClass} rate-star" data-rating="${i}" data-appointment-id="${appointmentId}"></i>`);
        }
        return stars.join('');
    };
    
    // --- Function to Render Appointments ---
    const renderAppointments = (container, appointments) => {
        const type = container.id.split('-')[0]; // upcoming, past, or cancelled
        const isUpcoming = type === 'upcoming';
        const isPast = type === 'past';
        const isCancelled = type === 'cancelled';

        const table = container.querySelector('table');
        const tbody = table?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (appointments.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = isPast ? 7 : 6; 
            td.className = 'text-center text-muted';
            td.textContent = 'No records to display.';
            tr.appendChild(td);
            tbody.appendChild(tr);
            
            // Create empty pagination
            createPagination(type, 0);
            return;
        }
        
        // Apply pagination
        const start = (currentPage[type] - 1) * pageSize[type];
        const paginatedApps = appointments.slice(start, start + pageSize[type]);
        
        paginatedApps.forEach(app => {
            let actions = '';
            if (isUpcoming) {
                actions = `
                <button class="btn btn-warning btn-sm rounded-pill text-dark reschedule-btn" data-appointment-id="${app.appointment_id}">Reschedule</button>
                <button class="btn btn-danger btn-sm rounded-pill cancel-btn" data-appointment-id="${app.appointment_id}">Cancel</button>`;
            } else {
                actions = `<button class="btn btn-outline-secondary btn-sm rounded-pill" onclick="viewMedicalRecords('${app.appointment_id}')">View Medical Records</button>`;
            }
            
            const tr = document.createElement('tr');
            let rowHtml = `
                <td>${app.doctorName}</td>
                <td>${app.specialization || ''}</td>
                <td>${app.dateTime || ''}</td>
                <td>${app.reason || ''}</td>
                <td>${app.status}</td>
            `;
            
            // Add rating column for past appointments
            if (isPast) {
                const ratingDisplay = app.rating_status === 'submitted' 
                    ? `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Rated</span>`
                    : `<button class="btn btn-outline-primary btn-sm rate-appointment-btn" data-appointment-id="${app.appointment_id}">Rate</button>`;
                rowHtml += `<td class="rating-cell">${ratingDisplay}</td>`;
            }
            
            rowHtml += `<td class="text-end">${actions}</td>`;
            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });
        
        // Create pagination
        createPagination(type, appointments.length);
    };

    // --- Main Fetch Function ---
    const fetchAppointments = async () => {
        // Show loading indicators
        const loadingHTML = '<div class="d-flex justify-content-center mt-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        upcomingContent.querySelector('.table-responsive').innerHTML = loadingHTML;
        pastContent.querySelector('.table-responsive').innerHTML = loadingHTML;
        cancelledContent.querySelector('.table-responsive').innerHTML = loadingHTML;
        
        try {
            const response = await fetch('/api/patient/appointments', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch appointments.');
            const data = await response.json();

            // Reset pagination to first page when data changes
            currentPage = { upcoming: 1, past: 1, cancelled: 1 };
            
            // Store data for filtering and pagination
            lastData = data;
            
            // Restore table structure
            upcomingContent.querySelector('.table-responsive').innerHTML = `
                <table class="table table-striped table-hover align-middle" id="upcoming-table">
                    <thead class="table-light">
                        <tr>
                            <th scope="col">Doctor</th>
                            <th scope="col">Specialization</th>
                            <th scope="col">Date/Time</th>
                            <th scope="col">Reason</th>
                            <th scope="col">Status</th>
                            <th scope="col" class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <div>
                        <select class="form-select" id="upcoming-page-size">
                            <option value="5">5 per page</option>
                            <option value="10" selected>10 per page</option>
                            <option value="25">25 per page</option>
                        </select>
                    </div>
                    <nav aria-label="Page navigation">
                        <ul class="pagination" id="upcoming-pagination"></ul>
                    </nav>
                </div>
            `;
            
            pastContent.querySelector('.table-responsive').innerHTML = `
                <table class="table table-striped table-hover align-middle" id="past-table">
                    <thead class="table-light">
                        <tr>
                            <th scope="col">Doctor</th>
                            <th scope="col">Specialization</th>
                            <th scope="col">Date/Time</th>
                            <th scope="col">Reason</th>
                            <th scope="col">Status</th>
                            <th scope="col">Rating</th>
                            <th scope="col" class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <div>
                        <select class="form-select" id="past-page-size">
                            <option value="5">5 per page</option>
                            <option value="10" selected>10 per page</option>
                            <option value="25">25 per page</option>
                        </select>
                    </div>
                    <nav aria-label="Page navigation">
                        <ul class="pagination" id="past-pagination"></ul>
                    </nav>
                </div>
            `;
            
            cancelledContent.querySelector('.table-responsive').innerHTML = `
                <table class="table table-striped table-hover align-middle" id="cancelled-table">
                    <thead class="table-light">
                        <tr>
                            <th scope="col">Doctor</th>
                            <th scope="col">Specialization</th>
                            <th scope="col">Date/Time</th>
                            <th scope="col">Reason</th>
                            <th scope="col">Status</th>
                            <th scope="col" class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <div>
                        <select class="form-select" id="cancelled-page-size">
                            <option value="5">5 per page</option>
                            <option value="10" selected>10 per page</option>
                            <option value="25">25 per page</option>
                        </select>
                    </div>
                    <nav aria-label="Page navigation">
                        <ul class="pagination" id="cancelled-pagination"></ul>
                    </nav>
                </div>
            `;
            
            // Re-attach event listeners for page size selectors
            document.getElementById('upcoming-page-size').addEventListener('change', (e) => {
                pageSize.upcoming = parseInt(e.target.value);
                currentPage.upcoming = 1;
                renderAppointments(upcomingContent, filterApps(lastData.upcoming));
            });
            
            document.getElementById('past-page-size').addEventListener('change', (e) => {
                pageSize.past = parseInt(e.target.value);
                currentPage.past = 1;
                renderAppointments(pastContent, filterApps(lastData.past));
            });
            
            document.getElementById('cancelled-page-size').addEventListener('change', (e) => {
                pageSize.cancelled = parseInt(e.target.value);
                currentPage.cancelled = 1;
                renderAppointments(cancelledContent, filterApps(lastData.cancelled));
            });
            
            // Render the appointments
            renderAppointments(upcomingContent, filterApps(data.upcoming));
            renderAppointments(pastContent, filterApps(data.past));
            renderAppointments(cancelledContent, filterApps(data.cancelled));

        } catch (error) {
            console.error('Error fetching appointments:', error);
            const errorHTML = '<p class="text-center w-100 mt-5" style="color:red;">Failed to load appointments.</p>';
            upcomingContent.querySelector('.table-responsive').innerHTML = errorHTML;
            pastContent.querySelector('.table-responsive').innerHTML = errorHTML;
            cancelledContent.querySelector('.table-responsive').innerHTML = errorHTML;
        }
    };

    // Bootstrap 5 handles tab switching automatically with data-bs-toggle="tab"

    // --- Rating Modal Functions ---
    const ratingModal = new bootstrap.Modal(document.getElementById('ratingModal'));
    const medicalRecordsModal = new bootstrap.Modal(document.getElementById('medicalRecordsModal'));
    let currentAppointmentForRating = null;

    // Initialize star rating interactions
    const initializeStarRatings = () => {
        document.querySelectorAll('.rating-stars').forEach(starContainer => {
            const stars = starContainer.querySelectorAll('i');
            const ratingType = starContainer.dataset.rating;
            const hiddenInput = document.getElementById(ratingType);

            stars.forEach((star, index) => {
                star.addEventListener('mouseenter', () => {
                    stars.forEach((s, i) => {
                        s.classList.toggle('filled', i <= index);
                    });
                });

                star.addEventListener('mouseleave', () => {
                    const currentRating = parseInt(hiddenInput.value) || 0;
                    stars.forEach((s, i) => {
                        s.classList.toggle('filled', i < currentRating);
                    });
                });

                star.addEventListener('click', () => {
                    const rating = index + 1;
                    hiddenInput.value = rating;
                    stars.forEach((s, i) => {
                        s.classList.toggle('filled', i < rating);
                    });
                });
            });
        });
    };

    // Open rating modal
    const openRatingModal = (appointment) => {
        currentAppointmentForRating = appointment;
        
        // Populate appointment details
        document.getElementById('rating-doctor-name').textContent = appointment.doctorName;
        document.getElementById('rating-appointment-date').textContent = appointment.dateTime;
        document.getElementById('rating-appointment-reason').textContent = appointment.reason || 'N/A';
        document.getElementById('rating-appointment-id').value = appointment.appointment_id;

        // Reset form
        document.getElementById('ratingForm').reset();
        document.querySelectorAll('.rating-stars i').forEach(star => {
            star.classList.remove('filled');
        });

        ratingModal.show();
    };

    // Open medical records modal
    const openMedicalRecordsModal = async (appointmentId) => {
        const contentDiv = document.getElementById('medicalRecordsContent');
        
        // Show loading spinner
        contentDiv.innerHTML = `
            <div class="d-flex justify-content-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
        
        medicalRecordsModal.show();
        
        try {
            const response = await fetch(`/api/appointments/${appointmentId}/medical-records`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                const data = result.data;
                
                contentDiv.innerHTML = `
                    <div class="row">
                        <div class="col-md-6">
                            <div class="card mb-3">
                                <div class="card-header bg-primary text-white">
                                    <h6 class="mb-0"><i class="bi bi-person-fill me-2"></i>Patient Information</h6>
                                </div>
                                <div class="card-body">
                                    <p><strong>Name:</strong> ${data.patient_name}</p>
                                    <p><strong>Date of Birth:</strong> ${new Date(data.date_of_birth).toLocaleDateString()}</p>
                                    <p><strong>Gender:</strong> ${data.gender}</p>
                                    <p><strong>Blood Type:</strong> ${data.blood_type || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card mb-3">
                                <div class="card-header bg-info text-white">
                                    <h6 class="mb-0"><i class="bi bi-calendar-event me-2"></i>Appointment Details</h6>
                                </div>
                                <div class="card-body">
                                    <p><strong>Date:</strong> ${new Date(data.appointment_date).toLocaleString()}</p>
                                    <p><strong>Reason:</strong> ${data.appointment_reason || 'N/A'}</p>
                                    <p><strong>Session Duration:</strong> ${data.session_duration || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-12">
                            <div class="card mb-3">
                                <div class="card-header bg-success text-white">
                                    <h6 class="mb-0"><i class="bi bi-heart-pulse me-2"></i>Medical History</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-md-4">
                                            <p><strong>Allergies:</strong><br>${data.allergies || 'None reported'}</p>
                                        </div>
                                        <div class="col-md-4">
                                            <p><strong>Current Medications:</strong><br>${data.current_medications || 'None reported'}</p>
                                        </div>
                                        <div class="col-md-4">
                                            <p><strong>Medical Conditions:</strong><br>${data.medical_conditions || 'None reported'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <div class="card mb-3">
                                <div class="card-header bg-warning text-dark">
                                    <h6 class="mb-0"><i class="bi bi-clipboard-pulse me-2"></i>Symptoms & Diagnosis</h6>
                                </div>
                                <div class="card-body">
                                    <p><strong>Symptoms:</strong><br>${data.symptoms || 'Not recorded'}</p>
                                    <p><strong>Diagnosis:</strong><br>${data.diagnosis || 'Not recorded'}</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card mb-3">
                                <div class="card-header bg-secondary text-white">
                                    <h6 class="mb-0"><i class="bi bi-prescription2 me-2"></i>Treatment & Medications</h6>
                                </div>
                                <div class="card-body">
                                    <p><strong>Treatment:</strong><br>${data.treatment || 'Not recorded'}</p>
                                    <p><strong>Prescribed Medicines:</strong><br>${data.prescribed_medicines || 'None prescribed'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-12">
                            <div class="card mb-3">
                                <div class="card-header bg-dark text-white">
                                    <h6 class="mb-0"><i class="bi bi-journal-medical me-2"></i>Doctor's Notes & Follow-up</h6>
                                </div>
                                <div class="card-body">
                                    <p><strong>Doctor's Notes:</strong><br>${data.doctor_notes || 'No notes recorded'}</p>
                                    <p><strong>Follow-up Instructions:</strong><br>${data.follow_up || 'No follow-up instructions'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                const errorData = await response.json();
                contentDiv.innerHTML = `
                    <div class="alert alert-warning" role="alert">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        ${errorData.message || 'Medical records not found for this appointment.'}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching medical records:', error);
            contentDiv.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-x-circle me-2"></i>
                    Error loading medical records. Please try again.
                </div>
            `;
        }
    };

    // Submit rating
    const submitRating = async () => {
        const formData = new FormData(document.getElementById('ratingForm'));
        const ratingData = {
            patient_rating: parseFloat(formData.get('patient_rating')) || null,
            doctor_rating: parseFloat(formData.get('doctor_rating')) || null,
            service_rating: parseFloat(formData.get('service_rating')) || null,
            patient_feedback: formData.get('patient_feedback') || null,
            would_recommend: formData.get('would_recommend') ? 1 : 0
        };

        // Validate at least one rating is provided
        if (!ratingData.patient_rating && !ratingData.doctor_rating && !ratingData.service_rating) {
            alert('Please provide at least one rating before submitting.');
            return;
        }

        try {
            // Get appointment ID from form or current appointment
            const appointmentId = document.getElementById('rating-appointment-id').value || 
                                (currentAppointmentForRating ? currentAppointmentForRating.appointment_id : null);
            
            if (!appointmentId) {
                alert('Appointment ID not found. Please try again.');
                return;
            }
            
            console.log('Submitting rating for appointment:', appointmentId);
            console.log('Rating data:', ratingData);
            
            const response = await fetch(`/api/appointments/${appointmentId}/rate`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(ratingData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                ratingModal.hide();
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.className = 'alert alert-success alert-dismissible fade show position-fixed';
                successMsg.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
                successMsg.innerHTML = `
                    <i class="bi bi-check-circle-fill me-2"></i>Rating submitted successfully!
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
                document.body.appendChild(successMsg);

                setTimeout(() => {
                    if (successMsg.parentNode) {
                        successMsg.remove();
                    }
                }, 3000);

                // Refresh appointments to show updated rating status
                fetchAppointments();
            } else {
                alert(`Error: ${result.message || 'Failed to submit rating'}`);
            }
        } catch (error) {
            console.error('Error submitting rating:', error);
            alert('An error occurred while submitting your rating. Please try again.');
        }
    };

    // --- Event Listeners for Action Buttons and Ratings ---
    const appointmentsContainer = document.querySelector('.appointments-management-section');
    appointmentsContainer.addEventListener('click', async (event) => {
        const rescheduleBtn = event.target.closest('.reschedule-btn');
        const cancelBtn = event.target.closest('.cancel-btn');
        const rateBtn = event.target.closest('.rate-appointment-btn');
        const viewBtn = event.target.closest('.view-details-btn');

        if (rescheduleBtn) {
            const appointmentId = rescheduleBtn.dataset.appointmentId;
            window.location.href = `./patient-booking.html?appointmentId=${appointmentId}`;
        } else if (cancelBtn) {
            const appointmentId = cancelBtn.dataset.appointmentId;
            if (confirm(`Are you sure you want to cancel appointment ID: ${appointmentId}?`)) {
                try {
                    const response = await fetch(`/api/patient/appointments/cancel/${appointmentId}`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        alert('Appointment cancelled successfully!');
                        fetchAppointments(); // Reload all appointments
                    } else {
                        const errorData = await response.json();
                        alert(`Failed to cancel: ${errorData.message}`);
                    }
                } catch (error) {
                    console.error('Error cancelling appointment:', error);
                    alert('An error occurred. Please try again.');
                }
            }
        } else if (rateBtn) {
            const appointmentId = rateBtn.dataset.appointmentId;
            const appointment = lastData.past.find(app => app.appointment_id == appointmentId);
            if (appointment) {
                openRatingModal(appointment);
            }
        } else if (viewBtn) {
            const appointmentId = viewBtn.dataset.appointmentId;
            openMedicalRecordsModal(appointmentId);
        }
    });

    // Initialize rating modal functionality
    document.getElementById('ratingModal').addEventListener('shown.bs.modal', initializeStarRatings);
    fetchAppointments();
    initializeStarRatings();
    
    // Add submit rating event listener
    document.getElementById('submitRating')?.addEventListener('click', submitRating);
    
    // Search functionality
    searchEl?.addEventListener('input', () => {
        renderAppointments(upcomingContent, filterApps(lastData.upcoming));
        renderAppointments(pastContent, filterApps(lastData.past));
        renderAppointments(cancelledContent, filterApps(lastData.cancelled));
    });

    // Page size change handlers
    upcomingPageSize?.addEventListener('change', (e) => {
        pageSize.upcoming = parseInt(e.target.value);
        currentPage.upcoming = 1;
        renderAppointments(upcomingContent, filterApps(lastData.upcoming));
    });

    pastPageSize?.addEventListener('change', (e) => {
        pageSize.past = parseInt(e.target.value);
        currentPage.past = 1;
        renderAppointments(pastContent, filterApps(lastData.past));
    });

    cancelledPageSize?.addEventListener('change', (e) => {
        pageSize.cancelled = parseInt(e.target.value);
        currentPage.cancelled = 1;
        renderAppointments(cancelledContent, filterApps(lastData.cancelled));
    });
    
    // Initial fetch
    fetchAppointments();
});

// Global logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login.html';
}

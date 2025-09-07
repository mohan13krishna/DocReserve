// Patient Medical Records JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    // Authentication check
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'user') {
        window.location.href = '/login.html';
        return;
    }

    // DOM elements
    const patientFullNameEl = document.getElementById('patient-full-name');
    const patientInitialsEl = document.getElementById('patient-initials');
    const searchInput = document.getElementById('searchInput');
    const filterSelect = document.getElementById('filterSelect');
    const loadingSpinner = document.getElementById('loading-spinner');
    const noRecordsDiv = document.getElementById('no-records');
    const medicalRecordsList = document.getElementById('medical-records-list');
    
    // Summary elements
    const totalRecordsEl = document.getElementById('total-records');
    const recentVisitsEl = document.getElementById('recent-visits');
    const doctorsVisitedEl = document.getElementById('doctors-visited');
    const avgRatingEl = document.getElementById('avg-rating');

    let allMedicalRecords = [];
    let filteredRecords = [];

    // Initialize page
    await initializePage();

    // Event listeners
    searchInput.addEventListener('input', filterRecords);
    filterSelect.addEventListener('change', filterRecords);

    async function initializePage() {
        try {
            // Set patient info
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            if (decodedToken.first_name && decodedToken.last_name) {
                patientFullNameEl.textContent = `${decodedToken.first_name} ${decodedToken.last_name}`;
                patientInitialsEl.textContent = `${decodedToken.first_name.charAt(0)}${decodedToken.last_name.charAt(0)}`.toUpperCase();
            }

            // Get patient ID from token - we'll use user_id and let backend handle the mapping
            const userId = decodedToken.user_id;
            
            // Fetch medical records
            await fetchMedicalRecords(userId);
            
        } catch (error) {
            console.error('Error initializing page:', error);
            showError('Failed to load medical records. Please try again later.');
        }
    }

    async function fetchMedicalRecords(patientId) {
        try {
            loadingSpinner.classList.remove('d-none');
            noRecordsDiv.classList.add('d-none');
            medicalRecordsList.classList.add('d-none');

            const response = await fetch(`/api/patients/${patientId}/appointments-for-rating`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            allMedicalRecords = data.data || [];
            filteredRecords = [...allMedicalRecords];

            updateSummaryCards();
            displayMedicalRecords();

        } catch (error) {
            console.error('Error fetching medical records:', error);
            showError('Failed to load medical records.');
        } finally {
            loadingSpinner.classList.add('d-none');
        }
    }

    function updateSummaryCards() {
        const totalRecords = allMedicalRecords.length;
        const recentVisits = allMedicalRecords.filter(record => {
            const recordDate = new Date(record.appointment_date);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return recordDate >= thirtyDaysAgo;
        }).length;

        const uniqueDoctors = new Set(allMedicalRecords.map(record => record.doctor_name)).size;
        
        const ratedRecords = allMedicalRecords.filter(record => record.patient_rating);
        const avgRating = ratedRecords.length > 0 
            ? (ratedRecords.reduce((sum, record) => sum + record.patient_rating, 0) / ratedRecords.length).toFixed(1)
            : '0.0';

        totalRecordsEl.textContent = totalRecords;
        recentVisitsEl.textContent = recentVisits;
        doctorsVisitedEl.textContent = uniqueDoctors;
        avgRatingEl.textContent = avgRating;
    }

    function displayMedicalRecords() {
        if (filteredRecords.length === 0) {
            noRecordsDiv.classList.remove('d-none');
            medicalRecordsList.classList.add('d-none');
            return;
        }

        noRecordsDiv.classList.add('d-none');
        medicalRecordsList.classList.remove('d-none');

        const recordsHTML = filteredRecords.map(record => {
            const appointmentDate = new Date(record.appointment_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const statusBadge = getStatusBadge(record.rating_status);
            const ratingDisplay = getRatingDisplay(record);

            return `
                <div class="border-bottom p-4 medical-record-item" data-record='${JSON.stringify(record)}'>
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <div class="d-flex align-items-start">
                                <div class="doctor-avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3" style="width: 50px; height: 50px; min-width: 50px;">
                                    ${getDoctorInitials(record.doctor_name)}
                                </div>
                                <div class="flex-grow-1">
                                    <h5 class="fw-bold mb-1">${record.doctor_name}</h5>
                                    <p class="text-muted mb-1">${record.specialization}</p>
                                    <p class="text-primary fw-semibold mb-1">${appointmentDate}</p>
                                    <p class="text-muted mb-2">${record.appointment_reason || 'General Consultation'}</p>
                                    ${statusBadge}
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            ${ratingDisplay}
                            <div class="mt-2">
                                <button class="btn btn-outline-primary btn-sm me-2 view-record-btn" data-appointment-id="${record.appointment_id}">
                                    <i class="bi bi-eye me-1"></i>View Details
                                </button>
                                ${record.rating_status === 'pending' ? 
                                    `<button class="btn btn-warning btn-sm rate-appointment-btn" data-appointment-id="${record.appointment_id}">
                                        <i class="bi bi-star me-1"></i>Rate
                                    </button>` : ''
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        medicalRecordsList.innerHTML = recordsHTML;

        // Add event listeners for buttons
        addRecordEventListeners();
    }

    function getStatusBadge(ratingStatus) {
        if (ratingStatus === 'submitted') {
            return '<span class="badge bg-success">Rated</span>';
        } else {
            return '<span class="badge bg-warning text-dark">Pending Rating</span>';
        }
    }

    function getRatingDisplay(record) {
        if (record.rating_status === 'submitted' && record.patient_rating) {
            return `
                <div class="rating-display">
                    <div class="d-flex align-items-center justify-content-end mb-1">
                        <span class="me-2 small text-muted">Your Rating:</span>
                        <div class="stars">
                            ${generateStars(record.patient_rating)}
                        </div>
                        <span class="ms-2 fw-bold">${record.patient_rating.toFixed(1)}</span>
                    </div>
                </div>
            `;
        }
        return '';
    }

    function generateStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<i class="bi bi-star-fill text-warning"></i>';
            } else {
                stars += '<i class="bi bi-star text-muted"></i>';
            }
        }
        return stars;
    }

    function getDoctorInitials(doctorName) {
        return doctorName.split(' ').map(name => name.charAt(0)).join('').toUpperCase();
    }

    function addRecordEventListeners() {
        // View record buttons
        document.querySelectorAll('.view-record-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const appointmentId = e.target.closest('.view-record-btn').dataset.appointmentId;
                await viewMedicalRecord(appointmentId);
            });
        });

        // Rate appointment buttons
        document.querySelectorAll('.rate-appointment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appointmentId = e.target.closest('.rate-appointment-btn').dataset.appointmentId;
                openRatingModal(appointmentId);
            });
        });
    }

    async function viewMedicalRecord(appointmentId) {
        try {
            const response = await fetch(`/api/appointments/${appointmentId}/medical-records`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const record = data.data;

            displayMedicalRecordModal(record);

        } catch (error) {
            console.error('Error fetching medical record details:', error);
            showError('Failed to load medical record details.');
        }
    }

    function displayMedicalRecordModal(record) {
        const appointmentDate = new Date(record.appointment_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const modalContent = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="fw-bold text-primary mb-3">Appointment Information</h6>
                    <div class="mb-3">
                        <strong>Doctor:</strong> ${record.doctor_name}<br>
                        <strong>Specialization:</strong> ${record.specialization}<br>
                        <strong>Date:</strong> ${appointmentDate}<br>
                        <strong>Reason:</strong> ${record.appointment_reason || 'General Consultation'}
                    </div>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold text-primary mb-3">Patient Information</h6>
                    <div class="mb-3">
                        <strong>Name:</strong> ${record.patient_name}<br>
                        <strong>Age:</strong> ${calculateAge(record.date_of_birth)} years<br>
                        <strong>Gender:</strong> ${record.gender}<br>
                        <strong>Blood Type:</strong> ${record.blood_type || 'Not specified'}
                    </div>
                </div>
            </div>
            
            <hr>
            
            <div class="row">
                <div class="col-12">
                    <h6 class="fw-bold text-primary mb-3">Medical Details</h6>
                    
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <strong>Symptoms:</strong>
                            <p class="mt-1">${record.symptoms || 'Not recorded'}</p>
                        </div>
                        <div class="col-md-6 mb-3">
                            <strong>Diagnosis:</strong>
                            <p class="mt-1">${record.diagnosis || 'Not recorded'}</p>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <strong>Treatment:</strong>
                            <p class="mt-1">${record.treatment || 'Not recorded'}</p>
                        </div>
                        <div class="col-md-6 mb-3">
                            <strong>Prescribed Medicines:</strong>
                            <p class="mt-1">${record.prescribed_medicines || 'None prescribed'}</p>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <strong>Follow-up Instructions:</strong>
                            <p class="mt-1">${record.follow_up || 'No follow-up required'}</p>
                        </div>
                        <div class="col-md-6 mb-3">
                            <strong>Doctor's Notes:</strong>
                            <p class="mt-1">${record.doctor_notes || 'No additional notes'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            ${record.allergies || record.current_medications || record.medical_conditions ? `
                <hr>
                <div class="row">
                    <div class="col-12">
                        <h6 class="fw-bold text-primary mb-3">Medical History</h6>
                        ${record.allergies ? `<p><strong>Allergies:</strong> ${record.allergies}</p>` : ''}
                        ${record.current_medications ? `<p><strong>Current Medications:</strong> ${record.current_medications}</p>` : ''}
                        ${record.medical_conditions ? `<p><strong>Medical Conditions:</strong> ${record.medical_conditions}</p>` : ''}
                    </div>
                </div>
            ` : ''}
        `;

        document.getElementById('medical-record-details').innerHTML = modalContent;
        
        const modal = new bootstrap.Modal(document.getElementById('medicalRecordModal'));
        modal.show();
    }

    function calculateAge(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    function filterRecords() {
        const searchTerm = searchInput.value.toLowerCase();
        const filterValue = filterSelect.value;

        filteredRecords = allMedicalRecords.filter(record => {
            // Search filter
            const matchesSearch = !searchTerm || 
                record.doctor_name.toLowerCase().includes(searchTerm) ||
                record.specialization.toLowerCase().includes(searchTerm) ||
                (record.appointment_reason && record.appointment_reason.toLowerCase().includes(searchTerm));

            // Date filter
            let matchesDate = true;
            if (filterValue !== 'all') {
                const recordDate = new Date(record.appointment_date);
                const now = new Date();
                
                switch (filterValue) {
                    case 'last-month':
                        const lastMonth = new Date();
                        lastMonth.setMonth(lastMonth.getMonth() - 1);
                        matchesDate = recordDate >= lastMonth;
                        break;
                    case 'last-3-months':
                        const last3Months = new Date();
                        last3Months.setMonth(last3Months.getMonth() - 3);
                        matchesDate = recordDate >= last3Months;
                        break;
                    case 'last-year':
                        const lastYear = new Date();
                        lastYear.setFullYear(lastYear.getFullYear() - 1);
                        matchesDate = recordDate >= lastYear;
                        break;
                }
            }

            return matchesSearch && matchesDate;
        });

        displayMedicalRecords();
    }

    function openRatingModal(appointmentId) {
        document.getElementById('ratingAppointmentId').value = appointmentId;
        
        // Reset form
        document.getElementById('ratingForm').reset();
        document.querySelectorAll('.rating-stars i').forEach(star => {
            star.classList.remove('bi-star-fill');
            star.classList.add('bi-star');
        });

        const modal = new bootstrap.Modal(document.getElementById('ratingModal'));
        modal.show();
    }

    // Rating stars functionality
    document.querySelectorAll('.rating-stars').forEach(ratingGroup => {
        const stars = ratingGroup.querySelectorAll('i');
        
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                const ratingType = ratingGroup.dataset.rating;
                const ratingValue = index + 1;
                
                // Update visual state
                stars.forEach((s, i) => {
                    if (i < ratingValue) {
                        s.classList.remove('bi-star');
                        s.classList.add('bi-star-fill');
                    } else {
                        s.classList.remove('bi-star-fill');
                        s.classList.add('bi-star');
                    }
                });
                
                // Store rating value
                ratingGroup.dataset.value = ratingValue;
            });
        });
    });

    // Submit rating
    document.getElementById('submitRatingBtn').addEventListener('click', async () => {
        const appointmentId = document.getElementById('ratingAppointmentId').value;
        const patientRating = document.querySelector('[data-rating="patient_rating"]').dataset.value;
        const doctorRating = document.querySelector('[data-rating="doctor_rating"]').dataset.value;
        const serviceRating = document.querySelector('[data-rating="service_rating"]').dataset.value;
        const patientFeedback = document.getElementById('patientFeedback').value;
        const wouldRecommend = document.getElementById('wouldRecommend').checked;

        if (!patientRating || !doctorRating || !serviceRating) {
            showError('Please provide all ratings before submitting.');
            return;
        }

        try {
            const response = await fetch(`/api/appointments/${appointmentId}/rate`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patient_rating: parseFloat(patientRating),
                    doctor_rating: parseFloat(doctorRating),
                    service_rating: parseFloat(serviceRating),
                    patient_feedback: patientFeedback || null,
                    would_recommend: wouldRecommend
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const modal = bootstrap.Modal.getInstance(document.getElementById('ratingModal'));
            modal.hide();

            showSuccess('Rating submitted successfully!');
            
            // Refresh the records
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            await fetchMedicalRecords(decodedToken.user_id);

        } catch (error) {
            console.error('Error submitting rating:', error);
            showError('Failed to submit rating. Please try again.');
        }
    });

    // Print functionality
    document.getElementById('printRecordBtn').addEventListener('click', () => {
        window.print();
    });

    function showError(message) {
        // You can implement a toast notification here
        alert(message);
    }

    function showSuccess(message) {
        // You can implement a toast notification here
        alert(message);
    }

    // Logout function
    window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        window.location.href = '/login.html';
    };
});

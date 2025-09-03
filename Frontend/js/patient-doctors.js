// public/js/patient-doctors.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Authentication and Elements ---
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'user') {
        window.location.href = '/login.html';
        return;
    }
    
    // Check if profile image utility function is available
    if (typeof getProfileImageUrl !== 'function') {
        console.error('Profile image utility function not found. Make sure utils.js is loaded.');
    }

    const patientFullNameEl = document.getElementById('patient-full-name');
    const patientInitialsEl = document.getElementById('patient-initials');
    const doctorsListContainer = document.getElementById('doctors-list-container');
    const doctorSearchInput = document.getElementById('doctor-search-input');
    const specializationFilter = document.getElementById('specialization-filter');
    const availabilityFilter = document.getElementById('availability-filter');
    const doctorProfileModalElement = document.getElementById('doctorProfileModal');
    const doctorProfileModal = new bootstrap.Modal(doctorProfileModalElement);

    // Update patient info in header from JWT payload
    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    patientFullNameEl.textContent = `${decodedToken.first_name || ''} ${decodedToken.last_name || ''}`;
    patientInitialsEl.textContent = `${(decodedToken.first_name || '').charAt(0)}${(decodedToken.last_name || '').charAt(0)}`.toUpperCase();

    // --- Function to Fetch and Render Doctors ---
    const fetchAndRenderDoctors = async () => {
        doctorsListContainer.innerHTML = '<p class="text-center w-100 mt-5">Loading doctors...</p>';
        try {
            const searchTerm = doctorSearchInput.value;
            const specialization = specializationFilter.value;
            const availability = availabilityFilter.value;

            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (specialization) params.append('specialty', specialization);
            if (availability) params.append('availability', availability);

            const queryString = params.toString();
            
            const response = await fetch(`/api/patient/doctors?${queryString}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    alert('Session expired or unauthorized. Please log in again.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('userRole');
                    window.location.href = '/login.html';
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const doctors = data.doctors;

            doctorsListContainer.innerHTML = '';
            if (doctors.length > 0) {
                doctors.forEach(doctor => {
                    const card = `
                        <div class="col-md-4 mb-4">
                            <div class="card h-100 shadow-sm border-0 animate-hover">
                                <div class="card-body text-center">
                                    <img src="${getProfileImageUrl(doctor.gender, doctor.doctor_id)}" class="rounded-circle mb-3" alt="Doctor Profile" style="width: 100px; height: 100px; object-fit: cover;">
                                    <h5 class="card-title fw-bold text-dark mb-1">Dr. ${doctor.first_name} ${doctor.last_name}</h5>
                                    <p class="card-text text-primary small mb-2">${doctor.specialization}</p>
                                    <div class="text-muted small mb-3">
                                        <i class="bi bi-star-fill text-warning me-1"></i>${doctor.rating} (${doctor.reviews} reviews)
                                    </div>
                                    <div class="d-flex flex-column gap-2">
                                        <button class="btn btn-outline-secondary btn-sm rounded-pill view-profile-button" data-bs-toggle="modal" data-bs-target="#doctorProfileModal" data-doctor-id="${doctor.doctor_id}">
                                            View Profile
                                        </button>
                                        <a href="./patient-booking.html?doctorId=${doctor.doctor_id}" class="btn btn-primary btn-sm rounded-pill book-button">
                                            Book Appointment
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    doctorsListContainer.insertAdjacentHTML('beforeend', card);
                });
            } else {
                doctorsListContainer.innerHTML = '<p class="text-center w-100 mt-5">No doctors found.</p>';
            }

        } catch (error) {
            console.error('Error fetching doctors:', error);
            doctorsListContainer.innerHTML = '<p class="text-center w-100 mt-5" style="color:red;">Failed to load doctors. Please try again.</p>';
        }
    };

    // --- Event Listeners for Filters and Modal ---
    doctorSearchInput.addEventListener('input', fetchAndRenderDoctors);
    specializationFilter.addEventListener('change', fetchAndRenderDoctors);
    availabilityFilter.addEventListener('change', fetchAndRenderDoctors);

    doctorsListContainer.addEventListener('click', async (event) => {
        const viewProfileBtn = event.target.closest('.view-profile-button');
        if (viewProfileBtn) {
            const doctorId = viewProfileBtn.dataset.doctorId;
            // Fetch single doctor's details from a new API endpoint
            try {
                const response = await fetch(`/api/patient/doctors/${doctorId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch doctor profile.');
                const doctor = await response.json();
                
                document.getElementById('modal-doctor-name').textContent = `Dr. ${doctor.first_name} ${doctor.last_name}`;
                document.getElementById('modal-doctor-specialty').textContent = doctor.specialization;
                document.getElementById('modal-doctor-experience').textContent = doctor.experience_years;
                document.getElementById('modal-doctor-rating').textContent = doctor.rating;
                document.getElementById('modal-doctor-bio').textContent = doctor.bio;

                // Use the utility function for doctor profile image
                document.getElementById('modal-doctor-image').src = getProfileImageUrl(doctor.gender, doctor.doctor_id);
                
                // Update modal's Book Appointment button link
                document.getElementById('modal-book-btn').href = `./patient-booking.html?doctorId=${doctorId}`;
                
                doctorProfileModal.show();
            } catch (error) {
                console.error('Error fetching single doctor details:', error);
                alert('Failed to load doctor profile details.');
            }
        }
    });

    // Initial fetch
    fetchAndRenderDoctors();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login.html';
}

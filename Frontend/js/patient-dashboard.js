// public/js/patient-dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    // Basic authentication check
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'user') {
        window.location.href = '/login.html'; // Redirect to login if not authenticated as a user
        return;
    }

    const patientFullNameEl = document.getElementById('patient-full-name');
    const patientInitialsEl = document.getElementById('patient-initials');
    const upcomingAppointmentsList = document.getElementById('upcoming-appointments-list');
    const totalUpcomingAppointmentsEl = document.getElementById('total-upcoming-appointments');
    const totalVisitsEl = document.getElementById('total-visits');
    const favoriteDoctorsEl = document.getElementById('favorite-doctors');
    const healthScoreEl = document.getElementById('health-score');

    // --- Initial Data Fetch ---
    try {
        const response = await fetch('/api/patient/dashboard/overview', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Send token for authentication
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
        console.log("Patient Dashboard Data:", data);

        // --- Update Patient Info ---
        const decodedToken = JSON.parse(atob(token.split('.')[1])); // Simple decode (not for security)
        if (decodedToken.first_name && decodedToken.last_name) {
             patientFullNameEl.textContent = `${decodedToken.first_name} ${decodedToken.last_name}`;
             patientInitialsEl.textContent = `${decodedToken.first_name.charAt(0)}${decodedToken.last_name.charAt(0)}`.toUpperCase();
        } else {
             patientFullNameEl.textContent = `John Doe`; // Default if not in token
             patientInitialsEl.textContent = `JD`;
        }

        // Update summary cards
        totalUpcomingAppointmentsEl.textContent = data.upcomingAppointments.length;
        
        // Fix for total visits counter - ensure we're getting the value from the backend
        if (data.totalVisits !== undefined && data.totalVisits !== null) {
            totalVisitsEl.textContent = data.totalVisits;
        } else {
            // Fallback to fetch total visits separately if not included in dashboard data
            fetchTotalVisits(token);
        }
        
        favoriteDoctorsEl.textContent = data.favoriteDoctors;
        healthScoreEl.textContent = data.healthScore;

        // Populate upcoming appointments
        upcomingAppointmentsList.innerHTML = ''; // Clear existing dummy content
        if (data.upcomingAppointments.length > 0) {
            data.upcomingAppointments.forEach(appointment => {
                const doctorInitials = (appointment.doctorName.match(/\b(\w)/g) || []).join('').toUpperCase();
                const appointmentCard = `
                    <div class="appointment-card d-flex align-items-center p-3 rounded-3 mb-3 bg-light animate-hover">
                        <div class="doctor-initials rounded-circle me-3 d-flex justify-content-center align-items-center text-white bg-info" style="width: 50px; height: 50px;">${doctorInitials}</div>
                        <div class="appointment-details flex-grow-1">
                            <h4 class="fw-bold mb-1 fs-6">${appointment.doctorName}</h4>
                            <p class="text-muted mb-1 small">${appointment.specialization}</p>
                            <p class="appointment-date text-primary fw-bold mb-0 small">${appointment.date}</p>
                        </div>
                        <div class="d-flex flex-column gap-2">
                            <button class="btn btn-outline-primary btn-sm rounded-pill">View Details</button>
                            <button class="btn btn-warning btn-sm rounded-pill text-dark">Reschedule</button>
                        </div>
                    </div>
                `;
                upcomingAppointmentsList.insertAdjacentHTML('beforeend', appointmentCard);
            });
        } else {
            upcomingAppointmentsList.innerHTML = '<p>No upcoming appointments found.</p>';
        }

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        upcomingAppointmentsList.innerHTML = '<p>Failed to load appointments. Please try again later.</p>';
    }
});

// Function to fetch total visits count separately
async function fetchTotalVisits(token) {
    try {
        const response = await fetch('/api/patient/visits/count', {
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
        const totalVisitsEl = document.getElementById('total-visits');
        
        if (data.count !== undefined) {
            totalVisitsEl.textContent = data.count;
        } else {
            totalVisitsEl.textContent = '0'; // Default if no data
        }
    } catch (error) {
        console.error('Error fetching total visits:', error);
        document.getElementById('total-visits').textContent = '0';
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login.html';
}

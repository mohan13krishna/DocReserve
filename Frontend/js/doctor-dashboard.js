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

    // --- Initial Data Fetch ---
    try {
        const response = await fetch('/api/doctor/schedule', {
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
        if (data.doctorInfo) {
             doctorFullNameEl.textContent = `Dr. ${data.doctorInfo.first_name} ${data.doctorInfo.last_name}`;
             doctorInitialsEl.textContent = `${data.doctorInfo.first_name.charAt(0)}${data.doctorInfo.last_name.charAt(0)}`.toUpperCase();
             doctorAvailabilityToggle.checked = data.doctorInfo.is_available;
             availabilityStatusEl.textContent = data.doctorInfo.is_available ? 'Available' : 'Busy';
        } else {
             doctorFullNameEl.textContent = `Dr. [Doctor Name]`;
             doctorInitialsEl.textContent = `DR`;
             doctorAvailabilityToggle.checked = true; // Default
             availabilityStatusEl.textContent = 'Available';
        }

        // --- Populate Today's Appointments ---
        todaysAppointmentsListEl.innerHTML = ''; // Clear static content
        if (data.todayAppointments && data.todayAppointments.length > 0) {
            data.todayAppointments.forEach(app => {
                const patientInitials = (app.patientName.match(/\b(\w)/g) || []).join('').toUpperCase();
                const statusClass = app.status.toLowerCase().replace(' ', '-');

                let actionButtons = '';
                const isUrgent = app.reason && app.reason.toLowerCase().includes('emergency');
                if (isUrgent) {
                    actionButtons = `<button class="button primary small">Call Patient</button>`;
                } else if (app.status === 'Upcoming' || app.status === 'Confirmed' || app.status === 'Pending') {
                    actionButtons = `<button class="button secondary small">Start</button>
                                     <button class="button secondary small">Reschedule</button>`;
                } else if (app.status === 'In Progress') {
                    actionButtons = `<button class="button secondary small">Complete</button>
                                     <button class="button secondary small">Reschedule</button>`;
                } else if (app.status === 'Completed') {
                    actionButtons = `<button class="button secondary small">View Notes</button>`;
                }

                const urgentLabel = isUrgent ? '<span class="status urgent-label">Urgent</span>' : '';

                const appCard = `
                    <div class="today-appointment-card ${isUrgent ? 'urgent' : ''}">
                        <div class="patient-initials">${patientInitials}</div>
                        <div class="appointment-details">
                            <h4>${app.patientName}</h4>
                            <p>${app.time} - ${app.reason}</p>
                            <span class="status ${statusClass}">${app.status}</span>
                            ${urgentLabel}
                        </div>
                        <div class="card-actions">
                            ${actionButtons}
                        </div>
                    </div>
                `;
                todaysAppointmentsListEl.insertAdjacentHTML('beforeend', appCard);
            });
        } else {
            todaysAppointmentsListEl.innerHTML = '<p>No appointments scheduled for today.</p>';
        }

        // --- Update Calendar Date and Appointments List Date ---
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        calendarCurrentDateEl.textContent = today.toLocaleDateString('en-US', options);
        currentAppointmentsDateEl.textContent = today.toLocaleDateString('en-US', options);

        // --- Handle Quick Settings (You'll need a form submission handler for this) ---
        // Populate default values if coming from API
        // document.getElementById('default-slot-duration').value = data.quickSettings.defaultSlotDuration;
        // document.getElementById('break-between-slots').value = data.quickSettings.breakBetweenSlots;
        // document.getElementById('auto-confirm-bookings').checked = data.quickSettings.autoConfirmBookings;

    } catch (error) {
        console.error('Error loading doctor dashboard:', error);
        todaysAppointmentsListEl.innerHTML = '<p>Failed to load dashboard data. Please try again later.</p>';
    }

    // --- Event Listeners ---
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
                alert(`Your status has been updated to: ${isAvailable ? 'Available' : 'Busy'}`);
            } else {
                alert('Failed to update availability. Please try again.');
                event.target.checked = !isAvailable; // Revert toggle state on error
            }
        } catch (error) {
            console.error('Error updating availability:', error);
            alert('An error occurred while updating availability.');
            event.target.checked = !isAvailable; // Revert toggle state on error
        }
    });

    // Add event listener for save settings button if implementing that form
    // document.getElementById('save-settings-btn').addEventListener('click', async () => { ... });
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login.html';
}
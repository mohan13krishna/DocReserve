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
                actions = `<button class="btn btn-outline-secondary btn-sm rounded-pill view-details-btn" data-appointment-id="${app.appointment_id}">View</button>`;
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
                rowHtml += `<td class="rating-cell">${createStarRating(app.rating || 0, app.appointment_id)}</td>`;
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

    // --- Event Listeners for Action Buttons and Ratings ---
    const appointmentsContainer = document.querySelector('.appointments-management-section');
    appointmentsContainer.addEventListener('click', async (event) => {
        const rescheduleBtn = event.target.closest('.reschedule-btn');
        const cancelBtn = event.target.closest('.cancel-btn');
        const ratingStar = event.target.closest('.rate-star');

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
        } else if (ratingStar) {
            const rating = parseInt(ratingStar.dataset.rating);
            const appointmentId = ratingStar.dataset.appointmentId;
            
            try {
                // Find the appointment in our data
                const appointment = lastData.past.find(app => app.appointment_id == appointmentId);
                if (!appointment) return;
                
                // Update the UI immediately for better user experience
                const ratingCell = ratingStar.closest('.rating-cell');
                if (ratingCell) {
                    ratingCell.innerHTML = createStarRating(rating, appointmentId);
                }
                
                // Store the rating in our local data
                appointment.rating = rating;
                
                // Send the rating to the server
                // Note: This is a mock implementation as the API endpoint might not exist yet
                // In a real implementation, you would send this to the server
                console.log(`Rating appointment ${appointmentId} with ${rating} stars`);
                
                // Simulate API call (remove this in production and use a real API call)
                /*
                const response = await fetch(`/api/patient/appointments/${appointmentId}/rate`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ rating })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Error rating appointment:', errorData);
                }
                */
            } catch (error) {
                console.error('Error rating appointment:', error);
            }
        }
    });
    
    // --- Event Listener for Search ---
    if (searchEl) {
        searchEl.addEventListener('input', () => {
            renderAppointments(upcomingContent, filterApps(lastData.upcoming));
            renderAppointments(pastContent, filterApps(lastData.past));
            renderAppointments(cancelledContent, filterApps(lastData.cancelled));
        });
    }

    // --- Event Listeners for Pagination Controls ---
    // Page size selectors
    upcomingPageSize.addEventListener('change', () => {
        currentPage.upcoming = 1; // Reset to first page when changing page size
        renderAppointments(upcomingContent, lastData.upcoming);
    });
    
    pastPageSize.addEventListener('change', () => {
        currentPage.past = 1; // Reset to first page when changing page size
        renderAppointments(pastContent, lastData.past);
    });
    
    cancelledPageSize.addEventListener('change', () => {
        currentPage.cancelled = 1; // Reset to first page when changing page size
        renderAppointments(cancelledContent, lastData.cancelled);
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

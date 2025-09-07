// doctor-schedule-management.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Doctor schedule management script starting...');
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    console.log('Token:', token ? 'exists' : 'missing');
    console.log('User role:', userRole);

    if (!token || userRole !== 'doctor') {
        console.log('Redirecting to login - no token or not doctor role');
        window.location.href = '/login.html';
        return;
    }

    // DOM Elements
    const doctorFullNameEl = document.getElementById('doctor-full-name');
    const doctorInitialsEl = document.getElementById('doctor-initials');
    const doctorAvailabilityToggle = document.getElementById('doctor-availability-toggle');
    const availabilityStatusEl = document.getElementById('availability-status');
    const calendarCurrentDateEl = document.getElementById('current-date');
    const currentAppointmentsDateEl = document.getElementById('current-date-appointments');
    const scheduleGridEl = document.getElementById('schedule-grid');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const prevDateBtn = document.getElementById('prev-date');
    const nextDateBtn = document.getElementById('next-date');
    const todayBtn = document.getElementById('today-btn');
    const viewToggles = document.querySelectorAll('.view-toggles .btn-check');
    const blockTimeForm = document.getElementById('block-time-form');
    const saveBlockTimeBtn = document.getElementById('save-block-time');
    const saveAvailabilityBtn = document.getElementById('save-availability');
    const submitLeaveRequestBtn = document.getElementById('submit-leave-request');


    // State variables
    let currentScheduleDate = new Date();
    let currentView = 'daily';
    let scheduleData = null;
    let leaveData = null;

    // Initialize the page
    initializePage();

    // Event listeners
    if (doctorAvailabilityToggle) doctorAvailabilityToggle.addEventListener('change', updateAvailability);
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveQuickSettings);
    if (prevDateBtn) prevDateBtn.addEventListener('click', () => navigateDate('prev'));
    if (nextDateBtn) nextDateBtn.addEventListener('click', () => navigateDate('next'));
    if (todayBtn) todayBtn.addEventListener('click', () => navigateDate('today'));
    viewToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                currentView = e.target.dataset.view;
                fetchAndRenderSchedule();
            }
        });
    });
    if (saveBlockTimeBtn) saveBlockTimeBtn.addEventListener('click', handleBlockTime);
    if (saveAvailabilityBtn) saveAvailabilityBtn.addEventListener('click', handleSetAvailability);
    if (submitLeaveRequestBtn) submitLeaveRequestBtn.addEventListener('click', handleLeaveRequest);


    // Table search and filter for appointments
    const appointmentsSearch = document.getElementById('appointments-search');
    const confirmedPrev = document.getElementById('confirmed-prev');
    const confirmedNext = document.getElementById('confirmed-next');
    const upcomingPrev = document.getElementById('upcoming-prev');
    const upcomingNext = document.getElementById('upcoming-next');
    const pastPrev = document.getElementById('past-prev');
    const pastNext = document.getElementById('past-next');
    const appointmentsExport = document.getElementById('appointments-export');
    const appointmentsPrint = document.getElementById('appointments-print');

    if (appointmentsSearch) appointmentsSearch.addEventListener('input', renderAppointmentTabs);
    if (confirmedPrev) confirmedPrev.addEventListener('click', () => changeConfirmedPage(-1));
    if (confirmedNext) confirmedNext.addEventListener('click', () => changeConfirmedPage(1));
    if (upcomingPrev) upcomingPrev.addEventListener('click', () => changeUpcomingPage(-1));
    if (upcomingNext) upcomingNext.addEventListener('click', () => changeUpcomingPage(1));
    if (pastPrev) pastPrev.addEventListener('click', () => changePastPage(-1));
    if (pastNext) pastNext.addEventListener('click', () => changePastPage(1));
    if (appointmentsExport) appointmentsExport.addEventListener('click', exportToCsv);
    if (appointmentsPrint) appointmentsPrint.addEventListener('click', printAppointments);

    // Modal event listeners
    const blockRecurringEl = document.getElementById('block-recurring');
    if (blockRecurringEl) {
        blockRecurringEl.addEventListener('change', function() {
            const recurringOptions = document.querySelector('.recurring-options');
            if (recurringOptions) {
                recurringOptions.classList.toggle('d-none', !this.checked);
            }
        });
    }

    // Set minimum date for leave request to today
    const today = new Date().toISOString().split('T')[0];
    const leaveStartDateEl = document.getElementById('leave-start-date');
    const leaveEndDateEl = document.getElementById('leave-end-date');
    
    if (leaveStartDateEl) leaveStartDateEl.min = today;
    if (leaveEndDateEl) leaveEndDateEl.min = today;

    // Update end date minimum when start date changes
    if (leaveStartDateEl) {
        leaveStartDateEl.addEventListener('change', function() {
            const startDate = this.value;
            if (leaveEndDateEl) {
                leaveEndDateEl.min = startDate;
                
                // If end date is before new start date, clear it
                if (leaveEndDateEl.value && leaveEndDateEl.value < startDate) {
                    leaveEndDateEl.value = '';
                }
            }
        });
    }

    // Add time slot buttons for each day in availability modal
    document.querySelectorAll('.add-time-slot').forEach(btn => {
        btn.addEventListener('click', function() {
            const day = this.dataset.day;
            const slotsContainer = document.getElementById(`${day}-slots`);
            const newSlot = `
                <div class="time-slot-row d-flex mb-2 align-items-center">
                    <div class="col-5">
                        <input type="time" class="form-control" value="09:00">
                    </div>
                    <div class="col-5">
                        <input type="time" class="form-control" value="17:00">
                    </div>
                    <div class="col-2 text-end">
                        <button class="btn btn-sm btn-outline-danger remove-slot"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            `;
            slotsContainer.insertAdjacentHTML('beforeend', newSlot);
            
            // Add event listener to the new remove button
            slotsContainer.querySelector('.time-slot-row:last-child .remove-slot').addEventListener('click', function() {
                this.closest('.time-slot-row').remove();
            });
        });
    });

    // Add event listeners to existing remove slot buttons
    document.querySelectorAll('.remove-slot').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.time-slot-row').remove();
        });
    });

    // Quick template selection
    document.getElementById('availability-template').addEventListener('change', function() {
        const template = this.value;
        if (!template) return; // Custom selected
        
        // Clear all existing slots
        document.querySelectorAll('[id$="-slots"]').forEach(container => {
            container.innerHTML = '';
        });
        
        // Set checkboxes based on template
        const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const weekend = ['saturday', 'sunday'];
        
        weekdays.forEach(day => {
            document.getElementById(`${day}-enabled`).checked = 
                (template === 'weekday' || template === 'evening' || template === 'morning');
        });
        
        weekend.forEach(day => {
            document.getElementById(`${day}-enabled`).checked = (template === 'weekend');
        });
        
        // Add appropriate time slots based on template
        const allDays = [...weekdays, ...weekend];
        allDays.forEach(day => {
            if (document.getElementById(`${day}-enabled`).checked) {
                const container = document.getElementById(`${day}-slots`);
                let startTime, endTime;
                
                switch(template) {
                    case 'weekday':
                        startTime = '09:00';
                        endTime = '17:00';
                        break;
                    case 'weekend':
                        startTime = '10:00';
                        endTime = '14:00';
                        break;
                    case 'evening':
                        startTime = '17:00';
                        endTime = '21:00';
                        break;
                    case 'morning':
                        startTime = '07:00';
                        endTime = '12:00';
                        break;
                }
                
                const newSlot = `
                    <div class="time-slot-row d-flex mb-2 align-items-center">
                        <div class="col-5">
                            <input type="time" class="form-control" value="${startTime}">
                        </div>
                        <div class="col-5">
                            <input type="time" class="form-control" value="${endTime}">
                        </div>
                        <div class="col-2 text-end">
                            <button class="btn btn-sm btn-outline-danger remove-slot"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                `;
                container.innerHTML = newSlot;
                
                // Add event listener to the new remove button
                container.querySelector('.remove-slot').addEventListener('click', function() {
                    this.closest('.time-slot-row').remove();
                });
            }
        });
    });

    // Helper function to parse appointment date and time
    function parseAppointmentDate(dateString) {
        if (!dateString) return null;
        
        // Handle different date formats
        let parsedDate;
        if (dateString.includes('T')) {
            // ISO format with time
            parsedDate = new Date(dateString);
        } else {
            // Date only format - assume it's for today with current time or a specific time
            parsedDate = new Date(dateString);
        }
        
        return parsedDate;
    }
    
    // Helper function to check if a time slot is in the past
    function isTimeSlotPast(slotTime, slotDate = null) {
        const now = new Date();
        const targetDate = slotDate ? new Date(slotDate) : currentScheduleDate;
        
        // Parse the time (e.g., "09:00 AM" or "14:30")
        const [time, period] = slotTime.split(' ');
        const [hours, minutes] = time.split(':').map(Number);
        
        let adjustedHours = hours;
        if (period) {
            // Handle 12-hour format
            if (period.toUpperCase() === 'PM' && hours !== 12) {
                adjustedHours += 12;
            } else if (period.toUpperCase() === 'AM' && hours === 12) {
                adjustedHours = 0;
            }
        }
        
        // Create the full datetime for the slot
        const slotDateTime = new Date(targetDate);
        slotDateTime.setHours(adjustedHours, minutes, 0, 0);
        
        return now > slotDateTime;
    }
    
    // Background function to update appointment status
    async function updateAppointmentStatusInBackground(appointmentId, newStatus) {
        try {
            const response = await fetch(`/api/appointments/${appointmentId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.ok) {
                console.log(`Appointment ${appointmentId} status updated to ${newStatus}`);
            } else {
                console.warn(`Failed to update appointment ${appointmentId} status:`, response.status);
            }
        } catch (error) {
            console.error('Error updating appointment status in background:', error);
        }
    }
    
    // Periodic refresh to update appointment statuses
    let refreshInterval;
    function startPeriodicRefresh() {
        // Refresh every 2 minutes to check for time-based status updates
        refreshInterval = setInterval(() => {
            console.log('Performing periodic refresh of appointments...');
            renderAppointmentTabs(); // Re-render to apply time-based updates
        }, 120000); // 2 minutes
    }
    
    function stopPeriodicRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }

    // Initialize pagination variables (moved to top to avoid reference errors)
    let confirmedPage = 1;
    let upcomingPage = 1;
    let pastPage = 1;
    let currentUpcomingPage = 1;
    let currentCompletedPage = 1;
    let currentPastPage = 1;

    // Functions
    async function initializePage() {
        updateDateDisplay();
        await fetchAndRenderSchedule();
        await fetchLeaveData();
        startPeriodicRefresh(); // Start automatic refresh
    }

    async function fetchAndRenderSchedule() {
        try {
            console.log('=== DEBUG: Starting fetchAndRenderSchedule ===');
            const dateString = currentScheduleDate.toISOString().split('T')[0];
            console.log('Fetching schedule for date:', dateString);

            const response = await fetch(`/api/doctor/schedule?date=${dateString}&view=${currentView}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('Schedule API error:', response.status, errText);
                showScheduleError(`Failed to load schedule (${response.status}). ${errText || ''}`);
                throw new Error(`HTTP ${response.status}`);
            }

            scheduleData = await response.json();
            console.log('Full scheduleData:', scheduleData);

            if (doctorAvailabilityToggle) doctorAvailabilityToggle.checked = scheduleData.doctorInfo?.is_available;
            if (availabilityStatusEl) availabilityStatusEl.textContent = scheduleData.doctorInfo?.is_available ? 'Available' : 'Busy';

            // Render schedule grid
            renderScheduleGrid(scheduleData.scheduleGrid);

            // Render appointment tabs
            renderAppointmentTabs();

            // Populate quick settings
            populateQuickSettings(scheduleData.quickSettings);

        } catch (error) {
            console.error('Error fetching schedule data:', error);
            if (!scheduleData) {
                scheduleData = { todayAppointments: [], upcomingAppointments: [], scheduleGrid: [] };
            }
            // Keep UI responsive with empty data
            renderAppointmentTabs();
        }
    }

    async function fetchLeaveData() {
        try {
            const response = await fetch('/api/doctor/leaves', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            leaveData = await response.json();
            renderLeaveManagement();
        } catch (error) {
            console.error('Error fetching leave data:', error);
            leaveData = { pending: [], previous: [] };
            renderLeaveManagement();
        }
    }


    function showScheduleError(message) {
        const confirmedTbody = document.getElementById('confirmed-appointments-tbody');
        const upcomingTbody = document.getElementById('upcoming-appointments-tbody');
        const pastTbody = document.getElementById('past-appointments-tbody');
        const errorRow = (msg) => `<tr><td colspan="5" class="text-center text-danger">${msg}</td></tr>`;
        if (confirmedTbody) confirmedTbody.innerHTML = errorRow(message);
        if (upcomingTbody) upcomingTbody.innerHTML = errorRow(message);
        if (pastTbody) pastTbody.innerHTML = errorRow(message);
    }

    function renderScheduleGrid(gridData) {
        if (!scheduleGridEl) return;
        
        scheduleGridEl.innerHTML = '';
        
        if (currentView === 'daily') {
            // Render daily view with modern styling
            gridData.forEach((slot, index) => {
                // Check if this time slot is in the past
                const isPast = isTimeSlotPast(slot.time, slot.date);
                
                // Normalize status to lowercase for CSS classes
                let normalizedStatus = slot.status.toLowerCase();
                
                // Override status to 'past' if the time has passed and it's available or booked
                if (isPast && ['available', 'booked'].includes(normalizedStatus)) {
                    normalizedStatus = 'past';
                }
                
                const slotEl = document.createElement('div');
                slotEl.className = `time-slot ${normalizedStatus}`;
                slotEl.style.animationDelay = `${index * 0.1}s`;
                
                // Determine display status
                let displayStatus = slot.status;
                if (normalizedStatus === 'available') {
                    displayStatus = 'Free';
                } else if (normalizedStatus === 'booked') {
                    displayStatus = 'Booked';
                } else if (normalizedStatus === 'completed') {
                    displayStatus = 'Completed';
                } else if (normalizedStatus === 'blocked') {
                    displayStatus = 'Blocked';
                } else if (normalizedStatus === 'past') {
                    displayStatus = 'Past';
                }
                
                let slotContent = `
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <span class="time-slot-time">${slot.time}</span>
                        <span class="time-slot-status ${normalizedStatus}">${displayStatus}</span>
                    </div>`;
                
                if (normalizedStatus === 'booked') {
                    slotContent += `
                        <div class="time-slot-patient">
                            <div class="patient-name">${slot.patientName}</div>
                            <div class="patient-reason">${slot.reason || 'No reason specified'}</div>
                        </div>
                    `;
                } else if (normalizedStatus === 'available') {
                    slotContent += `
                        <div class="time-slot-patient">
                            <div class="patient-reason">Available for booking</div>
                        </div>
                        <div class="slot-actions">
                            <button class="slot-btn warning block-slot" data-time="${slot.time}">
                                <i class="bi bi-slash-circle me-1"></i>Block
                            </button>
                        </div>
                    `;
                } else if (normalizedStatus === 'blocked') {
                    slotContent += `
                        <div class="time-slot-patient">
                            <div class="patient-reason">${slot.reason || 'Blocked'}</div>
                        </div>
                        <div class="slot-actions">
                            <button class="slot-btn danger unblock-slot" data-id="${slot.id}">
                                <i class="bi bi-unlock me-1"></i>Unblock
                            </button>
                        </div>
                    `;
                } else if (normalizedStatus === 'completed') {
                    slotContent += `
                        <div class="time-slot-patient">
                            <div class="patient-name">${slot.patientName}</div>
                            <div class="patient-reason">${slot.reason || 'Appointment completed'}</div>
                        </div>
                    `;
                } else if (normalizedStatus === 'past') {
                    slotContent += `
                        <div class="time-slot-patient">
                            <div class="patient-reason">${slot.patientName || 'Past time slot'}</div>
                        </div>
                    `;
                }
                
                slotEl.innerHTML = slotContent;
                scheduleGridEl.appendChild(slotEl);
            });
            
            // Add event listeners for add appointment buttons
            document.querySelectorAll('.add-appointment').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const time = e.target.closest('.add-appointment').getAttribute('data-time');
                    openAddAppointmentModal(time, 0);
                });
            });
            
            // Add event listeners for block slot buttons
            document.querySelectorAll('.block-slot').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const time = e.target.closest('.block-slot').getAttribute('data-time');
                    openBlockModal(time);
                });
            });
            
            // Add event listeners for unblock slot buttons
            document.querySelectorAll('.unblock-slot').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const slotId = e.target.closest('.unblock-slot').getAttribute('data-id');
                    unblockTimeSlot(slotId);
                });
            });
            
        } else if (currentView === 'weekly') {
            renderWeeklyView(gridData);
        } else if (currentView === 'monthly') {
            renderMonthlyView(gridData);
        }
    }

    function renderWeeklyView(gridData) {
        scheduleGridEl.innerHTML = '';
        
        // Create time header
        const timeHeader = document.createElement('div');
        timeHeader.className = 'weekly-time-header';
        timeHeader.textContent = 'Time';
        scheduleGridEl.appendChild(timeHeader);
        
        // Create day headers
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'weekly-day-header';
            dayHeader.textContent = day;
            scheduleGridEl.appendChild(dayHeader);
        });
        
        // Create time slots
        const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
        
        timeSlots.forEach(time => {
            // Time label
            const timeLabel = document.createElement('div');
            timeLabel.className = 'weekly-time-header';
            timeLabel.textContent = time;
            scheduleGridEl.appendChild(timeLabel);
            
            // Day slots
            daysOfWeek.forEach((day, dayIndex) => {
                const daySlot = document.createElement('div');
                daySlot.className = 'weekly-time-slot available';
                
                // Find appointments for this day/time
                const dayAppointments = gridData.filter(slot => 
                    slot.time === time && slot.dayOfWeek === dayIndex && slot.status !== 'Available'
                );
                
                if (dayAppointments.length > 0) {
                    // Count appointments by status
                    const statusCounts = {
                        confirmed: dayAppointments.filter(apt => apt.status.toLowerCase() === 'confirmed').length,
                        pending: dayAppointments.filter(apt => apt.status.toLowerCase() === 'pending').length,
                        booked: dayAppointments.filter(apt => apt.status.toLowerCase() === 'booked').length,
                        cancelled: dayAppointments.filter(apt => apt.status.toLowerCase() === 'cancelled').length,
                        completed: dayAppointments.filter(apt => apt.status.toLowerCase() === 'completed').length
                    };
                    
                    // Use the primary appointment status for styling
                    const primaryAppointment = dayAppointments[0];
                    const normalizedStatus = primaryAppointment.status.toLowerCase();
                    daySlot.className = `weekly-time-slot ${normalizedStatus}`;
                    
                    // Create simple count display
                    let statusDisplay = '';
                    if (statusCounts.booked > 0) statusDisplay += `${statusCounts.booked} Booked `;
                    if (statusCounts.cancelled > 0) statusDisplay += `${statusCounts.cancelled} Cancelled `;
                    if (statusCounts.confirmed > 0) statusDisplay += `${statusCounts.confirmed} Confirmed `;
                    if (statusCounts.pending > 0) statusDisplay += `${statusCounts.pending} Pending `;
                    if (statusCounts.completed > 0) statusDisplay += `${statusCounts.completed} Completed `;
                    
                    daySlot.innerHTML = `<small>${statusDisplay.trim()}</small>`;
                } else {
                    daySlot.innerHTML = '<small>Available</small>';
                    // Removed add appointment functionality from weekly view
                }
                
                scheduleGridEl.appendChild(daySlot);
            });
        });
    }

    function renderMonthlyView(gridData) {
        scheduleGridEl.innerHTML = '';
        
        // Create day headers
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'monthly-day-header';
            dayHeader.textContent = day;
            scheduleGridEl.appendChild(dayHeader);
        });
        
        // Get first day of month and total days in month
        const year = currentScheduleDate.getFullYear();
        const month = currentScheduleDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'monthly-day-cell other-month';
            scheduleGridEl.appendChild(emptyCell);
        }
        
        // Create calendar days
        for (let day = 1; day <= daysInMonth; day++) {
            const weekRow = document.createElement('div');
            weekRow.className = 'monthly-row';
            
            for (let j = 0; j < 7; j++) { // 7 days in a week
                const dayCell = document.createElement('div');
                dayCell.className = 'monthly-cell';
                
                if ((i === 0 && j < firstDay) || dayCount > daysInMonth) {
                    // Empty cell before first day or after last day
                    dayCell.classList.add('empty');
                } else {
                    dayCell.textContent = dayCount;
                    
                    // Check if this day has appointments
                    const dayDate = new Date(year, month, dayCount);
                    const dayString = dayDate.toISOString().split('T')[0];
                    
                    // Find appointments for this day
                    const dayAppointments = gridData.filter(slot => 
                        slot.date === dayString
                    );
                    
                    if (dayAppointments.length > 0) {
                        dayCell.classList.add('has-appointments');
                        dayCell.innerHTML = `
                            <div class="day-number">${dayCount}</div>
                            <div class="appointment-count">${dayAppointments.length} apt${dayAppointments.length > 1 ? 's' : ''}</div>
                        `;
                        dayCell.addEventListener('click', () => {
                            // Navigate to daily view for this date
                            currentScheduleDate = dayDate;
                            currentView = 'daily';
                            document.getElementById('view-daily').classList.add('active');
                            document.getElementById('view-weekly').classList.remove('active');
                            document.getElementById('view-monthly').classList.remove('active');
                            scheduleGridEl.className = 'daily-schedule-grid';
                            updateDateDisplay();
                            fetchAndRenderSchedule();
                        });
                    } else {
                        dayCell.innerHTML = `<div class="day-number">${dayCount}</div>`;
                    }
                    
                    dayCount++;
                }
                
                monthGrid.appendChild(dayCell);
            }
        }
        
        scheduleGridEl.appendChild(monthGrid);
    }

    function renderWeeklyView(gridData) {
        scheduleGridEl.innerHTML = '';
        
        // Create time header
        const timeHeader = document.createElement('div');
        timeHeader.className = 'weekly-time-header';
        timeHeader.textContent = 'Time';
        scheduleGridEl.appendChild(timeHeader);
        
        // Create day headers
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'weekly-day-header';
            dayHeader.textContent = day;
            scheduleGridEl.appendChild(dayHeader);
        });
        
        // Create time slots
        const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
        
        timeSlots.forEach(time => {
            // Time label
            const timeLabel = document.createElement('div');
            timeLabel.className = 'weekly-time-header';
            timeLabel.textContent = time;
            scheduleGridEl.appendChild(timeLabel);
            
            // Day slots
            daysOfWeek.forEach((day, dayIndex) => {
                const daySlot = document.createElement('div');
                daySlot.className = 'weekly-time-slot available';
                
                // Find appointments for this day/time
                const dayAppointments = gridData.filter(slot => 
                    slot.time === time && slot.dayOfWeek === dayIndex && slot.status !== 'Available'
                );
                
                if (dayAppointments.length > 0) {
                    // Count appointments by status
                    const statusCounts = {
                        confirmed: dayAppointments.filter(apt => apt.status.toLowerCase() === 'confirmed').length,
                        pending: dayAppointments.filter(apt => apt.status.toLowerCase() === 'pending').length,
                        booked: dayAppointments.filter(apt => apt.status.toLowerCase() === 'booked').length,
                        cancelled: dayAppointments.filter(apt => apt.status.toLowerCase() === 'cancelled').length,
                        completed: dayAppointments.filter(apt => apt.status.toLowerCase() === 'completed').length
                    };
                    
                    // Use the primary appointment status for styling
                    const primaryAppointment = dayAppointments[0];
                    const normalizedStatus = primaryAppointment.status.toLowerCase();
                    daySlot.className = `weekly-time-slot ${normalizedStatus}`;
                    
                    // Create simple count display
                    let statusDisplay = '';
                    if (statusCounts.booked > 0) statusDisplay += `${statusCounts.booked} Booked `;
                    if (statusCounts.cancelled > 0) statusDisplay += `${statusCounts.cancelled} Cancelled `;
                    if (statusCounts.confirmed > 0) statusDisplay += `${statusCounts.confirmed} Confirmed `;
                    if (statusCounts.pending > 0) statusDisplay += `${statusCounts.pending} Pending `;
                    if (statusCounts.completed > 0) statusDisplay += `${statusCounts.completed} Completed `;
                    
                    daySlot.innerHTML = `<small>${statusDisplay.trim()}</small>`;
                } else {
                    daySlot.innerHTML = '<small>Available</small>';
                    daySlot.addEventListener('click', () => openAddAppointmentModal(time, dayIndex));
                }
                
                scheduleGridEl.appendChild(daySlot);
            });
        });
    }
    
    function renderMonthlyView(gridData) {
        scheduleGridEl.innerHTML = '';
        
        // Create day headers
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'monthly-day-header';
            dayHeader.textContent = day;
            scheduleGridEl.appendChild(dayHeader);
        });
        
        // Get first day of month and total days in month
        const year = currentScheduleDate.getFullYear();
        const month = currentScheduleDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'monthly-day-cell empty';
            scheduleGridEl.appendChild(emptyCell);
        }
        
        // Create calendar days
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'monthly-day-cell';
            
            // Check if this day has appointments
            const dayDate = new Date(year, month, day);
            const dayString = dayDate.toISOString().split('T')[0];
            
            // Find appointments for this day and count by status
            const dayAppointments = gridData.filter(slot => 
                slot.date === dayString && slot.status !== 'Available'
            );
            
            // Check if this day is in the past
            const currentTime = new Date();
            const isPastDay = dayDate < currentTime.setHours(0, 0, 0, 0);
            
            // Filter appointments - exclude completed ones from display if day is past
            let filteredAppointments = dayAppointments;
            if (isPastDay) {
                // For past days, don't show completed appointments in the count
                filteredAppointments = dayAppointments.filter(apt => 
                    apt.status.toLowerCase() !== 'completed'
                );
            }
            
            // Count appointments by status (excluding completed for past days)
            const statusCounts = {
                confirmed: filteredAppointments.filter(apt => apt.status.toLowerCase() === 'confirmed').length,
                pending: filteredAppointments.filter(apt => apt.status.toLowerCase() === 'pending').length,
                booked: filteredAppointments.filter(apt => apt.status.toLowerCase() === 'booked').length,
                cancelled: filteredAppointments.filter(apt => apt.status.toLowerCase() === 'cancelled').length,
                blocked: isPastDay ? dayAppointments.filter(apt => apt.status.toLowerCase() === 'completed').length : 0
            };
            
            const totalAppointments = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
            
            if (totalAppointments > 0) {
                // Add appropriate class based on day status
                if (isPastDay && statusCounts.blocked > 0) {
                    dayCell.classList.add('has-blocked');
                } else {
                    dayCell.classList.add('has-appointments');
                }
                
                // Create simple count display for monthly view
                let statusDisplay = '';
                if (statusCounts.booked > 0) statusDisplay += `${statusCounts.booked} Booked<br>`;
                if (statusCounts.cancelled > 0) statusDisplay += `${statusCounts.cancelled} Cancelled<br>`;
                if (statusCounts.confirmed > 0) statusDisplay += `${statusCounts.confirmed} Confirmed<br>`;
                if (statusCounts.pending > 0) statusDisplay += `${statusCounts.pending} Pending<br>`;
                if (statusCounts.blocked > 0) statusDisplay += `${statusCounts.blocked} Blocked<br>`;
                
                dayCell.innerHTML = `
                    <div class="day-number">${day}</div>
                    <div class="appointment-count-text">${statusDisplay}</div>
                `;
                dayCell.addEventListener('click', () => {
                    // Navigate to daily view for this date
                    currentScheduleDate = dayDate;
                    currentView = 'daily';
                    document.getElementById('view-daily').classList.add('active');
                    document.getElementById('view-weekly').classList.remove('active');
                    document.getElementById('view-monthly').classList.remove('active');
                    scheduleGridEl.className = 'daily-schedule-grid';
                    updateDateDisplay();
                    fetchAndRenderSchedule();
                });
            } else {
                dayCell.innerHTML = `<div class="day-number">${day}</div>`;
            }
            
            scheduleGridEl.appendChild(dayCell);
        }
    }
    
    // Function to open add appointment modal
    function openAddAppointmentModal(time, dayIndex) {
        // Create a simple modal for adding appointments
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Add Appointment</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="add-appointment-form">
                            <div class="mb-3">
                                <label class="form-label">Time</label>
                                <input type="text" class="form-control" value="${time}" readonly>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Patient Name</label>
                                <input type="text" class="form-control" id="patient-name" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Reason</label>
                                <textarea class="form-control" id="appointment-reason" rows="3"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="saveNewAppointment('${time}', ${dayIndex})">Save Appointment</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        
        // Remove modal from DOM when closed
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }
    
    // Function to save new appointment
    window.saveNewAppointment = async function(time, dayIndex) {
        const patientNameEl = document.getElementById('patient-name');
        const reasonEl = document.getElementById('appointment-reason');
        
        if (!patientNameEl || !reasonEl) {
            alert('Form elements not found');
            return;
        }
        
        const patientName = patientNameEl.value;
        const reason = reasonEl.value;
        
        if (!patientName || !patientName.trim()) {
            alert('Please enter patient name');
            return;
        }
        
        try {
            // Calculate the date based on current view and dayIndex
            let appointmentDate = new Date(currentScheduleDate);
            if (currentView === 'weekly') {
                // Adjust date based on day of week
                const currentDay = appointmentDate.getDay();
                const targetDay = dayIndex;
                const dayDiff = targetDay - currentDay;
                appointmentDate.setDate(appointmentDate.getDate() + dayDiff);
            }
            
            const appointmentData = {
                date: appointmentDate.toISOString().split('T')[0],
                time: time,
                patientName: patientName,
                reason: reason,
                status: 'booked'
            };
            
            const response = await fetch('/api/doctor/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(appointmentData)
            });
            
            if (response.ok) {
                alert('Appointment created successfully!');
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.querySelector('.modal'));
                modal.hide();
                // Refresh schedule
                fetchAndRenderSchedule();
            } else {
                throw new Error('Failed to create appointment');
            }
        } catch (error) {
            console.error('Error creating appointment:', error);
            alert('Failed to create appointment. Please try again.');
        }
    }

    function renderLeaveManagement() {
        if (!leaveData) return;

        // Render leave requests in table format
        const leaveTableBody = document.getElementById('leave-requests-tbody');
        if (leaveTableBody) {
            leaveTableBody.innerHTML = '';
            
            // Combine all leave requests (pending and previous)
            const allLeaves = [
                ...(leaveData.pending || []).map(leave => ({ ...leave, status: 'pending' })),
                ...(leaveData.previous || [])
            ];
            
            if (allLeaves.length > 0) {
                allLeaves.forEach(leave => {
                    const formattedStartDate = new Date(leave.requested_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    const formattedEndDate = leave.end_date ? new Date(leave.end_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }) : formattedStartDate;
                    
                    const leaveTypeDisplay = leave.leave_type ? leave.leave_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Personal Leave';
                    
                    // Calculate duration
                    const startDate = new Date(leave.requested_date);
                    const endDate = leave.end_date ? new Date(leave.end_date) : startDate;
                    const duration = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
                    
                    // Status badge
                    let statusBadge = '';
                    if (leave.status === 'pending') {
                        statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
                    } else if (leave.status === 'approved') {
                        statusBadge = '<span class="badge bg-success">Approved</span>';
                    } else if (leave.status === 'rejected') {
                        statusBadge = '<span class="badge bg-danger">Rejected</span>';
                    }
                    
                    // Actions based on status
                    let actions = '';
                    if (leave.status === 'pending') {
                        actions = `
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-outline-primary" onclick="editLeaveRequest(${leave.leave_id})">
                                    Edit
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="cancelLeaveRequest(${leave.leave_id})">
                                    Delete
                                </button>
                            </div>
                        `;
                    } else {
                        actions = `
                            <button class="btn btn-sm btn-outline-secondary" onclick="viewLeaveRequest(${leave.leave_id})">
                                View
                            </button>
                        `;
                    }
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><span class="badge bg-light text-dark">${leaveTypeDisplay}</span></td>
                        <td><small class="text-muted">${formattedStartDate}</small></td>
                        <td><small class="text-muted">${formattedEndDate}</small></td>
                        <td><span class="badge bg-secondary">${duration} day${duration > 1 ? 's' : ''}</span></td>
                        <td>${statusBadge}</td>
                        <td><small class="text-muted" title="${leave.reason || 'No reason provided'}">${leave.reason ? (leave.reason.length > 30 ? leave.reason.substring(0, 30) + '...' : leave.reason) : 'No reason provided'}</small></td>
                        <td>${actions}</td>
                    `;
                    leaveTableBody.appendChild(row);
                });
            } else {
                leaveTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No leave requests found</td></tr>';
            }
        }
    }

    const appointmentsPerPage = 10;
    const pageSize = 10;

    // Helper function to get status badge HTML
    function getStatusBadge(status) {
        const statusClasses = {
            'Confirmed': 'bg-primary',
            'Pending': 'bg-warning text-dark',
            'In Progress': 'bg-info',
            'Completed': 'bg-success',
            'Cancelled': 'bg-danger'
        };
        
        const badgeClass = statusClasses[status] || 'bg-secondary';
        return `<span class="badge ${badgeClass}">${status}</span>`;
    }

    function renderAppointmentTabs() {
        console.log('=== DEBUG: renderAppointmentTabs called ===');
        console.log('scheduleData:', scheduleData);
        
        if (!scheduleData) {
            console.log('No scheduleData available');
            return;
        }
        
        console.log('Rendering appointment tabs...');
        renderConfirmedAppointments();
        renderUpcomingAppointments();
        renderCompletedAppointments();
        renderPastAppointments();
        
        // Update current date display
        if (currentAppointmentsDateEl) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            currentAppointmentsDateEl.textContent = `(${currentScheduleDate.toLocaleDateString(undefined, options)})`;
        }
    }

    function renderConfirmedAppointments() {
        const confirmedTbody = document.getElementById('confirmed-appointments-tbody');
        if (!confirmedTbody || !scheduleData) return;
        
        const searchEl = document.getElementById('appointments-search');
        const pageEl = document.getElementById('confirmed-page');
        const countEl = document.getElementById('confirmed-count');
        
        const q = (searchEl?.value || '').toLowerCase();
        
        // Use appointments from API response
        const appointmentsSource = scheduleData.todayAppointments || [];
        console.log('DEBUG: appointmentsSource for confirmed:', appointmentsSource);
        
        // Filter for visible (non-cancelled/non-completed) appointments for the selected date
        const confirmedAppointments = appointmentsSource.filter(a => {
            const patientName = a.patientName || a.patient_name || a.first_name + ' ' + a.last_name || 'Unknown Patient';
            const matchesQ = !q || patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            const statusNorm = (a.status || '').toLowerCase();
            const isVisible = !['cancelled', 'completed'].includes(statusNorm);
            return matchesQ && isVisible;
        });
        
        const total = confirmedAppointments.length;
        const start = (confirmedPage - 1) * pageSize;
        const pageItems = confirmedAppointments.slice(start, start + pageSize);
        
        confirmedTbody.innerHTML = '';
        
        if (pageItems.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" class="text-center">No confirmed appointments for today</td>`;
            confirmedTbody.appendChild(tr);
        } else {
            pageItems.forEach(a => {
                const tr = document.createElement('tr');
                tr.dataset.id = a.id;
                
                // Add action buttons based on appointment status
                let actionButtons = '';
                const status = a.status || 'Unknown';
                if (status === 'Confirmed') {
                    actionButtons = `
                        <button class="btn btn-sm btn-outline-primary me-1 appt-start">
                            <i class="bi bi-play-circle"></i> Start
                        </button>
                        <button class="btn btn-sm btn-outline-secondary appt-view">
                            <i class="bi bi-eye"></i> View
                        </button>
                    `;
                } else if (status === 'In Progress') {
                    actionButtons = `
                        <button class="btn btn-sm btn-success me-1 appt-complete">
                            <i class="bi bi-check2-circle"></i> Complete
                        </button>
                        <button class="btn btn-sm btn-outline-secondary appt-view">
                            <i class="bi bi-eye"></i> View
                        </button>
                    `;
                }
                
                            // Format the appointment date
            const appointmentDate = parseAppointmentDate(a.appointment_date || a.date);
            const isValid = !isNaN(appointmentDate.getTime());
            const formattedDate = isValid ? appointmentDate.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }) : '-';
            
            const patientName = a.patientName || a.patient_name || (a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : 'Unknown Patient');
            
            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td>${a.time || '-'}</td>
                <td>${patientName}</td>
                <td>${a.reason || 'No reason specified'}</td>
                <td><span class="badge ${getStatusBadgeClass(a.status || 'Unknown')}">${a.status || 'Unknown'}</span></td>
                <td>${actionButtons}</td>
            `;
                
                            // Add event listeners for action buttons
            const apptId = a.appointment_id || a.id;
                tr.querySelector('.appt-start')?.addEventListener('click', () => {
                    window.startAppointmentModal(apptId);
                });
                tr.querySelector('.appt-complete')?.addEventListener('click', () => {
                    completeAppointment(apptId);
                });
                tr.querySelector('.appt-view')?.addEventListener('click', () => {
                    viewAppointment(apptId);
                });
                
                confirmedTbody.appendChild(tr);
            });
        }
        
        // Update pagination info
        if (countEl) countEl.textContent = `Showing ${Math.min(start + 1, total)} to ${Math.min(start + pageSize, total)} of ${total} confirmed appointments`;
        if (pageEl) pageEl.textContent = `Page ${confirmedPage}`;
        
        // Update tab count badge
        const confirmedTabCount = document.getElementById('confirmed-tab-count');
        if (confirmedTabCount) confirmedTabCount.textContent = total;
        
        // Update pagination buttons
        if (document.getElementById('confirmed-prev')) {
            document.getElementById('confirmed-prev').disabled = confirmedPage <= 1;
        }
        if (document.getElementById('confirmed-next')) {
            document.getElementById('confirmed-next').disabled = start + pageSize >= total;
        }
    }

    function renderUpcomingAppointments() {
        const upcomingTbody = document.getElementById('upcoming-appointments-tbody');
        if (!upcomingTbody || !scheduleData) return;
        
        const searchEl = document.getElementById('appointments-search');
        const pageEl = document.getElementById('upcoming-page');
        const countEl = document.getElementById('upcoming-count');
        
        const q = (searchEl?.value || '').toLowerCase();
        const currentTime = new Date();
        
        // Process upcoming appointments and check for time-based status updates
        let upcomingAppointments = (scheduleData.upcomingAppointments || []).map(a => {
            const appointmentDateTime = parseAppointmentDate(a.date || a.appointment_date);
            
            // Check if appointment time has passed
            if (appointmentDateTime && !isNaN(appointmentDateTime.getTime()) && currentTime > appointmentDateTime) {
                // Only mark as past if status is not already completed or cancelled
                if (!['Completed', 'Cancelled', 'In Progress'].includes(a.status)) {
                    // Mark as past due to time expiration
                    a.status = 'Past';
                    a.isPastDue = true; // Flag to indicate this is past due to time
                    
                    // Optionally call API to update status in backend
                    updateAppointmentStatusInBackground(a.appointment_id || a.id, 'Past');
                }
            }
            
            return a;
        });
        
        // Filter out completed and past appointments (they should go to past appointments)
        upcomingAppointments = upcomingAppointments.filter(a => {
            const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            const isNotCompleted = !['Completed', 'Cancelled', 'Past'].includes(a.status);
            return matchesQ && isNotCompleted;
        });
        
        const total = upcomingAppointments.length;
        const start = (upcomingPage - 1) * pageSize;
        const pageItems = upcomingAppointments.slice(start, start + pageSize);
        
        upcomingTbody.innerHTML = '';
        
        if (pageItems.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" class="text-center">No upcoming appointments found</td>`;
            upcomingTbody.appendChild(tr);
        } else {
            pageItems.forEach(a => {
                const tr = document.createElement('tr');
                tr.dataset.id = a.id;
                
                const appointmentDate = parseAppointmentDate(a.date || a.appointment_date);
                const isValid = !isNaN(appointmentDate.getTime());
                const formattedDate = isValid ? appointmentDate.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                }) : '-';
                
                const formattedTime = isValid ? appointmentDate.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }) : (a.time || '-');
                
                // Add visual indicator for appointments that are overdue
                let rowClass = '';
                let statusDisplay = a.status;
                if (isValid && currentTime > appointmentDate && !['Completed', 'Cancelled', 'Past', 'In Progress'].includes(a.status)) {
                    rowClass = 'table-warning';
                    statusDisplay = 'Overdue';
                } else if (a.isPastDue) {
                    rowClass = 'table-secondary';
                    statusDisplay = 'Past';
                }
                
                tr.className = rowClass;
                tr.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td>${a.patientName}</td>
                    <td>${a.reason || 'No reason specified'}</td>
                    <td><span class="badge ${getStatusBadgeClass(statusDisplay)}">${statusDisplay}</span></td>
                `;
                
                upcomingTbody.appendChild(tr);
            });
        }
        
        // Update pagination info
        if (countEl) countEl.textContent = `Showing ${Math.min(start + 1, total)} to ${Math.min(start + pageSize, total)} of ${total} upcoming appointments`;
        if (pageEl) pageEl.textContent = `Page ${upcomingPage}`;
        
        // Update tab count badge
        const upcomingTabCount = document.getElementById('upcoming-tab-count');
        if (upcomingTabCount) upcomingTabCount.textContent = total;
        
        // Update pagination buttons
        if (document.getElementById('upcoming-prev')) {
            document.getElementById('upcoming-prev').disabled = upcomingPage <= 1;
        }
        if (document.getElementById('upcoming-next')) {
            document.getElementById('upcoming-next').disabled = start + pageSize >= total;
        }
    }

    function changeConfirmedPage(direction) {
        confirmedPage = Math.max(1, confirmedPage + direction);
        renderConfirmedAppointments();
    }

    function changeUpcomingPage(direction) {
        upcomingPage = Math.max(1, upcomingPage + direction);
        renderUpcomingAppointments();
    }

    function changePastPage(direction) {
        pastPage = Math.max(1, pastPage + direction);
        renderPastAppointments();
    }

    function renderPastAppointments() {
        const pastTbody = document.getElementById('past-appointments-tbody');
        if (!pastTbody || !scheduleData) return;
        
        const searchEl = document.getElementById('appointments-search');
        const pageEl = document.getElementById('past-page');
        const countEl = document.getElementById('past-count');
        
        const q = (searchEl?.value || '').toLowerCase();
        const currentTime = new Date();
        
        // Get all appointments and filter for past ones (completed, cancelled, or auto-completed)
        const basePast = scheduleData.pastAppointments || [];
        
        // Also include past appointments from upcoming that have passed their time
        const pastFromUpcoming = (scheduleData.upcomingAppointments || []).filter(a => {
            const appointmentDateTime = parseAppointmentDate(a.date || a.appointment_date);
            return appointmentDateTime && !isNaN(appointmentDateTime.getTime()) && 
                   (currentTime > appointmentDateTime || ['Completed', 'Cancelled', 'Past'].includes(a.status));
        });
        
        // Combine past appointments with past ones from upcoming
        const allPastAppointments = [...basePast, ...pastFromUpcoming];
        
        const pastAppointments = allPastAppointments.filter(a => {
            const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            return matchesQ;
        });
        
        // Remove duplicates based on appointment ID
        const uniquePastAppointments = pastAppointments.filter((appointment, index, self) => 
            index === self.findIndex(a => (a.appointment_id || a.id) === (appointment.appointment_id || appointment.id))
        );
        
        const total = uniquePastAppointments.length;
        const start = (pastPage - 1) * pageSize;
        const pageItems = uniquePastAppointments.slice(start, start + pageSize);
        
        pastTbody.innerHTML = '';
        
        if (pageItems.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" class="text-center">No past appointments found</td>`;
            pastTbody.appendChild(tr);
        } else {
            pageItems.forEach(a => {
                const tr = document.createElement('tr');
                tr.dataset.id = a.id;
                
                const appointmentDate = parseAppointmentDate(a.date || a.appointment_date);
                const isValid = !isNaN(appointmentDate.getTime());
                const formattedDate = isValid ? appointmentDate.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                }) : '-';
                
                const formattedTime = isValid ? appointmentDate.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }) : (a.time || '-');
                
                // Show appropriate past status
                let displayStatus = a.status;
                if (a.status === 'Completed') {
                    displayStatus = 'Past+Completed';
                } else if (a.isPastDue) {
                    displayStatus = 'Past';
                } else if (a.autoCompleted) {
                    displayStatus = 'Auto-Completed';
                }
                
                tr.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td>${a.patientName}</td>
                    <td>${a.reason || 'No reason specified'}</td>
                    <td><span class="badge ${getStatusBadgeClass(displayStatus)}">${displayStatus}</span></td>
                `;
                
                pastTbody.appendChild(tr);
            });
        }
        
        // Update pagination info
        if (countEl) countEl.textContent = `Showing ${Math.min(start + 1, total)} to ${Math.min(start + pageSize, total)} of ${total} past appointments`;
        if (pageEl) pageEl.textContent = `Page ${pastPage}`;
        
        // Update tab count badge
        const pastTabCount = document.getElementById('past-tab-count');
        if (pastTabCount) pastTabCount.textContent = total;
        
        // Update pagination buttons
        if (document.getElementById('past-prev')) {
            document.getElementById('past-prev').disabled = pastPage <= 1;
        }
        if (document.getElementById('past-next')) {
            document.getElementById('past-next').disabled = start + pageSize >= total;
        }
    }

    function getStatusBadgeClass(status) {
        if (!status) return 'bg-light text-dark';
        
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-warning text-dark';
            case 'confirmed': return 'bg-info text-dark';
            case 'in progress': return 'bg-primary';
            case 'completed': return 'bg-success';
            case 'auto-completed': return 'bg-success';
            case 'past+completed': return 'bg-success';
            case 'cancelled': return 'bg-secondary';
            case 'overdue': return 'bg-danger';
            case 'past': return 'bg-secondary text-white';
            default: return 'bg-light text-dark';
        }
    }

    function populateQuickSettings(settings) {
        if (!settings) return;
        
        const defaultSlotDuration = document.getElementById('default-slot-duration');
        const breakBetweenSlots = document.getElementById('break-between-slots');
        const autoConfirmBookings = document.getElementById('auto-confirm-bookings');
        
        if (defaultSlotDuration) defaultSlotDuration.value = settings.defaultSlotDuration || '30';
        if (breakBetweenSlots) breakBetweenSlots.value = settings.breakBetweenSlots || '15';
        if (autoConfirmBookings) autoConfirmBookings.checked = settings.autoConfirmBookings !== false;
    }

    function updateDateDisplay() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if (calendarCurrentDateEl) {
            calendarCurrentDateEl.textContent = currentScheduleDate.toLocaleDateString(undefined, options);
        }
    }

    function navigateDate(direction) {
        if (direction === 'prev') {
            if (currentView === 'daily') {
                currentScheduleDate.setDate(currentScheduleDate.getDate() - 1);
            } else if (currentView === 'weekly') {
                currentScheduleDate.setDate(currentScheduleDate.getDate() - 7);
            } else if (currentView === 'monthly') {
                currentScheduleDate.setMonth(currentScheduleDate.getMonth() - 1);
            }
        } else if (direction === 'next') {
            if (currentView === 'daily') {
                currentScheduleDate.setDate(currentScheduleDate.getDate() + 1);
            } else if (currentView === 'weekly') {
                currentScheduleDate.setDate(currentScheduleDate.getDate() + 7);
            } else if (currentView === 'monthly') {
                currentScheduleDate.setMonth(currentScheduleDate.getMonth() + 1);
            }
        } else if (direction === 'today') {
            currentScheduleDate = new Date();
        }
        
        updateDateDisplay();
        fetchAndRenderSchedule();
        
        // Clean up interval when page is unloaded
        window.addEventListener('beforeunload', stopPeriodicRefresh);
    }

    async function updateAvailability() {
        try {
            const isAvailable = doctorAvailabilityToggle.checked;
            availabilityStatusEl.textContent = isAvailable ? 'Available' : 'Busy';
            
            const response = await fetch('/api/doctor/availability', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ is_available: isAvailable })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Availability updated:', result);
            
        } catch (error) {
            console.error('Error updating availability:', error);
            alert('Failed to update availability. Please try again.');
            // Revert toggle state
            doctorAvailabilityToggle.checked = !doctorAvailabilityToggle.checked;
            availabilityStatusEl.textContent = doctorAvailabilityToggle.checked ? 'Available' : 'Busy';
        }
    }

    async function saveQuickSettings() {
        try {
            const defaultSlotDuration = document.getElementById('default-slot-duration').value;
            const breakBetweenSlots = document.getElementById('break-between-slots').value;
            const autoConfirmBookings = document.getElementById('auto-confirm-bookings').checked;
            
            const settings = {
                defaultSlotDuration,
                breakBetweenSlots,
                autoConfirmBookings
            };
            
            const response = await fetch('/api/doctor/quick-settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Settings saved:', result);
            alert('Settings saved successfully!');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Failed to save settings. Please try again.');
        }
    }

    async function viewAppointment(appointmentId) {
        try {
            const modalBody = document.getElementById('appointment-modal-body');
            modalBody.innerHTML = 'Loading appointment details...';
            
            const response = await fetch(`/api/appointments/${appointmentId}`, {
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
            console.log('Appointment details:', appointment);
            
            // Format appointment details for display
            const appointmentDate = new Date(appointment.appointmentDate);
            const formattedDate = appointmentDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
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
                            <p class="mb-0">${appointment.time}</p>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-12">
                            <h6 class="text-muted mb-1">Reason</h6>
                            <p class="mb-0">${appointment.reason || 'No reason provided'}</p>
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
                    ${appointment.status === 'Completed' ? '' : `
                    <div class="row mb-3">
                        <div class="col-12">
                            <h6 class="text-muted mb-1">Add/Edit Notes</h6>
                            <textarea class="form-control" id="appointment-notes" rows="3">${appointment.notes || ''}</textarea>
                            <button class="btn btn-primary mt-2" id="save-notes-btn">Save Notes</button>
                        </div>
                    </div>
                    `}
                </div>
            `;
            
            // Add event listener to save notes button if present
            const saveNotesBtn = document.getElementById('save-notes-btn');
            if (saveNotesBtn) {
                saveNotesBtn.addEventListener('click', () => saveAppointmentNotes(appointmentId));
            }
            
            // Show/hide reschedule button based on appointment status
            const rescheduleBtn = document.getElementById('appt-reschedule-btn');
            if (rescheduleBtn) {
                rescheduleBtn.style.display = ['Completed', 'Cancelled'].includes(appointment.status) ? 'none' : 'block';
                rescheduleBtn.onclick = () => prepareReschedule(appointmentId);
            }
            
        } catch (error) {
            console.error('Error fetching appointment details:', error);
            document.getElementById('appointment-modal-body').innerHTML = 'Failed to load appointment details. Please try again.';
        }
    }

    async function saveAppointmentNotes(appointmentId) {
        try {
            const notes = document.getElementById('appointment-notes').value;
            
            const response = await fetch(`/api/appointments/${appointmentId}/notes`, {
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
            console.log('Notes saved:', result);
            alert('Notes saved successfully!');
            
        } catch (error) {
            console.error('Error saving notes:', error);
            alert('Failed to save notes. Please try again.');
        }
    }

    async function startAppointment(appointmentId) {
        try {
            const response = await fetch(`/api/appointments/${appointmentId}/start`, {
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
            console.log('Appointment started:', result);
            alert('Appointment started successfully!');
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error starting appointment:', error);
            alert('Failed to start appointment. Please try again.');
        }
    }

    async function completeAppointment(appointmentId) {
        try {
            const response = await fetch(`/api/appointments/${appointmentId}/complete`, {
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
            console.log('Appointment completed:', result);
            alert('Appointment completed successfully!');
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error completing appointment:', error);
            alert('Failed to complete appointment. Please try again.');
        }
    }

    function prepareReschedule(appointmentId) {
        // This would open a modal or form to reschedule the appointment
        // For now, just log the action
        console.log('Preparing to reschedule appointment:', appointmentId);
        alert('Reschedule functionality will be implemented in a future update.');
    }

    function openBlockModal(time) {
        // Pre-fill the block time modal with the selected time
        const blockDate = document.getElementById('block-date');
        const blockStartTime = document.getElementById('block-start-time');
        const blockEndTime = document.getElementById('block-end-time');
        
        // Set date to current schedule date
        blockDate.value = currentScheduleDate.toISOString().split('T')[0];
        
        // Set start time to selected time
        blockStartTime.value = time;
        
        // Calculate end time (30 minutes later)
        const [hours, minutes] = time.split(':');
        const startDate = new Date();
        startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        const endDate = new Date(startDate.getTime() + 30 * 60000); // Add 30 minutes
        
        const endHours = endDate.getHours().toString().padStart(2, '0');
        const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
        blockEndTime.value = `${endHours}:${endMinutes}`;
        
        // Open the modal
        const blockTimeModal = new bootstrap.Modal(document.getElementById('blockTimeModal'));
        blockTimeModal.show();
    }

    async function handleBlockTime() {
        try {
            console.log('Block time button clicked');
            const blockDate = document.getElementById('block-date')?.value;
            const blockStartTime = document.getElementById('block-start-time')?.value;
            const blockEndTime = document.getElementById('block-end-time')?.value;
            const blockReason = document.getElementById('block-reason')?.value;
            const blockRecurring = document.getElementById('block-recurring')?.checked;
            
            console.log('Block time values:', { blockDate, blockStartTime, blockEndTime, blockReason, blockRecurring });
            
            if (!blockDate || !blockStartTime || !blockEndTime) {
                alert('Please fill in all required fields (Date, Start Time, End Time)');
                return;
            }
            
            let recurringDays = [];
            if (blockRecurring) {
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                recurringDays = days.filter(day => document.getElementById(`repeat-${day}`).checked);
            }
            
            const blockData = {
                date: blockDate,
                startTime: blockStartTime,
                endTime: blockEndTime,
                reason: blockReason,
                recurring: blockRecurring,
                recurringDays
            };
            
            const response = await fetch('/api/doctor/block-time', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(blockData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Time blocked:', result);
            alert('Time blocked successfully!');
            
            // Close the modal
            const blockTimeModal = bootstrap.Modal.getInstance(document.getElementById('blockTimeModal'));
            blockTimeModal.hide();
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error blocking time:', error);
            alert('Failed to block time. Please try again.');
        }
    }

    async function unblockTimeSlot(blockId) {
        try {
            const response = await fetch(`/api/doctor/block-time/${blockId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Time unblocked:', result);
            alert('Time unblocked successfully!');
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error unblocking time:', error);
            alert('Failed to unblock time. Please try again.');
        }
    }

    async function handleSetAvailability() {
        try {
            const effectiveDate = document.getElementById('availability-effective-date').value;
            
            // Collect availability data for each day
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const availability = {};
            
            days.forEach(day => {
                const enabled = document.getElementById(`${day}-enabled`).checked;
                availability[day] = {
                    enabled,
                    slots: []
                };
                
                if (enabled) {
                    const slotsContainer = document.getElementById(`${day}-slots`);
                    const slotRows = slotsContainer.querySelectorAll('.time-slot-row');
                    
                    slotRows.forEach(row => {
                        const timeInputs = row.querySelectorAll('input[type="time"]');
                        if (timeInputs.length >= 2) {
                            const startTime = timeInputs[0].value;
                            const endTime = timeInputs[1].value;
                            
                            if (startTime && endTime) {
                                availability[day].slots.push({
                                    startTime,
                                    endTime
                                });
                            }
                        }
                    });
                }
            });
            
            const availabilityData = {
                effectiveDate,
                availability
            };
            
            const response = await fetch('/api/doctor/availability/weekly', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(availabilityData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Availability set:', result);
            alert('Availability set successfully!');
            
            // Close the modal
            const setAvailabilityModal = bootstrap.Modal.getInstance(document.getElementById('setAvailabilityModal'));
            setAvailabilityModal.hide();
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error setting availability:', error);
            alert('Failed to set availability. Please try again.');
        }
    }

    async function handleLeaveRequest() {
        try {
            const startDate = document.getElementById('leave-start-date').value;
            const endDate = document.getElementById('leave-end-date').value;
            const leaveType = document.getElementById('leave-type').value;
            const reason = document.getElementById('leave-reason').value;

            if (!startDate || !endDate || !leaveType || !reason) {
                alert('Please fill in all required fields for leave request.');
                return;
            }

            // Validate that end date is not before start date
            if (new Date(endDate) < new Date(startDate)) {
                alert('End date cannot be before start date.');
                return;
            }

            const response = await fetch('/api/doctor/leaves', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    requested_date: startDate,
                    end_date: endDate,
                    leave_type: leaveType,
                    reason: reason
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Leave request submitted:', result);
            alert('Leave request submitted successfully!');
            
            // Clear form
            document.getElementById('leave-request-form').reset();
            
            // Close modal
            const leaveRequestModal = bootstrap.Modal.getInstance(document.getElementById('leaveRequestModal'));
            leaveRequestModal.hide();
            
            // Refresh leave data
            await fetchLeaveData();
        } catch (error) {
            console.error('Error submitting leave request:', error);
            alert('Failed to submit leave request. Please try again.');
        }
    }

    function openAddSlotModal(time, day) {
        // Create a simple modal for adding slots
        const modalHtml = `
            <div class="modal fade" id="addSlotModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Add Time Slot</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-6">
                                    <label class="form-label">Time</label>
                                    <input type="time" class="form-control" id="slot-time" value="${time || ''}" required>
                                </div>
                                <div class="col-6">
                                    <label class="form-label">Status</label>
                                    <select class="form-select" id="slot-status">
                                        <option value="available">Available</option>
                                        <option value="blocked">Blocked</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mt-3">
                                <label class="form-label">Details (Optional)</label>
                                <input type="text" class="form-control" id="slot-details" placeholder="Reason for blocking...">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="save-slot-btn">Save Slot</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('addSlotModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add new modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('addSlotModal'));
        modal.show();
        
        // Add event listener to save button
        document.getElementById('save-slot-btn').addEventListener('click', () => {
            const slotTime = document.getElementById('slot-time').value;
            const slotStatus = document.getElementById('slot-status').value;
            const slotDetails = document.getElementById('slot-details').value;
            
            if (!slotTime) {
                alert('Please enter a time for the slot.');
                return;
            }
            
            // Add the slot to the schedule
            addSlotToSchedule(slotTime, slotStatus, slotDetails, day);
            
            // Close modal
            modal.hide();
        });
    }

    async function addSlotToSchedule(time, status, details, day) {
        try {
            const slotData = {
                date: currentScheduleDate.toISOString().split('T')[0],
                time: time,
                status: status.toLowerCase(),
                details: details,
                day: day
            };
            
            const response = await fetch('/api/doctor/schedule/slot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(slotData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Slot added:', result);
            alert('Slot added successfully!');
            
            // Refresh the schedule
            await fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error adding slot:', error);
            alert('Failed to add slot. Please try again.');
        }
    }

    async function handleAddSlot() {
        try {
            const slotTime = document.getElementById('slot-time').value;
            const slotStatus = document.getElementById('slot-status').value;
            const slotDetails = document.getElementById('slot-details').value;
            
            const slotData = {
                date: currentScheduleDate.toISOString().split('T')[0],
                time: slotTime,
                status: slotStatus.toLowerCase(),
                details: slotDetails
            };
            
            const response = await fetch('/api/doctor/schedule/slot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(slotData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Slot added:', result);
            alert('Slot added successfully!');
            
            // Close the modal
            const addSlotModal = bootstrap.Modal.getInstance(document.getElementById('addSlotModal'));
            addSlotModal.hide();
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error adding slot:', error);
            alert('Failed to add slot. Please try again.');
        }
    }

    function exportToCsv() {
        if (!scheduleData || !scheduleData.todayAppointments) return;
        
        const searchEl = document.getElementById('todays-search');
        const statusEl = document.getElementById('todays-status-filter');
        
        const q = (searchEl?.value || '').toLowerCase();
        const status = (statusEl?.value || '').toLowerCase();
        
        const filtered = scheduleData.todayAppointments.filter(a => {
            const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            const matchesS = !status || (a.status || '').toLowerCase() === status.toLowerCase();
            return matchesQ && matchesS;
        });
        
        // Create CSV content
        const headers = ['Time', 'Patient Name', 'Reason', 'Status'];
        const rows = filtered.map(a => [
            a.time,
            a.patientName,
            a.reason || '',
            a.status
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `appointments_${currentScheduleDate.toISOString().split('T')[0]}.csv`);
        a.click();
    }

    function printAppointments() {
        if (!scheduleData || !scheduleData.todayAppointments) return;
        
        const searchEl = document.getElementById('todays-search');
        const statusEl = document.getElementById('todays-status-filter');
        
        const q = (searchEl?.value || '').toLowerCase();
        const status = (statusEl?.value || '').toLowerCase();
        
        const filtered = scheduleData.todayAppointments.filter(a => {
            const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            const matchesS = !status || (a.status || '').toLowerCase() === status.toLowerCase();
            return matchesQ && matchesS;
        });
        
        // Create print window
        const printWindow = window.open('', '_blank');
        
        // Get doctor name from token
        const token = localStorage.getItem('token');
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const doctorName = `Dr. ${decodedToken.first_name} ${decodedToken.last_name}`;
        
        // Format date
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateString = currentScheduleDate.toLocaleDateString(undefined, options);
        
        // Create print content
        printWindow.document.write(`
            <html>
            <head>
                <title>Appointments - ${dateString}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { font-size: 18px; margin-bottom: 10px; }
                    h2 { font-size: 16px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <h1>${doctorName} - Appointments</h1>
                <h2>${dateString}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Patient</th>
                            <th>Reason</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(a => `
                            <tr>
                                <td>${a.time}</td>
                                <td>${a.patientName}</td>
                                <td>${a.reason || ''}</td>
                                <td>${a.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        
        printWindow.document.close();
    }

    function parseAppointmentDate(value) {
        if (!value) return new Date(NaN);
        if (value instanceof Date) return value;
        if (typeof value === 'string') {
            // Handle MySQL 'YYYY-MM-DD HH:MM:SS' by converting space to 'T'
            const normalized = value.includes('T') ? value : value.replace(' ', 'T');
            return new Date(normalized);
        }
        return new Date(value);
    }

    async function saveAppointmentNotes(appointmentId) {
        try {
            const notes = document.getElementById('appointment-notes').value;
            
            const response = await fetch(`/api/appointments/${appointmentId}/notes`, {
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
            console.log('Notes saved:', result);
            alert('Notes saved successfully!');
            
        } catch (error) {
            console.error('Error saving notes:', error);
            alert('Failed to save notes. Please try again.');
        }
    }

    async function startAppointment(appointmentId) {
        try {
            const response = await fetch(`/api/appointments/${appointmentId}/start`, {
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
            console.log('Appointment started:', result);
            alert('Appointment started successfully!');
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error starting appointment:', error);
            alert('Failed to start appointment. Please try again.');
        }
    }

    async function completeAppointment(appointmentId) {
        try {
            const response = await fetch(`/api/appointments/${appointmentId}/complete`, {
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
            console.log('Appointment completed:', result);
            alert('Appointment completed successfully!');
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error completing appointment:', error);
            alert('Failed to complete appointment. Please try again.');
        }
    }

    function prepareReschedule(appointmentId) {
        // This would open a modal or form to reschedule the appointment
        // For now, just log the action
        console.log('Preparing to reschedule appointment:', appointmentId);
        alert('Reschedule functionality will be implemented in a future update.');
    }

    function openBlockModal(time) {
        // Pre-fill the block time modal with the selected time
        const blockDate = document.getElementById('block-date');
        const blockStartTime = document.getElementById('block-start-time');
        const blockEndTime = document.getElementById('block-end-time');
        
        // Set date to current schedule date
        blockDate.value = currentScheduleDate.toISOString().split('T')[0];
        
        // Set start time to selected time
        blockStartTime.value = time;
        
        // Calculate end time (30 minutes later)
        const [hours, minutes] = time.split(':');
        const startDate = new Date();
        startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        const endDate = new Date(startDate.getTime() + 30 * 60000); // Add 30 minutes
        
        const endHours = endDate.getHours().toString().padStart(2, '0');
        const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
        blockEndTime.value = `${endHours}:${endMinutes}`;
        
        // Open the modal
        const blockTimeModal = new bootstrap.Modal(document.getElementById('blockTimeModal'));
        blockTimeModal.show();
    }

    async function handleBlockTime() {
        try {
            console.log('Block time button clicked');
            const blockDate = document.getElementById('block-date')?.value;
            const blockStartTime = document.getElementById('block-start-time')?.value;
            const blockEndTime = document.getElementById('block-end-time')?.value;
            const blockReason = document.getElementById('block-reason')?.value;
            const blockRecurring = document.getElementById('block-recurring')?.checked;
            
            console.log('Block time values:', { blockDate, blockStartTime, blockEndTime, blockReason, blockRecurring });
            
            if (!blockDate || !blockStartTime || !blockEndTime) {
                alert('Please fill in all required fields (Date, Start Time, End Time)');
                return;
            }
            
            let recurringDays = [];
            if (blockRecurring) {
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                recurringDays = days.filter(day => document.getElementById(`repeat-${day}`).checked);
            }
            
            const blockData = {
                date: blockDate,
                startTime: blockStartTime,
                endTime: blockEndTime,
                reason: blockReason,
                recurring: blockRecurring,
                recurringDays
            };
            
            const response = await fetch('/api/doctor/block-time', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(blockData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Time blocked:', result);
            alert('Time blocked successfully!');
            
            // Close the modal
            const blockTimeModal = bootstrap.Modal.getInstance(document.getElementById('blockTimeModal'));
            blockTimeModal.hide();
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error blocking time:', error);
            alert('Failed to block time. Please try again.');
        }
    }

    async function unblockTimeSlot(blockId) {
        try {
            const response = await fetch(`/api/doctor/block-time/${blockId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Time unblocked:', result);
            alert('Time unblocked successfully!');
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error unblocking time:', error);
            alert('Failed to unblock time. Please try again.');
        }
    }

    async function handleSetAvailability() {
        try {
            const effectiveDate = document.getElementById('availability-effective-date').value;
            
            // Collect availability data for each day
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const availability = {};
            
            days.forEach(day => {
                const enabled = document.getElementById(`${day}-enabled`).checked;
                availability[day] = {
                    enabled,
                    slots: []
                };
                
                if (enabled) {
                    const slotsContainer = document.getElementById(`${day}-slots`);
                    const slotRows = slotsContainer.querySelectorAll('.time-slot-row');
                    
                    slotRows.forEach(row => {
                        const timeInputs = row.querySelectorAll('input[type="time"]');
                        if (timeInputs.length >= 2) {
                            const startTime = timeInputs[0].value;
                            const endTime = timeInputs[1].value;
                            
                            if (startTime && endTime) {
                                availability[day].slots.push({
                                    startTime,
                                    endTime
                                });
                            }
                        }
                    });
                }
            });
            
            const availabilityData = {
                effectiveDate,
                availability
            };
            
            const response = await fetch('/api/doctor/availability/weekly', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(availabilityData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Availability set:', result);
            alert('Availability set successfully!');
            
            // Close the modal
            const setAvailabilityModal = bootstrap.Modal.getInstance(document.getElementById('setAvailabilityModal'));
            setAvailabilityModal.hide();
            
            // Refresh the schedule to reflect the change
            fetchAndRenderSchedule();
            
        } catch (error) {
            console.error('Error setting availability:', error);
            alert('Failed to set availability. Please try again.');
        }
    }

    async function updateAvailability() {
        try {
            const isAvailable = doctorAvailabilityToggle.checked;
            availabilityStatusEl.textContent = isAvailable ? 'Available' : 'Busy';
            
            const response = await fetch('/api/doctor/availability', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ is_available: isAvailable })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Availability updated:', result);
            
        } catch (error) {
            console.error('Error updating availability:', error);
            alert('Failed to update availability. Please try again.');
            // Revert toggle state
            doctorAvailabilityToggle.checked = !doctorAvailabilityToggle.checked;
            availabilityStatusEl.textContent = doctorAvailabilityToggle.checked ? 'Available' : 'Busy';
        }
    }

    async function saveQuickSettings() {
        try {
            const defaultSlotDuration = document.getElementById('default-slot-duration').value;
            const breakBetweenSlots = document.getElementById('break-between-slots').value;
            const autoConfirmBookings = document.getElementById('auto-confirm-bookings').checked;
            
            const settings = {
                defaultSlotDuration,
                breakBetweenSlots,
                autoConfirmBookings
            };
            
            const response = await fetch('/api/doctor/quick-settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Settings saved:', result);
            alert('Settings saved successfully!');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Failed to save settings. Please try again.');
        }
    }

    function populateQuickSettings(settings) {
        if (!settings) return;
        
        const defaultSlotDuration = document.getElementById('default-slot-duration');
        const breakBetweenSlots = document.getElementById('break-between-slots');
        const autoConfirmBookings = document.getElementById('auto-confirm-bookings');
        
        if (defaultSlotDuration) defaultSlotDuration.value = settings.defaultSlotDuration || '30';
        if (breakBetweenSlots) breakBetweenSlots.value = settings.breakBetweenSlots || '15';
        if (autoConfirmBookings) autoConfirmBookings.checked = settings.autoConfirmBookings !== false;
    }

    function updateDateDisplay() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if (calendarCurrentDateEl) {
            calendarCurrentDateEl.textContent = currentScheduleDate.toLocaleDateString(undefined, options);
        }
    }


    // Initial load
    console.log('Initializing schedule management...');
    updateDateDisplay();
    fetchAndRenderSchedule();

    // Leave request management functions
    window.editLeaveRequest = async function(leaveId) {
        try {
            const response = await fetch(`/api/doctor/leave-requests/${leaveId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const leave = await response.json();
            
            // Populate the leave request modal with existing data
            const startDateInput = document.getElementById('leave-start-date');
            const endDateInput = document.getElementById('leave-end-date');
            const typeInput = document.getElementById('leave-type');
            const reasonInput = document.getElementById('leave-reason');
            
            if (startDateInput) startDateInput.value = leave.requested_date ? leave.requested_date.split('T')[0] : '';
            if (endDateInput) endDateInput.value = leave.end_date ? leave.end_date.split('T')[0] : '';
            if (typeInput) typeInput.value = leave.leave_type || '';
            if (reasonInput) reasonInput.value = leave.reason || '';
            
            // Store the leave ID for updating
            const modal = document.getElementById('leaveRequestModal');
            if (modal) {
                modal.setAttribute('data-leave-id', leaveId);
                const bootstrapModal = new bootstrap.Modal(modal);
                bootstrapModal.show();
            }
            
        } catch (error) {
            console.error('Error fetching leave request:', error);
            alert('Failed to load leave request details. Please try again.');
        }
    };

    window.cancelLeaveRequest = async function(leaveId) {
        if (!confirm('Are you sure you want to delete this leave request?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/doctor/leave-requests/${leaveId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            alert('Leave request deleted successfully!');
            
            // Refresh the leave data
            await fetchLeaveData();
            
        } catch (error) {
            console.error('Error deleting leave request:', error);
            alert('Failed to delete leave request. Please try again.');
        }
    };

    window.viewLeaveRequest = async function(leaveId) {
        try {
            const response = await fetch(`/api/doctor/leave-requests/${leaveId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const leave = await response.json();
            
            // Format dates
            const startDate = new Date(leave.requested_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const endDate = leave.end_date ? new Date(leave.end_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : startDate;
            
            const leaveTypeDisplay = leave.leave_type ? leave.leave_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Personal Leave';
            
            // Calculate duration
            const start = new Date(leave.requested_date);
            const end = leave.end_date ? new Date(leave.end_date) : start;
            const duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
            
            // Status styling
            let statusBadge = '';
            if (leave.status === 'approved') {
                statusBadge = '<span class="badge bg-success">Approved</span>';
            } else if (leave.status === 'rejected') {
                statusBadge = '<span class="badge bg-danger">Rejected</span>';
            } else {
                statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
            }
            
            // Create modal content
            const modalContent = `
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="text-muted">Leave Type</h6>
                        <p class="fw-bold">${leaveTypeDisplay}</p>
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-muted">Status</h6>
                        <p>${statusBadge}</p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="text-muted">Start Date</h6>
                        <p>${startDate}</p>
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-muted">End Date</h6>
                        <p>${endDate}</p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="text-muted">Duration</h6>
                        <p>${duration} day${duration > 1 ? 's' : ''}</p>
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-muted">Requested Date</h6>
                        <p>${new Date(leave.created_at || leave.requested_date).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-12">
                        <h6 class="text-muted">Reason</h6>
                        <p>${leave.reason || 'No reason provided'}</p>
                    </div>
                </div>
            `;
            
            // Show in a modal (create a simple modal if it doesn't exist)
            let viewModal = document.getElementById('viewLeaveModal');
            if (!viewModal) {
                // Create modal if it doesn't exist
                const modalHTML = `
                    <div class="modal fade" id="viewLeaveModal" tabindex="-1" aria-labelledby="viewLeaveModalLabel" aria-hidden="true">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="viewLeaveModalLabel">Leave Request Details</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body" id="viewLeaveModalBody">
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                viewModal = document.getElementById('viewLeaveModal');
            }
            
            // Set modal content and show
            document.getElementById('viewLeaveModalBody').innerHTML = modalContent;
            const modal = new bootstrap.Modal(viewModal);
            modal.show();
            
        } catch (error) {
            console.error('Error fetching leave request:', error);
            alert('Failed to load leave request details. Please try again.');
        }
    };

    // Timer variables
    let appointmentTimer = null;
    let timerStartTime = null;
    let timerPausedTime = 0;
    let currentAppointmentId = null;

    // Enhanced startAppointment function to open modal with patient details
    window.startAppointmentModal = async function(appointmentId) {
        try {
            console.log('Starting appointment modal for ID:', appointmentId);
            currentAppointmentId = appointmentId;
            
            // For now, let's use mock data to test the modal functionality
            const mockData = {
                appointment: {
                    appointment_id: appointmentId,
                    appointment_date: new Date().toISOString(),
                    reason: 'General consultation',
                    status: 'Confirmed',
                    notes: ''
                },
                patient: {
                    patient_id: 1,
                    first_name: 'John',
                    last_name: 'Doe',
                    date_of_birth: '1990-01-01',
                    phone_number: '+1234567890',
                    gender: 'Male',
                    blood_type: 'O+',
                    allergies: 'None reported',
                    current_medications: 'None',
                    medical_conditions: 'None',
                    address: '123 Main St'
                }
            };
            
            // Try to fetch real data, but fall back to mock data if it fails
            try {
                const appointmentResponse = await fetch(`/api/appointments/${appointmentId}/details`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (appointmentResponse.ok) {
                    const realData = await appointmentResponse.json();
                    if (realData.success) {
                        populateAppointmentModal(realData.data);
                    } else {
                        populateAppointmentModal(mockData);
                    }
                } else {
                    console.log('API not available, using mock data');
                    populateAppointmentModal(mockData);
                }
            } catch (apiError) {
                console.log('API error, using mock data:', apiError);
                populateAppointmentModal(mockData);
            }
            
            // Show the appointment management modal
            const modal = new bootstrap.Modal(document.getElementById('appointmentManagementModal'));
            modal.show();
            
            // Attach event listeners after modal is shown
            setTimeout(() => {
                attachTimerEventListeners();
            }, 100);
            
        } catch (error) {
            console.error('Error starting appointment:', error);
            alert('Failed to start appointment. Please try again.');
        }
    };

    function populateAppointmentModal(data) {
        // Patient Information
        document.getElementById('patient-name').textContent = `${data.patient.first_name} ${data.patient.last_name}`;
        document.getElementById('patient-age').textContent = calculateAge(data.patient.date_of_birth);
        document.getElementById('patient-gender').textContent = data.patient.gender || 'Not specified';
        document.getElementById('patient-phone').textContent = data.patient.phone_number || 'Not provided';
        document.getElementById('patient-blood-type').textContent = data.patient.blood_type || 'Not specified';
        document.getElementById('patient-allergies').textContent = data.patient.allergies || 'None reported';
        document.getElementById('patient-medications').textContent = data.patient.current_medications || 'None reported';
        
        // Appointment Details
        document.getElementById('appointment-reason').textContent = data.appointment.reason || 'General consultation';
        
        // Reset timer
        resetTimer();
    }

    function calculateAge(birthDate) {
        if (!birthDate) return 'Not specified';
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return `${age} years`;
    }

    function resetTimer() {
        if (appointmentTimer) {
            clearInterval(appointmentTimer);
        }
        appointmentTimer = null;
        timerStartTime = null;
        timerPausedTime = 0;
        
        document.getElementById('appointment-timer').textContent = '00:00:00';
        document.getElementById('session-start-time').textContent = '-';
        document.getElementById('session-status').textContent = 'Not Started';
        document.getElementById('session-status').className = 'badge bg-secondary';
        
        // Show/hide timer buttons
        document.getElementById('start-timer-btn').style.display = 'block';
        document.getElementById('pause-timer-btn').style.display = 'none';
        document.getElementById('resume-timer-btn').style.display = 'none';
    }

    function startTimerFunction() {
        console.log('Starting timer function...');
        
        timerStartTime = new Date();
        const startTimeStr = timerStartTime.toLocaleTimeString();
        
        const sessionStartEl = document.getElementById('session-start-time');
        const sessionStatusEl = document.getElementById('session-status');
        const startBtnEl = document.getElementById('start-timer-btn');
        const pauseBtnEl = document.getElementById('pause-timer-btn');
        const resumeBtnEl = document.getElementById('resume-timer-btn');
        
        if (sessionStartEl) sessionStartEl.textContent = startTimeStr;
        if (sessionStatusEl) {
            sessionStatusEl.textContent = 'In Progress';
            sessionStatusEl.className = 'badge bg-success';
        }
        
        // Show/hide timer buttons
        if (startBtnEl) startBtnEl.style.display = 'none';
        if (pauseBtnEl) pauseBtnEl.style.display = 'block';
        if (resumeBtnEl) resumeBtnEl.style.display = 'none';
        
        appointmentTimer = setInterval(updateTimer, 1000);
        
        console.log('Timer started successfully');
        
        // Update appointment status to "In Progress" in backend
        updateAppointmentStatusInBackground(currentAppointmentId, 'In Progress');
    }

    function pauseTimer() {
        if (appointmentTimer) {
            clearInterval(appointmentTimer);
            appointmentTimer = null;
        }
        
        document.getElementById('session-status').textContent = 'Paused';
        document.getElementById('session-status').className = 'badge bg-warning';
        
        // Show/hide timer buttons
        document.getElementById('pause-timer-btn').style.display = 'none';
        document.getElementById('resume-timer-btn').style.display = 'block';
    }

    function resumeTimer() {
        document.getElementById('session-status').textContent = 'In Progress';
        document.getElementById('session-status').className = 'badge bg-success';
        
        // Show/hide timer buttons
        document.getElementById('pause-timer-btn').style.display = 'block';
        document.getElementById('resume-timer-btn').style.display = 'none';
        
        appointmentTimer = setInterval(updateTimer, 1000);
    }

    function updateTimer() {
        if (!timerStartTime) return;
        
        const now = new Date();
        const elapsed = Math.floor((now - timerStartTime - timerPausedTime) / 1000);
        
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('appointment-timer').textContent = timeStr;
    }

    async function completeAppointmentWithRecords() {
        try {
            console.log('=== COMPLETE APPOINTMENT BUTTON CLICKED ===');
            console.log('Completing appointment with records...');
            console.log('Current appointment ID:', currentAppointmentId);
            
            if (!currentAppointmentId) {
                alert('No appointment selected. Please try again.');
                return;
            }
            
            // Get medical records data from form with validation
            const symptomsEl = document.getElementById('symptoms');
            const diagnosisEl = document.getElementById('diagnosis');
            const treatmentEl = document.getElementById('treatment');
            const prescribedMedicinesEl = document.getElementById('prescribed-medicines');
            const followUpEl = document.getElementById('follow-up');
            const doctorNotesEl = document.getElementById('doctor-notes');
            const timerEl = document.getElementById('appointment-timer');
            const startTimeEl = document.getElementById('session-start-time');
            
            console.log('Form elements found:', {
                symptoms: !!symptomsEl,
                diagnosis: !!diagnosisEl,
                treatment: !!treatmentEl,
                prescribed_medicines: !!prescribedMedicinesEl,
                follow_up: !!followUpEl,
                doctor_notes: !!doctorNotesEl,
                timer: !!timerEl,
                startTime: !!startTimeEl
            });
            
            const medicalRecords = {
                symptoms: symptomsEl?.value || '',
                diagnosis: diagnosisEl?.value || '',
                treatment: treatmentEl?.value || '',
                prescribed_medicines: prescribedMedicinesEl?.value || '',
                follow_up: followUpEl?.value || '',
                doctor_notes: doctorNotesEl?.value || '',
                session_duration: timerEl?.textContent || '00:00:00',
                session_start_time: startTimeEl?.textContent || '-'
            };

            console.log('Medical records data:', medicalRecords);

            // Try to complete appointment with medical records via API
            try {
                console.log(`Making API call to: /api/appointments/${currentAppointmentId}/complete-with-records`);
                console.log('Request body:', JSON.stringify(medicalRecords, null, 2));
                
                const response = await fetch(`/api/appointments/${currentAppointmentId}/complete-with-records`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(medicalRecords)
                });

                console.log('API Response status:', response.status);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('Appointment completed with records:', result);
                    
                    // Show success message
                    alert('Appointment completed successfully with medical records!\n\nRecorded:\n' + 
                          `- Duration: ${medicalRecords.session_duration}\n` +
                          `- Symptoms: ${medicalRecords.symptoms || 'None recorded'}\n` +
                          `- Diagnosis: ${medicalRecords.diagnosis || 'None recorded'}`);
                } else {
                    const errorText = await response.text();
                    console.error('API Error Response:', response.status, errorText);
                    
                    // Still complete locally but show warning
                    alert(`API Error (${response.status}): ${errorText}\n\nAppointment will be marked as completed locally.`);
                }
            } catch (apiError) {
                console.error('API Network Error:', apiError);
                alert(`Network Error: ${apiError.message}\n\nAppointment will be marked as completed locally.`);
            }
            
            // Stop timer
            if (appointmentTimer) {
                clearInterval(appointmentTimer);
                appointmentTimer = null;
            }
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('appointmentManagementModal'));
            if (modal) {
                modal.hide();
                fetchAndRenderSchedule();
            }
            
        } catch (error) {
            console.error('Error completing appointment:', error);
            alert('Failed to complete appointment. Please try again.');
        }
    }

    // Add event listeners for timer buttons - moved to after modal is shown
    function attachTimerEventListeners() {
        console.log('Attaching timer event listeners...');
        
        const startBtn = document.getElementById('start-timer-btn');
        const pauseBtn = document.getElementById('pause-timer-btn');
        const resumeBtn = document.getElementById('resume-timer-btn');
        const completeBtn = document.getElementById('complete-appointment-btn');
        const completeBtn2 = document.getElementById('complete-appointment-btn-2');
        
        if (startBtn) {
            startBtn.addEventListener('click', startTimerFunction);
            console.log('Start timer button listener attached');
        } else {
            console.error('Start timer button not found!');
        }
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', pauseTimer);
            console.log('Pause timer button listener attached');
        } else {
            console.error('Pause timer button not found!');
        }
        
        if (resumeBtn) {
            resumeBtn.addEventListener('click', resumeTimer);
            console.log('Resume timer button listener attached');
        } else {
            console.error('Resume timer button not found!');
        }
        
        // Attach event listeners to both complete buttons
        if (completeBtn) {
            completeBtn.removeEventListener('click', completeAppointmentWithRecords);
            completeBtn.addEventListener('click', completeAppointmentWithRecords);
            console.log('Complete appointment button 1 listener attached');
        } else {
            console.error('Complete appointment button 1 not found!');
        }
        
        if (completeBtn2) {
            completeBtn2.removeEventListener('click', completeAppointmentWithRecords);
            completeBtn2.addEventListener('click', completeAppointmentWithRecords);
            console.log('Complete appointment button 2 listener attached');
        } else {
            console.error('Complete appointment button 2 not found!');
        }
    }

    // Test function to verify modal exists
    window.testModal = function() {
        const modal = document.getElementById('appointmentManagementModal');
        if (modal) {
            console.log('Modal found!');
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
        } else {
            console.error('Modal not found!');
        }
    };

    // Test function for complete appointment button
    window.testCompleteButton = function() {
        console.log('=== TESTING COMPLETE APPOINTMENT BUTTON ===');
        const completeBtn = document.getElementById('complete-appointment-btn');
        if (completeBtn) {
            console.log('Complete button found:', completeBtn);
            console.log('Button text:', completeBtn.textContent);
            console.log('Button disabled:', completeBtn.disabled);
            console.log('Button visible:', completeBtn.offsetParent !== null);
            
            // Try to trigger the function directly
            console.log('Triggering complete appointment function...');
            completeAppointmentWithRecords();
        } else {
            console.error('Complete appointment button not found!');
        }
    };

    // Function to view medical records - make it globally available
    window.viewMedicalRecords = async function(appointmentId) {
        try {
            console.log('Fetching medical records for appointment:', appointmentId);
            
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/appointments/${appointmentId}/medical-records`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            
            if (result.success) {
                displayMedicalRecords(result.data);
                const modal = new bootstrap.Modal(document.getElementById('medicalRecordsViewModal'));
                modal.show();
            } else {
                alert('Medical records not found for this appointment.');
            }
        } catch (error) {
            console.error('Error fetching medical records:', error);
            alert('Error loading medical records. Please try again.');
        }
    };

    // Function to display medical records in modal
    function displayMedicalRecords(data) {
        const content = document.getElementById('medical-records-content');
        
        // Calculate age
        const birthDate = new Date(data.date_of_birth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0"><i class="bi bi-person-fill me-2"></i>Patient Information</h6>
                        </div>
                        <div class="card-body">
                            <p><strong>Name:</strong> ${data.patient_name}</p>
                            <p><strong>Age:</strong> ${age} years</p>
                            <p><strong>Gender:</strong> ${data.gender || 'N/A'}</p>
                            <p><strong>Blood Type:</strong> ${data.blood_type || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <div class="card mb-3">
                        <div class="card-header bg-warning text-dark">
                            <h6 class="mb-0"><i class="bi bi-exclamation-triangle-fill me-2"></i>Medical History</h6>
                        </div>
                        <div class="card-body">
                            <p><strong>Allergies:</strong> ${data.allergies || 'None reported'}</p>
                            <p><strong>Current Medications:</strong> ${data.current_medications || 'None reported'}</p>
                            <p><strong>Medical Conditions:</strong> ${data.medical_conditions || 'None reported'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header bg-info text-white">
                            <h6 class="mb-0"><i class="bi bi-calendar-event me-2"></i>Appointment Details</h6>
                        </div>
                        <div class="card-body">
                            <p><strong>Date:</strong> ${new Date(data.appointment_date).toLocaleDateString()}</p>
                            <p><strong>Reason:</strong> ${data.appointment_reason}</p>
                            <p><strong>Session Duration:</strong> ${data.session_duration || 'N/A'}</p>
                            <p><strong>Session Start:</strong> ${data.session_start_time || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <div class="card mb-3">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0"><i class="bi bi-clipboard2-pulse me-2"></i>Medical Records</h6>
                        </div>
                        <div class="card-body">
                            <p><strong>Symptoms:</strong> ${data.symptoms || 'N/A'}</p>
                            <p><strong>Diagnosis:</strong> ${data.diagnosis || 'N/A'}</p>
                            <p><strong>Treatment:</strong> ${data.treatment || 'N/A'}</p>
                            <p><strong>Prescribed Medicines:</strong> ${data.prescribed_medicines || 'N/A'}</p>
                            <p><strong>Follow-up Instructions:</strong> ${data.follow_up || 'N/A'}</p>
                            <p><strong>Doctor Notes:</strong> ${data.doctor_notes || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Make viewMedicalRecords globally accessible
    window.viewMedicalRecords = viewMedicalRecords;

    function renderCompletedAppointments() {
        console.log('=== DEBUG: renderCompletedAppointments called ===');
        console.log('scheduleData.pastAppointments:', scheduleData?.pastAppointments);
        
        if (!scheduleData) {
            console.log('No scheduleData available for completed appointments');
            return;
        }
        
        const tbody = document.getElementById('completed-appointments-tbody');
        const countEl = document.getElementById('completed-count');
        const pageEl = document.getElementById('completed-page');
        
        if (!tbody) {
            console.log('completed-appointments-tbody element not found');
            return;
        }
        
        // Get all appointments and filter for completed ones
        const allAppointments = [
            ...(scheduleData.todayAppointments || []),
            ...(scheduleData.upcomingAppointments || []),
            ...(scheduleData.pastAppointments || [])
        ];
        
        // Filter only completed appointments and sort by date (most recent first)
        const completedAppointments = allAppointments
            .filter(apt => apt.status === 'Completed')
            .sort((a, b) => {
                const dateA = new Date(a.appointment_date || a.date);
                const dateB = new Date(b.appointment_date || b.date);
                return dateB - dateA; // Most recent first
            });
        console.log('Completed appointments:', completedAppointments);
        
        const totalPages = Math.ceil(completedAppointments.length / appointmentsPerPage);
        const startIndex = (currentCompletedPage - 1) * appointmentsPerPage;
        const endIndex = startIndex + appointmentsPerPage;
        const pageAppointments = completedAppointments.slice(startIndex, endIndex);
        
        // Update tab count
        const tabCount = document.getElementById('completed-tab-count');
        if (tabCount) {
            tabCount.textContent = completedAppointments.length;
        }
        
        if (pageAppointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No completed appointments found</td></tr>';
            if (countEl) countEl.textContent = '';
            if (pageEl) pageEl.textContent = '';
            return;
        }

        tbody.innerHTML = pageAppointments.map(appointment => {
            // Handle different date field names and formats
            const appointmentDate = appointment.appointment_date || appointment.date;
            const date = new Date(appointmentDate);
            
            // Check if date is valid
            const dateStr = !isNaN(date.getTime()) ? date.toLocaleDateString() : 'Invalid Date';
            const timeStr = !isNaN(date.getTime()) ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Invalid Time';
            
            // Handle different patient name field names
            const patientName = appointment.patient_name || appointment.patientName || appointment.name || 'Unknown Patient';
            
            const statusBadge = getStatusBadge(appointment.status);
            
            const actionButtons = `<button class="btn btn-success btn-sm" onclick="viewMedicalRecords(${appointment.appointment_id})" title="View Medical Records">
                <i class="bi bi-clipboard2-pulse"></i> View Records
            </button>`;

            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${timeStr}</td>
                    <td>${patientName}</td>
                    <td>${appointment.reason || 'No reason specified'}</td>
                    <td>${statusBadge}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        }).join('');
        
        // Update pagination info
        if (countEl) {
            countEl.textContent = `Showing ${startIndex + 1}-${Math.min(endIndex, completedAppointments.length)} of ${completedAppointments.length} appointments`;
        }
        if (pageEl) {
            pageEl.textContent = `Page ${currentCompletedPage} of ${totalPages}`;
        }
        
        // Update pagination buttons
        const prevBtn = document.getElementById('completed-prev');
        const nextBtn = document.getElementById('completed-next');
        if (prevBtn) prevBtn.disabled = currentCompletedPage === 1;
        if (nextBtn) nextBtn.disabled = currentCompletedPage === totalPages;
    }

    // Add pagination event handlers for completed appointments
    document.addEventListener('DOMContentLoaded', function() {
        const completedPrevBtn = document.getElementById('completed-prev');
        const completedNextBtn = document.getElementById('completed-next');
        
        if (completedPrevBtn) {
            completedPrevBtn.onclick = () => {
                if (currentCompletedPage > 1) {
                    currentCompletedPage--;
                    renderCompletedAppointments();
                }
            };
        }
        
        if (completedNextBtn) {
            completedNextBtn.onclick = () => {
                const allAppointments = [
                    ...(scheduleData?.todayAppointments || []),
                    ...(scheduleData?.upcomingAppointments || []),
                    ...(scheduleData?.pastAppointments || [])
                ];
                const completedAppointments = allAppointments.filter(apt => apt.status === 'Completed');
                const totalPages = Math.ceil(completedAppointments.length / appointmentsPerPage);
                if (currentCompletedPage < totalPages) {
                    currentCompletedPage++;
                    renderCompletedAppointments();
                }
            };
        }
        
        // Add pagination event handlers for past appointments
        const pastPrevBtn = document.getElementById('past-prev');
        const pastNextBtn = document.getElementById('past-next');
        
        if (pastPrevBtn) {
            pastPrevBtn.onclick = () => {
                if (currentPastPage > 1) {
                    currentPastPage--;
                    renderPastAppointments();
                }
            };
        }
        
        if (pastNextBtn) {
            pastNextBtn.onclick = () => {
                const pastAppointments = scheduleData?.pastAppointments?.filter(apt => apt.status !== 'Completed') || [];
                const totalPages = Math.ceil(pastAppointments.length / appointmentsPerPage);
                if (currentPastPage < totalPages) {
                    currentPastPage++;
                    renderPastAppointments();
                }
            };
        }
    });

    // Update view toggle buttons
    document.addEventListener('change', function(e) {
        if (e.target.name === 'view') {
            // Remove active class from all buttons
            document.querySelectorAll('.view-toggle-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // Add active class to selected button
            document.querySelector(`label[for="${e.target.id}"]`).classList.add('active');
            
            // Update current view and re-render
            if (e.target.id === 'view-daily') {
                currentView = 'daily';
                scheduleGridEl.className = 'daily-schedule-grid';
            } else if (e.target.id === 'view-weekly') {
                currentView = 'weekly';
                scheduleGridEl.className = 'weekly-schedule-grid';
            } else if (e.target.id === 'view-monthly') {
                currentView = 'monthly';
                scheduleGridEl.className = 'monthly-calendar';
            }
            
            // Re-fetch and render schedule for new view
            fetchAndRenderSchedule();
        }
    });

    // Logout function
    window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        window.location.href = '/login.html';
    };
});

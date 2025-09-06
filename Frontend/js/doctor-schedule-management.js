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
    const calendarCurrentDateEl = document.getElementById('calendar-current-date');
    const currentAppointmentsDateEl = document.getElementById('current-date-appointments');
    const scheduleGridEl = document.getElementById('schedule-grid');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const prevDateBtn = document.getElementById('prev-date-btn');
    const nextDateBtn = document.getElementById('next-date-btn');
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
    doctorAvailabilityToggle.addEventListener('change', updateAvailability);
    saveSettingsBtn.addEventListener('click', saveQuickSettings);
    prevDateBtn.addEventListener('click', () => navigateDate('prev'));
    nextDateBtn.addEventListener('click', () => navigateDate('next'));
    todayBtn.addEventListener('click', () => navigateDate('today'));
    viewToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                currentView = e.target.dataset.view;
                fetchAndRenderSchedule();
            }
        });
    });
    saveBlockTimeBtn.addEventListener('click', handleBlockTime);
    saveAvailabilityBtn.addEventListener('click', handleSetAvailability);
    submitLeaveRequestBtn.addEventListener('click', handleLeaveRequest);


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
    document.getElementById('block-recurring').addEventListener('change', function() {
        document.querySelector('.recurring-options').classList.toggle('d-none', !this.checked);
    });

    // Set minimum date for leave request to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('leave-start-date').min = today;
    document.getElementById('leave-end-date').min = today;

    // Update end date minimum when start date changes
    document.getElementById('leave-start-date').addEventListener('change', function() {
        const startDate = this.value;
        const endDateInput = document.getElementById('leave-end-date');
        endDateInput.min = startDate;
        
        // If end date is before new start date, clear it
        if (endDateInput.value && endDateInput.value < startDate) {
            endDateInput.value = '';
        }
    });

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

    // Functions
    async function initializePage() {
        updateDateDisplay();
        await fetchAndRenderSchedule();
        await fetchLeaveData();
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
            // Render daily view with improved styling
            gridData.forEach(slot => {
                const slotEl = document.createElement('div');
                slotEl.className = `time-slot schedule-card ${slot.status}`;
                
                let slotContent = `
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="time-slot-time fw-bold fs-5">${slot.time}</span>
                        <span class="badge ${getStatusBadgeClass(slot.status)}">${slot.status}</span>
                    </div>
                `;
                
                if (slot.status === 'booked') {
                    slotContent += `
                        <div class="time-slot-patient mb-2">
                            <strong>${slot.patientName}</strong>
                            <br><small class="text-muted">${slot.reason || 'No reason specified'}</small>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary view-appointment" data-id="${slot.id}">
                                <i class="bi bi-eye me-1"></i>View
                            </button>
                            <button class="btn btn-sm btn-outline-success start-appointment" data-id="${slot.id}">
                                <i class="bi bi-play-circle me-1"></i>Start
                            </button>
                        </div>
                    `;
                } else if (slot.status === 'available') {
                    slotContent += `
                        <div class="time-slot-patient mb-2">
                            <small class="text-muted">Available for booking</small>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-warning block-slot" data-time="${slot.time}">
                                <i class="bi bi-slash-circle me-1"></i>Block
                            </button>
                            <button class="btn btn-sm btn-outline-success add-slot" data-time="${slot.time}">
                                <i class="bi bi-plus-circle me-1"></i>Add Slot
                            </button>
                        </div>
                    `;
                } else if (slot.status === 'blocked') {
                    slotContent += `
                        <div class="time-slot-patient mb-2">
                            <small class="text-muted">${slot.reason || 'Blocked'}</small>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-danger unblock-slot" data-id="${slot.id}">
                                <i class="bi bi-unlock me-1"></i>Unblock
                            </button>
                        </div>
                    `;
                } else if (slot.status === 'past') {
                    slotContent += `
                        <div class="time-slot-patient mb-2">
                            <small class="text-muted">${slot.patientName || 'Past appointment'}</small>
                        </div>
                    `;
                }
                
                slotEl.innerHTML = slotContent;
                scheduleGridEl.appendChild(slotEl);
                
                // Add event listeners to buttons
                if (slot.status === 'booked') {
                    slotEl.querySelector('.view-appointment')?.addEventListener('click', () => viewAppointment(slot.id));
                    slotEl.querySelector('.start-appointment')?.addEventListener('click', () => startAppointment(slot.id));
                } else if (slot.status === 'available') {
                    slotEl.querySelector('.block-slot')?.addEventListener('click', () => openBlockModal(slot.time));
                    slotEl.querySelector('.add-slot')?.addEventListener('click', () => openAddSlotModal(slot.time));
                } else if (slot.status === 'blocked') {
                    slotEl.querySelector('.unblock-slot')?.addEventListener('click', () => unblockSlot(slot.id));
                }
            });
        } else if (currentView === 'weekly') {
            renderWeeklyView(gridData);
        } else if (currentView === 'monthly') {
            renderMonthlyView(gridData);
        }
    }

    function renderWeeklyView(gridData) {
        const weeklyContainer = document.createElement('div');
        weeklyContainer.className = 'weekly-grid';
        
        // Create header row with days
        const headerRow = document.createElement('div');
        headerRow.className = 'weekly-row header';
        
        // Add time column header
        const timeHeader = document.createElement('div');
        timeHeader.className = 'weekly-cell time-header';
        timeHeader.textContent = 'Time';
        headerRow.appendChild(timeHeader);
        
        // Add day column headers
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        days.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'weekly-cell day-header';
            dayHeader.textContent = day;
            headerRow.appendChild(dayHeader);
        });
        
        weeklyContainer.appendChild(headerRow);
        
        // Create time rows
        const timeSlots = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
        timeSlots.forEach(time => {
            const timeRow = document.createElement('div');
            timeRow.className = 'weekly-row';
            
            // Add time cell
            const timeCell = document.createElement('div');
            timeCell.className = 'weekly-cell time-cell';
            timeCell.textContent = time;
            timeRow.appendChild(timeCell);
            
            // Add day cells
            days.forEach(day => {
                const dayCell = document.createElement('div');
                dayCell.className = 'weekly-cell day-cell';
                
                // Find slot for this day and time if it exists
                const slot = gridData.find(s => s.day === day && s.time === time);
                if (slot) {
                    dayCell.classList.add(slot.status);
                    if (slot.status === 'booked') {
                        dayCell.innerHTML = `<small>${slot.patientName}</small>`;
                        dayCell.addEventListener('click', () => viewAppointment(slot.id));
                    } else if (slot.status === 'blocked') {
                        dayCell.innerHTML = `<small>${slot.reason || 'Blocked'}</small>`;
                    }
                } else {
                    dayCell.classList.add('no-slot');
                    // Add add-slot button for available slots
                    const addBtn = document.createElement('button');
                    addBtn.className = 'add-slot-btn';
                    addBtn.innerHTML = '<i class="bi bi-plus"></i>';
                    addBtn.addEventListener('click', () => openAddSlotModal(time, day));
                    dayCell.appendChild(addBtn);
                }
                
                timeRow.appendChild(dayCell);
            });
            
            weeklyContainer.appendChild(timeRow);
        });
        
        scheduleGridEl.appendChild(weeklyContainer);
    }

    function renderMonthlyView(gridData) {
        const monthlyContainer = document.createElement('div');
        monthlyContainer.className = 'monthly-grid';
        
        // Create header row with days of week
        const headerRow = document.createElement('div');
        headerRow.className = 'monthly-row header';
        
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'monthly-cell day-header';
            dayHeader.textContent = day;
            headerRow.appendChild(dayHeader);
        });
        
        monthlyContainer.appendChild(headerRow);
        
        // Get first day of month and total days in month
        const year = currentScheduleDate.getFullYear();
        const month = currentScheduleDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Create calendar grid
        let dayCount = 1;
        for (let i = 0; i < 6; i++) { // 6 rows max in a month view
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
                    const dayAppointments = gridData.filter(s => s.date === dayString && s.status === 'booked');
                    const dayBlocked = gridData.filter(s => s.date === dayString && s.status === 'blocked');
                    
                    if (dayAppointments.length > 0) {
                        dayCell.classList.add('has-appointments');
                        const appointmentCount = document.createElement('div');
                        appointmentCount.className = 'appointment-count';
                        appointmentCount.textContent = dayAppointments.length;
                        dayCell.appendChild(appointmentCount);
                    }
                    
                    if (dayBlocked.length > 0) {
                        dayCell.classList.add('has-blocked');
                    }
                    
                    // Highlight current day
                    const today = new Date();
                    if (dayDate.getDate() === today.getDate() && 
                        dayDate.getMonth() === today.getMonth() && 
                        dayDate.getFullYear() === today.getFullYear()) {
                        dayCell.classList.add('today');
                    }
                    
                    // Add click event to view day
                    dayCell.addEventListener('click', () => {
                        currentScheduleDate = new Date(year, month, dayCount);
                        currentView = 'daily';
                        document.getElementById('view-daily').checked = true;
                        updateDateDisplay();
                        fetchAndRenderSchedule();
                    });
                    
                    dayCount++;
                }
                
                weekRow.appendChild(dayCell);
            }
            
            monthlyContainer.appendChild(weekRow);
            
            // Break if we've displayed all days
            if (dayCount > daysInMonth) break;
        }
        
        scheduleGridEl.appendChild(monthlyContainer);
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

    let confirmedPage = 1;
    let upcomingPage = 1;
    let pastPage = 1;
    const pageSize = 10;

    function renderAppointmentTabs() {
        if (!scheduleData) return;
        
        renderConfirmedAppointments();
        renderUpcomingAppointments();
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
        
        // Filter for visible (non-cancelled/non-completed) appointments for the selected date
        const confirmedAppointments = appointmentsSource.filter(a => {
            const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
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
            
            tr.innerHTML = `
                <td>${formattedDate}</td>
                    <td>${a.time || '-'}</td>
                    <td>${a.patientName || 'Unknown Patient'}</td>
                    <td>${a.reason || 'No reason specified'}</td>
                    <td><span class="badge ${getStatusBadgeClass(a.status || 'Unknown')}">${a.status || 'Unknown'}</span></td>
                    <td>${actionButtons}</td>
                `;
                
                            // Add event listeners for action buttons
            const apptId = a.appointment_id || a.id;
                tr.querySelector('.appt-start')?.addEventListener('click', () => {
                    startAppointment(apptId);
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
        
        // Use upcoming appointments from API response
        const upcomingAppointments = (scheduleData.upcomingAppointments || []).filter(a => {
            const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            return matchesQ;
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
                
                tr.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td>${a.patientName}</td>
                    <td>${a.reason || 'No reason specified'}</td>
                    <td><span class="badge ${getStatusBadgeClass(a.status)}">${a.status}</span></td>
                `;
                
                upcomingTbody.appendChild(tr);
            });
        }
        
        // Update pagination info
        if (countEl) countEl.textContent = `Showing ${Math.min(start + 1, total)} to ${Math.min(start + pageSize, total)} of ${total} upcoming appointments`;
        if (pageEl) pageEl.textContent = `Page ${upcomingPage}`;
        
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
        
        // Get all appointments and filter for past ones (completed or cancelled)
        const basePast = scheduleData.pastAppointments || [];
        const pastAppointments = basePast.filter(a => {
            const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            return matchesQ;
        });
        
        const total = pastAppointments.length;
        const start = (pastPage - 1) * pageSize;
        const pageItems = pastAppointments.slice(start, start + pageSize);
        
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
                
                tr.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td>${a.patientName}</td>
                    <td>${a.reason || 'No reason specified'}</td>
                    <td><span class="badge ${getStatusBadgeClass(a.status)}">${a.status}</span></td>
                `;
                
                pastTbody.appendChild(tr);
            });
        }
        
        // Update pagination info
        if (countEl) countEl.textContent = `Showing ${Math.min(start + 1, total)} to ${Math.min(start + pageSize, total)} of ${total} past appointments`;
        if (pageEl) pageEl.textContent = `Page ${pastPage}`;
        
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
            case 'cancelled': return 'bg-secondary';
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
        // Initial load
        console.log('Initializing schedule management...');
        updateDateDisplay();
        fetchAndRenderSchedule();
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
                body: JSON.stringify({ isAvailable })
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

    async function unblockSlot(blockId) {
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
                        const startTime = row.querySelector('input[type="time"]:nth-child(1)').value;
                        const endTime = row.querySelector('input[type="time"]:nth-child(2)').value;
                        
                        availability[day].slots.push({
                            startTime,
                            endTime
                        });
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

    async function viewAppointment(appointmentId) {
        try {
            const modalBody = document.getElementById('appointment-modal-body');
            modalBody.innerHTML = '<div class="text-center"><i class="bi bi-hourglass-split"></i> Loading appointment details...</div>';
            
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
            const appointmentDate = new Date(appointment.appointment_date || appointment.date);
            const formattedDate = appointmentDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            let notesSection = '';
            if (appointment.notes) {
                notesSection = `
                    <div class="appointment-notes">
                        <h6 class="text-primary mb-2"><i class="bi bi-chat-text me-2"></i>Patient Notes</h6>
                        <p class="mb-0">${appointment.notes}</p>
                    </div>
                `;
            }
            
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
                    ${notesSection}
                    ${appointment.status === 'Completed' ? '' : `
                    <div class="row mb-3">
                        <div class="col-12">
                            <h6 class="text-muted mb-1">Add/Edit Notes</h6>
                            <textarea class="form-control" id="appointment-notes" rows="3" placeholder="Add your notes here...">${appointment.notes || ''}</textarea>
                            <button class="btn btn-primary mt-2" id="save-notes-btn">
                                <i class="bi bi-save me-1"></i>Save Notes
                            </button>
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
            
            // Show the modal
            const appointmentModal = new bootstrap.Modal(document.getElementById('appointmentModal'));
            appointmentModal.show();
            
        } catch (error) {
            console.error('Error fetching appointment details:', error);
            document.getElementById('appointment-modal-body').innerHTML = 
                '<div class="text-center text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Failed to load appointment details. Please try again.</div>';
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

    async function unblockSlot(blockId) {
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
                        const startTime = row.querySelector('input[type="time"]:nth-child(1)').value;
                        const endTime = row.querySelector('input[type="time"]:nth-child(2)').value;
                        
                        availability[day].slots.push({
                            startTime,
                            endTime
                        });
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
                body: JSON.stringify({ isAvailable })
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

    // Logout function
    window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        window.location.href = '/login.html';
    };
});

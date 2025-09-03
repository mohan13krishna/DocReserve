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
    const slotSaveBtn = document.getElementById('slot-save-btn');

    // State variables
    let currentScheduleDate = new Date();
    let currentView = 'daily';
    let scheduleData = null;

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
    slotSaveBtn.addEventListener('click', handleAddSlot);

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
    }

    async function fetchAndRenderSchedule() {
        try {
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

            scheduleData = await response.json();

            // Update doctor info
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            doctorFullNameEl.textContent = `Dr. ${decodedToken.first_name} ${decodedToken.last_name}`;
            doctorInitialsEl.textContent = `${decodedToken.first_name.charAt(0)}${decodedToken.last_name.charAt(0)}`.toUpperCase();
            doctorAvailabilityToggle.checked = scheduleData.doctorInfo.is_available;
            availabilityStatusEl.textContent = scheduleData.doctorInfo.is_available ? 'Available' : 'Busy';

            // Render schedule grid
            renderScheduleGrid(scheduleData.scheduleGrid);
            
            // Render appointment tabs
            renderAppointmentTabs();
            
            // Populate quick settings
            populateQuickSettings(scheduleData.quickSettings);
            
        } catch (error) {
            console.error('Error fetching schedule data:', error);
            alert('Failed to load schedule data. Please try again later.');
        }
    }

    function renderScheduleGrid(gridData) {
        if (!scheduleGridEl) return;
        
        scheduleGridEl.innerHTML = '';
        
        if (currentView === 'daily') {
            // Render daily view
            gridData.forEach(slot => {
                const slotEl = document.createElement('div');
                slotEl.className = `time-slot p-2 rounded-3 mb-2 d-flex flex-column ${slot.status}`;
                
                let slotContent = `
                    <span class="time-slot-time fw-bold">${slot.time}</span>
                `;
                
                if (slot.status === 'booked') {
                    slotContent += `
                        <span class="time-slot-patient small">${slot.patientName}</span>
                        <div class="d-flex mt-1 gap-1">
                            <button class="btn btn-sm btn-outline-primary view-appointment" data-id="${slot.id}">View</button>
                            <button class="btn btn-sm btn-outline-secondary start-appointment" data-id="${slot.id}">Start</button>
                        </div>
                    `;
                } else if (slot.status === 'available') {
                    slotContent += `
                        <span class="time-slot-patient small">Available</span>
                        <div class="d-flex mt-1 gap-1">
                            <button class="btn btn-sm btn-outline-warning block-slot" data-time="${slot.time}">Block</button>
                        </div>
                    `;
                } else if (slot.status === 'blocked') {
                    slotContent += `
                        <span class="time-slot-patient small">${slot.reason || 'Blocked'}</span>
                        <div class="d-flex mt-1 gap-1">
                            <button class="btn btn-sm btn-outline-danger unblock-slot" data-id="${slot.id}">Unblock</button>
                        </div>
                    `;
                } else if (slot.status === 'past') {
                    slotContent += `
                        <span class="time-slot-patient small">${slot.patientName || 'Past'}</span>
                    `;
                }
                
                slotEl.innerHTML = slotContent;
                scheduleGridEl.appendChild(slotEl);
                
                // Add event listeners to buttons
                if (slot.status === 'booked') {
                    slotEl.querySelector('.view-appointment').addEventListener('click', () => viewAppointment(slot.id));
                    slotEl.querySelector('.start-appointment').addEventListener('click', () => startAppointment(slot.id));
                } else if (slot.status === 'available') {
                    slotEl.querySelector('.block-slot').addEventListener('click', () => openBlockModal(slot.time));
                } else if (slot.status === 'blocked') {
                    slotEl.querySelector('.unblock-slot').addEventListener('click', () => unblockSlot(slot.id));
                }
            });
        } else if (currentView === 'weekly') {
            // Render weekly view
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
                    }
                    
                    timeRow.appendChild(dayCell);
                });
                
                weeklyContainer.appendChild(timeRow);
            });
            
            scheduleGridEl.appendChild(weeklyContainer);
        } else if (currentView === 'monthly') {
            // Render monthly view (calendar style)
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
        
        console.log('Schedule data:', scheduleData);
        console.log('Today appointments:', scheduleData.todayAppointments);
        console.log('All appointments:', scheduleData.appointments);
        
        const searchEl = document.getElementById('appointments-search');
        const pageEl = document.getElementById('confirmed-page');
        const countEl = document.getElementById('confirmed-count');
        
        const q = (searchEl?.value || '').toLowerCase();
        
        // Use appointments array if todayAppointments doesn't exist
        const appointmentsSource = scheduleData.todayAppointments || scheduleData.appointments || [];
        console.log('Appointments source:', appointmentsSource);
        
        // Filter for confirmed and in-progress appointments for the selected date
        const confirmedAppointments = appointmentsSource.filter(a => {
            const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            // Accept any status for now to see what data we have
            const isConfirmedOrInProgress = true; // Temporarily show all appointments
            console.log(`Appointment ${a.patientName}: status=${a.status}, matches=${isConfirmedOrInProgress}`);
            return matchesQ && isConfirmedOrInProgress;
        });
        
        console.log('Filtered confirmed appointments:', confirmedAppointments);
        
        const total = confirmedAppointments.length;
        const start = (confirmedPage - 1) * pageSize;
        const pageItems = confirmedAppointments.slice(start, start + pageSize);
        
        confirmedTbody.innerHTML = '';
        
        if (pageItems.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" class="text-center">No confirmed appointments for this date</td>`;
            confirmedTbody.appendChild(tr);
        } else {
            pageItems.forEach(a => {
                const tr = document.createElement('tr');
                tr.dataset.id = a.id;
                
                // Add action buttons based on appointment status
                let actionButtons = '';
                if (a.status === 'Confirmed') {
                    actionButtons = `
                        <button class="btn btn-sm btn-outline-primary me-1 appt-start">
                            <i class="bi bi-play-circle"></i> Start
                        </button>
                        <button class="btn btn-sm btn-outline-secondary appt-view">
                            <i class="bi bi-eye"></i> View
                        </button>
                    `;
                } else if (a.status === 'In Progress') {
                    actionButtons = `
                        <button class="btn btn-sm btn-success me-1 appt-complete">
                            <i class="bi bi-check2-circle"></i> Complete
                        </button>
                        <button class="btn btn-sm btn-outline-secondary appt-view">
                            <i class="bi bi-eye"></i> View
                        </button>
                    `;
                }
                
                tr.innerHTML = `
                    <td>${a.time}</td>
                    <td>${a.patientName}</td>
                    <td>${a.reason || ''}</td>
                    <td><span class="badge ${getStatusBadgeClass(a.status)}">${a.status}</span></td>
                    <td>${actionButtons}</td>
                `;
                
                // Add event listeners for action buttons
                const apptId = a.appointment_id;
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
        
        // Get only next day confirmed appointments
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(tomorrow.getDate() + 1);
        dayAfterTomorrow.setHours(0, 0, 0, 0);
        
        const upcomingAppointments = (scheduleData.upcomingAppointments || []).filter(a => {
            const matchesQ = !q || a.patientName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            const apptDate = new Date(a.date || a.appointment_date);
            apptDate.setHours(0, 0, 0, 0);
            
            // Only show confirmed appointments for next day only
            const isNextDay = apptDate.getTime() >= tomorrow.getTime() && apptDate.getTime() < dayAfterTomorrow.getTime();
            const isConfirmed = a.status === 'Confirmed';
            
            return matchesQ && isNextDay && isConfirmed;
        });
        
        const total = upcomingAppointments.length;
        const start = (upcomingPage - 1) * pageSize;
        const pageItems = upcomingAppointments.slice(start, start + pageSize);
        
        upcomingTbody.innerHTML = '';
        
        if (pageItems.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" class="text-center">No confirmed appointments for next day</td>`;
            upcomingTbody.appendChild(tr);
        } else {
            pageItems.forEach(a => {
                const tr = document.createElement('tr');
                tr.dataset.id = a.id;
                
                const appointmentDate = new Date(a.date || a.appointment_date);
                const formattedDate = appointmentDate.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                });
                
                tr.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${a.time}</td>
                    <td>${a.patientName}</td>
                    <td>${a.reason || ''}</td>
                    <td><span class="badge ${getStatusBadgeClass(a.status)}">${a.status}</span></td>
                `;
                
                upcomingTbody.appendChild(tr);
            });
        }
        
        // Update pagination info
        if (countEl) countEl.textContent = `Showing ${Math.min(start + 1, total)} to ${Math.min(start + pageSize, total)} of ${total} past appointments`;
        if (pageEl) pageEl.textContent = `Page ${pastPage}`;
        
        // Update pagination buttons
        const prevBtn = document.getElementById('past-prev');
        const nextBtn = document.getElementById('past-next');
        if (prevBtn) prevBtn.disabled = pastPage <= 1;
        if (nextBtn) nextBtn.disabled = start + pageSize >= total;
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

    function getStatusBadgeClass(status) {
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

    // Initial load
    console.log('Initializing schedule management...');
    updateDateDisplay();
    fetchAndRenderSchedule();

    // Logout function
    window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        window.location.href = '/login.html';
    };
});

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) return (window.location.href = '/login.html');
  const url = new URL(window.location.href);
  const appointmentId = url.searchParams.get('appointmentId');

  const apptDate = document.getElementById('appt-date');
  const apptTime = document.getElementById('appt-time');
  const apptReason = document.getElementById('appt-reason');
  const bookBtn = document.getElementById('book-btn');

  // If rescheduling existing appointment, load details
  if (appointmentId) {
    try {
      const resp = await fetch(`/api/patient/appointments/${appointmentId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) {
        const app = await resp.json();
        // Pre-fill doctor and date/time
        const d = new Date(app.appointment_date);
        apptDate.value = d.toISOString().split('T')[0];
        // Doctor can't be changed in this basic flow; we just populate times accordingly
        window.selectedDoctorId = app.doctor_id;
        document.getElementById('doctor-search').value = app.doctorName.replace(/^Dr\.\s*/, '');
        await loadAvailability();
        // Try to match nearest time in dropdown
        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        apptTime.value = timeStr;
        apptReason.value = app.reason || '';
        // Update button text
        bookBtn.textContent = 'Reschedule Appointment';
      }
    } catch (e) { console.warn('Failed to load existing appointment', e); }
  }

  async function loadAvailability() {
    apptTime.innerHTML = '<option value="">Select a time</option>';
    if (!window.selectedDoctorId || !apptDate.value) return;
    try {
      const resp = await fetch(`/api/patient/doctors/${window.selectedDoctorId}/availability?date=${apptDate.value}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        console.error('Error fetching availability:', resp.status, resp.statusText);
        apptTime.innerHTML = '<option value="" disabled>Error loading time slots</option>';
        return;
      }
      
      // Check if response is HTML instead of JSON (common server error)
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('Error fetching availability: Server returned HTML instead of JSON');
        apptTime.innerHTML = '<option value="" disabled>Error: Server returned invalid data</option>';
        return;
      }
      
      const data = await resp.json();
      data.schedule.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.time;
        opt.textContent = `${s.time} ${s.status === 'Booked' ? '(Booked)' : s.status === 'Blocked' ? '(Blocked)' : ''}`;
        opt.disabled = s.status !== 'Available';
        apptTime.appendChild(opt);
      });
    } catch (error) {
      console.error('Error fetching availability:', error);
      apptTime.innerHTML = '<option value="" disabled>Error loading time slots</option>';
    }
  }

  // Expose for search quick pick to call after doctor selection
  window.loadAvailability = loadAvailability;
});


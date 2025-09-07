const db = require('../models/db');

exports.getDoctorSchedule = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { date, view } = req.query; // Get date and view from the query string

        if (!doctorId) {
            return res.status(400).json({ message: 'Doctor ID not found for this user.' });
        }
        
        
        // Fetch doctor info and quick settings in one go
        const [doctorInfoRows] = await db.execute(`
            SELECT doctor_id, first_name, last_name, is_available FROM doctors WHERE doctor_id = ?
        `, [doctorId]);
        
        
        if (!doctorInfoRows.length) {
            return res.status(404).json({ message: 'Doctor not found in database.' });
        }

        // Fetch today's appointments based on the current date
        // Use database server date to avoid timezone mismatches
        
        // First, let's check if this doctor exists and get all their appointments
        const [allAppointments] = await db.execute(`
            SELECT
                a.appointment_id,
                a.appointment_date,
                a.reason,
                a.status,
                a.doctor_id,
                p.first_name AS patient_first_name,
                p.last_name AS patient_last_name
            FROM Appointments a
            JOIN Patients p ON a.patient_id = p.patient_id
            WHERE a.doctor_id = ?
            ORDER BY a.appointment_date DESC;
        `, [doctorId]);
        
        
        // Now fetch today's appointments
        const [todayAppointments] = await db.execute(`
            SELECT
                a.appointment_id,
                a.appointment_date,
                a.reason,
                a.status,
                p.first_name AS patient_first_name,
                p.last_name AS patient_last_name
            FROM Appointments a
            JOIN Patients p ON a.patient_id = p.patient_id
            WHERE a.doctor_id = ?
            AND DATE(a.appointment_date) = CURDATE()
            ORDER BY a.appointment_date ASC;
        `, [doctorId]);
        
        // If no appointments today, let's also check for any appointments this week to provide some data
        let fallbackAppointments = [];
        if (todayAppointments.length === 0) {
            const [weekAppointments] = await db.execute(`
                SELECT
                    a.appointment_id,
                    a.appointment_date,
                    a.reason,
                    a.status,
                    p.first_name AS patient_first_name,
                    p.last_name AS patient_last_name
                FROM Appointments a
                JOIN Patients p ON a.patient_id = p.patient_id
                WHERE a.doctor_id = ?
                AND a.appointment_date >= CURDATE()
                AND a.appointment_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                ORDER BY a.appointment_date ASC
                LIMIT 5;
            `, [doctorId]);
            
            fallbackAppointments = weekAppointments;
        }

        // Fetch recent patients (last 7 days)
        const [recentPatients] = await db.execute(`
            SELECT DISTINCT 
                p.patient_id,
                p.first_name,
                p.last_name,
                p.gender,
                p.date_of_birth,
                MAX(a.appointment_date) as last_visit
            FROM patients p
            JOIN appointments a ON p.patient_id = a.patient_id
            WHERE a.doctor_id = ?
            AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY p.patient_id
            ORDER BY last_visit DESC
            LIMIT 10;
        `, [doctorId]);

        // Fetch upcoming appointments (next 30 days)
        const [upcomingAppointments] = await db.execute(`
            SELECT
                a.appointment_id,
                a.appointment_date,
                a.reason,
                a.status,
                p.first_name AS patient_first_name,
                p.last_name AS patient_last_name
            FROM Appointments a
            JOIN Patients p ON a.patient_id = p.patient_id
            WHERE a.doctor_id = ?
            AND a.appointment_date > NOW()
            AND a.appointment_date <= DATE_ADD(NOW(), INTERVAL 30 DAY)
            AND status IN ('Upcoming', 'Confirmed', 'Pending')
            ORDER BY a.appointment_date ASC
            LIMIT 50;
        `, [doctorId]);

        // Get count of upcoming appointments
        const [upcomingCount] = await db.execute(`
            SELECT COUNT(*) as count
            FROM Appointments
            WHERE doctor_id = ?
            AND appointment_date > NOW()
            AND status IN ('Upcoming', 'Confirmed', 'Pending');
        `, [doctorId]);

        // Fetch total patients count
        const [totalPatientsCount] = await db.execute(`
            SELECT COUNT(DISTINCT p.patient_id) as count
            FROM Patients p
            JOIN Appointments a ON p.patient_id = a.patient_id
            WHERE a.doctor_id = ?;
        `, [doctorId]);
        
        // Fetch past appointments (last 30 days)
        const [pastAppointments] = await db.execute(`
            SELECT
                a.appointment_id,
                a.appointment_date,
                a.reason,
                a.status,
                p.first_name AS patient_first_name,
                p.last_name AS patient_last_name
            FROM Appointments a
            JOIN Patients p ON a.patient_id = p.patient_id
            WHERE a.doctor_id = ?
            AND a.appointment_date < NOW()
            AND a.appointment_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ORDER BY a.appointment_date DESC
            LIMIT 100;
        `, [doctorId]);
        
        // Use today's appointments if available, otherwise use fallback
        const appointmentsToFormat = todayAppointments.length > 0 ? todayAppointments : fallbackAppointments;
        
        const formattedTodayAppointments = appointmentsToFormat.map(app => ({
            appointment_id: app.appointment_id,
            patientName: `${app.patient_first_name} ${app.patient_last_name}`,
            time: new Date(app.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            appointment_date: app.appointment_date,
            date: app.appointment_date,
            reason: app.reason,
            status: app.status
        }));

        const formattedRecentPatients = recentPatients.map(p => ({
            patient_id: p.patient_id,
            fullName: `${p.first_name} ${p.last_name}`,
            gender: p.gender,
            age: p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : 'N/A',
            lastVisit: p.last_visit ? new Date(p.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
            conditions: p.medical_conditions ? p.medical_conditions.split(',').map(c => c.trim()) : []
        }));

        const formattedUpcomingAppointments = upcomingAppointments.map(app => ({
            appointment_id: app.appointment_id,
            patientName: `${app.patient_first_name} ${app.patient_last_name}`,
            time: new Date(app.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            date: app.appointment_date,
            reason: app.reason,
            status: app.status
        }));
        
        const formattedPastAppointments = pastAppointments.map(app => ({
            appointment_id: app.appointment_id,
            patientName: `${app.patient_first_name} ${app.patient_last_name}`,
            time: new Date(app.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            date: app.appointment_date,
            reason: app.reason,
            status: app.status
        }));
        
        // --- Schedule Generation Logic (Daily View) ---
        let scheduleGrid = [];
        if (view === 'daily' && date) {
            // Fetch appointments for the requested date
            const [appointmentsForDate] = await db.execute(`
                SELECT a.appointment_date, p.first_name, p.last_name, a.reason, a.status
                FROM Appointments a
                JOIN Patients p ON a.patient_id = p.patient_id
                WHERE a.doctor_id = ? AND DATE(a.appointment_date) = ?
                ORDER BY a.appointment_date ASC;
            `, [doctorId, date]);
            
            const bookedSlots = appointmentsForDate.map(app => {
                const appTime = new Date(app.appointment_date);
                const timeString = appTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                return {
                    time: timeString,
                    patientName: `${app.first_name} ${app.last_name}`,
                    reason: app.reason,
                    status: app.status
                };
            });

            // Fetch blocked times for the date
            const [blockedTimes] = await db.execute(`
                SELECT blocked_time_id, start_time, end_time, reason
                FROM blocked_times
                WHERE doctor_id = ? AND blocked_date = ?
                ORDER BY start_time ASC;
            `, [doctorId, date]);

            // Generate a full day's schedule (e.g., 8:00 AM to 5:00 PM in 30-minute slots)
            let currentTime = new Date(date);
            currentTime.setHours(8, 0, 0, 0); // Start at 8:00 AM
            const endTime = new Date(date);
            endTime.setHours(17, 0, 0, 0); // End at 5:00 PM

            while (currentTime <= endTime) {
                const timeString = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                let slot = { time: timeString, status: 'Available', details: '' };

                // Check if this slot is booked
                const bookedSlot = bookedSlots.find(s => s.time === timeString);
                if (bookedSlot) {
                    slot.status = 'Booked';
                    slot.patientName = bookedSlot.patientName;
                    slot.reason = bookedSlot.reason;
                    slot.details = `${bookedSlot.patientName} - ${bookedSlot.reason}`;
                }
                
                // Check if this slot is blocked
                const blockedSlot = blockedTimes.find(bt => {
                    const startTime = new Date(`${date}T${bt.start_time}`);
                    const endTime = new Date(`${date}T${bt.end_time}`);
                    return currentTime >= startTime && currentTime < endTime;
                });
                
                if (blockedSlot) {
                    slot.status = 'Blocked';
                    slot.reason = blockedSlot.reason;
                    slot.id = blockedSlot.blocked_time_id;
                    slot.details = blockedSlot.reason;
                }

                scheduleGrid.push(slot);
                currentTime.setMinutes(currentTime.getMinutes() + 30); // Next 30-minute slot
            }
        }
        
        // --- Mock Quick Settings (replace with database fetch) ---
        const quickSettings = {
            defaultSlotDuration: '30',
            breakBetweenSlots: '15',
            autoConfirmBookings: true
        };

        res.status(200).json({
            doctorInfo: doctorInfoRows[0],
            todayAppointments: formattedTodayAppointments,
            recentPatients: formattedRecentPatients,
            upcomingAppointments: formattedUpcomingAppointments,
            upcomingAppointmentsCount: upcomingCount[0].count,
            totalPatients: totalPatientsCount[0].count,
            scheduleGrid: scheduleGrid,
            quickSettings: quickSettings,
            pastAppointments: formattedPastAppointments
        });

    } catch (error) {
        console.error('Error fetching doctor schedule:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.updateDoctorAvailability = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { is_available } = req.body;

        // Validate input parameters
        if (doctorId === undefined || doctorId === null) {
            return res.status(400).json({ message: 'Doctor ID is required.' });
        }

        if (is_available === undefined || is_available === null) {
            return res.status(400).json({ message: 'Availability status is required.' });
        }

        // Convert boolean to integer for MySQL
        const availabilityValue = is_available ? 1 : 0;

        await db.execute(
            'UPDATE doctors SET is_available = ? WHERE doctor_id = ?',
            [availabilityValue, doctorId]
        );

        res.status(200).json({ message: 'Availability updated successfully.' });
    } catch (error) {
        console.error('Error updating doctor availability:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getDoctorAvailability = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const [rows] = await db.execute(
            'SELECT is_available FROM doctors WHERE doctor_id = ?',
            [doctorId]
        );
        if (!rows.length) {
            return res.status(404).json({ message: 'Doctor not found.' });
        }
        res.status(200).json({ is_available: !!rows[0].is_available });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.updateQuickSettings = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { defaultSlotDuration, breakBetweenSlots, autoConfirmBookings } = req.body;

        // In a real application, you would save these settings to a database table
        // For now, we'll just return a success message.
        res.status(200).json({ message: 'Quick settings saved successfully!' });
    } catch (error) {
        console.error('Error updating quick settings:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.approveAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;
        const doctorId = req.user.doctor_id;

        // Update appointment status to Confirmed (matching database enum)
        const [result] = await db.execute(`
            UPDATE appointments 
            SET status = 'Confirmed' 
            WHERE appointment_id = ? AND doctor_id = ?
        `, [appointmentId, doctorId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found or unauthorized.' });
        }

        res.status(200).json({ message: 'Appointment approved successfully!' });
    } catch (error) {
        console.error('Error approving appointment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.cancelAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;
        const doctorId = req.user.doctor_id;

        // Update appointment status to Cancelled (matching database enum)
        const [result] = await db.execute(`
            UPDATE appointments 
            SET status = 'Cancelled' 
            WHERE appointment_id = ? AND doctor_id = ?
        `, [appointmentId, doctorId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found or unauthorized.' });
        }

        res.status(200).json({ message: 'Appointment cancelled successfully!' });
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.startAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;
        const doctorId = req.user.doctor_id;

        // Update appointment status to In Progress
        const [result] = await db.execute(`
            UPDATE appointments 
            SET status = 'In Progress' 
            WHERE appointment_id = ? AND doctor_id = ? AND status IN ('Pending', 'Confirmed')
        `, [appointmentId, doctorId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found, unauthorized, or cannot be started.' });
        }

        res.status(200).json({ message: 'Appointment started successfully!' });
    } catch (error) {
        console.error('Error starting appointment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.completeAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;
        const doctorId = req.user.doctor_id;
        const { notes } = req.body;

        // Update appointment status to Completed and add notes if provided
        const [result] = await db.execute(`
            UPDATE appointments 
            SET status = 'Completed', notes = COALESCE(?, notes)
            WHERE appointment_id = ? AND doctor_id = ? AND status = 'In Progress'
        `, [notes, appointmentId, doctorId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found, unauthorized, or not in progress.' });
        }

        res.status(200).json({ message: 'Appointment completed successfully!' });
    } catch (error) {
        console.error('Error completing appointment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getAppointmentDetails = async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;
        const doctorId = req.user.doctor_id;

        const [appointments] = await db.execute(`
            SELECT 
                a.appointment_id,
                a.appointment_date,
                a.reason,
                a.status,
                a.notes,
                p.first_name AS patient_first_name,
                p.last_name AS patient_last_name,
                p.phone_number AS patient_phone,
                p.date_of_birth,
                p.gender,
                p.medical_conditions,
                p.allergies,
                p.current_medications
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            WHERE a.appointment_id = ? AND a.doctor_id = ?
        `, [appointmentId, doctorId]);

        if (appointments.length === 0) {
            return res.status(404).json({ message: 'Appointment not found or unauthorized.' });
        }

        const appointment = appointments[0];
        const formattedAppointment = {
            appointmentId: appointment.appointment_id,
            appointmentDate: appointment.appointment_date,
            patientName: `${appointment.patient_first_name} ${appointment.patient_last_name}`,
            patientPhone: appointment.patient_phone,
            patientAge: appointment.date_of_birth ? new Date().getFullYear() - new Date(appointment.date_of_birth).getFullYear() : 'N/A',
            patientGender: appointment.gender,
            reason: appointment.reason,
            status: appointment.status,
            notes: appointment.notes,
            medicalConditions: appointment.medical_conditions,
            allergies: appointment.allergies,
            currentMedications: appointment.current_medications
        };

        res.status(200).json(formattedAppointment);
    } catch (error) {
        console.error('Error fetching appointment details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};


exports.getDoctorProfile = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const [doctorRows] = await db.execute(`
            SELECT d.*, u.email FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE d.doctor_id = ?
        `, [doctorId]);

        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Doctor profile not found.' });
        }
        res.status(200).json(doctorRows[0]);
    } catch (error) {
        console.error('Error fetching doctor profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.updateDoctorProfile = async (req, res) => {
    const doctorId = req.user.doctor_id;
    const { first_name, last_name, specialization, experience_years, bio, phone_number } = req.body;

    try {
        await db.execute(`
            UPDATE doctors SET
                first_name = ?, last_name = ?, specialization = ?, experience_years = ?, bio = ?, phone_number = ?
            WHERE doctor_id = ?
        `, [
            first_name, last_name, specialization, experience_years, bio, phone_number,
            doctorId
        ]);
        res.status(200).json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Error updating doctor profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getDoctorPatients = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { search, limit } = req.query;
        
        let query = `
            SELECT DISTINCT p.patient_id, p.first_name, p.last_name, p.gender, p.date_of_birth, p.phone_number, u.email,
                   (SELECT MAX(appointment_date) FROM appointments WHERE patient_id = p.patient_id AND doctor_id = ?) as last_visit,
                   (SELECT MIN(appointment_date) FROM appointments WHERE patient_id = p.patient_id AND doctor_id = ? AND appointment_date > CURDATE() AND status IN ('Upcoming', 'Confirmed', 'Pending')) as next_appointment,
                   p.medical_conditions
            FROM patients p
            JOIN appointments a ON p.patient_id = a.patient_id
            JOIN users u ON p.user_id = u.user_id
            WHERE a.doctor_id = ?`;
        
        const params = [doctorId, doctorId, doctorId];
        
        // Add search functionality
        if (search) {
            query += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR CONCAT(p.first_name, ' ', p.last_name) LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        query += ` ORDER BY p.last_name, p.first_name`;
        
        // Add limit if specified
        if (limit) {
            query += ` LIMIT ?`;
            params.push(parseInt(limit));
        }
        
        // Fetch patients who have had appointments with this doctor
        const [patients] = await db.execute(query, params);

        const formattedPatients = patients.map(p => ({
            patient_id: p.patient_id,
            fullName: `${p.first_name} ${p.last_name}`,
            gender: p.gender,
            age: p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : 'N/A',
            phoneNumber: p.phone_number,
            email: p.email,
            lastVisit: p.last_visit ? new Date(p.last_visit).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric'}) : 'N/A',
            nextAppointment: p.next_appointment ? new Date(p.next_appointment).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'No upcoming appointments',
            conditions: p.medical_conditions ? p.medical_conditions.split(',').map(c => c.trim()) : []
        }));

        res.status(200).json({ patients: formattedPatients, totalPatients: formattedPatients.length });
    } catch (error) {
        console.error('Error fetching doctor patients:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Leave Management Endpoints
exports.getDoctorLeaves = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        
        // Fetch pending leave requests
        const [pendingLeaves] = await db.execute(`
            SELECT 
                leave_id,
                doctor_id,
                requested_date,
                end_date,
                leave_type,
                reason,
                status,
                created_at
            FROM doctorleaverequests 
            WHERE doctor_id = ? AND status = 'pending'
            ORDER BY created_at DESC
        `, [doctorId]);
        
        // Fetch previous leave requests (approved/rejected)
        const [previousLeaves] = await db.execute(`
            SELECT 
                leave_id,
                doctor_id,
                requested_date,
                end_date,
                leave_type,
                reason,
                status,
                created_at
            FROM doctorleaverequests 
            WHERE doctor_id = ? AND status IN ('approved', 'rejected')
            ORDER BY created_at DESC
            LIMIT 20
        `, [doctorId]);
        
        res.status(200).json({
            pending: pendingLeaves,
            previous: previousLeaves
        });
        
    } catch (error) {
        console.error('Error fetching doctor leaves:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Get individual leave request
exports.getLeaveRequest = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { leaveId } = req.params;
        
        const [leaveRows] = await db.execute(`
            SELECT 
                leave_id,
                doctor_id,
                requested_date,
                end_date,
                leave_type,
                reason,
                status,
                created_at
            FROM doctorleaverequests 
            WHERE leave_id = ? AND doctor_id = ?
        `, [leaveId, doctorId]);
        
        if (leaveRows.length === 0) {
            return res.status(404).json({ message: 'Leave request not found.' });
        }
        
        res.status(200).json(leaveRows[0]);
        
    } catch (error) {
        console.error('Error fetching leave request:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Update leave request
exports.updateLeaveRequest = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { leaveId } = req.params;
        const { requested_date, end_date, leave_type, reason } = req.body;
        
        // Check if leave request exists and belongs to doctor
        const [existingLeave] = await db.execute(`
            SELECT leave_id FROM doctorleaverequests 
            WHERE leave_id = ? AND doctor_id = ? AND status = 'pending'
        `, [leaveId, doctorId]);
        
        if (existingLeave.length === 0) {
            return res.status(404).json({ message: 'Leave request not found or cannot be modified.' });
        }
        
        // Update the leave request
        await db.execute(`
            UPDATE doctorleaverequests 
            SET requested_date = ?, end_date = ?, leave_type = ?, reason = ?
            WHERE leave_id = ? AND doctor_id = ?
        `, [requested_date, end_date, leave_type, reason, leaveId, doctorId]);
        
        res.status(200).json({ message: 'Leave request updated successfully.' });
        
    } catch (error) {
        console.error('Error updating leave request:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Delete leave request
exports.deleteLeaveRequest = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { leaveId } = req.params;
        
        // Check if leave request exists and belongs to doctor
        const [existingLeave] = await db.execute(`
            SELECT leave_id FROM doctorleaverequests 
            WHERE leave_id = ? AND doctor_id = ? AND status = 'pending'
        `, [leaveId, doctorId]);
        
        if (existingLeave.length === 0) {
            return res.status(404).json({ message: 'Leave request not found or cannot be deleted.' });
        }
        
        // Delete the leave request
        await db.execute(`
            DELETE FROM doctorleaverequests 
            WHERE leave_id = ? AND doctor_id = ?
        `, [leaveId, doctorId]);
        
        res.status(200).json({ message: 'Leave request deleted successfully.' });
        
    } catch (error) {
        console.error('Error deleting leave request:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.submitLeaveRequest = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { requested_date, end_date, leave_type, reason } = req.body;
        
        if (!requested_date || !end_date || !leave_type || !reason) {
            return res.status(400).json({ message: 'Missing required fields: requested_date, end_date, leave_type, reason' });
        }
        
        // Validate dates
        const startDate = new Date(requested_date);
        const endDate = new Date(end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (startDate < today) {
            return res.status(400).json({ message: 'Start date cannot be in the past' });
        }
        
        if (endDate < startDate) {
            return res.status(400).json({ message: 'End date cannot be before start date' });
        }
        
        // Validate leave type
        const validLeaveTypes = ['personal_leave', 'emergency', 'sick_leave', 'vacation', 'maternity_paternity', 'other'];
        if (!validLeaveTypes.includes(leave_type)) {
            return res.status(400).json({ message: 'Invalid leave type' });
        }
        
        // Insert leave request
        const [result] = await db.execute(`
            INSERT INTO doctorleaverequests (
                doctor_id, 
                requested_date, 
                end_date,
                leave_type,
                reason, 
                status, 
                created_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', NOW())
        `, [doctorId, requested_date, end_date, leave_type, reason]);
        
        res.status(201).json({ 
            message: 'Leave request submitted successfully',
            leave_id: result.insertId
        });
        
    } catch (error) {
        console.error('Error submitting leave request:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Additional Doctor Controller Functions
exports.setWeeklyAvailability = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { effectiveDate, availability } = req.body;
        
        // This would typically save to a doctor_availability table
        // For now, just return success
        res.status(200).json({ 
            message: 'Weekly availability set successfully',
            effectiveDate,
            availability
        });
        
    } catch (error) {
        console.error('Error setting weekly availability:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.blockTime = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { date, startTime, endTime, reason, recurring, recurringDays } = req.body;
        
        if (!date || !startTime || !endTime) {
            return res.status(400).json({ message: 'Date, start time, and end time are required.' });
        }
        
        // Insert blocked time into database
        const insertQuery = `
            INSERT INTO blocked_times (doctor_id, blocked_date, start_time, end_time, reason, is_recurring, recurring_days)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const recurringDaysJson = recurring && recurringDays ? JSON.stringify(recurringDays) : null;
        
        const [result] = await db.execute(insertQuery, [
            doctorId,
            date,
            startTime,
            endTime,
            reason || 'Blocked',
            recurring || false,
            recurringDaysJson
        ]);
        
        res.status(200).json({ 
            message: 'Time blocked successfully',
            blockedTimeId: result.insertId,
            date,
            startTime,
            endTime,
            reason: reason || 'Blocked'
        });
        
    } catch (error) {
        console.error('Error blocking time:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.unblockTime = async (req, res) => {
    try {
        const { id } = req.params;
        const doctorId = req.user.doctor_id;
        
        // Delete the blocked time slot
        const deleteQuery = `
            DELETE FROM blocked_times 
            WHERE blocked_time_id = ? AND doctor_id = ?
        `;
        
        const [result] = await db.execute(deleteQuery, [id, doctorId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Blocked time slot not found or unauthorized.' });
        }
        
        res.status(200).json({ 
            message: 'Time slot unblocked successfully',
            blockedTimeId: id
        });
        
    } catch (error) {
        console.error('Error unblocking time:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.addScheduleSlot = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { date, time, status, details, day } = req.body;
        
        // This would typically save to a schedule_slots table
        // For now, just return success
        res.status(200).json({ 
            message: 'Schedule slot added successfully',
            date,
            time,
            status,
            details
        });
        
    } catch (error) {
        console.error('Error adding schedule slot:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.updateQuickSettings = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { defaultSlotDuration, breakBetweenSlots, autoConfirmBookings } = req.body;
        
        // This would typically save to a doctor_settings table
        // For now, just return success
        res.status(200).json({ 
            message: 'Quick settings updated successfully',
            defaultSlotDuration,
            breakBetweenSlots,
            autoConfirmBookings
        });
        
    } catch (error) {
        console.error('Error updating quick settings:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getDoctorProfile = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        // Return a flat object including email to match frontend expectations
        const [doctorRows] = await db.execute(`
            SELECT 
                d.doctor_id,
                d.first_name,
                d.last_name,
                d.specialization,
                d.experience_years,
                d.rating,
                d.bio,
                d.phone_number,
                d.hospital_id,
                u.email
            FROM doctors d
            LEFT JOIN users u ON d.user_id = u.user_id
            WHERE d.doctor_id = ?
        `, [doctorId]);

        if (!doctorRows.length) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        res.status(200).json(doctorRows[0]);
    } catch (error) {
        console.error('Error fetching doctor profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.updateDoctorProfile = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const { first_name, last_name, specialization, experience_years, bio, phone_number } = req.body;

        await db.execute(`
            UPDATE doctors 
            SET first_name = ?, last_name = ?, specialization = ?, 
                experience_years = ?, bio = ?, phone_number = ?
            WHERE doctor_id = ?
        `, [first_name, last_name, specialization, experience_years, bio, phone_number, doctorId]);

        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating doctor profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// (Removed duplicate minimal getDoctorPatients implementation that returned raw rows)

exports.approveAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const doctorId = req.user.doctor_id;
        
        await db.execute(`
            UPDATE appointments 
            SET status = 'Confirmed' 
            WHERE appointment_id = ? AND doctor_id = ?
        `, [appointmentId, doctorId]);
        
        res.status(200).json({ message: 'Appointment approved successfully' });
        
    } catch (error) {
        console.error('Error approving appointment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.cancelAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const doctorId = req.user.doctor_id;
        
        await db.execute(`
            UPDATE appointments 
            SET status = 'Cancelled' 
            WHERE appointment_id = ? AND doctor_id = ?
        `, [appointmentId, doctorId]);
        
        res.status(200).json({ message: 'Appointment cancelled successfully' });
        
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.startAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const doctorId = req.user.doctor_id;
        
        await db.execute(`
            UPDATE appointments 
            SET status = 'Confirmed' 
            WHERE appointment_id = ? AND doctor_id = ?
        `, [appointmentId, doctorId]);
        
        res.status(200).json({ message: 'Appointment started successfully' });
        
    } catch (error) {
        console.error('Error starting appointment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.completeAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const doctorId = req.user.doctor_id;
        
        await db.execute(`
            UPDATE appointments 
            SET status = 'Completed' 
            WHERE appointment_id = ? AND doctor_id = ?
        `, [appointmentId, doctorId]);
        
        res.status(200).json({ message: 'Appointment completed successfully' });
        
    } catch (error) {
        console.error('Error completing appointment:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getAppointmentDetails = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const doctorId = req.user.doctor_id;
        
        const [appointments] = await db.execute(`
            SELECT a.appointment_id, a.appointment_date, a.reason, a.status, a.notes,
                   p.first_name, p.last_name, u.email, p.phone_number
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            JOIN users u ON p.user_id = u.user_id
            WHERE a.appointment_id = ? AND a.doctor_id = ?
        `, [appointmentId, doctorId]);
        
        if (!appointments.length) {
            return res.status(404).json({ message: 'Appointment not found' });
        }
        
        const appointment = appointments[0];
        appointment.patientName = `${appointment.first_name} ${appointment.last_name}`;
        
        res.status(200).json({ appointment });
        
    } catch (error) {
        console.error('Error fetching appointment details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Update appointment status
exports.updateAppointmentStatus = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { status } = req.body;
        
        console.log('Update appointment status request:', { appointmentId, status });
        console.log('User object:', req.user);
        
        // Get doctor_id from the user object - check multiple possible fields
        let doctorId = req.user.doctor_id || req.user.id;
        
        // If still no doctor_id, try to get it from the database using user_id
        if (!doctorId && req.user.user_id) {
            const [doctorRows] = await db.execute(
                'SELECT doctor_id FROM doctors WHERE user_id = ?', 
                [req.user.user_id]
            );
            if (doctorRows.length > 0) {
                doctorId = doctorRows[0].doctor_id;
            }
        }
        
        if (!doctorId) {
            console.error('Doctor ID not found in user object:', req.user);
            return res.status(400).json({
                success: false,
                message: 'Doctor ID not found. Please log in again.'
            });
        }
        
        // Validate status - match database enum values exactly
        const validStatuses = ['Upcoming', 'Confirmed', 'Pending', 'Cancelled', 'Completed'];
        
        // Map frontend status to database enum values
        let dbStatus = status;
        if (status === 'In Progress') {
            dbStatus = 'Confirmed'; // Map "In Progress" to "Confirmed" in database
        }
        
        if (!validStatuses.includes(dbStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', ')
            });
        }
        
        console.log('Updating appointment:', { appointmentId, status, doctorId });
        
        const [result] = await db.execute(`
            UPDATE Appointments 
            SET status = ? 
            WHERE appointment_id = ? AND doctor_id = ?
        `, [dbStatus, appointmentId, doctorId]);
        
        console.log('Update result:', result);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found or you do not have permission to update it'
            });
        }
        
        res.json({
            success: true,
            message: `Appointment status updated to ${status}`,
            data: {
                appointment_id: appointmentId,
                status: dbStatus
            }
        });
        
    } catch (error) {
        console.error('Error updating appointment status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get past appointments for doctor
exports.getPastAppointments = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const query = `
            SELECT 
                a.appointment_id,
                a.appointment_date,
                a.reason,
                a.status,
                a.notes,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                p.phone_number as patient_phone,
                CASE 
                    WHEN camr.appointment_id IS NOT NULL THEN 1 
                    ELSE 0 
                END as has_medical_records
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            LEFT JOIN completed_appointments_medical_records camr ON a.appointment_id = camr.appointment_id
            WHERE a.doctor_id = ? 
            AND a.status IN ('Completed', 'Cancelled')
            AND DATE(a.appointment_date) < CURDATE()
            ORDER BY a.appointment_date DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM appointments a
            WHERE a.doctor_id = ? 
            AND a.status IN ('Completed', 'Cancelled')
            AND DATE(a.appointment_date) < CURDATE()
        `;

        const [appointments] = await db.execute(query, [doctorId, limit, offset]);
        const [countResult] = await db.execute(countQuery, [doctorId]);
        
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: {
                appointments,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit
                }
            }
        });

    } catch (error) {
        console.error('Error fetching past appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    getDoctorSchedule: exports.getDoctorSchedule,
    approveAppointment: exports.approveAppointment,
    cancelAppointment: exports.cancelAppointment,
    updateAppointmentStatus: exports.updateAppointmentStatus,
    completeAppointment: exports.completeAppointment,
    startAppointment: exports.startAppointment,
    getDoctorProfile: exports.getDoctorProfile,
    updateDoctorProfile: exports.updateDoctorProfile,
    updateDoctorAvailability: exports.updateDoctorAvailability,
    getDoctorAvailability: exports.getDoctorAvailability,
    getPastAppointments: exports.getPastAppointments,
    getDoctorPatients: exports.getDoctorPatients,
    getDoctorLeaves: exports.getDoctorLeaves,
    getLeaveRequest: exports.getLeaveRequest,
    updateLeaveRequest: exports.updateLeaveRequest,
    deleteLeaveRequest: exports.deleteLeaveRequest,
    submitLeaveRequest: exports.submitLeaveRequest,
    setWeeklyAvailability: exports.setWeeklyAvailability,
    blockTime: exports.blockTime,
    unblockTime: exports.unblockTime,
    addScheduleSlot: exports.addScheduleSlot,
    updateQuickSettings: exports.updateQuickSettings,
    getAppointmentDetails: exports.getAppointmentDetails
};

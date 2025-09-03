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
        const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
        
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
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
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
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            WHERE a.doctor_id = ?
            AND DATE(a.appointment_date) = ?
            ORDER BY a.appointment_date ASC;
        `, [doctorId, today]);
        
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
                FROM appointments a
                JOIN patients p ON a.patient_id = p.patient_id
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
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
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
            FROM appointments
            WHERE doctor_id = ?
            AND appointment_date > NOW()
            AND status IN ('Upcoming', 'Confirmed', 'Pending');
        `, [doctorId]);

        // Fetch total patients count
        const [totalPatientsCount] = await db.execute(`
            SELECT COUNT(DISTINCT p.patient_id) as count
            FROM patients p
            JOIN appointments a ON p.patient_id = a.patient_id
            WHERE a.doctor_id = ?;
        `, [doctorId]);
        
        // Use today's appointments if available, otherwise use fallback
        const appointmentsToFormat = todayAppointments.length > 0 ? todayAppointments : fallbackAppointments;
        
        const formattedTodayAppointments = appointmentsToFormat.map(app => ({
            appointment_id: app.appointment_id,
            patientName: `${app.patient_first_name} ${app.patient_last_name}`,
            time: new Date(app.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
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
        
        // --- Schedule Generation Logic (Daily View) ---
        let scheduleGrid = [];
        if (view === 'daily' && date) {
            // Fetch appointments for the requested date
            const [appointmentsForDate] = await db.execute(`
                SELECT a.appointment_date, p.first_name, p.last_name, a.reason, a.status
                FROM appointments a
                JOIN patients p ON a.patient_id = p.patient_id
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
                    slot.details = `${bookedSlot.patientName} - ${bookedSlot.reason}`;
                }
                
                // Add logic for blocked times (e.g., lunch break)
                if (timeString === '12:00 PM') {
                    slot.status = 'Blocked';
                    slot.details = 'Lunch Break';
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
            quickSettings: quickSettings
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

        await db.execute(
            'UPDATE doctors SET is_available = ? WHERE doctor_id = ?',
            [is_available, doctorId]
        );

        res.status(200).json({ message: 'Availability updated successfully.' });
    } catch (error) {
        console.error('Error updating doctor availability:', error);
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

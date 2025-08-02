const db = require('../models/db');

// Helper to format date for display
const formatDateForDoctor = (dateString) => {
    const date = new Date(dateString);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleDateString('en-US', options);
};

exports.getDoctorSchedule = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;

        if (!doctorId) {
            return res.status(400).json({ message: 'Doctor ID not found for this user.' });
        }

        const [doctorInfo] = await db.execute(`
            SELECT first_name, last_name, is_available FROM Doctors WHERE doctor_id = ?
        `, [doctorId]);

        // Fetch today's appointments
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

        const formattedTodayAppointments = todayAppointments.map(app => ({
            appointment_id: app.appointment_id,
            patientName: `${app.patient_first_name} ${app.patient_last_name}`,
            time: new Date(app.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            reason: app.reason,
            status: app.status
        }));

        // Placeholder for quick settings
        const quickSettings = {
            defaultSlotDuration: '30 min',
            breakBetweenSlots: '15 min',
            autoConfirmBookings: true
        };

        res.status(200).json({
            doctorInfo: doctorInfo[0],
            todayAppointments: formattedTodayAppointments,
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
            'UPDATE Doctors SET is_available = ? WHERE doctor_id = ?',
            [is_available, doctorId]
        );

        res.status(200).json({ message: 'Availability updated successfully.' });
    } catch (error) {
        console.error('Error updating doctor availability:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getDoctorProfile = async (req, res) => {
    try {
        const doctorId = req.user.doctor_id;
        const [doctorRows] = await db.execute(`
            SELECT d.*, u.email FROM Doctors d JOIN Users u ON d.user_id = u.user_id WHERE d.doctor_id = ?
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
            UPDATE Doctors SET
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
        // Fetch patients who have had appointments with this doctor
        const [patients] = await db.execute(`
            SELECT DISTINCT p.patient_id, p.first_name, p.last_name, p.gender, p.date_of_birth, p.phone_number, u.email,
                   (SELECT MAX(appointment_date) FROM Appointments WHERE patient_id = p.patient_id AND doctor_id = ?) as last_visit,
                   (SELECT MIN(appointment_date) FROM Appointments WHERE patient_id = p.patient_id AND doctor_id = ? AND appointment_date > CURDATE() AND status IN ('Upcoming', 'Confirmed', 'Pending')) as next_appointment,
                   p.medical_conditions
            FROM Patients p
            JOIN Appointments a ON p.patient_id = a.patient_id
            JOIN Users u ON p.user_id = u.user_id
            WHERE a.doctor_id = ?
            ORDER BY p.last_name, p.first_name;
        `, [doctorId, doctorId, doctorId]); // Pass doctorId three times for the subqueries and main query

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
const db = require('../models/db');

// Helper to format date for display
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
  return date.toLocaleDateString('en-US', options).replace(',', '')
             .replace('at', '');
};

// Helper: ensure we have a patient_id for this request
const getPatientIdFromReq = async (req) => {
  if (req.user?.patient_id) return req.user.patient_id;
  if (req.user?.user_id) {
    const [rows] = await db.execute('SELECT patient_id FROM Patients WHERE user_id = ?', [req.user.user_id]);
    if (rows.length) return rows[0].patient_id;
  }
  return null;
};

// Helper: normalize ISO date/time to SQL DATETIME string
const toSqlDateTime = (isoStr) => {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  // Format using LOCAL date/time components to match the wall-clock selection
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  const SS = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
};

exports.getPatientDashboardOverview = async (req, res) => {
  try {
    const patientId = req.user.patient_id;

    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID not found for this user.' });
    }

    // Upcoming Appointments - only show Pending and Confirmed appointments from today onwards
    // Sort with tomorrow's appointments first, then other dates in ascending order
    const [upcomingAppointments] = await db.execute(`
      SELECT
        a.appointment_id,
        a.appointment_date,
        a.reason,
        a.status,
        d.first_name AS doctor_first_name,
        d.last_name AS doctor_last_name,
        d.specialization
      FROM Appointments a
      JOIN Doctors d ON a.doctor_id = d.doctor_id
      WHERE a.patient_id = ? 
        AND a.status IN ('Confirmed', 'Pending')
        AND DATE(a.appointment_date) >= CURDATE()
      ORDER BY 
        CASE 
          WHEN DATE(a.appointment_date) = CURDATE() + INTERVAL 1 DAY THEN 0
          ELSE 1
        END,
        a.appointment_date ASC
      LIMIT 3;
    `, [patientId]);

    // Total Visits
    const [totalVisitsResult] = await db.execute(`
      SELECT COUNT(*) AS total_visits
      FROM Appointments
      WHERE patient_id = ? AND status = 'Completed';
    `, [patientId]);
    const totalVisits = totalVisitsResult[0].count;

    // Placeholder for Favorite Doctors and Health Score (static for now, as per design)
    const favoriteDoctors = 5;
    const healthScore = '85%';

    const formattedAppointments = upcomingAppointments.map(app => {
      let displayDate;
      const appDate = new Date(app.appointment_date);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      if (appDate.toDateString() === tomorrow.toDateString()) {
        displayDate = `Tomorrow, ${appDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      } else {
        displayDate = formatDate(app.appointment_date);
      }

      return {
        appointment_id: app.appointment_id,
        doctorName: `Dr. ${app.doctor_first_name} ${app.doctor_last_name}`,
        specialization: app.specialization,
        date: displayDate,
        status: app.status
      };
    });

    res.status(200).json({
      upcomingAppointments: formattedAppointments,
      totalVisits: totalVisits,
      favoriteDoctors: favoriteDoctors,
      healthScore: healthScore,
    });

  } catch (error) {
    console.error('Error fetching patient dashboard overview:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.getPatientProfile = async (req, res) => {
    try {
        const patientId = await getPatientIdFromReq(req);
        if (!patientId) return res.status(400).json({ message: 'Patient context not found.' });
        const [patientRows] = await db.execute(`
            SELECT p.*, u.email FROM Patients p JOIN Users u ON p.user_id = u.user_id WHERE p.patient_id = ?
        `, [patientId]);

        if (patientRows.length === 0) {
            return res.status(404).json({ message: 'Patient profile not found.' });
        }
        res.status(200).json(patientRows[0]);
    } catch (error) {
        console.error('Error fetching patient profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.updatePatientProfile = async (req, res) => {
    const patientId = await getPatientIdFromReq(req);
    if (!patientId) return res.status(400).json({ message: 'Patient context not found.' });
    const payload = req.body || {};

    // Fetch existing row to preserve unspecified fields
    try {
        const [rows] = await db.execute('SELECT * FROM Patients WHERE patient_id = ?', [patientId]);
        if (!rows.length) return res.status(404).json({ message: 'Patient not found.' });
        const current = rows[0];

        // Coalesce fields from request over existing values
        const first_name = payload.first_name ?? current.first_name;
        const last_name = payload.last_name ?? current.last_name;
        const phone_number = payload.phone_number ?? current.phone_number;
        const date_of_birth = payload.date_of_birth ?? current.date_of_birth;
        const address = payload.address ?? current.address;
        const blood_type = payload.blood_type ?? current.blood_type;
        const gender = payload.gender ?? current.gender;
        const allergies = payload.allergies ?? current.allergies;
        const current_medications = payload.current_medications ?? current.current_medications;
        const medical_conditions = payload.medical_conditions ?? current.medical_conditions;
        const insurance_provider = payload.insurance_provider ?? current.insurance_provider;
        const policy_number = payload.policy_number ?? current.policy_number;
        const group_number = payload.group_number ?? current.group_number;
        const member_id = payload.member_id ?? current.member_id;
        const emergency_contact_name = payload.emergency_contact_name ?? current.emergency_contact_name;
        const emergency_contact_relationship = payload.emergency_contact_relationship ?? current.emergency_contact_relationship;
        const emergency_contact_phone = payload.emergency_contact_phone ?? current.emergency_contact_phone;

        await db.execute(`
            UPDATE Patients SET
                first_name = ?, last_name = ?, phone_number = ?, date_of_birth = ?, address = ?,
                blood_type = ?, gender = ?, allergies = ?, current_medications = ?, medical_conditions = ?,
                insurance_provider = ?, policy_number = ?, group_number = ?, member_id = ?,
                emergency_contact_name = ?, emergency_contact_relationship = ?, emergency_contact_phone = ?
            WHERE patient_id = ?
        `, [
            first_name, last_name, phone_number, date_of_birth, address,
            blood_type, gender, allergies, current_medications, medical_conditions,
            insurance_provider, policy_number, group_number, member_id,
            emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
            patientId
        ]);
        res.status(200).json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Error updating patient profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getPatientAppointments = async (req, res) => {
    try {
        const patientId = req.user.patient_id;
        const [appointments] = await db.execute(`
            SELECT
                a.appointment_id,
                a.appointment_date,
                a.reason,
                a.status,
                d.first_name AS doctor_first_name,
                d.last_name AS doctor_last_name,
                d.specialization
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date ASC;
        `, [patientId]);

        const upcoming = [];
        const past = [];
        const cancelled = [];

        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        appointments.forEach(app => {
            const appDate = new Date(app.appointment_date);
            const appDateOnly = new Date(appDate);
            appDateOnly.setHours(0, 0, 0, 0); // Start of appointment date

            const formattedApp = {
                appointment_id: app.appointment_id,
                doctorName: `Dr. ${app.doctor_first_name} ${app.doctor_last_name}`,
                specialization: app.specialization,
                dateTime: appDate.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
                reason: app.reason,
                status: app.status
            };

            if (app.status === 'Cancelled') {
                cancelled.push(formattedApp);
            } else if (appDateOnly >= today && (app.status === 'Confirmed' || app.status === 'Pending')) {
                // Only show Pending and Confirmed appointments from today onwards for upcoming tab
                upcoming.push(formattedApp);
            } else {
                // Past appointments include completed ones and those before today
                past.push(formattedApp);
            }
        });

        res.status(200).json({ upcoming, past, cancelled });

    } catch (error) {
        console.error('Error fetching patient appointments:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// --- NEW FUNCTION: getDoctorsList to fetch all doctors ---
exports.getDoctorsList = async (req, res) => {
    try {
        // Build a dynamic SQL query to fetch doctors with filters
        const { search = '', specialty = '', availability = '' } = req.query;

        let query = `
            SELECT
                d.doctor_id,
                d.first_name,
                d.last_name,
                d.specialization,
                d.experience_years,
                d.rating,
                d.bio,
                (SELECT hospital_name FROM Hospitals h WHERE h.hospital_id = d.hospital_id) AS hospital_name,
                (SELECT COUNT(*) FROM Appointments a WHERE a.doctor_id = d.doctor_id) AS reviews,
                (SELECT MIN(appointment_date) FROM Appointments a WHERE a.doctor_id = d.doctor_id AND a.appointment_date > CURDATE() AND a.status IN ('Upcoming', 'Confirmed', 'Pending')) AS next_available_date
            FROM Doctors d
            WHERE d.is_approved = TRUE
        `;
        const params = [];

        // Add filters to the query
        if (search) {
            query += ` AND (d.first_name LIKE ? OR d.last_name LIKE ? OR d.specialization LIKE ? OR (SELECT hospital_name FROM Hospitals h WHERE h.hospital_id = d.hospital_id) LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (specialty) {
            query += ` AND d.specialization = ?`;
            params.push(specialty);
        }
        if (availability) {
            if (availability === 'Today') {
                query += ` AND EXISTS (SELECT 1 FROM Appointments a WHERE a.doctor_id = d.doctor_id AND DATE(a.appointment_date) = CURDATE() AND a.status IN ('Upcoming', 'Confirmed', 'Pending'))`;
            } else if (availability === 'Tomorrow') {
                query += ` AND EXISTS (SELECT 1 FROM Appointments a WHERE a.doctor_id = d.doctor_id AND DATE(a.appointment_date) = CURDATE() + INTERVAL 1 DAY AND a.status IN ('Upcoming', 'Confirmed', 'Pending'))`;
            } else if (availability === 'This Week') {
                query += ` AND EXISTS (SELECT 1 FROM Appointments a WHERE a.doctor_id = d.doctor_id AND YEARWEEK(a.appointment_date) = YEARWEEK(NOW()) AND a.appointment_date >= CURDATE() AND a.status IN ('Upcoming', 'Confirmed', 'Pending'))`;
            }
        }
        
        query += ` ORDER BY d.rating DESC, d.experience_years DESC;`;

        const [doctors] = await db.execute(query, params);

        // Format the results for the frontend
        const formattedDoctors = doctors.map(doc => ({
            doctor_id: doc.doctor_id,
            first_name: doc.first_name,
            last_name: doc.last_name,
            specialization: doc.specialization,
            experience_years: doc.experience_years,
            rating: doc.rating,
            bio: doc.bio,
            hospital_name: doc.hospital_name,
            reviews: doc.reviews,
            // Format the next available date if it exists
            next_available: doc.next_available_date ? new Date(doc.next_available_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'No upcoming slots'
        }));

        res.status(200).json({ doctors: formattedDoctors, totalCount: formattedDoctors.length });

    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// --- NEW FUNCTION: getDoctorDetails to fetch a single doctor's details ---
exports.getDoctorDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const [doctorRows] = await db.execute(`
            SELECT
                d.doctor_id,
                d.first_name,
                d.last_name,
                d.specialization,
                d.experience_years,
                d.rating,
                d.bio,
                (SELECT hospital_name FROM Hospitals h WHERE h.hospital_id = d.hospital_id) AS hospital_name,
                (SELECT COUNT(*) FROM Appointments a WHERE a.doctor_id = d.doctor_id) AS reviews
            FROM Doctors d
            WHERE d.doctor_id = ? AND d.is_approved = TRUE;
        `, [id]);

        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Doctor not found.' });
        }
        const doctor = doctorRows[0];
        res.status(200).json({
            id: doctor.doctor_id,
            first_name: doctor.first_name,
            last_name: doctor.last_name,
            specialization: doctor.specialization,
            experience_years: doctor.experience_years,
            rating: doctor.rating,
            bio: doctor.bio,
            hospital_name: doctor.hospital_name,
            reviews: doctor.reviews
        });
    } catch (error) {
        console.error('Error fetching doctor details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Get doctor availability for a given date (generate slots and mark booked)
exports.getDoctorAvailability = async (req, res) => {
    try {
        const { id } = req.params; // doctor id
        const { date } = req.query; // YYYY-MM-DD
        if (!date) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });

        // Fetch booked appointments for the date
        const [apps] = await db.execute(`
            SELECT appointment_date, reason, status
            FROM Appointments
            WHERE doctor_id = ? AND DATE(appointment_date) = ?
            ORDER BY appointment_date ASC
        `, [id, date]);

        const booked = apps.map(a => {
            const t = new Date(a.appointment_date);
            const timeStr = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            return { time: timeStr, status: a.status, reason: a.reason };
        });

        const schedule = [];
        let cur = new Date(date);
        cur.setHours(8,0,0,0);
        const end = new Date(date);
        end.setHours(17,0,0,0);
        while (cur <= end) {
            const timeStr = cur.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            let slot = { time: timeStr, status: 'Available' };
            const bk = booked.find(b => b.time === timeStr && b.status !== 'Cancelled');
            if (bk) slot = { time: timeStr, status: 'Booked', reason: bk.reason };
            if (timeStr === '12:00 PM') slot = { time: timeStr, status: 'Blocked', reason: 'Lunch' };
            schedule.push(slot);
            cur.setMinutes(cur.getMinutes() + 30);
        }
        res.status(200).json({ date, schedule });
    } catch (e) {
        console.error('Error fetching availability:', e);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Create a new appointment (booking)
exports.bookAppointment = async (req, res) => {
    try {
        const patientId = await getPatientIdFromReq(req);
        const { doctor_id, appointment_date, reason } = req.body; // appointment_date in ISO
        if (!doctor_id || !appointment_date) return res.status(400).json({ message: 'doctor_id and appointment_date are required.' });
        if (!patientId) return res.status(400).json({ message: 'Patient context not found.' });
        const sqlDate = toSqlDateTime(appointment_date);
        if (!sqlDate) return res.status(400).json({ message: 'Invalid appointment_date.' });

        // Conflict check: doctor already has an appointment at that time (not cancelled)
        const [conflicts] = await db.execute(`
            SELECT appointment_id FROM Appointments
            WHERE doctor_id = ? AND appointment_date = ? AND status <> 'Cancelled'
        `, [doctor_id, sqlDate]);
        if (conflicts.length) return res.status(409).json({ message: 'Selected time is no longer available.' });

        await db.execute(`
            INSERT INTO Appointments (doctor_id, patient_id, appointment_date, reason, status)
            VALUES (?, ?, ?, ?, 'Pending')
        `, [doctor_id, patientId, sqlDate, reason || null]);
        res.status(201).json({ message: 'Appointment booked successfully.' });
    } catch (e) {
        console.error('Error booking appointment:', e);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Cancel appointment
exports.cancelAppointment = async (req, res) => {
    try {
        const patientId = await getPatientIdFromReq(req);
        const { id } = req.params;
        if (!patientId) return res.status(400).json({ message: 'Patient context not found.' });
        // Ensure appointment belongs to patient
        const [rows] = await db.execute('SELECT patient_id FROM Appointments WHERE appointment_id = ?', [id]);
        if (!rows.length || rows[0].patient_id !== patientId) return res.status(404).json({ message: 'Appointment not found.' });
        await db.execute('UPDATE Appointments SET status = "Cancelled" WHERE appointment_id = ?', [id]);
        res.status(200).json({ message: 'Appointment cancelled.' });
    } catch (e) {
        console.error('Error cancelling appointment:', e);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Reschedule appointment
exports.rescheduleAppointment = async (req, res) => {
    try {
        const patientId = await getPatientIdFromReq(req);
        const { id } = req.params;
        const { new_date, reason } = req.body; // new_date ISO
        if (!new_date) return res.status(400).json({ message: 'new_date is required.' });
        if (!patientId) return res.status(400).json({ message: 'Patient context not found.' });
        const sqlDate = toSqlDateTime(new_date);
        if (!sqlDate) return res.status(400).json({ message: 'Invalid new_date.' });
        const [rows] = await db.execute('SELECT doctor_id, patient_id FROM Appointments WHERE appointment_id = ?', [id]);
        if (!rows.length || rows[0].patient_id !== patientId) return res.status(404).json({ message: 'Appointment not found.' });
        const doctorId = rows[0].doctor_id;
        // conflict check
        const [conflicts] = await db.execute(
            'SELECT appointment_id FROM Appointments WHERE doctor_id = ? AND appointment_date = ? AND status <> "Cancelled" AND appointment_id <> ?',[doctorId, sqlDate, id]
        );
        if (conflicts.length) return res.status(409).json({ message: 'Selected time is no longer available.' });
        await db.execute('UPDATE Appointments SET appointment_date = ?, reason = COALESCE(?, reason), status = "Pending" WHERE appointment_id = ?', [sqlDate, reason || null, id]);
        res.status(200).json({ message: 'Appointment rescheduled.' });
    } catch (e) {
        console.error('Error rescheduling appointment:', e);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Get appointment by ID
exports.getAppointmentById = async (req, res) => {
    try {
        const patientId = req.user.patient_id;
        const { id } = req.params;
        const [rows] = await db.execute(`
            SELECT a.appointment_id, a.appointment_date, a.reason, a.status, a.doctor_id,
                   d.first_name AS doctor_first_name, d.last_name AS doctor_last_name, d.specialization
            FROM Appointments a JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE a.appointment_id = ? AND a.patient_id = ?
        `, [id, patientId]);
        if (!rows.length) return res.status(404).json({ message: 'Appointment not found.' });
        const app = rows[0];
        res.status(200).json({
            appointment_id: app.appointment_id,
            doctor_id: app.doctor_id,
            doctorName: `Dr. ${app.doctor_first_name} ${app.doctor_last_name}`,
            specialization: app.specialization,
            appointment_date: app.appointment_date,
            reason: app.reason,
            status: app.status
        });
    } catch (e) {
        console.error('Error getting appointment:', e);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

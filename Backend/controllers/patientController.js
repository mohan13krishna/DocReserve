const db = require('../models/db');

// Helper to format date for display
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
  return date.toLocaleDateString('en-US', options).replace(',', '')
             .replace('at', '');
};

exports.getPatientDashboardOverview = async (req, res) => {
  try {
    const patientId = req.user.patient_id;

    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID not found for this user.' });
    }

    // Upcoming Appointments
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
      WHERE a.patient_id = ? AND a.status IN ('Upcoming', 'Confirmed', 'Pending')
      ORDER BY a.appointment_date ASC
      LIMIT 3;
    `, [patientId]);

    // Total Visits
    const [totalVisitsResult] = await db.execute(`
      SELECT COUNT(*) AS total_visits
      FROM Appointments
      WHERE patient_id = ? AND status = 'Completed';
    `, [patientId]);
    const totalVisits = totalVisitsResult[0].total_visits;

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
        const patientId = req.user.patient_id;
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
    const patientId = req.user.patient_id;
    const { first_name, last_name, phone_number, date_of_birth, address,
            blood_type, gender, allergies, current_medications, medical_conditions,
            insurance_provider, policy_number, group_number, member_id,
            emergency_contact_name, emergency_contact_relationship, emergency_contact_phone } = req.body;

    try {
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
            ORDER BY a.appointment_date DESC;
        `, [patientId]);

        const upcoming = [];
        const past = [];
        const cancelled = [];

        const now = new Date();
        appointments.forEach(app => {
            const appDate = new Date(app.appointment_date);
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
            } else if (appDate > now && (app.status === 'Upcoming' || app.status === 'Confirmed' || app.status === 'Pending')) {
                upcoming.push(formattedApp);
            } else {
                past.push(formattedApp);
            }
        });

        res.status(200).json({ upcoming, past, cancelled });

    } catch (error) {
        console.error('Error fetching patient appointments:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// You'd add more functions for booking, rescheduling, cancelling appointments here
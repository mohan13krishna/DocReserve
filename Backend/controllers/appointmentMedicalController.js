const db = require('../models/db');

// Get appointment details with patient information
const getAppointmentDetails = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        
        // Query to get appointment details with patient information
        const query = `
            SELECT 
                a.appointment_id,
                a.appointment_date,
                a.reason,
                a.status,
                a.notes,
                p.patient_id,
                p.first_name,
                p.last_name,
                p.date_of_birth,
                p.phone_number,
                p.gender,
                p.blood_type,
                p.allergies,
                p.current_medications,
                p.medical_conditions,
                p.address
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            WHERE a.appointment_id = ?
        `;
        
        const [rows] = await db.execute(query, [appointmentId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Appointment not found' 
            });
        }
        
        const appointmentData = rows[0];
        
        // Structure the response
        const response = {
            appointment: {
                appointment_id: appointmentData.appointment_id,
                appointment_date: appointmentData.appointment_date,
                reason: appointmentData.reason,
                status: appointmentData.status,
                notes: appointmentData.notes
            },
            patient: {
                patient_id: appointmentData.patient_id,
                first_name: appointmentData.first_name,
                last_name: appointmentData.last_name,
                date_of_birth: appointmentData.date_of_birth,
                phone_number: appointmentData.phone_number,
                gender: appointmentData.gender,
                blood_type: appointmentData.blood_type,
                allergies: appointmentData.allergies,
                current_medications: appointmentData.current_medications,
                medical_conditions: appointmentData.medical_conditions,
                address: appointmentData.address
            }
        };
        
        res.json({
            success: true,
            data: response
        });
        
    } catch (error) {
        console.error('Error fetching appointment details:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Complete appointment with medical records
const completeAppointmentWithRecords = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const {
            symptoms,
            diagnosis,
            treatment,
            prescribed_medicines,
            follow_up,
            doctor_notes,
            session_duration,
            session_start_time
        } = req.body;
        
        // No need to map field names - use original field names from frontend
        
        // Get appointment details first
        const appointmentQuery = `
            SELECT appointment_id, patient_id, doctor_id, appointment_date 
            FROM appointments 
            WHERE appointment_id = ?
        `;
        
        const [appointmentRows] = await db.execute(appointmentQuery, [appointmentId]);
        
        if (appointmentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        const appointment = appointmentRows[0];
        
        // Get connection from pool for transaction
        const connection = await db.getConnection();
        
        try {
            // Start transaction
            await connection.beginTransaction();
            
            // Update appointment status to completed
            const updateAppointmentQuery = `
                UPDATE appointments 
                SET status = 'Completed', notes = ? 
                WHERE appointment_id = ?
            `;
            
            await connection.execute(updateAppointmentQuery, [doctor_notes, appointmentId]);
            
            // Insert medical records
            const insertMedicalRecordsQuery = `
                INSERT INTO completed_appointments_medical_records (
                    appointment_id, patient_id, doctor_id, appointment_date, symptoms, diagnosis, 
                    treatment, prescribed_medicines, follow_up, 
                    doctor_notes, session_duration, session_start_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await connection.execute(insertMedicalRecordsQuery, [
                appointmentId, appointment.patient_id, appointment.doctor_id, appointment.appointment_date,
                symptoms, diagnosis, treatment, prescribed_medicines,
                follow_up, doctor_notes, session_duration, session_start_time
            ]);
            
            // Commit transaction
            await connection.commit();
            
            res.json({
                success: true,
                message: 'Appointment completed successfully with medical records',
                data: {
                    appointment_id: appointmentId,
                    status: 'Completed'
                }
            });
            
        } catch (error) {
            // Rollback transaction on error
            await connection.rollback();
            throw error;
        } finally {
            // Release connection back to pool
            connection.release();
        }
        
    } catch (error) {
        console.error('Error completing appointment with records:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get medical records for a patient
const getPatientMedicalRecords = async (req, res) => {
    try {
        const { patientId } = req.params;
        
        const query = `
            SELECT 
                mr.*,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.specialization
            FROM completed_appointments_medical_records mr
            JOIN doctors d ON mr.doctor_id = d.doctor_id
            WHERE mr.patient_id = ?
            ORDER BY mr.appointment_date DESC
        `;
        
        const [rows] = await db.execute(query, [patientId]);
        
        res.json({
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('Error fetching patient medical records:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get medical records for a specific appointment
const getAppointmentMedicalRecord = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        
        const query = `
            SELECT 
                mr.*,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.specialization
            FROM completed_appointments_medical_records mr
            JOIN patients p ON mr.patient_id = p.patient_id
            JOIN doctors d ON mr.doctor_id = d.doctor_id
            WHERE mr.appointment_id = ?
        `;
        
        const [rows] = await db.execute(query, [appointmentId]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Medical record not found for this appointment'
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
        
    } catch (error) {
        console.error('Error fetching appointment medical record:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get medical records for a specific appointment
const getMedicalRecords = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { user_id, role } = req.user;
        
        // Debug logging
        console.log('getMedicalRecords - appointmentId:', appointmentId);
        console.log('getMedicalRecords - user_id:', user_id);
        console.log('getMedicalRecords - role:', role);
        console.log('getMedicalRecords - req.user:', req.user);
        
        // Validate required parameters
        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: 'Appointment ID is required'
            });
        }
        
        if (!user_id || !role) {
            return res.status(400).json({
                success: false,
                message: 'User authentication information is missing'
            });
        }
        
        // First check if the appointment exists and get patient info
        const appointmentQuery = `
            SELECT a.patient_id, a.doctor_id
            FROM appointments a
            WHERE a.appointment_id = ?
        `;
        
        const [appointmentData] = await db.execute(appointmentQuery, [appointmentId]);
        
        if (appointmentData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        const { patient_id, doctor_id } = appointmentData[0];
        
        // Authorization check: patients can only view their own records, doctors can view their patients' records
        if (role === 'user') {
            // For patients, we need to get their patient_id from the patients table using their user_id
            const patientQuery = `SELECT patient_id FROM patients WHERE user_id = ?`;
            const [patientData] = await db.execute(patientQuery, [user_id]);
            
            if (patientData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Patient profile not found'
                });
            }
            
            const userPatientId = patientData[0].patient_id;
            
            if (patient_id !== userPatientId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You can only view your own medical records'
                });
            }
        } else if (role === 'doctor') {
            // For doctors, we need to get their doctor_id from the doctors table using their user_id
            const doctorQuery = `SELECT doctor_id FROM doctors WHERE user_id = ?`;
            const [doctorData] = await db.execute(doctorQuery, [user_id]);
            
            if (doctorData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor profile not found'
                });
            }
            
            const userDoctorId = doctorData[0].doctor_id;
            
            if (doctor_id !== userDoctorId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You can only view records for your own patients'
                });
            }
        }
        
        const query = `
            SELECT 
                camr.*,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                p.date_of_birth,
                p.gender,
                p.blood_type,
                p.allergies,
                p.current_medications,
                p.medical_conditions,
                a.appointment_date,
                a.reason as appointment_reason,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.specialization
            FROM completed_appointments_medical_records camr
            JOIN appointments a ON camr.appointment_id = a.appointment_id
            JOIN patients p ON camr.patient_id = p.patient_id
            JOIN doctors d ON camr.doctor_id = d.doctor_id
            WHERE camr.appointment_id = ?
        `;
        
        const [records] = await db.execute(query, [appointmentId]);
        
        if (records.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Medical records not found for this appointment'
            });
        }
        
        res.json({
            success: true,
            data: records[0]
        });
        
    } catch (error) {
        console.error('Error fetching medical records:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Submit rating for completed appointment (by patient)
const submitAppointmentRating = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const {
            patient_rating,
            doctor_rating,
            service_rating,
            patient_feedback,
            would_recommend
        } = req.body;
        
        // Validate rating values
        const ratings = [patient_rating, doctor_rating, service_rating].filter(r => r !== null && r !== undefined);
        for (const rating of ratings) {
            if (rating < 1.0 || rating > 5.0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ratings must be between 1.0 and 5.0'
                });
            }
        }
        
        // Check if appointment exists and is completed
        const checkQuery = `
            SELECT camr.record_id, camr.patient_id, camr.rating_status
            FROM completed_appointments_medical_records camr
            WHERE camr.appointment_id = ?
        `;
        
        const [existingRecords] = await db.execute(checkQuery, [appointmentId]);
        
        if (existingRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Completed appointment record not found'
            });
        }
        
        const record = existingRecords[0];
        
        // Check if rating already submitted
        if (record.rating_status === 'submitted') {
            return res.status(400).json({
                success: false,
                message: 'Rating has already been submitted for this appointment'
            });
        }
        
        // Update the record with rating information
        const updateQuery = `
            UPDATE completed_appointments_medical_records 
            SET 
                patient_rating = ?,
                doctor_rating = ?,
                service_rating = ?,
                patient_feedback = ?,
                would_recommend = ?,
                rating_date = CURRENT_TIMESTAMP,
                rating_status = 'submitted'
            WHERE appointment_id = ?
        `;
        
        await db.execute(updateQuery, [
            patient_rating || null,
            doctor_rating || null,
            service_rating || null,
            patient_feedback || null,
            would_recommend || null,
            appointmentId
        ]);
        
        res.json({
            success: true,
            message: 'Rating submitted successfully',
            data: {
                appointment_id: appointmentId,
                rating_status: 'submitted'
            }
        });
        
    } catch (error) {
        console.error('Error submitting appointment rating:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get appointments available for rating by patient
const getAppointmentsForRating = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { user_id, role } = req.user;
        
        // For patients, get their actual patient_id from the patients table
        let actualPatientId;
        
        if (role === 'user') {
            const patientQuery = `SELECT patient_id FROM patients WHERE user_id = ?`;
            const [patientData] = await db.execute(patientQuery, [user_id]);
            
            if (patientData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Patient profile not found'
                });
            }
            
            actualPatientId = patientData[0].patient_id;
        } else {
            // For other roles, use the provided patientId
            actualPatientId = patientId;
        }
        
        const query = `
            SELECT 
                camr.appointment_id,
                camr.appointment_date,
                camr.rating_status,
                camr.patient_rating,
                camr.doctor_rating,
                camr.service_rating,
                camr.rating_date,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.specialization,
                a.reason as appointment_reason
            FROM completed_appointments_medical_records camr
            JOIN doctors d ON camr.doctor_id = d.doctor_id
            JOIN appointments a ON camr.appointment_id = a.appointment_id
            WHERE camr.patient_id = ?
            ORDER BY camr.appointment_date DESC
        `;
        
        const [records] = await db.execute(query, [actualPatientId]);
        
        res.json({
            success: true,
            data: records
        });
        
    } catch (error) {
        console.error('Error fetching appointments for rating:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get doctor ratings and statistics
const getDoctorRatings = async (req, res) => {
    try {
        const { doctorId } = req.params;
        
        const query = `
            SELECT 
                COUNT(*) as total_ratings,
                AVG(patient_rating) as avg_patient_rating,
                AVG(doctor_rating) as avg_doctor_rating,
                AVG(service_rating) as avg_service_rating,
                SUM(CASE WHEN would_recommend = 1 THEN 1 ELSE 0 END) as recommend_count,
                COUNT(CASE WHEN would_recommend IS NOT NULL THEN 1 END) as recommend_total
            FROM completed_appointments_medical_records
            WHERE doctor_id = ? AND rating_status = 'submitted'
        `;
        
        const [stats] = await db.execute(query, [doctorId]);
        
        // Get recent reviews
        const reviewsQuery = `
            SELECT 
                patient_rating,
                doctor_rating,
                service_rating,
                patient_feedback,
                would_recommend,
                rating_date,
                appointment_date
            FROM completed_appointments_medical_records
            WHERE doctor_id = ? AND rating_status = 'submitted' AND patient_feedback IS NOT NULL
            ORDER BY rating_date DESC
            LIMIT 10
        `;
        
        const [reviews] = await db.execute(reviewsQuery, [doctorId]);
        
        const result = {
            statistics: stats[0],
            recent_reviews: reviews
        };
        
        // Calculate recommendation percentage
        if (result.statistics.recommend_total > 0) {
            result.statistics.recommendation_percentage = 
                (result.statistics.recommend_count / result.statistics.recommend_total * 100).toFixed(1);
        } else {
            result.statistics.recommendation_percentage = 0;
        }
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('Error fetching doctor ratings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    getAppointmentDetails,
    completeAppointmentWithRecords,
    getPatientMedicalRecords,
    getAppointmentMedicalRecord,
    getMedicalRecords,
    submitAppointmentRating,
    getAppointmentsForRating,
    getDoctorRatings
};

const db = require('../models/db');

exports.getAdminDashboardOverview = async (req, res) => {
    try {
        const hospitalId = req.user.hospital_id;

        const [totalDoctorsResult] = await db.execute(`
            SELECT COUNT(*) AS count FROM Doctors WHERE hospital_id = ? AND is_approved = TRUE;
        `, [hospitalId]);
        const totalDoctors = totalDoctorsResult[0].count;

        const [pendingApprovalsResult] = await db.execute(`
            SELECT COUNT(*) AS count FROM Doctors WHERE hospital_id = ? AND is_approved = FALSE;
        `, [hospitalId]);
        const pendingApprovals = pendingApprovalsResult[0].count;

        const [todayAppointmentsResult] = await db.execute(`
            SELECT COUNT(a.appointment_id) AS count
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE d.hospital_id = ? AND DATE(a.appointment_date) = CURDATE();
        `, [hospitalId]);
        const todayAppointments = todayAppointmentsResult[0].count;

        const [totalPatientsResult] = await db.execute(`
            SELECT COUNT(DISTINCT a.patient_id) AS count
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE d.hospital_id = ?;
        `, [hospitalId]);
        const totalPatients = totalPatientsResult[0].count;

        res.status(200).json({
            totalDoctors,
            pendingApprovals,
            todayAppointments,
            totalPatients
        });

    } catch (error) {
        console.error('Error fetching hospital admin overview:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getPendingDoctorApprovals = async (req, res) => {
    try {
        const hospitalId = req.user.hospital_id;
        const [doctors] = await db.execute(`
            SELECT d.doctor_id, d.first_name, d.last_name, d.specialization,
                   h.hospital_name, u.email, u.created_at AS applied_date
            FROM Doctors d
            JOIN Users u ON d.user_id = u.user_id
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE d.hospital_id = ? AND d.is_approved = FALSE;
        `, [hospitalId]);

        res.status(200).json(doctors);
    } catch (error) {
        console.error('Error fetching pending doctor approvals:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getApprovedDoctors = async (req, res) => {
    try {
        const hospitalId = req.user.hospital_id;
        const { search = '', specialization = '', status = '' } = req.query;

        let query = `
            SELECT d.doctor_id, d.first_name, d.last_name, d.specialization, d.rating, d.experience_years, d.is_available as status,
                   (SELECT COUNT(*) FROM Appointments a WHERE a.doctor_id = d.doctor_id) as total_appointments
            FROM Doctors d
            WHERE d.hospital_id = ? AND d.is_approved = TRUE
        `;
        const params = [hospitalId];

        if (search) {
            query += ` AND (d.first_name LIKE ? OR d.last_name LIKE ? OR d.specialization LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (specialization) {
            query += ` AND d.specialization = ?`;
            params.push(specialization);
        }
        if (status) {
            // is_available for status: Active (true), On Leave/Inactive (false)
            if (status === 'Active') {
                query += ` AND d.is_available = TRUE`;
            } else if (status === 'On Leave' || status === 'Inactive') {
                query += ` AND d.is_available = FALSE`;
            }
        }

        query += ` ORDER BY d.last_name, d.first_name`; // Add pagination/limit if needed

        const [doctors] = await db.execute(query, params);

        res.status(200).json({ doctors, totalCount: doctors.length }); // Provide totalCount for pagination
    } catch (error) {
        console.error('Error fetching approved doctors:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};


exports.approveDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalId = req.user.hospital_id;

        const [result] = await db.execute(
            'UPDATE Doctors SET is_approved = TRUE WHERE doctor_id = ? AND hospital_id = ?',
            [id, hospitalId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Doctor not found or not within your hospital.' });
        }

        res.status(200).json({ message: 'Doctor approved successfully.' });
    } catch (error) {
        console.error('Error approving doctor:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.rejectDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalId = req.user.hospital_id;

        // Optionally, you might delete the doctor user and profile, or just mark as rejected
        // For simplicity, let's just delete the Doctor entry and its linked User
        const [doctorRows] = await db.execute('SELECT user_id FROM Doctors WHERE doctor_id = ? AND hospital_id = ?', [id, hospitalId]);
        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Doctor not found or not within your hospital.' });
        }
        const userId = doctorRows[0].user_id;

        // Delete from Doctors table (CASCADE will handle User table if foreign key is set up with onDelete CASCADE)
        await db.execute('DELETE FROM Doctors WHERE doctor_id = ?', [id]);
        await db.execute('DELETE FROM Users WHERE user_id = ?', [userId]);


        res.status(200).json({ message: 'Doctor request rejected and removed.' });
    } catch (error) {
        console.error('Error rejecting doctor:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getHospitalAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.hospital_admin_id; // from token payload
        const [adminRows] = await db.execute(`
            SELECT ha.*, u.email, h.hospital_name
            FROM HospitalAdmins ha
            JOIN Users u ON ha.user_id = u.user_id
            LEFT JOIN Hospitals h ON ha.hospital_id = h.hospital_id
            WHERE ha.admin_id = ?
        `, [adminId]);

        if (adminRows.length === 0) {
            return res.status(404).json({ message: 'Hospital Admin profile not found.' });
        }
        res.status(200).json(adminRows[0]);
    } catch (error) {
        console.error('Error fetching hospital admin profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.updateHospitalAdminProfile = async (req, res) => {
    const adminId = req.user.hospital_admin_id;
    const { first_name, last_name, phone_number, department } = req.body; // Hospital name is read-only

    try {
        await db.execute(`
            UPDATE HospitalAdmins SET
                first_name = ?, last_name = ?, phone_number = ?, department = ?
            WHERE admin_id = ?
        `, [
            first_name, last_name, phone_number, department,
            adminId
        ]);
        res.status(200).json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Error updating hospital admin profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getHospitalAnalyticsData = async (req, res) => {
    try {
        const hospitalId = req.user.hospital_id;
        // Mock data for analytics as this would involve complex queries and data aggregation
        // In a real application, you'd perform SQL queries here to get real data.

        const appointmentStats = {
            daily: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], data: [45, 52, 38, 65, 72, 45, 28] },
            weekly: { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], data: [250, 280, 260, 310] },
            monthly: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [1000, 1100, 950, 1200, 1350, 1300] }
        };

        const departmentDistribution = {
            labels: ['Cardiology', 'Neurology', 'Pediatrics', 'Surgery'],
            data: [30, 25, 20, 25]
        };

        const topDoctors = [
            { name: 'Dr. Alex Kumar', department: 'Cardiology', appointments: 342, rating: 4.9, revenue: '$68,400', growth: '+18%' },
            { name: 'Dr. Jennifer Lee', department: 'Surgery', appointments: 298, rating: 4.8, revenue: '$89,600', growth: '+24%' },
            { name: 'Dr. Robert Davis', department: 'Pediatrics', appointments: 280, rating: 4.7, revenue: '$55,200', growth: '+10%' }
        ];

        const metrics = {
            patientSatisfaction: { score: 4.7, reviews: 2847 },
            avgWaitTime: { minutes: 18, change: '-12% from last week' },
            cancellationRate: { rate: '5.2%', change: '↑+2.1% from last week' }
        };

        res.status(200).json({
            appointmentStats,
            departmentDistribution,
            topDoctors,
            metrics
        });

    } catch (error) {
        console.error('Error fetching hospital analytics:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
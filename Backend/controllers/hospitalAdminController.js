const db = require('../models/db');
const bcrypt = require('bcryptjs');

exports.getAdminDashboardOverview = async (req, res) => {
    try {
        const hospitalCode = req.user.hospital_code; // Filter strictly by hospital_code

        const [totalDoctorsResult] = await db.execute(`
            SELECT COUNT(*) AS count
            FROM Doctors d
            WHERE (d.hospital_code = ? OR (d.hospital_code IS NULL AND d.hospital_id IN (SELECT h2.hospital_id FROM Hospitals h2 WHERE h2.hospital_code = ?)))
              AND d.is_approved = TRUE;
        `, [hospitalCode, hospitalCode]);
        const totalDoctors = totalDoctorsResult[0].count;

        const [pendingApprovalsResult] = await db.execute(`
            SELECT COUNT(*) AS count
            FROM Doctors d
            WHERE (d.hospital_code = ? OR (d.hospital_code IS NULL AND d.hospital_id IN (SELECT h2.hospital_id FROM Hospitals h2 WHERE h2.hospital_code = ?)))
              AND d.is_approved = FALSE;
        `, [hospitalCode, hospitalCode]);
        const pendingApprovals = pendingApprovalsResult[0].count;

        const [todayAppointmentsResult] = await db.execute(`
            SELECT COUNT(a.appointment_id) AS count
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE (d.hospital_code = ? OR h.hospital_code = ?)
              AND DATE(a.appointment_date) = CURDATE();
        `, [hospitalCode, hospitalCode]);
        const todayAppointments = todayAppointmentsResult[0].count;

        const [totalPatientsResult] = await db.execute(`
            SELECT COUNT(DISTINCT a.patient_id) AS count
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE (d.hospital_code = ? OR h.hospital_code = ?);
        `, [hospitalCode, hospitalCode]);
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


// CRUD for Approved Doctors (view/update/delete)
exports.getDoctorById = async (req, res) => {
    try {
        const hospitalCode = req.user.hospital_code;
        const { id } = req.params;
        const [rows] = await db.execute(`
            SELECT d.doctor_id, d.first_name, d.last_name, d.specialization, d.rating, d.experience_years, d.is_available
            FROM Doctors d
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE d.doctor_id = ? AND d.is_approved = TRUE AND (d.hospital_code = ? OR h.hospital_code = ?)
        `, [id, hospitalCode, hospitalCode]);
        if (!rows.length) return res.status(404).json({ message: 'Doctor not found.' });
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching doctor:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.updateDoctor = async (req, res) => {
    try {
        const hospitalCode = req.user.hospital_code;
        const { id } = req.params;
        const { first_name, last_name, specialization, is_available } = req.body;
        const [result] = await db.execute(`
            UPDATE Doctors d
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            SET d.first_name = COALESCE(?, d.first_name),
                d.last_name = COALESCE(?, d.last_name),
                d.specialization = COALESCE(?, d.specialization),
                d.is_available = COALESCE(?, d.is_available)
            WHERE d.doctor_id = ? AND d.is_approved = TRUE AND (d.hospital_code = ? OR h.hospital_code = ?)
        `, [first_name, last_name, specialization, is_available, id, hospitalCode, hospitalCode]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Doctor not found or not in your hospital.' });
        res.status(200).json({ message: 'Doctor updated successfully.' });
    } catch (error) {
        console.error('Error updating doctor:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.deleteDoctor = async (req, res) => {
    try {
        const hospitalCode = req.user.hospital_code;
        const { id } = req.params;
        // Ensure doctor is in this hospital
        const [rows] = await db.execute(`SELECT user_id FROM Doctors d LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id WHERE d.doctor_id = ? AND (d.hospital_code = ? OR h.hospital_code = ?)`, [id, hospitalCode, hospitalCode]);
        if (!rows.length) return res.status(404).json({ message: 'Doctor not found or not in your hospital.' });
        const userId = rows[0].user_id;
        await db.execute('DELETE FROM Doctors WHERE doctor_id = ?', [id]);
        await db.execute('DELETE FROM Users WHERE user_id = ?', [userId]);
        res.status(200).json({ message: 'Doctor removed successfully.' });
    } catch (error) {
        console.error('Error deleting doctor:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getPendingDoctorApprovals = async (req, res) => {
    try {
        const hospitalCode = req.user.hospital_code;
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.max(parseInt(req.query.limit || '10', 10), 1);
        const offset = (page - 1) * limit;

        // Total count
        const [countRows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM Doctors d
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE d.is_approved = FALSE
              AND (d.hospital_code = ? OR h.hospital_code = ?)
        `, [hospitalCode, hospitalCode]);
        const total = countRows[0]?.total || 0;
        const totalPages = Math.max(Math.ceil(total / limit), 1);

        // Page data
        const [doctors] = await db.execute(`
            SELECT d.doctor_id, d.first_name, d.last_name, d.specialization,
                   h.hospital_name, u.email,
                   u.created_at AS applied_date
            FROM Doctors d
            JOIN Users u ON d.user_id = u.user_id
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE d.is_approved = FALSE
              AND (d.hospital_code = ? OR h.hospital_code = ?)
            ORDER BY applied_date DESC
            LIMIT ? OFFSET ?
        `, [hospitalCode, hospitalCode, limit, offset]);

        res.status(200).json({ doctors, totalCount: total, page, limit, totalPages });
    } catch (error) {
        console.error('Error fetching pending doctor approvals:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getApprovedDoctors = async (req, res) => {
    try {
        const hospitalCode = req.user.hospital_code;
        const { search = '', specialization = '', status = '', page: pageStr = '1', limit: limitStr = '10' } = req.query;
        const page = Math.max(parseInt(pageStr, 10) || 1, 1);
        const limit = Math.max(parseInt(limitStr, 10) || 10, 1);
        const offset = (page - 1) * limit;

        let baseWhere = `WHERE d.is_approved = TRUE AND (d.hospital_code = ? OR h.hospital_code = ?)`;
        const params = [hospitalCode, hospitalCode];

        if (search) {
            baseWhere += ` AND (d.first_name LIKE ? OR d.last_name LIKE ? OR d.specialization LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (specialization) {
            baseWhere += ` AND d.specialization = ?`;
            params.push(specialization);
        }
        if (status) {
            if (status === 'Active') baseWhere += ` AND d.is_available = TRUE`;
            else if (status === 'On Leave' || status === 'Inactive') baseWhere += ` AND d.is_available = FALSE`;

        }

        // Count total
        const [countRows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM Doctors d
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            ${baseWhere}
        `, params);
        const total = countRows[0]?.total || 0;
        const totalPages = Math.max(Math.ceil(total / limit), 1);

        // Page rows
        const [doctors] = await db.execute(`
            SELECT d.doctor_id, d.first_name, d.last_name, d.specialization, d.rating, d.experience_years, d.is_available as status,
                   (SELECT COUNT(*) FROM Appointments a WHERE a.doctor_id = d.doctor_id) as total_appointments
            FROM Doctors d
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            ${baseWhere}
            ORDER BY d.last_name, d.first_name
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.status(200).json({ doctors, totalCount: total, page, limit, totalPages });
    } catch (error) {
        console.error('Error fetching approved doctors:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};


exports.approveDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalCode = req.user.hospital_code;

        const [result] = await db.execute(
            'UPDATE Doctors SET is_approved = TRUE, hospital_code = COALESCE(hospital_code, ?) WHERE doctor_id = ? AND (hospital_code = ? OR hospital_code IS NULL)',
            [hospitalCode, id, hospitalCode]
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
        const hospitalCode = req.user.hospital_code;

        // Ensure the doctor belongs to this hospital (by code) before deletion
        const [doctorRows] = await db.execute('SELECT user_id FROM Doctors WHERE doctor_id = ? AND (hospital_code = ? OR hospital_code IS NULL)', [id, hospitalCode]);
        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Doctor not found or not within your hospital.' });
        }
        const userId = doctorRows[0].user_id;

        await db.execute('DELETE FROM Doctors WHERE doctor_id = ?', [id]);
        await db.execute('DELETE FROM Users WHERE user_id = ?', [userId]);

        res.status(200).json({ message: 'Doctor request rejected and removed.' });
    } catch (error) {
        console.error('Error rejecting doctor:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};


// Leave Requests for Doctors
exports.getLeaveRequests = async (req, res) => {
    try {
        const hospitalCode = req.user.hospital_code;
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.max(parseInt(req.query.limit || '10', 10), 1);
        const offset = (page - 1) * limit;

        // Count total leave requests for doctors belonging to this hospital
        const [countRows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM DoctorLeaveRequests lr
            JOIN Doctors d ON lr.doctor_id = d.doctor_id
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE (d.hospital_code = ? OR h.hospital_code = ?)
        `, [hospitalCode, hospitalCode]);
        const total = countRows[0]?.total || 0;
        const totalPages = Math.max(Math.ceil(total / limit), 1);

        const [rows] = await db.execute(`
            SELECT lr.leave_id, lr.requested_date, lr.reason, lr.status,
                   d.doctor_id, d.first_name, d.last_name, d.specialization
            FROM DoctorLeaveRequests lr
            JOIN Doctors d ON lr.doctor_id = d.doctor_id
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE (d.hospital_code = ? OR h.hospital_code = ?)
            ORDER BY lr.created_at DESC
            LIMIT ? OFFSET ?
        `, [hospitalCode, hospitalCode, limit, offset]);

        res.status(200).json({ requests: rows, totalCount: total, page, limit, totalPages });
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.approveLeaveRequest = async (req, res) => {
    try {
        const hospitalCode = req.user.hospital_code;
        const { id } = req.params; // leave_id
        // validate the request belongs to this hospital
        const [rows] = await db.execute(`
            SELECT lr.doctor_id
            FROM DoctorLeaveRequests lr
            JOIN Doctors d ON lr.doctor_id = d.doctor_id
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE lr.leave_id = ? AND (d.hospital_code = ? OR h.hospital_code = ?)
        `, [id, hospitalCode, hospitalCode]);
        if (!rows.length) return res.status(404).json({ message: 'Leave request not found.' });
        await db.execute('UPDATE DoctorLeaveRequests SET status = "Approved" WHERE leave_id = ?', [id]);
        res.status(200).json({ message: 'Leave request approved.' });
    } catch (error) {
        console.error('Error approving leave request:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.rejectLeaveRequest = async (req, res) => {
    try {
        const hospitalCode = req.user.hospital_code;
        const { id } = req.params; // leave_id
        const [rows] = await db.execute(`
            SELECT lr.doctor_id
            FROM DoctorLeaveRequests lr
            JOIN Doctors d ON lr.doctor_id = d.doctor_id
            LEFT JOIN Hospitals h ON d.hospital_id = h.hospital_id
            WHERE lr.leave_id = ? AND (d.hospital_code = ? OR h.hospital_code = ?)
        `, [id, hospitalCode, hospitalCode]);
        if (!rows.length) return res.status(404).json({ message: 'Leave request not found.' });
        await db.execute('UPDATE DoctorLeaveRequests SET status = "Rejected" WHERE leave_id = ?', [id]);
        res.status(200).json({ message: 'Leave request rejected.' });
    } catch (error) {
        console.error('Error rejecting leave request:', error);
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

        // 1) Appointment stats
        // Daily: last 7 days
        const [dailyRows] = await db.execute(`
            SELECT DATE(a.appointment_date) AS day, COUNT(*) AS count
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE d.hospital_id = ? AND a.appointment_date >= CURDATE() - INTERVAL 6 DAY
            GROUP BY DATE(a.appointment_date)
            ORDER BY day ASC;
        `, [hospitalId]);
        // Weekly: last 4 ISO weeks (YEARWEEK)
        const [weeklyRows] = await db.execute(`
            SELECT YEARWEEK(a.appointment_date, 1) AS yw, COUNT(*) AS count
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE d.hospital_id = ? AND a.appointment_date >= CURDATE() - INTERVAL 27 DAY
            GROUP BY YEARWEEK(a.appointment_date,1)
            ORDER BY yw ASC;
        `, [hospitalId]);
        // Monthly: last 6 months
        const [monthlyRows] = await db.execute(`
            SELECT DATE_FORMAT(a.appointment_date, '%Y-%m') AS ym, COUNT(*) AS count
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE d.hospital_id = ? AND a.appointment_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
            GROUP BY DATE_FORMAT(a.appointment_date, '%Y-%m')
            ORDER BY ym ASC;
        `, [hospitalId]);

        // Helper to fill last N days
        const genLastNDays = (n) => {
            const days = [];
            for (let i = n - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                days.push(d);
            }
            return days;
        };
        const dailyDates = genLastNDays(7);
        const dailyMap = new Map(dailyRows.map(r => [new Date(r.day).toISOString().slice(0,10), r.count]));
        const dailyLabels = dailyDates.map(d => d.toISOString().slice(0,10));
        const dailyData = dailyLabels.map(k => dailyMap.get(k) || 0);

        // Weekly labels: keep as last up to 4 entries from weeklyRows
        const weeklyTrim = weeklyRows.slice(-4);
        const weeklyLabels = weeklyTrim.map(r => `Wk ${r.yw}`);
        const weeklyData = weeklyTrim.map(r => r.count);

        // Monthly labels: ensure last 6 months even if zero
        const genLastNMonths = (n) => {
            const arr = [];
            const now = new Date();
            for (let i = n - 1; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                arr.push(ym);
            }
            return arr;
        };
        const monthlyLabels = genLastNMonths(6);
        const monthlyMap = new Map(monthlyRows.map(r => [r.ym, r.count]));
        const monthlyData = monthlyLabels.map(m => monthlyMap.get(m) || 0);

        const appointmentStats = {
            daily: { labels: dailyLabels, data: dailyData },
            weekly: { labels: weeklyLabels, data: weeklyData },
            monthly: { labels: monthlyLabels, data: monthlyData }
        };

        // 2) Department distribution (by specialization)
        const [deptRows] = await db.execute(`
            SELECT d.specialization AS dept, COUNT(*) AS count
            FROM Doctors d
            WHERE d.hospital_id = ? AND d.is_approved = TRUE
            GROUP BY d.specialization
            ORDER BY count DESC;
        `, [hospitalId]);
        const departmentDistribution = {
            labels: deptRows.map(r => r.dept || 'Unknown'),
            data: deptRows.map(r => r.count)
        };

        // 3) Top doctors (last 30 days by appointments)
        const [topRows] = await db.execute(`
            SELECT d.doctor_id, d.first_name, d.last_name, d.specialization, d.rating,
                   COUNT(a.appointment_id) AS appointments
            FROM Doctors d
            LEFT JOIN Appointments a ON a.doctor_id = d.doctor_id AND a.appointment_date >= CURDATE() - INTERVAL 30 DAY
            WHERE d.hospital_id = ? AND d.is_approved = TRUE
            GROUP BY d.doctor_id
            ORDER BY appointments DESC
            LIMIT 5;
        `, [hospitalId]);
        // Compute growth vs previous 30 days
        const topDoctorIds = topRows.map(r => r.doctor_id);
        let growthMap = new Map();
        if (topDoctorIds.length) {
            const placeholders = topDoctorIds.map(() => '?').join(',');
            const [currRows] = await db.execute(`
                SELECT a.doctor_id, COUNT(*) AS cnt
                FROM Appointments a
                WHERE a.doctor_id IN (${placeholders}) AND a.appointment_date >= CURDATE() - INTERVAL 30 DAY
                GROUP BY a.doctor_id
            `, topDoctorIds);
            const [prevRows] = await db.execute(`
                SELECT a.doctor_id, COUNT(*) AS cnt
                FROM Appointments a
                WHERE a.doctor_id IN (${placeholders}) AND a.appointment_date < CURDATE() - INTERVAL 30 DAY AND a.appointment_date >= CURDATE() - INTERVAL 60 DAY
                GROUP BY a.doctor_id
            `, topDoctorIds);
            const currMap = new Map(currRows.map(r => [r.doctor_id, r.cnt]));
            const prevMap = new Map(prevRows.map(r => [r.doctor_id, r.cnt]));
            growthMap = new Map(topDoctorIds.map(id => {
                const c = currMap.get(id) || 0;
                const p = prevMap.get(id) || 0;
                const growthPct = p === 0 ? (c > 0 ? 100 : 0) : Math.round(((c - p) / p) * 100);
                const sign = growthPct >= 0 ? '+' : '';
                return [id, `${sign}${growthPct}%`];
            }));
        }
        const topDoctors = topRows.map(r => ({
            name: `Dr. ${r.first_name} ${r.last_name}`,
            department: r.specialization || 'General',
            appointments: r.appointments || 0,
            rating: r.rating || null,
            revenue: '-', // not tracked in schema
            growth: growthMap.get(r.doctor_id) || '+0%'
        }));

        // 4) Metrics
        const [ratingRow] = await db.execute(`
            SELECT ROUND(AVG(d.rating),1) AS avg_rating
            FROM Doctors d
            WHERE d.hospital_id = ? AND d.is_approved = TRUE AND d.rating IS NOT NULL;
        `, [hospitalId]);
        const [appsLast90] = await db.execute(`
            SELECT COUNT(*) AS cnt
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE d.hospital_id = ? AND a.appointment_date >= CURDATE() - INTERVAL 90 DAY;
        `, [hospitalId]);
        const [apps30] = await db.execute(`
            SELECT
                SUM(CASE WHEN a.status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled,
                COUNT(*) AS total
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE d.hospital_id = ? AND a.appointment_date >= CURDATE() - INTERVAL 30 DAY;
        `, [hospitalId]);
        const cancellationRate = apps30[0].total > 0 ? ((apps30[0].cancelled / apps30[0].total) * 100).toFixed(1) + '%' : '0%';

        const metrics = {
            patientSatisfaction: { score: ratingRow[0]?.avg_rating || 0, reviews: appsLast90[0]?.cnt || 0 },
            avgWaitTime: { minutes: 0, change: 'N/A' }, // not tracked; set to N/A
            cancellationRate: { rate: cancellationRate, change: 'N/A' }
        };

        res.status(200).json({ appointmentStats, departmentDistribution, topDoctors, metrics });

    } catch (error) {
        console.error('Error fetching hospital analytics:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Reviews for doctors (placeholder derived from Appointments notes / rating if available)
exports.getDoctorReviews = async (req, res) => {
    try {
        const hospitalId = req.user.hospital_id;
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.max(parseInt(req.query.limit || '10', 10), 1);
        const offset = (page - 1) * limit;

        // If you have a Reviews table, replace this with a proper join.
        // Fallback: synthesize reviews from appointments with notes and join doctor rating.
        const [countRows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE d.hospital_id = ? AND a.notes IS NOT NULL AND a.notes <> ''
        `, [hospitalId]);
        const total = countRows[0]?.total || 0;
        const totalPages = Math.max(Math.ceil(total / limit), 1);

        const [rows] = await db.execute(`
            SELECT a.appointment_id, DATE(a.appointment_date) AS review_date, a.notes AS review_text,
                   d.doctor_id, d.first_name, d.last_name, d.specialization, d.rating
            FROM Appointments a
            JOIN Doctors d ON a.doctor_id = d.doctor_id
            WHERE d.hospital_id = ? AND a.notes IS NOT NULL AND a.notes <> ''
            ORDER BY a.appointment_date DESC
            LIMIT ? OFFSET ?
        `, [hospitalId, limit, offset]);

        res.status(200).json({ reviews: rows, totalCount: total, page, limit, totalPages });
    } catch (error) {
        console.error('Error fetching doctor reviews:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};


// Update password (top-level)
exports.updateHospitalAdminPassword = async (req, res) => {
    try {
        const adminId = req.user.hospital_admin_id;
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ message: 'Current and new password are required.' });
        }
        const [rows] = await db.execute(`
            SELECT u.user_id, u.password
            FROM HospitalAdmins ha
            JOIN Users u ON ha.user_id = u.user_id
            WHERE ha.admin_id = ?
        `, [adminId]);
        if (!rows.length) return res.status(404).json({ message: 'Admin user not found.' });
        const user = rows[0];
        const isMatch = await bcrypt.compare(current_password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect.' });
        const hashed = await bcrypt.hash(new_password, 10);
        await db.execute('UPDATE Users SET password = ? WHERE user_id = ?', [hashed, user.user_id]);
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Error updating hospital admin password:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

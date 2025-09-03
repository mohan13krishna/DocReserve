// backend/controllers/superAdminController.js
const db = require('../models/db');
const bcrypt = require('bcryptjs');

exports.getSuperAdminDashboardOverview = async (req, res) => {
    try {
        const [totalHospitalAdminsResult] = await db.execute('SELECT COUNT(*) AS count FROM HospitalAdmins WHERE is_approved = TRUE;');
        const totalHospitalAdmins = totalHospitalAdminsResult[0].count;

        const [pendingAdminApprovalsResult] = await db.execute('SELECT COUNT(*) AS count FROM HospitalAdmins WHERE is_approved = FALSE;');
        const pendingAdminApprovals = pendingAdminApprovalsResult[0].count;

        const [totalDoctorsResult] = await db.execute('SELECT COUNT(*) AS count FROM Doctors WHERE is_approved = TRUE;');
        const totalDoctors = totalDoctorsResult[0].count;

        const [totalUsersResult] = await db.execute('SELECT COUNT(*) AS count FROM Users WHERE role = "user";');
        const totalUsers = totalUsersResult[0].count;

        res.status(200).json({
            totalHospitalAdmins,
            pendingAdminApprovals,
            totalDoctors,
            totalUsers
        });
    } catch (error) {
        console.error('Error fetching super admin overview:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getPendingHospitalAdminApprovals = async (req, res) => {
    try {
        const { search = '' } = req.query;
        let query = `
            SELECT ha.admin_id, ha.first_name, ha.last_name, h.hospital_name, u.email, u.created_at AS registration_date, ha.is_approved
            FROM HospitalAdmins ha
            JOIN Users u ON ha.user_id = u.user_id
            LEFT JOIN Hospitals h ON ha.hospital_id = h.hospital_id
            WHERE ha.is_approved = FALSE
        `;
        const params = [];

        if (search) {
            query += ` AND (ha.first_name LIKE ? OR ha.last_name LIKE ? OR u.email LIKE ? OR h.hospital_name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY u.created_at DESC;`;

        const [admins] = await db.execute(query, params);
        res.status(200).json({ admins, totalCount: admins.length });
    } catch (error) {
        console.error('Error fetching pending hospital admin approvals:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.approveHospitalAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute(
            'UPDATE HospitalAdmins SET is_approved = TRUE WHERE admin_id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Hospital Admin not found.' });
        }

        res.status(200).json({ message: 'Hospital Admin approved successfully.' });
    } catch (error) {
        console.error('Error approving hospital admin:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.rejectHospitalAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const [adminRows] = await db.execute('SELECT user_id FROM HospitalAdmins WHERE admin_id = ?', [id]);
        if (adminRows.length === 0) {
            return res.status(404).json({ message: 'Hospital Admin not found.' });
        }
        const userId = adminRows[0].user_id;

        await db.execute('DELETE FROM HospitalAdmins WHERE admin_id = ?', [id]);
        await db.execute('DELETE FROM Users WHERE user_id = ?', [userId]);

        res.status(200).json({ message: 'Hospital Admin request rejected and removed.' });
    } catch (error) {
        console.error('Error rejecting hospital admin:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};


// --- Corrected and New functions for hospital management page ---

exports.getApprovedHospitalAdmins = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const offset = (page - 1) * limit;

        // Total count for pagination
        const [countRows] = await db.execute(`
            SELECT COUNT(*) AS count
            FROM HospitalAdmins ha
            JOIN Users u ON ha.user_id = u.user_id
            JOIN Hospitals h ON ha.hospital_id = h.hospital_id
            WHERE ha.is_approved = TRUE
        `);
        const totalCount = countRows[0]?.count || 0;

        // Page data
        const [admins] = await db.execute(`
            SELECT ha.admin_id, ha.first_name, ha.last_name, u.email, u.created_at, h.hospital_name
            FROM HospitalAdmins ha
            JOIN Users u ON ha.user_id = u.user_id
            JOIN Hospitals h ON ha.hospital_id = h.hospital_id
            WHERE ha.is_approved = TRUE
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        const totalPages = Math.ceil(totalCount / limit) || 1;

        res.status(200).json({ admins, totalCount, page, limit, totalPages });
    } catch (error) {
        console.error('Error fetching approved hospital admins:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Corrected query: Removed 'ha.phone_number'
exports.getHospitalAdminDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const [adminRows] = await db.execute(`
            SELECT ha.first_name, ha.last_name, h.hospital_name, u.email, u.created_at
            FROM HospitalAdmins ha
            JOIN Users u ON ha.user_id = u.user_id
            JOIN Hospitals h ON ha.hospital_id = h.hospital_id
            WHERE ha.admin_id = ?
        `, [id]);

        if (adminRows.length === 0) {
            return res.status(404).json({ message: 'Hospital Admin not found.' });
        }
        res.status(200).json(adminRows[0]);
    } catch (error) {
        console.error('Error fetching hospital admin details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Corrected update function to remove phone_number
exports.updateHospitalAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name } = req.body;
        await db.execute(
            'UPDATE HospitalAdmins SET first_name = ?, last_name = ? WHERE admin_id = ?',
            [first_name, last_name, id]
        );
        res.status(200).json({ message: 'Hospital Admin updated successfully.' });
    } catch (error) {
        console.error('Error updating hospital admin:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.deleteHospitalAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const [adminRows] = await db.execute('SELECT user_id FROM HospitalAdmins WHERE admin_id = ?', [id]);
        if (adminRows.length === 0) {
            return res.status(404).json({ message: 'Hospital Admin not found.' });
        }
        const userId = adminRows[0].user_id;

        await db.execute('DELETE FROM HospitalAdmins WHERE admin_id = ?', [id]);
        await db.execute('DELETE FROM Users WHERE user_id = ?', [userId]);

        res.status(200).json({ message: 'Hospital Admin removed successfully.' });
    } catch (error) {
        console.error('Error deleting hospital admin:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

// New functions for managing hospitals
exports.getApprovedHospitals = async (req, res) => {
    try {
        // Pagination params
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.max(parseInt(req.query.limit || '10', 10), 1);
        const offset = (page - 1) * limit;

        // Total count for pagination
        const [countRows] = await db.execute('SELECT COUNT(*) AS total FROM Hospitals');
        const total = countRows[0].total || 0;
        const totalPages = Math.max(Math.ceil(total / limit), 1);

        // Page of hospitals
        const [hospitals] = await db.execute(`
            SELECT
                h.hospital_id,
                h.hospital_name,
                h.hospital_address,
                h.hospital_phone,
                (SELECT COUNT(*) FROM Doctors d WHERE d.hospital_id = h.hospital_id AND d.is_approved = TRUE) AS total_doctors,
                (SELECT COUNT(DISTINCT a.patient_id)
                 FROM Appointments a
                 JOIN Doctors d ON a.doctor_id = d.doctor_id
                 WHERE d.hospital_id = h.hospital_id) AS total_patients_visited,
                (SELECT ROUND(AVG(d.rating), 1) FROM Doctors d WHERE d.hospital_id = h.hospital_id AND d.is_approved = TRUE) AS avg_doctor_rating
            FROM Hospitals h
            GROUP BY h.hospital_id
            ORDER BY h.hospital_id ASC
            LIMIT ? OFFSET ?;
        `, [limit, offset]);

        res.status(200).json({ hospitals, page, limit, total, totalPages });
    } catch (error) {
        console.error('Error fetching approved hospitals:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getHospitalDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const [hospitalDetails] = await db.execute(`
            SELECT
                h.hospital_name,
                h.hospital_address,
                h.hospital_phone,
                (SELECT COUNT(*) FROM Doctors d WHERE d.hospital_id = h.hospital_id AND d.is_approved = TRUE) AS total_doctors,
                (SELECT COUNT(DISTINCT a.patient_id) FROM Appointments a JOIN Doctors d ON a.doctor_id = d.doctor_id WHERE d.hospital_id = h.hospital_id) AS total_patients_visited
            FROM Hospitals h
            WHERE h.hospital_id = ?
        `, [id]);

        if (hospitalDetails.length === 0) {
            return res.status(404).json({ message: 'Hospital not found.' });
        }

        res.status(200).json(hospitalDetails[0]);
    } catch (error) {
        console.error('Error fetching hospital details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.updateHospital = async (req, res) => {
    try {
        const { id } = req.params;
        const { hospital_name, hospital_address, hospital_phone } = req.body;
        await db.execute(
            'UPDATE Hospitals SET hospital_name = ?, hospital_address = ?, hospital_phone = ? WHERE hospital_id = ?',
            [hospital_name, hospital_address, hospital_phone, id]
        );
        res.status(200).json({ message: 'Hospital updated successfully.' });
    } catch (error) {
        console.error('Error updating hospital:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.deleteHospital = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM Hospitals WHERE hospital_id = ?', [id]);
        res.status(200).json({ message: 'Hospital deleted successfully.' });
    } catch (error) {
        console.error('Error deleting hospital:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

// Create Hospital (Super Admin adds)
exports.createHospital = async (req, res) => {
    try {
        const { hospital_name, hospital_code, hospital_phone } = req.body;
        if (!hospital_name) return res.status(400).json({ message: 'Hospital name is required.' });
        if (!hospital_code) return res.status(400).json({ message: 'Hospital code is required.' });
        // Insert with code; address now optional, not included by request
        const [result] = await db.execute(
            'INSERT INTO Hospitals (hospital_name, hospital_phone, hospital_code) VALUES (?, ?, ?)',
            [hospital_name, hospital_phone || null, hospital_code]
        );
        res.status(201).json({ message: 'Hospital created successfully.', hospital_id: result.insertId });
    } catch (error) {
        console.error('Error creating hospital:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getSuperAdminAnalyticsData = async (req, res) => {
    try {
        // User Registration Trends (past 30 days)
        const [userRegistrationTrends] = await db.execute(`
            SELECT DATE(created_at) AS date, COUNT(*) AS count
            FROM Users
            WHERE created_at >= CURDATE() - INTERVAL 30 DAY
            GROUP BY DATE(created_at)
            ORDER BY date ASC;
        `);

        // Doctor Onboarding Statistics (past 30 days)
        const [doctorOnboardingStatistics] = await db.execute(`
            SELECT DATE(u.created_at) AS date, COUNT(*) AS count
            FROM Doctors d
            JOIN Users u ON d.user_id = u.user_id
            WHERE d.is_approved = TRUE AND u.created_at >= CURDATE() - INTERVAL 30 DAY
            GROUP BY DATE(u.created_at)
            ORDER BY date ASC;
        `);

        // User Distribution (by role)
        const [userDistribution] = await db.execute(`
            SELECT role, COUNT(*) AS count
            FROM Users
            GROUP BY role;
        `);

        // Doctor Specialties
        const [doctorSpecialties] = await db.execute(`
            SELECT specialization, COUNT(*) AS count
            FROM Doctors
            WHERE is_approved = TRUE
            GROUP BY specialization
            ORDER BY count DESC;
        `);

        // Hospitals by Area (derive area from address: text after the last comma)
        const [hospitalsByArea] = await db.execute(`
            SELECT
                TRIM(
                    CASE
                        WHEN LOCATE(',', h.hospital_address) > 0 THEN SUBSTRING_INDEX(h.hospital_address, ',', -1)
                        ELSE h.hospital_address
                    END
                ) AS area,
                COUNT(*) AS count
            FROM Hospitals h
            GROUP BY area
            ORDER BY count DESC;
        `);

        // Format data for the frontend
        const formattedUserRegistration = {
            labels: userRegistrationTrends.map(row => row.date.toISOString().split('T')[0]),
            data: userRegistrationTrends.map(row => row.count)
        };

        const formattedDoctorOnboarding = {
            labels: doctorOnboardingStatistics.map(row => row.date.toISOString().split('T')[0]),
            data: doctorOnboardingStatistics.map(row => row.count)
        };

        const formattedUserDistribution = {
            labels: userDistribution.map(row => row.role),
            data: userDistribution.map(row => row.count)
        };

        const formattedDoctorSpecialties = {
            labels: doctorSpecialties.map(row => row.specialization),
            data: doctorSpecialties.map(row => row.count)
        };

        const formattedHospitalCategories = {
            labels: hospitalsByArea.map(row => row.area || 'Unknown'),
            data: hospitalsByArea.map(row => row.count)
        };

        // Rating categories: how many doctors have exact average ratings like 4.9, 4.8, ...
        const [ratingBuckets] = await db.execute(`
            SELECT ROUND(d.rating, 1) AS bucket, COUNT(*) AS count
            FROM Doctors d
            WHERE d.is_approved = TRUE AND d.rating IS NOT NULL
            GROUP BY ROUND(d.rating, 1)
            ORDER BY bucket DESC;
        `);
        const formattedRatingCategories = {
            labels: ratingBuckets.map(r => {
                const n = Number(r.bucket);
                return Number.isFinite(n) ? n.toFixed(1) : 'N/A';
            }),
            data: ratingBuckets.map(r => Number(r.count) || 0)
        };

        res.status(200).json({
            userRegistrationTrends: formattedUserRegistration,
            doctorOnboardingStatistics: formattedDoctorOnboarding,
            userDistribution: formattedUserDistribution,
            doctorSpecialties: formattedDoctorSpecialties,
            hospitalCategories: formattedHospitalCategories,
            ratingCategories: formattedRatingCategories
        });

    } catch (error) {
        console.error('Error fetching super admin analytics data:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// --- Super Admin Profile Endpoints ---
exports.getSuperAdminProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const [rows] = await db.execute(
            'SELECT user_id, email, created_at FROM Users WHERE user_id = ? AND role = "super_admin"',
            [userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'Super admin profile not found.' });
        const user = rows[0];

        const [approvedAdmins] = await db.execute('SELECT COUNT(*) AS count FROM HospitalAdmins WHERE is_approved = TRUE');
        const username = (user.email && user.email.includes('@')) ? user.email.split('@')[0] : 'admin';

        res.status(200).json({
            username,
            email: user.email,
            quickStats: {
                accountCreated: user.created_at ? new Date(user.created_at).toDateString() : 'N/A',
                lastLogin: 'N/A',
                totalSessions: 'N/A',
                hospitalAdminsApproved: approvedAdmins[0]?.count || 0
            }
        });
    } catch (error) {
        console.error('Error fetching super admin profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.updateSuperAdminPassword = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ message: 'Current and new password are required.' });
        }
        const [rows] = await db.execute('SELECT password FROM Users WHERE user_id = ? AND role = "super_admin"', [userId]);
        if (!rows.length) return res.status(404).json({ message: 'Super admin user not found.' });
        const isMatch = await bcrypt.compare(current_password, rows[0].password);
        if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect.' });
        const hashed = await bcrypt.hash(new_password, 10);
        await db.execute('UPDATE Users SET password = ? WHERE user_id = ?', [hashed, userId]);
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Error updating super admin password:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

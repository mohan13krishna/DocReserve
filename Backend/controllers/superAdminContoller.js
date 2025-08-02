const db = require('../models/db');

exports.getSuperAdminDashboardOverview = async (req, res) => {
    try {
        const [totalHospitalAdminsResult] = await db.execute('SELECT COUNT(*) AS count FROM HospitalAdmins;');
        const totalHospitalAdmins = totalHospitalAdminsResult[0].count;

        const [pendingAdminApprovalsResult] = await db.execute('SELECT COUNT(*) AS count FROM HospitalAdmins WHERE is_approved = FALSE;');
        const pendingAdminApprovals = pendingAdminApprovalsResult[0].count;

        const [totalDoctorsResult] = await db.execute('SELECT COUNT(*) AS count FROM Doctors;');
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
        const { search = '', status = '' } = req.query; // Added search and status filters

        let query = `
            SELECT ha.admin_id, ha.first_name, ha.last_name, h.hospital_name, u.email, u.created_at AS registration_date, ha.is_approved
            FROM HospitalAdmins ha
            JOIN Users u ON ha.user_id = u.user_id
            LEFT JOIN Hospitals h ON ha.hospital_id = h.hospital_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (ha.first_name LIKE ? OR ha.last_name LIKE ? OR u.email LIKE ? OR h.hospital_name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status === 'Pending') {
            query += ` AND ha.is_approved = FALSE`;
        } else if (status === 'Approved') {
            query += ` AND ha.is_approved = TRUE`;
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

exports.getSuperAdminAnalyticsData = async (req, res) => {
    try {
        // Mock data for analytics (replace with actual database queries)
        const userRegistrationTrends = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            data: [850, 920, 890, 950, 1250, 1300, 1280, 1450, 1380, 1550, 1700, 1820]
        };

        const doctorOnboardingStatistics = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            data: [45, 52, 48, 60, 85, 90, 88, 105, 98, 115, 125, 135]
        };

        const userDistribution = {
            labels: ['Patients', 'Doctors', 'Hospital Admins'],
            data: [75, 20, 5]
        };

        const doctorSpecialties = {
            labels: ['Cardiology', 'Neurology', 'Orthopedics', 'General Medicine'],
            data: [25, 20, 30, 25]
        };

        const hospitalCategories = {
            labels: ['General Hosp', 'Specialty Clinics', 'Medical Centers', 'Community'],
            data: [35, 25, 20, 20]
        };

        res.status(200).json({
            userRegistrationTrends,
            doctorOnboardingStatistics,
            userDistribution,
            doctorSpecialties,
            hospitalCategories
        });
    } catch (error) {
        console.error('Error fetching super admin analytics:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getSuperAdminProfile = async (req, res) => {
    try {
        // Super Admin profile information (from Users table)
        const userId = req.user.user_id;
        const [userRows] = await db.execute('SELECT email FROM Users WHERE user_id = ? AND role = "super_admin"', [userId]);

        if (userRows.length === 0) {
            return res.status(404).json({ message: 'Super Admin profile not found.' });
        }

        // Mock quick stats (these would ideally come from DB queries)
        const quickStats = {
            accountCreated: 'Jan 15, 2023',
            lastLogin: 'Today, 9:30 AM',
            totalSessions: 1247,
            hospitalAdminsApproved: 89 // Specific to Super Admin
        };

        res.status(200).json({
            email: userRows[0].email,
            username: 'admin_user', // As per your design
            quickStats: quickStats
        });
    } catch (error) {
        console.error('Error fetching super admin profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.updateSuperAdminPassword = async (req, res) => {
    const userId = req.user.user_id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
        return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    try {
        const [userRows] = await db.execute('SELECT password FROM Users WHERE user_id = ?', [userId]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const user = userRows[0];
        const isMatch = await bcrypt.compare(current_password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid current password.' });
        }

        const hashedNewPassword = await bcrypt.hash(new_password, 10);
        await db.execute('UPDATE Users SET password = ? WHERE user_id = ?', [hashedNewPassword, userId]);

        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Error updating super admin password:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
const express = require('express');
const router = express.Router();
const hospitalAdminController = require('../controllers/hospitalAdminController'); // Renamed
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/dashboard/overview', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getAdminDashboardOverview);
router.get('/doctors/pending', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getPendingDoctorApprovals);
router.get('/doctors/approved', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getApprovedDoctors);
router.get('/doctors/:id', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getDoctorById);
router.put('/doctors/:id', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.updateDoctor);
router.delete('/doctors/:id', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.deleteDoctor);
router.put('/doctors/approve/:id', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.approveDoctor);
router.delete('/doctors/reject/:id', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.rejectDoctor); // Changed to DELETE

// Leave requests
router.get('/leave-requests', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getLeaveRequests);
router.put('/leave-requests/:id/approve', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.approveLeaveRequest);
router.put('/leave-requests/:id/reject', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.rejectLeaveRequest);
router.get('/leave-requests/:id', authenticateToken, authorizeRole(['hospital_admin']), async (req, res) => {
    // lightweight detail endpoint using the main controller query shape
    try {
        const hospitalId = req.user.hospital_id;
        const { id } = req.params;
        const db = require('../models/db');
        const [rows] = await db.execute(`
            SELECT lr.leave_id, lr.status, lr.reason, lr.requested_date,
                   d.first_name, d.last_name, d.specialization
            FROM doctorleaverequests lr
            JOIN Doctors d ON lr.doctor_id = d.doctor_id
            WHERE lr.leave_id = ? AND d.hospital_id = ?
        `, [id, hospitalId]);
        if (!rows.length) return res.status(404).json({ message: 'Leave not found' });
        const r = rows[0];
        res.status(200).json({
            id: r.leave_id,
            doctorName: `Dr. ${r.first_name} ${r.last_name}`,
            department: r.specialization,
            leaveType: 'N/A',
            startDate: r.requested_date,
            endDate: r.requested_date,
            duration: 1,
            status: r.status,
            reason: r.reason || ''
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/analytics', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getHospitalAnalyticsData);
router.get('/analytics/reviews', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getDoctorReviews);

router.get('/profile', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getHospitalAdminProfile);
router.put('/profile', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.updateHospitalAdminProfile);
router.put('/profile/password', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.updateHospitalAdminPassword);

module.exports = router;

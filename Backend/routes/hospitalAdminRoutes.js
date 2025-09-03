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

router.get('/analytics', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getHospitalAnalyticsData);
router.get('/analytics/reviews', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getDoctorReviews);

router.get('/profile', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getHospitalAdminProfile);
router.put('/profile', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.updateHospitalAdminProfile);
router.put('/profile/password', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.updateHospitalAdminPassword);

module.exports = router;

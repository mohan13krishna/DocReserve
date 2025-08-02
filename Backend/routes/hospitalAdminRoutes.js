const express = require('express');
const router = express.Router();
const hospitalAdminController = require('../controllers/hospitalAdminController'); // Renamed
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/dashboard/overview', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getAdminDashboardOverview);
router.get('/doctors/pending', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getPendingDoctorApprovals);
router.get('/doctors/approved', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getApprovedDoctors);
router.put('/doctors/approve/:id', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.approveDoctor);
router.delete('/doctors/reject/:id', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.rejectDoctor); // Changed to DELETE

router.get('/analytics', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getHospitalAnalyticsData);

router.get('/profile', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.getHospitalAdminProfile);
router.put('/profile', authenticateToken, authorizeRole(['hospital_admin']), hospitalAdminController.updateHospitalAdminProfile);

module.exports = router;
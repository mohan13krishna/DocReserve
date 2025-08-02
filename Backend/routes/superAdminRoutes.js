const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminContoller');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/dashboard/overview', authenticateToken, authorizeRole(['super_admin']), superAdminController.getSuperAdminDashboardOverview);
router.get('/hospital-admins/pending', authenticateToken, authorizeRole(['super_admin']), superAdminController.getPendingHospitalAdminApprovals);
router.put('/hospital-admins/approve/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.approveHospitalAdmin);
router.delete('/hospital-admins/reject/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.rejectHospitalAdmin);

router.get('/analytics', authenticateToken, authorizeRole(['super_admin']), superAdminController.getSuperAdminAnalyticsData);

router.get('/profile', authenticateToken, authorizeRole(['super_admin']), superAdminController.getSuperAdminProfile);
router.put('/profile/password', authenticateToken, authorizeRole(['super_admin']), superAdminController.updateSuperAdminPassword); // Only password for super admin

module.exports = router;
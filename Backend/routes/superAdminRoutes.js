// backend/routes/superAdminRoutes.js
const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminContoller');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// Dashboard overview
router.get('/dashboard/overview', authenticateToken, authorizeRole(['super_admin']), superAdminController.getSuperAdminDashboardOverview);

// Pending hospital admins (approval workflow)
router.get('/hospital-admins/pending', authenticateToken, authorizeRole(['super_admin']), superAdminController.getPendingHospitalAdminApprovals);
router.put('/hospital-admins/approve/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.approveHospitalAdmin);
router.delete('/hospital-admins/reject/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.rejectHospitalAdmin);

// Routes for managing approved hospital admins
router.get('/approved-hospital-admins', authenticateToken, authorizeRole(['super_admin']), superAdminController.getApprovedHospitalAdmins);
router.put('/approved-hospital-admins/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.updateHospitalAdmin);
router.delete('/approved-hospital-admins/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.deleteHospitalAdmin);
router.get('/approved-hospital-admins/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.getHospitalAdminDetails);

// Routes for managing hospitals
router.get('/hospitals', authenticateToken, authorizeRole(['super_admin']), superAdminController.getApprovedHospitals);
router.post('/hospitals', authenticateToken, authorizeRole(['super_admin']), superAdminController.createHospital);
router.put('/hospitals/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.updateHospital);
router.delete('/hospitals/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.deleteHospital);
router.get('/hospitals/:id', authenticateToken, authorizeRole(['super_admin']), superAdminController.getHospitalDetails);

// Analytics
router.get('/analytics', authenticateToken, authorizeRole(['super_admin']), superAdminController.getSuperAdminAnalyticsData);

// Profile
router.get('/profile', authenticateToken, authorizeRole(['super_admin']), superAdminController.getSuperAdminProfile);
router.put('/profile/password', authenticateToken, authorizeRole(['super_admin']), superAdminController.updateSuperAdminPassword);

module.exports = router;

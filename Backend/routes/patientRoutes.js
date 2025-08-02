const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/dashboard/overview', authenticateToken, authorizeRole(['user']), patientController.getPatientDashboardOverview);
router.get('/profile', authenticateToken, authorizeRole(['user']), patientController.getPatientProfile);
router.put('/profile', authenticateToken, authorizeRole(['user']), patientController.updatePatientProfile);
router.get('/appointments', authenticateToken, authorizeRole(['user']), patientController.getPatientAppointments);

module.exports = router;
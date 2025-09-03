const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/schedule', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorSchedule);
router.put('/availability', authenticateToken, authorizeRole(['doctor']), doctorController.updateDoctorAvailability);
router.get('/profile', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorProfile);
router.put('/profile', authenticateToken, authorizeRole(['doctor']), doctorController.updateDoctorProfile);
router.get('/patients', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorPatients);
router.put('/quick-settings', authenticateToken, authorizeRole(['doctor']), doctorController.updateQuickSettings);

// Appointment management routes
router.put('/appointments/:appointmentId/approve', authenticateToken, authorizeRole(['doctor']), doctorController.approveAppointment);
router.put('/appointments/:appointmentId/cancel', authenticateToken, authorizeRole(['doctor']), doctorController.cancelAppointment);
router.put('/appointments/:appointmentId/start', authenticateToken, authorizeRole(['doctor']), doctorController.startAppointment);
router.put('/appointments/:appointmentId/complete', authenticateToken, authorizeRole(['doctor']), doctorController.completeAppointment);
router.get('/appointments/:appointmentId', authenticateToken, authorizeRole(['doctor']), doctorController.getAppointmentDetails);

module.exports = router;

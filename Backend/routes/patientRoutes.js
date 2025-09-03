const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/dashboard/overview', authenticateToken, authorizeRole(['user']), patientController.getPatientDashboardOverview);
router.get('/profile', authenticateToken, authorizeRole(['user']), patientController.getPatientProfile);
router.put('/profile', authenticateToken, authorizeRole(['user']), patientController.updatePatientProfile);
router.get('/appointments', authenticateToken, authorizeRole(['user']), patientController.getPatientAppointments);

// Booking and appointment management
router.post('/appointments', authenticateToken, authorizeRole(['user']), patientController.bookAppointment);
router.get('/appointments/:id', authenticateToken, authorizeRole(['user']), patientController.getAppointmentById);
router.put('/appointments/cancel/:id', authenticateToken, authorizeRole(['user']), patientController.cancelAppointment);
router.put('/appointments/reschedule/:id', authenticateToken, authorizeRole(['user']), patientController.rescheduleAppointment);

// Doctors directory and availability
router.get('/doctors', authenticateToken, authorizeRole(['user']), patientController.getDoctorsList);
router.get('/doctors/:id', authenticateToken, authorizeRole(['user']), patientController.getDoctorDetails);
router.get('/doctors/:id/availability', authenticateToken, authorizeRole(['user']), patientController.getDoctorAvailability);

module.exports = router;

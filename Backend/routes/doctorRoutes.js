const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/schedule', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorSchedule);
router.put('/availability', authenticateToken, authorizeRole(['doctor']), doctorController.updateDoctorAvailability);
router.get('/availability', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorAvailability);
router.put('/availability/weekly', authenticateToken, authorizeRole(['doctor']), doctorController.setWeeklyAvailability);
router.post('/block-time', authenticateToken, authorizeRole(['doctor']), doctorController.blockTime);
router.delete('/block-time/:id', authenticateToken, authorizeRole(['doctor']), doctorController.unblockTime);
router.post('/schedule/slot', authenticateToken, authorizeRole(['doctor']), doctorController.addScheduleSlot);
router.get('/profile', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorProfile);
router.put('/profile', authenticateToken, authorizeRole(['doctor']), doctorController.updateDoctorProfile);
router.get('/patients', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorPatients);
router.put('/quick-settings', authenticateToken, authorizeRole(['doctor']), doctorController.updateQuickSettings);

// Leave Management Routes
router.get('/leaves', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorLeaves);
router.post('/leaves', authenticateToken, authorizeRole(['doctor']), doctorController.submitLeaveRequest);
router.get('/leave-requests/:leaveId', authenticateToken, authorizeRole(['doctor']), doctorController.getLeaveRequest);
router.put('/leave-requests/:leaveId', authenticateToken, authorizeRole(['doctor']), doctorController.updateLeaveRequest);
router.delete('/leave-requests/:leaveId', authenticateToken, authorizeRole(['doctor']), doctorController.deleteLeaveRequest);

// Appointment management routes
router.put('/appointments/:appointmentId/approve', authenticateToken, authorizeRole(['doctor']), doctorController.approveAppointment);
router.put('/appointments/:appointmentId/cancel', authenticateToken, authorizeRole(['doctor']), doctorController.cancelAppointment);
router.put('/appointments/:appointmentId/start', authenticateToken, authorizeRole(['doctor']), doctorController.startAppointment);
router.put('/appointments/:appointmentId/complete', authenticateToken, authorizeRole(['doctor']), doctorController.completeAppointment);
router.get('/appointments/:appointmentId', authenticateToken, authorizeRole(['doctor']), doctorController.getAppointmentDetails);

module.exports = router;

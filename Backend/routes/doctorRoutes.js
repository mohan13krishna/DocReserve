const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/schedule', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorSchedule);
router.put('/availability', authenticateToken, authorizeRole(['doctor']), doctorController.updateDoctorAvailability);
router.get('/profile', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorProfile);
router.put('/profile', authenticateToken, authorizeRole(['doctor']), doctorController.updateDoctorProfile);
router.get('/patients', authenticateToken, authorizeRole(['doctor']), doctorController.getDoctorPatients);

module.exports = router;
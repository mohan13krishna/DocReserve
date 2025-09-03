const db = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [rows] = await db.execute('SELECT user_id, email, password, role FROM Users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    let payload = {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    };

    // Check approval status and add role-specific IDs to payload
    if (user.role === 'doctor') {
      const [doctorRows] = await db.execute('SELECT doctor_id, is_approved, first_name, last_name FROM Doctors WHERE user_id = ?', [user.user_id]);
      if (doctorRows.length === 0 || !doctorRows[0].is_approved) {
        return res.status(403).json({ message: 'Your doctor account is pending approval by a hospital admin.' });
      }
      payload.doctor_id = doctorRows[0].doctor_id;
      payload.first_name = doctorRows[0].first_name;
      payload.last_name = doctorRows[0].last_name;
    } else if (user.role === 'hospital_admin') {
      const [adminRows] = await db.execute('SELECT admin_id, hospital_id, hospital_code, is_approved, first_name, last_name FROM HospitalAdmins WHERE user_id = ?', [user.user_id]);
      if (adminRows.length === 0 || !adminRows[0].is_approved) {
        return res.status(403).json({ message: 'Your hospital admin account is pending approval by a super admin.' });
      }
      payload.hospital_admin_id = adminRows[0].admin_id;
      payload.hospital_id = adminRows[0].hospital_id;
      payload.hospital_code = adminRows[0].hospital_code; // include for filtering
      payload.first_name = adminRows[0].first_name;
      payload.last_name = adminRows[0].last_name;
    } else if (user.role === 'user') {
      const [patientRows] = await db.execute('SELECT patient_id, first_name, last_name FROM Patients WHERE user_id = ?', [user.user_id]);
      if (patientRows.length > 0) {
        payload.patient_id = patientRows[0].patient_id;
        payload.first_name = patientRows[0].first_name;
        payload.last_name = patientRows[0].last_name;
      }
    } else if (user.role === 'super_admin') {
        // Super admin doesn't have a linked profile in another table, just the user table.
        // You might add a super_admin_id if you had a separate table for them, but usually not needed.
    }


    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

exports.register = async (req, res) => {
  const { email, password, role, doctor_registration_id, hospital_id, first_name, last_name, phone_number } = req.body;

  if (!email || !password || !role || !first_name || !last_name) {
    return res.status(400).json({ message: 'All required fields are needed for registration.' });
  }

  if (!['user', 'doctor', 'hospital_admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role provided.' });
  }

  try {
    const [existingUsers] = await db.execute('SELECT user_id FROM Users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const connection = await db.getConnection();
    await connection.beginTransaction();

    let userId;
    let registrationMessage = 'Registration successful!';

    try {
      const [userResult] = await connection.execute(
        'INSERT INTO Users (email, password, role) VALUES (?, ?, ?)',
        [email, hashedPassword, role]
      );
      userId = userResult.insertId;

      if (role === 'user') {
        await connection.execute(
          'INSERT INTO Patients (user_id, first_name, last_name, phone_number) VALUES (?, ?, ?, ?)',
          [userId, first_name, last_name, phone_number || null]
        );
      } else if (role === 'doctor') {
        if (!doctor_registration_id) {
          throw new Error('Doctor registration ID is required for doctor role.');
        }
        if (!hospital_id) {
          throw new Error('Hospital ID is required for doctor role.');
        }
        await connection.execute(
          'INSERT INTO Doctors (user_id, doctor_registration_id, first_name, last_name, hospital_id, is_approved) VALUES (?, ?, ?, ?, ?, FALSE)',
          [userId, doctor_registration_id, first_name, last_name, hospital_id]
        );
        registrationMessage = 'Registration successful! Your doctor account is pending approval by a hospital admin.';
      } else if (role === 'hospital_admin') {
        if (!hospital_id) {
          throw new Error('Hospital ID is required for hospital admin role.');
        }
        await connection.execute(
          'INSERT INTO HospitalAdmins (user_id, hospital_id, first_name, last_name, is_approved) VALUES (?, ?, ?, ?, FALSE)',
          [userId, hospital_id, first_name, last_name]
        );
        registrationMessage = 'Registration submitted! Your hospital admin request is pending approval by a super admin.';
      }
      await connection.commit();
      res.status(201).json({ message: registrationMessage });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'Server error during registration.' });
  }
};

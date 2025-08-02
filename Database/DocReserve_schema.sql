-- docreserve_schema.sql

-- Create Database
CREATE DATABASE IF NOT EXISTS DocReserve_App;
USE DocReserve_App;

-- Users Table
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'doctor', 'hospital_admin', 'super_admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients Table (linked to Users)
CREATE TABLE Patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    phone_number VARCHAR(20),
    address TEXT,
    blood_type VARCHAR(5),
    gender ENUM('Male', 'Female', 'Other'),
    allergies TEXT,
    current_medications TEXT,
    medical_conditions TEXT,
    insurance_provider VARCHAR(100),
    policy_number VARCHAR(100),
    group_number VARCHAR(100),
    member_id VARCHAR(100),
    emergency_contact_name VARCHAR(255),
    emergency_contact_relationship VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Hospitals Table (for hospital_admin role)
CREATE TABLE Hospitals (
    hospital_id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_name VARCHAR(255) NOT NULL,
    hospital_address TEXT,
    hospital_phone VARCHAR(20)
);

-- Doctors Table (linked to Users)
CREATE TABLE Doctors (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    doctor_registration_id VARCHAR(100) UNIQUE, -- Doctor needs to provide this
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    specialization VARCHAR(100),
    experience_years INT,
    rating DECIMAL(2,1),
    bio TEXT,
    phone_number VARCHAR(20),
    hospital_id INT, -- To link doctors to hospitals
    is_approved BOOLEAN DEFAULT FALSE, -- Hospital admin approval
    is_available BOOLEAN DEFAULT TRUE, -- Toggle for busy/available/unavailable
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES Hospitals(hospital_id) ON DELETE SET NULL
);

-- Hospital Admins Table (linked to Users and Hospitals)
CREATE TABLE HospitalAdmins (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    hospital_id INT, -- Hospital Admin should provide Hospital ID while registering
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_approved BOOLEAN DEFAULT FALSE, -- Super admin approval
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES Hospitals(hospital_id) ON DELETE SET NULL
);

-- Appointments Table
CREATE TABLE Appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    doctor_id INT,
    appointment_date DATETIME NOT NULL,
    reason TEXT,
    status ENUM('Upcoming', 'Confirmed', 'Pending', 'Cancelled', 'Completed') NOT NULL,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES Doctors(doctor_id) ON DELETE CASCADE
);

-- Sample Data (for initial setup and testing)
-- Super Admin User (universal credentials)
INSERT INTO Users (email, password, role) VALUES ('Admin@DocReserve.com', '$2a$10$tJ9c.mG6dD9R0J9zW1b.2u.I5y/x8G2z.J5y8X.S/4.M.y.3.A.y', 'super_admin'); -- password is 'AdminDRPassword' hashed

-- Sample Hospital
INSERT INTO Hospitals (hospital_name, hospital_address, hospital_phone) VALUES ('Metropolitan General Hospital', '101 City Center', '+11234567890');
INSERT INTO Hospitals (hospital_name, hospital_address, hospital_phone) VALUES ('Childrens Medical Center', '202 Pediatric Way', '+10987654321');

-- Sample Users (hashed password 'password123')
INSERT INTO Users (email, password, role) VALUES
('john.doe@example.com', '$2a$10$tJ9c.mG6dD9R0J9zW1b.2u.I5y/x8G2z.J5y8X.S/4.M.y.3.A.y', 'user'),
('sarah.johnson.dr@example.com', '$2a$10$tJ9c.mG6dD9R0J9zW1b.2u.I5y/x8G2z.J5y8X.S/4.M.y.3.A.y', 'doctor'),
('mike.admin@hospital.com', '$2a$10$tJ9c.mG6dD9R0J9zW1b.2u.I5y/x8G2z.J5y8X.S/4.M.y.3.A.y', 'hospital_admin');

-- Sample Patient
INSERT INTO Patients (user_id, first_name, last_name, phone_number) VALUES
((SELECT user_id FROM Users WHERE email = 'john.doe@example.com'), 'John', 'Doe', '+1 (555) 123-4567');

-- Sample Doctors
INSERT INTO Doctors (user_id, doctor_registration_id, first_name, last_name, specialization, experience_years, rating, hospital_id, is_approved) VALUES
((SELECT user_id FROM Users WHERE email = 'sarah.johnson.dr@example.com'), 'DR001', 'Sarah', 'Johnson', 'Cardiologist', 15, 4.9, (SELECT hospital_id FROM Hospitals WHERE hospital_name = 'Metropolitan General Hospital'), TRUE),
(NULL, 'DR002', 'Michael', 'Anderson', 'Cardiologist', 10, 4.8, (SELECT hospital_id FROM Hospitals WHERE hospital_name = 'Metropolitan General Hospital'), TRUE),
(NULL, 'DR003', 'Robert', 'Wilson', 'Neurologist', 20, 4.7, (SELECT hospital_id FROM Hospitals WHERE hospital_name = 'Metropolitan General Hospital'), TRUE);

-- Sample Hospital Admin
INSERT INTO HospitalAdmins (user_id, hospital_id, first_name, last_name, is_approved) VALUES
((SELECT user_id FROM Users WHERE email = 'mike.admin@hospital.com'), (SELECT hospital_id FROM Hospitals WHERE hospital_name = 'Metropolitan General Hospital'), 'Mike', 'Admin', TRUE);

-- Sample Appointments for John Doe
INSERT INTO Appointments (patient_id, doctor_id, appointment_date, reason, status) VALUES
((SELECT patient_id FROM Patients WHERE first_name = 'John'), (SELECT doctor_id FROM Doctors WHERE first_name = 'Michael' AND last_name = 'Anderson'), '2025-08-03 10:30:00', 'Regular Checkup', 'Upcoming'),
((SELECT patient_id FROM Patients WHERE first_name = 'John'), (SELECT doctor_id FROM Doctors WHERE first_name = 'Sarah' AND last_name = 'Johnson'), '2024-12-28 14:00:00', 'Dermatology Consultation', 'Upcoming'),
((SELECT patient_id FROM Patients WHERE first_name = 'John'), (SELECT doctor_id FROM Doctors WHERE first_name = 'Robert' AND last_name = 'Wilson'), '2025-01-05 11:15:00', 'Follow-up Visit', 'Upcoming');

-- Sample Doctors for Hospital Admin to manage (not yet approved)
INSERT INTO Users (email, password, role) VALUES ('pending.doc@example.com', '$2a$10$tJ9c.mG6dD9R0J9zW1b.2u.I5y/x8G2z.J5y8X.S/4.M.y.3.A.y', 'doctor'); -- password is 'password123'
INSERT INTO Doctors (user_id, doctor_registration_id, first_name, last_name, specialization, hospital_id, is_approved) VALUES
((SELECT user_id FROM Users WHERE email = 'pending.doc@example.com'), 'DR004', 'Emily', 'Rodriguez', 'Pediatrics', (SELECT hospital_id FROM Hospitals WHERE hospital_name = 'Childrens Medical Center'), FALSE);

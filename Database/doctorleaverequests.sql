CREATE TABLE IF NOT EXISTS doctorleaverequests (
    leave_id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    requested_date DATE NOT NULL,
    end_date DATE,
    leave_type ENUM('personal_leave', 'emergency', 'sick_leave', 'vacation', 'maternity_paternity', 'other') DEFAULT 'personal_leave',
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    INDEX idx_doctor_status (doctor_id, status),
    INDEX idx_status (status),
    INDEX idx_requested_date (requested_date),
    INDEX idx_leave_type (leave_type)
);

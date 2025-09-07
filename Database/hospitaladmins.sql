-- Hospital Admins Table
CREATE TABLE IF NOT EXISTS hospitaladmins (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    hospital_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_approved TINYINT(1) DEFAULT 0,
    phone_number VARCHAR(20),
    hospital_code VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_hospital_id (hospital_id),
    INDEX idx_is_approved (is_approved),
    INDEX idx_hospital_code (hospital_code)
);

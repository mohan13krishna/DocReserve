-- Hospitals Table
CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id INT PRIMARY KEY AUTO_INCREMENT,
    hospital_code VARCHAR(50) UNIQUE NOT NULL,
    hospital_name VARCHAR(255) NOT NULL,
    hospital_details TEXT,
    hospital_address TEXT,
    hospital_phone VARCHAR(20),
    INDEX idx_hospital_code (hospital_code),
    INDEX idx_hospital_name (hospital_name)
);

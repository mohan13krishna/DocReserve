-- Create blocked_times table for storing doctor blocked time slots
CREATE TABLE IF NOT EXISTS blocked_times (
    blocked_time_id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    blocked_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason VARCHAR(255),
    is_recurring TINYINT(1) DEFAULT 0,
    recurring_days TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    INDEX idx_doctor_date (doctor_id, blocked_date),
    INDEX idx_doctor_time (doctor_id, blocked_date, start_time, end_time)
);

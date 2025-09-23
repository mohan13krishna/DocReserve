# DocReserve - Hospital Management System 

A comprehensive web-based doctor appointment booking system that facilitates appointment booking, patient management, doctor scheduling, and hospital administration.

## 🏥 Project Overview 

DocReserve is a full-stack web application designed to streamline hospital operations by providing separate interfaces for patients, doctors, hospital administrators, and super administrators. The system enables efficient appointment management, medical record keeping, and hospital resource management. 
   
## ✨ Key Features

### For Patients   
- **User Registration & Authentication** - Secure account creation and login 
- **Doctor Discovery** - Browse and search for doctors by specialization
- **Appointment Booking** - Schedule appointments with preferred doctors 
- **Medical Records Access** - View complete medical history and records
- **Appointment Management** - Track and manage upcoming appointments
- **Rating System** - Rate doctors and provide feedback after appointments

### For Doctors
- **Professional Dashboard** - Comprehensive overview of practice metrics
- **Appointment Management** - Approve, cancel, start, and complete appointments
- **Schedule Management** - View and manage daily schedules
- **Patient Records** - Access patient medical history and information
- **Medical Documentation** - Create detailed medical records during appointments
- **Leave Management** - Request and manage time off

### For Hospital Administrators
- **Hospital Dashboard** - Monitor hospital operations and statistics
- **Doctor Management** - Approve and manage doctor registrations
- **Analytics & Reporting** - View hospital performance metrics
- **Resource Management** - Manage hospital resources and staff

### For Super Administrators
- **System-wide Management** - Oversee multiple hospitals
- **Hospital Registration** - Approve new hospital registrations
- **User Management** - Manage system-wide user accounts
- **Analytics Dashboard** - System-wide performance metrics

## 🏗️ Architecture

The project follows a **3-tier architecture**:

1. **Frontend (Presentation Layer)** - HTML, CSS, JavaScript
2. **Backend (Application Layer)** - Node.js with Express.js
3. **Database (Data Layer)** - MySQL

## 📁 Project Structure

```
DocReserve/
├── Frontend/                    # Client-side application
│   ├── css/                    # Stylesheets
│   │   ├── doctor-dashboard.css
│   │   ├── hospital-admin-dashboard.css
│   │   ├── login.css
│   │   ├── patient-dashboard.css
│   │   ├── register.css
│   │   ├── services.css
│   │   ├── styles.css
│   │   ├── super-admin-dashboard.css
│   │   └── patient-medical-records.css
│   ├── js/                     # Client-side JavaScript
│   │   ├── doctor-dashboard.js
│   │   ├── doctor-schedule-management.js
│   │   ├── hospital-admin-analytics.js
│   │   ├── login.js
│   │   ├── patient-appointments.js
│   │   ├── patient-booking.js
│   │   ├── patient-dashboard.js
│   │   ├── patient-medical-records.js
│   │   ├── register.js
│   │   └── [+13 more JS files]
│   ├── assets/                 # Static assets
│   │   └── Index.jpg
│   ├── *.html                  # HTML pages (25 pages)
│   └── index.html              # Landing page
├── Backend/                    # Server-side application
│   ├── config/                 # Configuration files
│   │   └── db.config.js       # Database configuration
│   ├── controllers/            # Business logic controllers
│   │   ├── appointmentMedicalController.js
│   │   ├── authController.js
│   │   ├── doctorController.js
│   │   ├── hospitalController.js
│   │   ├── patientController.js
│   │   └── userController.js
│   ├── middleware/             # Express middleware
│   │   └── authMiddleware.js   # Authentication middleware
│   ├── models/                 # Database models
│   │   └── db.js              # Database connection
│   ├── routes/                 # API route definitions
│   │   ├── appointmentRoutes.js
│   │   ├── authRoutes.js
│   │   ├── doctorRoutes.js
│   │   ├── hospitalRoutes.js
│   │   └── patientRoutes.js
│   ├── .env                   # Environment variables
│   ├── package.json           # Node.js dependencies
│   └── server.js              # Express server entry point
└── Database/                   # Database schema files
    ├── appointments.sql        # Appointments table
    ├── blocked_times_table.sql # Doctor blocked times
    ├── doctors.sql            # Doctors table
    ├── doctorleaverequests.sql # Leave requests
    ├── hospitals.sql          # Hospitals table
    ├── hospitaladmins.sql     # Hospital administrators
    ├── medical_records_table.sql # Medical records
    ├── patients.sql           # Patients table
    └── users.sql              # Users authentication table
```

## 🛠️ Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Responsive styling with modern design
- **JavaScript (ES6+)** - Interactive functionality
- **Bootstrap** - UI components and responsive grid

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **JWT** - Authentication and authorization
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing

### Database
- **MySQL** - Relational database management system
- **mysql2** - MySQL driver for Node.js

## 📊 Database Schema

The system uses 9 main database tables:

1. **users** - Authentication and role management
2. **patients** - Patient personal and medical information
3. **doctors** - Doctor profiles and credentials
4. **hospitals** - Hospital information and details
5. **hospitaladmins** - Hospital administrator accounts
6. **appointments** - Appointment scheduling and management
7. **doctorleaverequests** - Doctor leave management
8. **completed_appointments_medical_records** - Medical documentation
9. **blocked_times** - Doctor availability management

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DocReserve
   ```

2. **Set up the database**
   ```bash
   # Create MySQL database
   mysql -u root -p
   CREATE DATABASE docreserve;
   
   # Import database schema
   mysql -u root -p docreserve < Database/users.sql
   mysql -u root -p docreserve < Database/hospitals.sql
   mysql -u root -p docreserve < Database/patients.sql
   mysql -u root -p docreserve < Database/doctors.sql
   mysql -u root -p docreserve < Database/hospitaladmins.sql
   mysql -u root -p docreserve < Database/appointments.sql
   mysql -u root -p docreserve < Database/doctorleaverequests.sql
   mysql -u root -p docreserve < Database/medical_records_table.sql
   mysql -u root -p docreserve < Database/blocked_times_table.sql
   ```

3. **Configure environment variables**
   ```bash
   cd Backend
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Install backend dependencies**
   ```bash
   cd Backend
   npm install
   ```

5. **Start the development server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`
   - The frontend files are served statically by the Express server

## 🔐 User Roles & Access Control

The system implements role-based access control with four user types:

1. **Patients** - Book appointments, view medical records
2. **Doctors** - Manage appointments, create medical records
3. **Hospital Admins** - Manage hospital operations, approve doctors
4. **Super Admins** - System-wide management and oversight

## 📱 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Appointments
- `GET /api/appointments` - Get appointments
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:id/approve` - Approve appointment
- `PUT /api/appointments/:id/cancel` - Cancel appointment
- `PUT /api/appointments/:id/start` - Start appointment
- `PUT /api/appointments/:id/complete` - Complete appointment

### Medical Records
- `GET /api/appointments/:id/medical-records` - Get medical records
- `POST /api/appointments/:id/complete-with-records` - Save medical records
- `PUT /api/appointments/:id/rate` - Rate appointment

## 🎨 UI/UX Features

- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Modern Interface** - Clean and intuitive user experience
- **Role-based Dashboards** - Customized interfaces for each user type
- **Real-time Updates** - Dynamic content loading and updates
- **Interactive Components** - Modals, forms, and interactive elements

## 🔧 Development

### Code Organization
- **MVC Pattern** - Separation of concerns with Models, Views, and Controllers
- **Modular Structure** - Organized codebase with clear file structure
- **RESTful APIs** - Standard HTTP methods and status codes
- **Error Handling** - Comprehensive error handling and validation

### Security Features
- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt for secure password storage
- **SQL Injection Prevention** - Parameterized queries
- **CORS Configuration** - Controlled cross-origin requests

## 📈 Future Enhancements

- **Real-time Notifications** - WebSocket integration for live updates
- **Mobile Application** - React Native or Flutter mobile app
- **Telemedicine** - Video consultation capabilities
- **Payment Integration** - Online payment processing
- **Advanced Analytics** - Machine learning insights
- **Multi-language Support** - Internationalization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 👥 Author

- **Mohan Krishna Thalla** - Initial work and ongoing development

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape this project
- Special recognition for the healthcare professionals who provided domain expertise
- Appreciation for the open-source community and the tools that made this project possible

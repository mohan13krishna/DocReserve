// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./models/db'); // Database connection pool

const app = express();

// Define CORS options
const corsOptions = {
  origin: 'http://localhost:5000', // MUST match your frontend's exact origin [cite: 1]
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods for your API [cite: 1]
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed request headers [cite: 1]
  credentials: true // Allow sending cookies (if you later use them for authentication) [cite: 1]
};

// Middleware
app.use(cors(corsOptions)); // Apply the CORS middleware with explicit options [cite: 1]
app.use(express.json()); // For parsing application/json [cite: 1]
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded [cite: 1]

// --- CORRECTED STATIC FILE SERVING BASED ON YOUR EXACT DIRECTORY STRUCTURE ---
// Assuming your project root is 'Project'
// and server.js is in 'Project/Backend/server.js'
// and frontend files are in 'Project/Frontend/'
// HTML files are directly in 'Project/Frontend/'
// CSS is in 'Project/Frontend/css/'
// JS is in 'Project/Frontend/js/'
// Images are in 'Project/Frontend/assets/'

// Serve the 'Frontend' directory as the root for static files.
// This means:
// - HTML files (e.g., index.html, login.html) are directly accessible at http://localhost:5000/index.html etc.
// - Files in 'Frontend/css/' are accessible at http://localhost:5000/css/style.css
// - Files in 'Frontend/js/' are accessible at http://localhost:5000/js/main.js
// - The 'assets' folder itself is now accessible directly as /assets/ from the root
app.use(express.static(path.join(__dirname, '..', 'Frontend')));


// Test DB connection
db.getConnection()
  .then(connection => {
    console.log('Successfully connected to the database.');
    connection.release(); // Release the connection immediately
  })
  .catch(err => {
    console.error('Failed to connect to the database:', err.message);
    process.exit(1); // Exit if DB connection fails
  });

// API Routes
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const hospitalAdminRoutes = require('./routes/hospitalAdminRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes'); // Correctly references the route file [cite: 2]

app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/hospital-admin', hospitalAdminRoutes);
app.use('/api/super-admin', superAdminRoutes);

// Appointment routes (for approve/cancel actions)
app.put('/api/appointments/:appointmentId/approve', require('./middleware/authMiddleware').authenticateToken, require('./middleware/authMiddleware').authorizeRole(['doctor']), require('./controllers/doctorController').approveAppointment);
app.put('/api/appointments/:appointmentId/cancel', require('./middleware/authMiddleware').authenticateToken, require('./middleware/authMiddleware').authorizeRole(['doctor']), require('./controllers/doctorController').cancelAppointment);

// Catch-all for SPA-like routing: serves the appropriate HTML file or defaults to index.html
app.get('*', (req, res) => {
    const frontendRoot = path.join(__dirname, '..', 'Frontend'); // Correct path to your Frontend directory [cite: 1]
    const requestedPath = req.path;

    // List of all expected HTML files (directly in Frontend folder)
    const htmlFiles = [
        '/index.html', '/login.html', '/register.html', '/doctors.html', '/services.html', '/about.html',
        '/patient-dashboard.html', '/patient-doctors.html', '/patient-appointments.html', '/patient-profile.html',
        '/doctor-dashboard.html', '/doctor-patient-management.html', '/doctor-profile.html',
        '/hospital-admin-dashboard.html', '/hospital-admin-analytics.html', '/hospital-admin-profile.html',
        '/super-admin-dashboard.html', '/super-admin-analytics.html', '/super-admin-profile.html'
    ];

    // If the request path directly matches one of our HTML files, serve it
    if (htmlFiles.includes(requestedPath)) {
        return res.sendFile(path.join(frontendRoot, requestedPath));
    }

    // Handle dashboard roots which might not have .html in URL
    // These redirect to the main dashboard HTML files for each role.
    if (requestedPath.startsWith('/patient')) {
        return res.sendFile(path.join(frontendRoot, 'patient-dashboard.html'));
    } else if (requestedPath.startsWith('/doctor')) {
        return res.sendFile(path.join(frontendRoot, 'doctor-dashboard.html'));
    } else if (requestedPath.startsWith('/hospital-admin')) {
        return res.sendFile(path.join(frontendRoot, 'hospital-admin-dashboard.html'));
    } else if (requestedPath.startsWith('/super-admin')) {
        return res.sendFile(path.join(frontendRoot, 'super-admin-dashboard.html'));
    }

    // Default fallback to the landing page for any other route not explicitly handled
    res.sendFile(path.join(frontendRoot, 'index.html'));
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

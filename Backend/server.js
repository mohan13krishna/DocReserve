// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./models/db'); // Database connection pool

const app = express();

// Define CORS options
const corsOptions = {
  origin: 'http://localhost:5000', // MUST match your frontend's exact origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods for your API
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed request headers
  credentials: true // Allow sending cookies (if you later use them for authentication)
};

// Middleware
app.use(cors(corsOptions)); // Apply the CORS middleware with explicit options
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// === CORRECTED STATIC FILE SERVING BASED ON YOUR SCREENSHOTS ===
// Assuming your project root is 'Project'
// and server.js is in 'Project/Backend/server.js'
// and frontend files are in 'Project/Frontend/'
// HTML files are in 'Project/Frontend/'
// CSS/JS are in 'Project/Frontend/assets/css' and 'Project/Frontend/assets/js'

// Serve HTML files directly from the 'Frontend' directory (accessible at http://localhost:5000/index.html etc.)
app.use(express.static(path.join(__dirname, '..', 'Frontend')));

// Serve CSS, JS, Images from the 'assets' subdirectory within 'Frontend'
// They will be accessible via /assets/css/style.css, /assets/js/login.js etc.
// This means your HTML files should reference them like: <link rel="stylesheet" href="/assets/css/style.css">
//                                                    <script src="/assets/js/login.js"></script>
// If you want to keep 'href="css/style.css"', then the path needs to be adjusted in the HTML files instead.
// For simplicity and standard practice, let's assume assets are accessed via '/assets/' prefix.
app.use('/assets', express.static(path.join(__dirname, '..', 'Frontend', 'assets')));


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
const superAdminRoutes = require('./routes/superAdminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/hospital-admin', hospitalAdminRoutes);
app.use('/api/super-admin', superAdminRoutes);


// Catch-all for SPA-like routing: serves the appropriate HTML file or defaults to index.html
app.get('*', (req, res) => {
    const frontendRoot = path.join(__dirname, '..', 'Frontend'); // Correct path to your Frontend directory
    const requestedPath = req.path;

    // Check if the requested path is for a specific HTML file
    const htmlFiles = [
        '/index.html', '/login.html', '/register.html', '/doctors.html', '/services.html', '/about.html',
        '/patient-dashboard.html', '/patient-doctors.html', '/patient-appointments.html', '/patient-profile.html',
        '/doctor-dashboard.html', '/doctor-patient-management.html', '/doctor-profile.html',
        '/hospital-admin-dashboard.html', '/hospital-admin-analytics.html', '/hospital-admin-profile.html',
        '/super-admin-dashboard.html', '/super-admin-analytics.html', '/super-admin-profile.html'
    ];

    if (htmlFiles.includes(requestedPath)) {
        return res.sendFile(path.join(frontendRoot, requestedPath));
    }

    // Handle dashboard roots which might not have .html in URL
    if (requestedPath.startsWith('/patient')) {
        return res.sendFile(path.join(frontendRoot, 'patient-dashboard.html')); // Assumes patient-dashboard is default for /patient/*
    } else if (requestedPath.startsWith('/doctor')) {
        return res.sendFile(path.join(frontendRoot, 'doctor-dashboard.html')); // Assumes doctor-dashboard is default for /doctor/*
    } else if (requestedPath.startsWith('/hospital-admin')) {
        return res.sendFile(path.join(frontendRoot, 'hospital-admin-dashboard.html'));
    } else if (requestedPath.startsWith('/super-admin')) {
        return res.sendFile(path.join(frontendRoot, 'super-admin-dashboard.html'));
    }

    // Default fallback to the landing page for any other route
    res.sendFile(path.join(frontendRoot, 'index.html'));
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

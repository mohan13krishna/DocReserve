// public/js/super-admin-analytics.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'super_admin') {
        window.location.href = '/login.html';
        return;
    }

    // Elements for admin info (re-used from dashboard.js logic)
    const adminEmailDisplay = document.getElementById('admin-email-display');
    const adminInitialsEl = document.getElementById('admin-initials');

    // Chart instances
    let userRegistrationChart;
    let doctorOnboardingChart;
    let userDistributionChart;
    let doctorSpecialtiesChart;
    let hospitalCategoriesChart;

    // --- Dummy Data Functions (replace with actual API calls) ---
    const getUserRegistrationTrendsData = async () => {
        // API call: `/api/super-admin/analytics` and extract specific data
        const response = await fetch('/api/super-admin/analytics', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        return data.userRegistrationTrends;
    };

    const getDoctorOnboardingStatisticsData = async () => {
        const response = await fetch('/api/super-admin/analytics', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        return data.doctorOnboardingStatistics;
    };

    const getUserDistributionData = async () => {
        const response = await fetch('/api/super-admin/analytics', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        return data.userDistribution;
    };

    const getDoctorSpecialtiesData = async () => {
        const response = await fetch('/api/super-admin/analytics', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        return data.doctorSpecialties;
    };

    const getHospitalCategoriesData = async () => {
        const response = await fetch('/api/super-admin/analytics', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        return data.hospitalCategories;
    };

    // --- Chart Initialization Functions ---
    const initChart = (ctxId, chartType, chartData, options) => {
        const ctx = document.getElementById(ctxId).getContext('2d');
        let chartInstance;

        // Destroy existing chart if it exists
        if (Chart.getChart(ctxId)) {
            Chart.getChart(ctxId).destroy();
        }

        chartInstance = new Chart(ctx, {
            type: chartType,
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: options.legendPosition || 'top',
                    },
                    title: {
                        display: true,
                        text: options.titleText || ''
                    }
                },
                scales: options.scales || {}
            }
        });
        return chartInstance;
    };

    // --- Populate and Draw Charts ---
    const loadAllCharts = async () => {
        // User Registration Trends Chart
        const userRegData = await getUserRegistrationTrendsData();
        userRegistrationChart = initChart('user-registration-trends-chart', 'line', {
            labels: userRegData.labels,
            datasets: [{
                label: 'Users',
                data: userRegData.data,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
                tension: 0.4
            }]
        }, {
            titleText: 'User Registration Trends',
            scales: { y: { beginAtZero: true }, x: {} }
        });

        // Doctor Onboarding Statistics Chart
        const doctorOnboardingData = await getDoctorOnboardingStatisticsData();
        doctorOnboardingChart = initChart('doctor-onboarding-statistics-chart', 'line', {
            labels: doctorOnboardingData.labels,
            datasets: [{
                label: 'Doctors Onboarded',
                data: doctorOnboardingData.data,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                fill: true,
                tension: 0.4
            }]
        }, {
            titleText: 'Doctor Onboarding Statistics',
            scales: { y: { beginAtZero: true }, x: {} }
        });

        // User Distribution Chart
        const userDistData = await getUserDistributionData();
        userDistributionChart = initChart('user-distribution-chart', 'doughnut', {
            labels: userDistData.labels,
            datasets: [{
                data: userDistData.data,
                backgroundColor: userDistData.colors || ['#007bff', '#28a745', '#ffc107'], // Example colors
                hoverOffset: 4
            }]
        }, {
            titleText: 'User Distribution',
            legendPosition: 'right'
        });

        // Doctor Specialties Chart
        const doctorSpecData = await getDoctorSpecialtiesData();
        doctorSpecialtiesChart = initChart('doctor-specialties-chart', 'pie', {
            labels: doctorSpecData.labels,
            datasets: [{
                data: doctorSpecData.data,
                backgroundColor: doctorSpecData.colors || ['#007bff', '#20c997', '#fd7e14', '#6f42c1'], // Example colors
                hoverOffset: 4
            }]
        }, {
            titleText: 'Doctor Specialties',
            legendPosition: 'right'
        });

        // Hospital Categories Chart
        const hospitalCatData = await getHospitalCategoriesData();
        hospitalCategoriesChart = initChart('hospital-categories-chart', 'pie', {
            labels: hospitalCatData.labels,
            datasets: [{
                data: hospitalCatData.data,
                backgroundColor: hospitalCatData.colors || ['#17a2b8', '#6610f2', '#e83e8c', '#6c757d'], // Example colors
                hoverOffset: 4
            }]
        }, {
            titleText: 'Hospital Categories',
            legendPosition: 'right'
        });
    };

    // --- Initial Load ---
    adminEmailDisplay.textContent = 'Admin@DocReserve.com'; // Always "Admin@DocReserve.com" for super admin
    adminInitialsEl.textContent = 'AD';

    loadAllCharts();
});
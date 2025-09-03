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
    let ratingCategoriesChart;

    // --- Chart Initialization Function ---
    const initChart = (ctxId, chartType, chartData, options) => {
        const ctx = document.getElementById(ctxId);
        if (!ctx) {
            console.error(`Canvas element with ID '${ctxId}' not found.`);
            return null;
        }

        const existingChart = Chart.getChart(ctxId);
        if (existingChart) {
            existingChart.destroy();
        }

        const newChart = new Chart(ctx.getContext('2d'), {
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
        return newChart;
    };
    
    // --- Populate and Draw Charts ---
    const loadAllCharts = async () => {
        try {
            const response = await fetch('/api/super-admin/analytics', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch analytics data.');
            const data = await response.json();
            
            // User Registration Trends Chart
            userRegistrationChart = initChart('user-registration-trends-chart', 'line', {
                labels: data.userRegistrationTrends.labels,
                datasets: [{
                    label: 'Users Registered',
                    data: data.userRegistrationTrends.data,
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
            doctorOnboardingChart = initChart('doctor-onboarding-statistics-chart', 'line', {
                labels: data.doctorOnboardingStatistics.labels,
                datasets: [{
                    label: 'Doctors Onboarded',
                    data: data.doctorOnboardingStatistics.data,
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
            userDistributionChart = initChart('user-distribution-chart', 'doughnut', {
                labels: data.userDistribution.labels,
                datasets: [{
                    data: data.userDistribution.data,
                    backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545'],
                    hoverOffset: 4
                }]
            }, {
                titleText: 'User Distribution',
                legendPosition: 'right'
            });

            // Doctor Specialties Chart with dynamic distinct colors
            const makeDistinctColors = (n) => {
                const colors = [];
                for (let i = 0; i < n; i++) {
                    const hue = Math.floor((360 / n) * i);
                    colors.push(`hsl(${hue}, 70%, 50%)`);
                }
                return colors;
            };
            const specColors = makeDistinctColors(data.doctorSpecialties.labels.length || 1);
            doctorSpecialtiesChart = initChart('doctor-specialties-chart', 'pie', {
                labels: data.doctorSpecialties.labels,
                datasets: [{
                    data: data.doctorSpecialties.data,
                    backgroundColor: specColors,
                    hoverOffset: 4
                }]
            }, {
                titleText: 'Doctor Specialties',
                legendPosition: 'right'
            });

            // Rating Categories Chart (e.g., 4.9, 4.8, ...)
            ratingCategoriesChart = initChart('rating-categories-chart', 'bar', {
                labels: data.ratingCategories.labels,
                datasets: [{
                    label: 'Number of Doctors',
                    data: data.ratingCategories.data,
                    backgroundColor: '#17a2b8'
                }]
            }, {
                titleText: 'Rating Categories (avg doctor rating buckets)',
                scales: { y: { beginAtZero: true } }
            });
        } catch (error) {
            console.error('Error fetching analytics data:', error);
            // Handle error, e.g., display a message on the page
        }
    };

    // --- Initial Load ---
    adminEmailDisplay.textContent = 'Admin@DocReserve.com';
    adminInitialsEl.textContent = 'AD';

    loadAllCharts();
});

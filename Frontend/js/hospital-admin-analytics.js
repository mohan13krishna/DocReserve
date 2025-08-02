// public/js/hospital-admin-analytics.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'hospital_admin') {
        window.location.href = '/login.html';
        return;
    }

    // Elements for admin info (re-used from dashboard.js logic)
    const adminFullNameEl = document.getElementById('admin-full-name');
    const adminInitialsEl = document.getElementById('admin-initials');

    // Analytics metric elements
    const patientSatisfactionScoreEl = document.getElementById('patient-satisfaction-score');
    const patientSatisfactionReviewsEl = document.getElementById('patient-satisfaction-reviews');
    const avgWaitTimeEl = document.getElementById('avg-wait-time');
    const avgWaitTimeChangeEl = document.getElementById('avg-wait-time-change');
    const cancellationRateEl = document.getElementById('cancellation-rate');
    const cancellationRateChangeEl = document.getElementById('cancellation-rate-change');
    const topDoctorsTableBody = document.getElementById('top-doctors-table-body');
    const analyticsChartTimeFilters = document.querySelectorAll('.chart-time-filter');


    // Chart instances
    let appointmentStatsChart;
    let departmentDistributionChart;


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
    const loadAllAnalyticsData = async (timeframe = 'daily') => {
        try {
            const response = await fetch(`/api/hospital-admin/analytics?timeframe=${timeframe}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch analytics data.');
            const data = await response.json();

            // Appointment Statistics Chart
            const appStatsData = data.appointmentStats[timeframe];
            appointmentStatsChart = initChart('appointment-statistics-chart', 'line', {
                labels: appStatsData.labels,
                datasets: [{
                    label: 'Appointments',
                    data: appStatsData.data,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            }, {
                titleText: 'Appointment Statistics',
                scales: { y: { beginAtZero: true }, x: {} }
            });

            // Department Distribution Chart
            const deptDistData = data.departmentDistribution;
            departmentDistributionChart = initChart('department-distribution-chart', 'doughnut', {
                labels: deptDistData.labels,
                datasets: [{
                    data: deptDistData.data,
                    backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545'], // Example colors
                    hoverOffset: 4
                }]
            }, {
                titleText: 'Department Distribution',
                legendPosition: 'right'
            });

            // Populate Other Metrics
            patientSatisfactionScoreEl.textContent = data.metrics.patientSatisfaction.score;
            patientSatisfactionReviewsEl.textContent = `Based on ${data.metrics.patientSatisfaction.reviews} reviews`;
            avgWaitTimeEl.textContent = data.metrics.avgWaitTime.minutes;
            avgWaitTimeChangeEl.textContent = data.metrics.avgWaitTime.change;
            cancellationRateEl.textContent = data.metrics.cancellationRate.rate;
            cancellationRateChangeEl.textContent = data.metrics.cancellationRate.change;

            // Load Top Performing Doctors
            topDoctorsTableBody.innerHTML = '';
            if (data.topDoctors && data.topDoctors.length > 0) {
                data.topDoctors.forEach(doc => {
                    const row = `
                        <tr>
                            <td>${doc.name}<br>${doc.department}</td>
                            <td>${doc.appointments}</td>
                            <td>${doc.rating}</td>
                            <td>${doc.revenue}</td>
                            <td style="color:${doc.growth.startsWith('+') ? '#28a745' : '#dc3545'};">${doc.growth}</td>
                        </tr>
                    `;
                    topDoctorsTableBody.insertAdjacentHTML('beforeend', row);
                });
            } else {
                topDoctorsTableBody.innerHTML = '<tr><td colspan="5">No top performing doctors found.</td></tr>';
            }

        } catch (error) {
            console.error('Error loading analytics data:', error);
            // Display error messages on relevant sections if needed
        }
    };


    // --- Initial Load ---
    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    const adminFirstName = decodedToken.first_name || 'Sarah';
    const adminLastName = decodedToken.last_name || 'Johnson';
    document.getElementById('admin-full-name').textContent = `${adminFirstName} ${adminLastName}`;
    document.getElementById('admin-initials').textContent = `${adminFirstName.charAt(0)}${adminLastName.charAt(0)}`.toUpperCase();

    loadAllAnalyticsData('daily'); // Initialize with daily view

    // --- Event Listeners ---
    analyticsChartTimeFilters.forEach(button => {
        button.addEventListener('click', (event) => {
            analyticsChartTimeFilters.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            loadAllAnalyticsData(event.target.dataset.time);
        });
    });

    // Date range filter for Top Performing Doctors (you'd re-call loadTopPerformingDoctors with new dates)
    document.getElementById('start-date').addEventListener('change', loadAllAnalyticsData);
    document.getElementById('end-date').addEventListener('change', loadAllAnalyticsData);
});
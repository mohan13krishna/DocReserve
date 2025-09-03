// public/js/login.js
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('login-form').addEventListener('submit', async function(event) {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const messageDiv = document.getElementById('login-message');
        messageDiv.textContent = ''; // Clear previous messages
        messageDiv.classList.add('hidden'); // Hide it

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token); // Store token
                localStorage.setItem('userRole', data.role); // Store role

                // Redirect based on role
                if (data.role === 'user') {
                    window.location.href = '/patient-dashboard.html';
                } else if (data.role === 'doctor') {
                    window.location.href = '/doctor-dashboard.html';
                } else if (data.role === 'hospital_admin') {
                    window.location.href = '/hospital-admin-dashboard.html';
                } else if (data.role === 'super_admin') {
                     window.location.href = '/super-admin-dashboard.html';
                }
            } else {
                messageDiv.textContent = data.message || 'Login failed. Please try again.';
                messageDiv.classList.remove('hidden');
                messageDiv.classList.remove('success-message');
                messageDiv.classList.add('error-message');
            }
        } catch (error) {
            console.error('Login error:', error);
            messageDiv.textContent = 'An error occurred. Please try again later.';
            messageDiv.classList.remove('hidden');
            messageDiv.classList.remove('success-message');
            messageDiv.classList.add('error-message');
        }
    });
});

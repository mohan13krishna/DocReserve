// public/js/register.js
document.addEventListener('DOMContentLoaded', function() {
    const roleSelect = document.getElementById('role');
    const doctorFields = document.getElementById('doctor-fields');
    const hospitalAdminFields = document.getElementById('hospital-admin-fields');
    const registerForm = document.getElementById('register-form');
    const messageDiv = document.getElementById('register-message');

    function toggleRoleSpecificFields() {
        doctorFields.classList.add('hidden');
        hospitalAdminFields.classList.add('hidden');
        // Clear input values when hidden to prevent accidental submission of wrong data
        document.getElementById('doctor_registration_id').value = '';
        document.getElementById('hospital_id').value = '';


        if (roleSelect.value === 'doctor') {
            doctorFields.classList.remove('hidden');
        } else if (roleSelect.value === 'hospital_admin') {
            hospitalAdminFields.classList.remove('hidden');
        }
    }

    roleSelect.addEventListener('change', toggleRoleSpecificFields);
    toggleRoleSpecificFields(); // Call on load to set initial state

    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        messageDiv.textContent = '';
        messageDiv.classList.add('hidden');
        messageDiv.classList.remove('error-message', 'success-message');

        const formData = {
            first_name: document.getElementById('first_name').value,
            last_name: document.getElementById('last_name').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            role: roleSelect.value,
        };

        if (formData.role === 'doctor') {
            formData.doctor_registration_id = document.getElementById('doctor_registration_id').value;
            // Hospital ID for doctor is optional during registration, can be set by admin
            formData.hospital_id = document.getElementById('doctor_hospital_id').value || null;
        } else if (formData.role === 'hospital_admin') {
            formData.hospital_id = document.getElementById('hospital_id').value;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.textContent = data.message;
                messageDiv.classList.remove('hidden');
                messageDiv.classList.add('success-message');
                registerForm.reset(); // Clear the form
                toggleRoleSpecificFields(); // Reset fields visibility
                // Optionally redirect after a delay
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 3000);
            } else {
                messageDiv.textContent = data.message || 'Registration failed.';
                messageDiv.classList.remove('hidden');
                messageDiv.classList.add('error-message');
            }
        } catch (error) {
            console.error('Registration error:', error);
            messageDiv.textContent = 'An error occurred during registration. Please try again later.';
            messageDiv.classList.remove('hidden');
            messageDiv.classList.add('error-message');
        }
    });
});
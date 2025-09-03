// public/js/register.js
document.addEventListener('DOMContentLoaded', function() {
    const roleSelect = document.getElementById('role');
    const doctorFields = document.getElementById('doctor-fields');
    const hospitalAdminFields = document.getElementById('hospital-admin-fields');
    const registerForm = document.getElementById('register-form');
    const messageDiv = document.getElementById('register-message');

    // Get the conditional input elements
    const doctorRegIdInput = document.getElementById('doctor_registration_id');
    const hospitalIdInput = document.getElementById('hospital_id');
    const doctorHospitalIdInput = document.getElementById('doctor_hospital_id');

    // Password helpers
    const pwdInput = document.getElementById('password');
    const pwdConfirmInput = document.getElementById('confirm_password');
    const togglePwdBtn = document.getElementById('toggle-password');
    const toggleConfirmBtn = document.getElementById('toggle-confirm');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');

    // Role help text
    const roleHelp = document.getElementById('role-help');

    // Function to handle showing/hiding fields and setting 'required' attribute
    function toggleRoleSpecificFields() {
        // First, hide all conditional fields and remove 'required'
        doctorFields.classList.add('hidden');
        hospitalIdInput.required = false;
        doctorRegIdInput.required = false;
        hospitalAdminFields.classList.add('hidden');

        // Help text default
        roleHelp.textContent = '';

        // Then, check the selected role and apply visibility and 'required'
        if (roleSelect.value === 'doctor') {
            doctorFields.classList.remove('hidden');
            doctorRegIdInput.required = true;
            // Require hospital id for doctors
            const docHosp = document.getElementById('doctor_hospital_id');
            if (docHosp) docHosp.required = true;
            roleHelp.textContent = 'Doctor registrations require a valid Doctor Registration ID and Hospital ID. Your account will be reviewed by a Hospital Admin before you can log in.';
        } else if (roleSelect.value === 'hospital_admin') {
            hospitalAdminFields.classList.remove('hidden');
            hospitalIdInput.required = true;
            roleHelp.textContent = 'Hospital Admin registrations require a valid Hospital ID. Your request will be reviewed by a Super Admin. You can log in after approval.';
        } else {
            roleHelp.textContent = 'Patients can log in immediately after registering.';
        }
    }

    roleSelect.addEventListener('change', toggleRoleSpecificFields);
    toggleRoleSpecificFields(); // Call on load to set initial state

    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        messageDiv.textContent = '';
        messageDiv.classList.add('hidden');
        messageDiv.classList.remove('error-message', 'success-message');

        // Basic client-side checks
        if (pwdInput.value !== pwdConfirmInput.value) {
            messageDiv.textContent = 'Passwords do not match.';
            messageDiv.classList.remove('hidden');
            messageDiv.classList.add('error-message');
            return;
        }
        if (pwdInput.value.length < 6) {
            messageDiv.textContent = 'Password must be at least 6 characters.';
            messageDiv.classList.remove('hidden');
            messageDiv.classList.add('error-message');
            return;
        }

        const formData = {
            first_name: document.getElementById('first_name').value,
            last_name: document.getElementById('last_name').value,
            email: document.getElementById('email').value,
            password: pwdInput.value,
            role: roleSelect.value,
        };

        if (formData.role === 'doctor') {
            formData.doctor_registration_id = doctorRegIdInput.value;
            formData.hospital_id = document.getElementById('doctor_hospital_id').value;
        } else if (formData.role === 'hospital_admin') {
            formData.hospital_id = hospitalIdInput.value;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.textContent = data.message;
                messageDiv.classList.remove('hidden');
                messageDiv.classList.add('success-message');
                registerForm.reset();
                toggleRoleSpecificFields();
                setTimeout(() => { window.location.href = '/login.html'; }, 2500);
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

    // Password strength and toggles
    function evaluateStrength(pwd) {
        let score = 0;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[a-z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        return score; // 0..5
    }
    function renderStrength(score) {
        const pct = (score / 5) * 100;
        strengthBar.style.width = pct + '%';
        let cls = 'bg-danger', label = 'Very Weak';
        if (score === 2) { cls = 'bg-warning'; label = 'Weak'; }
        if (score === 3) { cls = 'bg-info'; label = 'Okay'; }
        if (score === 4) { cls = 'bg-primary'; label = 'Good'; }
        if (score === 5) { cls = 'bg-success'; label = 'Strong'; }
        strengthBar.className = 'progress-bar ' + cls;
        strengthText.textContent = 'Strength: ' + label;
    }
    pwdInput.addEventListener('input', () => {
        renderStrength(evaluateStrength(pwdInput.value));
    });
    function toggleVisibility(input, btn) {
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        if (btn) btn.textContent = isPwd ? 'Hide' : 'Show';
    }
    togglePwdBtn.addEventListener('click', () => toggleVisibility(pwdInput, togglePwdBtn));
    toggleConfirmBtn.addEventListener('click', () => toggleVisibility(pwdConfirmInput, toggleConfirmBtn));

});

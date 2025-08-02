// public/js/hospital-admin-profile.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'hospital_admin') {
        window.location.href = '/login.html';
        return;
    }

    const adminInitialsProfileEl = document.getElementById('admin-initials-profile');
    const firstNameInput = document.getElementById('first-name');
    const lastNameInput = document.getElementById('last-name');
    const emailAddressInput = document.getElementById('email-address');
    const phoneNumberInput = document.getElementById('phone-number');
    const departmentInput = document.getElementById('department');
    const hospitalNameInput = document.getElementById('hospital-name');

    const accountCreatedEl = document.getElementById('account-created');
    const lastLoginEl = document.getElementById('last-login');
    const totalSessionsEl = document.getElementById('total-sessions');
    const doctorsApprovedEl = document.getElementById('doctors-approved');

    // --- Initial Profile Data Load ---
    try {
        const response = await fetch('/api/hospital-admin/profile', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch admin profile.');
        const profileData = await response.json();
        console.log('Hospital Admin Profile Data:', profileData);

        // Set initials
        adminInitialsProfileEl.textContent = `${profileData.first_name.charAt(0)}${profileData.last_name.charAt(0)}`.toUpperCase();


        // Populate form fields
        firstNameInput.value = profileData.first_name || '';
        lastNameInput.value = profileData.last_name || '';
        emailAddressInput.value = profileData.email || '';
        phoneNumberInput.value = profileData.phone_number || '';
        departmentInput.value = profileData.department || '';
        hospitalNameInput.value = profileData.hospital_name || ''; // Read-only

        // Populate quick stats (dummy data for now, would come from API or be calculated)
        accountCreatedEl.textContent = 'Jan 15, 2023'; // Placeholder
        lastLoginEl.textContent = 'Today, 9:30 AM'; // Placeholder
        totalSessionsEl.textContent = '1,247'; // Placeholder
        doctorsApprovedEl.textContent = '89'; // Placeholder

    } catch (error) {
        console.error('Error loading admin profile data:', error);
        alert('Failed to load profile data.');
    }

    // --- Form Submission Handlers ---
    document.getElementById('personal-info-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const updatedInfo = {
            first_name: firstNameInput.value,
            last_name: lastNameInput.value,
            phone_number: phoneNumberInput.value,
            department: departmentInput.value
        };

        try {
            const response = await fetch('/api/hospital-admin/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedInfo)
            });
            if (response.ok) {
                alert('Personal information updated successfully!');
            } else {
                const errorData = await response.json();
                alert(`Failed to update profile: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Error updating personal info:', error);
            alert('An error occurred while updating personal information.');
        }
    });

    document.getElementById('password-change-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;

        if (newPassword !== confirmNewPassword) {
            alert('New password and confirm new password do not match.');
            return;
        }

        if (newPassword.length < 6) { // Basic validation
            alert('New password must be at least 6 characters long.');
            return;
        }

        try {
            const response = await fetch('/api/hospital-admin/profile/password', { // Assuming this endpoint exists
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });

            if (response.ok) {
                alert('Password updated successfully!');
                document.getElementById('password-change-form').reset(); // Clear form
            } else {
                const errorData = await response.json();
                alert(`Password change failed: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Error changing password:', error);
            alert('An error occurred while changing password.');
        }
    });

    // Event listener for notification toggles (if you want to save them)
    document.querySelector('.notification-settings-card .button.primary').addEventListener('click', () => {
        alert('Notification settings save logic to be implemented!');
        // You would collect states of checkboxes and send to a PUT endpoint
    });

    // Event listener for "Upload New Photo" (requires file upload logic)
    document.getElementById('change-photo-btn').addEventListener('click', () => {
        alert('Photo upload logic to be implemented!');
        // This would involve FormData and a multipart/form-data request
    });
});
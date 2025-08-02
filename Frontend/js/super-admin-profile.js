// public/js/super-admin-profile.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'super_admin') {
        window.location.href = '/login.html';
        return;
    }

    const adminInitialsProfileEl = document.getElementById('admin-initials-profile');
    const usernameInput = document.getElementById('username');
    const emailAddressInput = document.getElementById('email-address');

    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password');

    const accountCreatedEl = document.getElementById('account-created');
    const lastLoginEl = document.getElementById('last-login');
    const totalSessionsEl = document.getElementById('total-sessions');
    const hospitalAdminsApprovedEl = document.getElementById('hospital-admins-approved'); // Renamed for clarity


    // --- Initial Profile Data Load ---
    try {
        const response = await fetch('/api/super-admin/profile', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch super admin profile.');
        const profileData = await response.json();
        console.log('Super Admin Profile Data:', profileData);

        // Populate form fields
        usernameInput.value = profileData.username || '';
        emailAddressInput.value = profileData.email || '';
        adminInitialsProfileEl.textContent = 'AD'; // Super Admin initials are static 'AD'

        // Populate quick stats
        accountCreatedEl.textContent = profileData.quickStats.accountCreated || 'N/A';
        lastLoginEl.textContent = profileData.quickStats.lastLogin || 'N/A';
        totalSessionsEl.textContent = profileData.quickStats.totalSessions || 'N/A';
        hospitalAdminsApprovedEl.textContent = profileData.quickStats.hospitalAdminsApproved || 'N/A';

    } catch (error) {
        console.error('Error loading super admin profile data:', error);
        alert('Failed to load profile data.');
    }

    // --- Form Submission Handlers ---
    document.getElementById('personal-info-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        alert('Super Admin personal information update logic is not implemented as per design (fields are readonly).');
        // This form is primarily for display for the Super Admin
    });

    document.getElementById('password-change-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;

        if (newPassword !== confirmNewPassword) {
            alert('New password and confirm new password do not match.');
            return;
        }

        if (newPassword.length < 6) {
            alert('New password must be at least 6 characters long.');
            return;
        }

        try {
            const response = await fetch('/api/super-admin/profile/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });

            if (response.ok) {
                alert('Password updated successfully!');
                document.getElementById('password-change-form').reset();
            } else {
                const errorData = await response.json();
                alert(`Password change failed: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Error changing password:', error);
            alert('An error occurred while changing password.');
        }
    });

    // Event listener for "Upload New Photo" (requires file upload logic)
    document.getElementById('change-photo-btn').addEventListener('click', () => {
        alert('Photo upload logic to be implemented!');
    });
});
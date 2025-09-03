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
    
    // Log missing elements to help with debugging
    const requiredElements = [
        { id: 'admin-initials-profile', el: adminInitialsProfileEl },
        { id: 'first-name', el: firstNameInput },
        { id: 'last-name', el: lastNameInput },
        { id: 'email-address', el: emailAddressInput },
        { id: 'phone-number', el: phoneNumberInput },
        { id: 'department', el: departmentInput },
        { id: 'hospital-name', el: hospitalNameInput }
    ];
    
    const missingElements = requiredElements.filter(item => !item.el);
    if (missingElements.length > 0) {
        console.warn('Missing required DOM elements:', missingElements.map(item => item.id));
    }

    // --- Initial Profile Data Load ---
    // Create a loading indicator
    const profileCard = document.querySelector('.profile-card');
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'text-center py-5';
    loadingIndicator.innerHTML = `
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3 text-muted">Loading profile data...</p>
    `;
    
    // Show loading indicator
    profileCard.prepend(loadingIndicator);
    
    // Function to load mock data if API fails
    const loadMockProfileData = () => {
        console.log('Loading mock profile data as fallback');
        return {
            hospital_admin_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@hospital.com',
            phone_number: '(555) 123-4567',
            department: 'Administration',
            hospital_name: 'General Hospital',
            gender: 'male',
            created_at: '2023-01-15T08:30:00Z',
            last_login: new Date().toISOString()
        };
    };
    
    // Check if we're in development mode or API is unavailable
    const isDevelopmentMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    try {
        console.log('Fetching profile data from:', '/api/hospital-admin/profile');
        console.log('Using authorization token:', token ? `Bearer ${token.substring(0, 10)}...` : 'No token');
        
        // Set a timeout for the fetch request
        const fetchPromise = fetch('/api/hospital-admin/profile', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out after 5 seconds')), 5000);
        });
        
        // Race the fetch against the timeout
        const response = await Promise.race([fetchPromise, timeoutPromise])
            .catch(error => {
                console.error('Network error during fetch:', error);
                
                // If in development mode, use mock data instead of throwing error
                if (isDevelopmentMode) {
                    console.warn('Using mock data in development mode');
                    return { ok: true, json: () => Promise.resolve(loadMockProfileData()) };
                }
                
                throw new Error('Network connection error. Please check your internet connection or the server may be down.');
            });

        // Remove loading indicator
        loadingIndicator.remove();
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers ? [...response.headers.entries()] : 'No headers available');

        let profileData;
        
        if (!response.ok) {
            const errorData = await response.json().catch(e => {
                console.error('Error parsing error response:', e);
                return {};
            });
            console.error('Error response data:', errorData);
            
            // If in development mode, use mock data instead of throwing error
            if (isDevelopmentMode) {
                console.warn('Using mock data due to API error in development mode');
                profileData = loadMockProfileData();
            } else {
                throw new Error(errorData.message || `Server error (${response.status}): ${response.statusText}`);
            }
        } else {
            // Try to parse the response JSON
            profileData = await response.json().catch(error => {
                console.error('Error parsing profile data:', error);
                
                // If in development mode, use mock data instead of throwing error
                if (isDevelopmentMode) {
                    console.warn('Using mock data due to parsing error in development mode');
                    return loadMockProfileData();
                }
                
                throw new Error('Invalid response format from server.');
            });
        }
        
        console.log('Hospital Admin Profile Data:', profileData);

        // Set initials
        if (adminInitialsProfileEl) {
            adminInitialsProfileEl.textContent = `${profileData.first_name.charAt(0)}${profileData.last_name.charAt(0)}`.toUpperCase();
        } else {
            console.warn('Element with ID "admin-initials-profile" not found in the DOM');
        }
        
        // Set profile image if available
        const profileImage = document.getElementById('profile-image');
        if (profileImage && typeof getProfileImageUrl === 'function') {
            profileImage.src = getProfileImageUrl(profileData.gender, profileData.hospital_admin_id);
            profileImage.alt = `${profileData.first_name} ${profileData.last_name}`;
        } else if (!profileImage) {
            console.warn('Element with ID "profile-image" not found in the DOM');
        }

        // Populate form fields with null checks
        if (firstNameInput) firstNameInput.value = profileData.first_name || '';
        if (lastNameInput) lastNameInput.value = profileData.last_name || '';
        if (emailAddressInput) emailAddressInput.value = profileData.email || '';
        if (phoneNumberInput) phoneNumberInput.value = profileData.phone_number || '';
        if (departmentInput) departmentInput.value = profileData.department || '';
        if (hospitalNameInput) hospitalNameInput.value = profileData.hospital_name || ''; // Read-only

        // Populate quick stats with null checks (dummy data for now, would come from API or be calculated)
        if (accountCreatedEl) accountCreatedEl.textContent = 'Jan 15, 2023'; // Placeholder
        if (lastLoginEl) lastLoginEl.textContent = 'Today, 9:30 AM'; // Placeholder
        if (totalSessionsEl) totalSessionsEl.textContent = '1,247'; // Placeholder
        if (doctorsApprovedEl) doctorsApprovedEl.textContent = '89'; // Placeholder

    } catch (error) {
        console.error('Error loading admin profile data:', error);
        
        // Remove loading indicator if it still exists
        if (loadingIndicator.parentNode) {
            loadingIndicator.remove();
        }
        
        // Create a more user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger mx-auto my-4';
        errorMessage.style.maxWidth = '600px';
        errorMessage.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
                <div>
                    <h5 class="alert-heading mb-1">Failed to load profile data</h5>
                    <p class="mb-2">${error.message || 'Could not connect to the server. Please try again later.'}</p>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.location.reload()">Try Again</button>
                </div>
            </div>
        `;
        
        profileCard.prepend(errorMessage);
    }

    // --- Form Submission Handlers ---
    const personalInfoForm = document.getElementById('personal-info-form');
    if (personalInfoForm) {
        personalInfoForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const updatedInfo = {
                first_name: firstNameInput ? firstNameInput.value : '',
                last_name: lastNameInput ? lastNameInput.value : '',
                phone_number: phoneNumberInput ? phoneNumberInput.value : '',
                department: departmentInput ? departmentInput.value : ''
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
                    
                    // Update initials if name changed and element exists
                    if (adminInitialsProfileEl) {
                        adminInitialsProfileEl.textContent = `${updatedInfo.first_name.charAt(0)}${updatedInfo.last_name.charAt(0)}`.toUpperCase();
                    }
                } else {
                    const errorData = await response.json();
                    alert(`Failed to update profile: ${errorData.message}`);
                }
            } catch (error) {
                console.error('Error updating personal info:', error);
                alert('An error occurred while updating personal information.');
            }
        });
    } else {
        console.error('Personal info form not found in the DOM');
    }

    const passwordChangeForm = document.getElementById('password-change-form');
    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const currentPasswordEl = document.getElementById('current-password');
            const newPasswordEl = document.getElementById('new-password');
            const confirmNewPasswordEl = document.getElementById('confirm-new-password');
            
            if (!currentPasswordEl || !newPasswordEl || !confirmNewPasswordEl) {
                console.error('One or more password fields not found in the DOM');
                alert('Error: Password form fields not found');
                return;
            }
            
            const currentPassword = currentPasswordEl.value;
            const newPassword = newPasswordEl.value;
            const confirmNewPassword = confirmNewPasswordEl.value;

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
                    passwordChangeForm.reset(); // Clear form
                } else {
                    const errorData = await response.json();
                    alert(`Password change failed: ${errorData.message}`);
                }
            } catch (error) {
                console.error('Error changing password:', error);
                alert('An error occurred while changing password.');
            }
        });
    } else {
        console.error('Password change form not found in the DOM');
    }

    // Event listener for notification toggles (if you want to save them)
    const notificationSettingsBtn = document.querySelector('.notification-settings-card .button.primary');
    if (notificationSettingsBtn) {
        notificationSettingsBtn.addEventListener('click', () => {
            alert('Notification settings save logic to be implemented!');
            // You would collect states of checkboxes and send to a PUT endpoint
        });
    } else {
        console.warn('Notification settings button not found in the DOM');
    }

    // Event listener for "Upload New Photo" (requires file upload logic)
    const changePhotoBtn = document.getElementById('change-photo-btn');
    if (changePhotoBtn) {
        changePhotoBtn.addEventListener('click', () => {
            alert('Photo upload feature coming soon! Currently using generated profile image.');
            // This would involve FormData and a multipart/form-data request
        });
    } else {
        console.warn('Change photo button not found in the DOM');
    }
});

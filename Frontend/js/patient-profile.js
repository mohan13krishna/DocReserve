// public/js/patient-profile.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'user') {
        window.location.href = '/login.html';
        return;
    }
    
    // Check if profile image utility function is available
    if (typeof getProfileImageUrl !== 'function') {
        console.error('Profile image utility function not found. Make sure utils.js is loaded.');
    }

    const patientFullNameEl = document.getElementById('patient-full-name');
    const patientInitialsEl = document.getElementById('patient-initials');

    // Elements for forms
    const firstNameInput = document.getElementById('first-name');
    const lastNameInput = document.getElementById('last-name');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const dobInput = document.getElementById('date-of-birth');
    const addressInput = document.getElementById('address');
    const bloodTypeInput = document.getElementById('blood-type');
    const genderSelect = document.getElementById('gender');
    const allergiesInput = document.getElementById('allergies');
    const currentMedicationsInput = document.getElementById('current-medications');
    const medicalConditionsInput = document.getElementById('medical-conditions');
    const emergencyNameInput = document.getElementById('emergency-name');
    const emergencyRelationshipInput = document.getElementById('emergency-relationship');
    const emergencyPhoneInput = document.getElementById('emergency-phone');
    const insuranceProviderInput = document.getElementById('insurance-provider');
    const policyNumberInput = document.getElementById('policy-number');
    const groupNumberInput = document.getElementById('group-number');
    const memberIdInput = document.getElementById('member-id');

    // --- Fetch Profile Data ---
    const fetchProfile = async () => {
        try {
            const response = await fetch('/api/patient/profile', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch profile data.');
            const data = await response.json();
            console.log('Patient Profile Data:', data);

            // Populate header info
    patientFullNameEl.textContent = `${data.first_name || ''} ${data.last_name || ''}`;
    patientInitialsEl.textContent = `${(data.first_name || '').charAt(0)}${(data.last_name || '').charAt(0)}`.toUpperCase();
    
    // Set profile image if available
    const profileImage = document.getElementById('profile-image');
    if (profileImage && typeof getProfileImageUrl === 'function') {
        profileImage.src = getProfileImageUrl(data.gender, data.patient_id);
        profileImage.alt = `${data.first_name} ${data.last_name}`;
    }


            // Populate Personal Information
            firstNameInput.value = data.first_name || '';
            lastNameInput.value = data.last_name || '';
            emailInput.value = data.email || '';
            phoneInput.value = data.phone_number || '';
            dobInput.value = data.date_of_birth ? new Date(data.date_of_birth).toISOString().split('T')[0] : '';
            addressInput.value = data.address || '';
            genderSelect.value = data.gender || '';

            // Populate Medical Information
            bloodTypeInput.value = data.blood_type || '';
            allergiesInput.value = data.allergies || '';
            currentMedicationsInput.value = data.current_medications || '';
            medicalConditionsInput.value = data.medical_conditions || '';

            // Populate Emergency Contact
            emergencyNameInput.value = data.emergency_contact_name || '';
            emergencyRelationshipInput.value = data.emergency_contact_relationship || '';
            emergencyPhoneInput.value = data.emergency_contact_phone || '';

            // Populate Insurance Information
            insuranceProviderInput.value = data.insurance_provider || '';
            policyNumberInput.value = data.policy_number || '';
            groupNumberInput.value = data.group_number || '';
            memberIdInput.value = data.member_id || '';
            
            // Notification preferences would need separate API/logic
        } catch (error) {
            console.error('Error fetching patient profile:', error);
            alert('Failed to load patient profile.');
        }
    };

    // --- Form Submission Handler (Unified) ---
    const profileForm = document.getElementById('profile-form');
    profileForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        // Basic validations
        const errors = [];
        if (!firstNameInput.value.trim()) errors.push('First name is required');
        if (!lastNameInput.value.trim()) errors.push('Last name is required');
        if (dobInput.value && new Date(dobInput.value) > new Date()) errors.push('Date of birth cannot be in the future');
        if (errors.length) { alert(errors.join('\n')); return; }

        const data = {
            first_name: firstNameInput.value,
            last_name: lastNameInput.value,
            phone_number: phoneInput.value,
            date_of_birth: dobInput.value,
            address: addressInput.value,
            gender: genderSelect.value,
            blood_type: bloodTypeInput.value,
            allergies: allergiesInput.value,
            current_medications: currentMedicationsInput.value,
            medical_conditions: medicalConditionsInput.value,
            emergency_contact_name: emergencyNameInput.value,
            emergency_contact_relationship: emergencyRelationshipInput.value,
            emergency_contact_phone: emergencyPhoneInput.value,
            insurance_provider: insuranceProviderInput.value,
            policy_number: policyNumberInput.value,
            group_number: groupNumberInput.value,
            member_id: memberIdInput.value
        };
        try {
            const response = await fetch('/api/patient/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to save profile.');
            alert('Profile saved successfully!');
            fetchProfile();
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Failed to save profile.');
        }
    });

    // Remove old per-section handlers now that we use unified profile-form

    // --- Initial Fetch ---
    fetchProfile();

    // Photo change/upload would require specific file upload logic
    document.getElementById('change-photo-btn').addEventListener('click', () => {
        alert('Photo upload feature coming soon! Currently using generated profile image.');
    });

    // Notification preferences saving (if implemented, would need its own PUT endpoint)
    document.querySelector('.notification-settings-card .button.primary').addEventListener('click', () => {
        alert('Notification preferences save logic not yet implemented.');
    });
});

// Frontend/js/utils.js

/**
 * Generates a profile image URL based on gender and a unique identifier
 * @param {string} gender - 'male', 'female', or any other value (defaults to male)
 * @param {number|string} id - A unique identifier to generate different images (1-200)
 * @returns {string} - URL to the profile image
 */
function getProfileImageUrl(gender, id) {
  // Normalize gender to lowercase for comparison
  const normalizedGender = (gender || '').toLowerCase();
  
  // Determine if we should use 'men' or 'women' in the URL
  const genderPath = normalizedGender === 'female' ? 'women' : 'men';
  
  // Convert id to a number and ensure it's between 1 and 200
  let imageId = parseInt(id, 10) || 1;
  imageId = Math.max(1, Math.min(imageId, 200));
  
  // Return the complete URL
  return `https://randomuser.me/api/portraits/${genderPath}/${imageId}.jpg`;
}

/**
 * Generates a profile image URL based on user data
 * @param {Object} userData - User data object containing gender and id
 * @returns {string} - URL to the profile image
 */
function getUserProfileImage(userData) {
  if (!userData) return getProfileImageUrl();
  
  // Use user_id, doctor_id, patient_id, or hospital_admin_id as the unique identifier
  const id = userData.user_id || userData.doctor_id || userData.patient_id || userData.hospital_admin_id || 1;
  
  return getProfileImageUrl(userData.gender, id);
}

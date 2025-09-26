# Profile Picture Upload - Frontend Implementation Guide

## Option 1: File Upload from Local Device (RECOMMENDED)

### Frontend HTML/Framework Examples:

#### React.js Implementation:
```jsx
import React, { useState } from 'react';
import axios from 'axios';

const ProfilePictureUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [profilePic, setProfilePic] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      setSelectedFile(file);
      
      // Preview the image
      const reader = new FileReader();
      reader.onload = (e) => setProfilePic(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadProfilePicture = async () => {
    if (!selectedFile) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('profilePicture', selectedFile);

    try {
      const response = await axios.post('/api/profile/upload-picture', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Upload successful:', response.data);
      setProfilePic(response.data.data.profilePic);
      alert('Profile picture updated successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload profile picture');
    } finally {
      setLoading(false);
    }
  };

  const deleteProfilePicture = async () => {
    setLoading(true);
    try {
      await axios.delete('/api/profile/delete-picture', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      setProfilePic('');
      alert('Profile picture deleted successfully!');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete profile picture');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-picture-upload">
      {/* Current Profile Picture */}
      {profilePic && (
        <div className="current-pic">
          <img src={profilePic} alt="Current Profile" style={{width: 100, height: 100, borderRadius: '50%'}} />
        </div>
      )}

      {/* File Input */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{display: 'none'}}
        id="profile-pic-input"
      />
      
      <label htmlFor="profile-pic-input" className="file-input-label">
        Choose New Image
      </label>

      {/* Upload Button */}
      {selectedFile && (
        <button 
          onClick={uploadProfilePicture} 
          disabled={loading}
          className="upload-btn"
        >
          {loading ? 'Uploading...' : 'Upload Profile Picture'}
        </button>
      )}

      {/* Delete Button */}
      {profilePic && (
        <button 
          onClick={deleteProfilePicture} 
          disabled={loading}
          className="delete-btn"
        >
          Delete Current Picture
        </button>
      )}
    </div>
  );
};

export default ProfilePictureUpload;
```

#### Vanilla JavaScript Implementation:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Profile Picture Upload</title>
</head>
<body>
    <div id="profile-container">
        <h3>Profile Picture Upload</h3>
        
        <!-- Current Profile Picture Display -->
        <div id="current-pic">
            <!-- Will be populated by JavaScript -->
        </div>
        
        <!-- File Input -->
        <input 
            type="file" 
            id="imageInput" 
            accept="image/*"
            style="margin: 10px 0;"
        />
        
        <!-- Upload Button -->
        <button id="uploadBtn" onclick="uploadImage()">Upload Profile Picture</button>
        
        <!-- Delete Button -->
        <button id="deleteBtn" onclick="deleteImage()" style="display: none;">Delete Picture</button>
    </div>

    <script>
        let selectedFile = null;
        const imageInput = document.getElementById('imageInput');
        const uploadBtn = document.getElementById('uploadBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const currentPicDiv = document.getElementById('current-pic');

        // Handle file selection
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    alert('Please select an image file');
                    return;
                }
                
                // Validate file size (5MB limit)
                if (file.size > 5 * 1024 * 1024) {
                    alert('File size must be less than 5MB');
                    return;
                }
                
                selectedFile = file;
                
                // Show preview
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentPicDiv.innerHTML = `<img src="${e.target.result}" style="width: 100px; height: 100px; border-radius: 50%;">`;
                };
                reader.readAsDataURL(file);
            }
        });

        // Upload function
        async function uploadImage() {
            if (!selectedFile) {
                alert('Please select an image first');
                return;
            }

            const formData = new FormData();
            formData.append('profilePicture', selectedFile);

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/profile/upload-picture', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                        // Don't set Content-Type, let browser set it for FormData
                    },
                    body: formData
                });

                const result = await response.json();
                
                if (result.success) {
                    currentPicDiv.innerHTML = `<img src="${result.data.profilePic}" style="width: 100px; height: 100px; border-radius: 50%;">`;
                    deleteBtn.style.display = 'inline-block';
                    alert('Profile picture uploaded successfully!');
                } else {
                    alert('Upload failed: ' + result.message);
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('Failed to upload profile picture');
            }
        }

        // Delete function
        async function deleteImage() {
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/profile/delete-picture', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();
                
                if (result.success) {
                    currentPicDiv.innerHTML = '';
                    deleteBtn.style.display = 'none';
                    alert('Profile picture deleted successfully!');
                } else {
                    alert('Delete failed: ' + result.message);
                }
            } catch (error) {
                console.error('Delete error:', error);
                alert('Failed to delete profile picture');
            }
        }

        // Load current profile picture on page load
        async function loadCurrentProfile() {
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/profile/', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                const result = await response.json();
                if (result.success && result.data.user.profilePic) {
                    currentPicDiv.innerHTML = `<img src="${result.data.user.profilePic}" style="width: 100px; height: 100px; border-radius: 50%;">`;
                    deleteBtn.style.display = 'inline-block';
                }
            } catch (error) {
                console.error('Failed to load profile:', error);
            }
        }

        // Load profile on page initialization
        loadCurrentProfile();
    </script>
</body>
</html>
```

## Option 2: URL Input (Alternative Method)

If you also want to allow URL-based profile pictures:

```jsx
// React component for URL input
const ProfilePictureFromURL = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const updateProfileWithURL = async () => {
    if (!imageUrl) {
      alert('Please enter an image URL');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.put('/api/profile', {
        profilePic: imageUrl,
        // ... other profile fields if updating simultaneously
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Profile updated:', response.data);
      alert('Profile picture updated successfully!');
    } catch (error) {
      console.error('Update failed:', error);
      alert('Failed to update profile picture');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="url"
        placeholder="Enter image URL"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        style={{width: '400px', padding: '10px', margin: '10px'}}
      />
      <button onClick={updateProfileWithURL} disabled={loading}>
        {loading ? 'Updating...' : 'Set Profile Picture from URL'}
      </button>
      
      {imageUrl && (
        <div style={{marginTop: '10px'}}>
          <p>Preview:</p>
          <img src={imageUrl} alt="Preview" style={{width: 100, height: 100, borderRadius: '50%'}} />
        </div>
      )}
    </div>
  );
};
```

## Complete Profile Update Form
```jsx
// Complete profile update form including picture upload
const ProfileUpdateForm = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    profilePic: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({...prev, profilePic: e.target.result}));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedFile) {
      // Upload file first
      const uploadFormData = new FormData();
      uploadFormData.append('profilePicture', selectedFile);
      
      try {
        const uploadResponse = await axios.post('/api/profile/upload-picture', uploadFormData, {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data' 
          }
        });
        
        // Then update other profile data with the new image URL
        const updateResponse = await axios.put('/api/profile', {
          firstName: formData.firstName,
          lastName: formData.lastName,
          profilePic: uploadResponse.data.data.profilePic
        }, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        console.log('Profile updated successfully');
        alert('Profile updated successfully!');
      } catch (error) {
        console.error('Update failed:', error);
        alert('Failed to update profile');
      }
    } else {
      // Just update profile without new image
      // Regular profile update...
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={(e) => setFormData(prev => ({...prev, firstName: e.target.value}))}
      />
      
      <input
        type="text"
        placeholder="Last Name"
        value={formData.lastName}
        onChange={(e) => setFormData(prev => ({...prev, lastName: e.target.value}))}
      />
      
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      <button type="submit">Update Profile</button>
    </form>
  );
};
```

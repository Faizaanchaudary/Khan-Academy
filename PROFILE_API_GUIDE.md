# Profile Update API - Professional Implementation Guide

## Best Practice: Use Different Endpoints for Different Content Types

### 🎯 **Type 1: Text Updates (Names, bio, etc.) - Use JSON**
- **Endpoint:** `PUT /api/profile`
- **Content-Type:** `application/json`
- **Purpose:** Update names, bio, email, password changes

### 📸 **Type 2: Image Uploads - Use FormData**  
- **Endpoint:** `POST /api/profile/upload-picture`
- **Content-Type:** `multipart/form-data`
- **Purpose:** Upload new profile pictures

---

## Implementation Examples

### ✅ **CORRECT WAY: Update Profile Names (JSON)**

**Postman Setup:**
```
Method: PUT
URL: http://localhost:5000/api/profile
Headers:
  Authorization: Bearer YOUR_TOKEN
  Content-Type: application/json

Body (Raw JSON):
{
  "firstName": "John",
  "lastName": "Doe",
  "profilePic": "https://existing-domain.com/image.jpg" // Optional: existing URL
}
```

**JavaScript Frontend:**
```javascript
async function updateProfile(firstName, lastName) {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      firstName: firstName,
      lastName: lastName
      // Add other text fields here
    })
  });
  
  return await response.json();
}

// Usage: updateProfile("John", "Doe");
```

### ✅ **CORRECT WAY: Upload Profile Picture (FormData)**

**Postman Setup:**
```
Method: POST  
URL: http://localhost:5000/api/profile/upload-picture
Headers:
  Authorization: Bearer YOUR_TOKEN

Body (form-data):
profilePicture: [FILE] // Select image from computer
```

**JavaScript Frontend:**
```javascript
async function uploadProfilePicture(imageFile) {
  const formData = new FormData();
  formData.append('profilePicture', imageFile);
  
  const response = await fetch('/api/profile/upload-picture', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type, let browser handle it for FormData
    },
    body: formData
  });
  
  return await response.json();
}

// Usage: 
const fileInput = document.getElementById('profileImage');
const file = fileInput.files[0];
uploadProfilePicture(file);
```

---

## 🚨 **DON'T MIX Data Types**

### ❌ WRONG: Using form-data for text
```http
PUT /api/profile
Content-Type: multipart/form-data
Body: form-data
firstName: "John" 
lastName: "Doe"

<-- This causes parsing issues -->
```

### ❌ WRONG: Adding image upload in text endpoint  
```json
{
  "firstName": "John", 
  "profilePicture": "[FILE BLOB]" <-- Can't send file here
}
```

---

## Complete Frontend Implementation

### React Example:
```jsx
const ProfileUpdateForm = ({ userId }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);

  // Update names/info (JSON)
  const updateProfileInfo = async () => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Profile updated!');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Update failed');
    }
  };

  // Upload image (FormData)
  const uploadProfileImage = async () => {
    if (!selectedFile) return;
    
    const formData = new FormData();
    formData.append('profilePicture', selectedFile);
    
    try {
      const response = await fetch('/api/profile/upload-picture', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Image uploaded!');
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Upload failed');
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={e => setFormData(prev => ({...prev, firstName: e.target.value}))}
      />
      <input
        type="text"
        placeholder="Last Name"  
        value={formData.lastName}
        onChange={e => setFormData(prev => ({...prev, lastName: e.target.value}))}
      />
      <button onClick={updateProfileInfo}>Update Names</button>
      
      <hr />
      
      <input
        type="file"
        accept="image/*"
        onChange={e => setSelectedFile(e.target.files[0])}
      />
      <button onClick={uploadProfileImage} disabled={!selectedFile}>
        Upload New Picture
      </button>
    </div>
  );
};
```

---

## Recommended Workflow

1. **Step 1:** Update profile text data first (names, bio)
2. **Step 2:** Upload new image separately  
3. **Optional:** Use URL to combine both actions in one form

This keeps data clean and makes debugging easier.

# Profile API Documentation

## Overview
Profile management API endpoints for user profile operations and password management.

**Base URL:** `/profile`

**Authentication:** All endpoints require valid authentication token.

---

## Endpoints

### 1. Get Profile
**GET** `/profile/`

Retrieves current user's profile information.

#### Response
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "user_123",
      "businessName": "ABC Pharmacy",
      "email": "contact@abcpharmacy.com",
      "phone": "+1234567890",
      "mobile": "+1234567890",
      "address": {
        "street": "123 Main Street",
        "city": "Springfield",
        "state": "Illinois",
        "zipCode": "62701",
        "country": "United States"
      },
      "licenseImage": "https://example.com/license.jpg",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### 2. Update Profile
**PUT** `/profile/`

Updates user profile information with optional license image upload.

**Content-Type:** `multipart/form-data`

#### Request Body (Form Data)
```
businessName: "ABC Pharmacy Updated"       // Optional (2-100 characters)
email: "newemail@abcpharmacy.com"         // Optional (valid email)
phone: "+1234567890"                      // Optional (valid mobile phone)
mobile: "+1234567890"                     // Optional (valid mobile phone)
address[street]: "456 Oak Avenue"         // Optional (max 255 characters)
address[city]: "Springfield"              // Optional (max 100 characters)
address[state]: "Illinois"                // Optional (max 100 characters)
address[zipCode]: "62702"                 // Optional (valid postal code)
address[country]: "United States"         // Optional (max 100 characters)
licenseImage: [FILE]                      // Optional (image file)
```

#### Response
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "profile": {
      "id": "user_123",
      "businessName": "ABC Pharmacy Updated",
      "email": "newemail@abcpharmacy.com",
      "licenseImage": "https://example.com/new_license.jpg",
      "updatedAt": "2024-01-15T11:30:00.000Z"
    }
  }
}
```

---

### 3. Change Password
**POST** `/profile/change-password`

Changes user's password with current password verification.

#### Request Body
```json
{
  "currentPassword": "oldpassword123",      // Required (current password)
  "newPassword": "NewPassword123"           
}
```

#### Response
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## Validation Rules

### Update Profile
- `businessName`: Optional, 2-100 characters
- `email`: Optional, valid email format (normalized)
- `phone`: Optional, valid mobile phone number
- `mobile`: Optional, valid mobile phone number
- `address.street`: Optional, maximum 255 characters
- `address.city`: Optional, maximum 100 characters
- `address.state`: Optional, maximum 100 characters
- `address.zipCode`: Optional, valid postal code format
- `address.country`: Optional, maximum 100 characters
- `licenseImage`: Optional, image file upload

### Change Password
- `currentPassword`: Required, must match existing password
- `newPassword`: Required, minimum 6 characters
- `newPassword`: Must contain at least one lowercase letter, one uppercase letter, and one number

---

## Error Responses

### Authentication Error (401)
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "newPassword",
      "message": "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    }
  ]
}
```

### Wrong Current Password (400)
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

### File Upload Error (400)
```json
{
  "success": false,
  "message": "Invalid file format. Only images are allowed"
}
```

### Email Already Exists (409)
```json
{
  "success": false,
  "message": "Email is already registered to another account"
}
```

---

## File Upload Requirements

### License Image Upload
- **Accepted formats:** JPG, JPEG, PNG, GIF
- **Maximum file size:** 5MB
- **Field name:** `licenseImage`
- **Upload type:** Single file
- Files are validated for format and size before processing
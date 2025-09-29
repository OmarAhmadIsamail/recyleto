# Authentication API Documentation

## Overview
This API provides authentication services including user login, password recovery, and pharmacy registration functionality.

## Base URL
```
/auth
```

## Endpoints

### 1. User Login
**POST** `/auth/login`

Authenticates users using email/username and password.

#### Request Body
```json
{
  "email": "user@example.com",     // Optional (string, valid email)
  "username": "username",          // Optional (string)
  "password": "password123"        // Required (string, min 6 characters)
}
```

**Note:** Either `email` or `username` must be provided.

#### Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here",
    "user": {
      // user details
    }
  }
}
```

#### Validation Rules
- `email`: Must be a valid email format (if provided)
- `username`: Must be a string (if provided)
- `password`: Minimum 6 characters required
- At least one of `email` or `username` must be provided

---

### 2. Forgot Password
**POST** `/auth/forgot-password`

Initiates password recovery process by sending reset code to user's email.

#### Request Body
```json
{
  "email": "user@example.com"      // Required (string, valid email)
}
```

#### Response
```json
{
  "success": true,
  "message": "Password reset code sent to your email"
}
```

#### Validation Rules
- `email`: Must be a valid email format

---

### 3. Reset Password
**POST** `/auth/reset-password`

Resets user password using the code sent to their email.

#### Request Body
```json
{
  "email": "user@example.com",     // Required (string, valid email)
  "code": "123456",                // Required (string, reset code)
  "newPassword": "newpassword123"  // Required (string, min 6 characters)
}
```

#### Response
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

#### Validation Rules
- `email`: Must be a valid email format
- `code`: Required reset code received via email
- `newPassword`: Minimum 6 characters required

---

### 4. Register Pharmacy
**POST** `/auth/register-pharmacy`

Registers a new pharmacy with business details and license documentation.

**Content-Type:** `multipart/form-data`

#### Request Body (Form Data)
```
pharmacyName: "ABC Pharmacy"              // Required (string)
businessEmail: "contact@abcpharmacy.com"  // Required (valid email)
businessPhone: "+1234567890"              // Required (valid mobile number)
mobileNumber: "+1234567890"               // Required (valid mobile number)
password: "securepassword123"             // Required (string, min 6 characters)
confirmPassword: "securepassword123"      // Required (must match password)
businessAddress[street]: "123 Main St"    // Required (string)
businessAddress[city]: "Springfield"      // Required (string)
businessAddress[state]: "IL"              // Required (string)
businessAddress[zipCode]: "62701"         // Required (string)
licenseImage: [FILE]                      // Required (image file)
```

#### Response
```json
{
  "success": true,
  "message": "Pharmacy registration successful",
  "data": {
    "pharmacyId": "unique_pharmacy_id",
    "status": "pending_verification"
  }
}
```

#### Validation Rules
- `pharmacyName`: Required, non-empty string
- `businessEmail`: Must be a valid email format
- `businessPhone`: Must be a valid mobile phone number
- `mobileNumber`: Must be a valid mobile phone number
- `password`: Minimum 6 characters required
- `confirmPassword`: Must match the password field
- `businessAddress.street`: Required, non-empty string
- `businessAddress.city`: Required, non-empty string
- `businessAddress.state`: Required, non-empty string
- `businessAddress.zipCode`: Required, non-empty string
- `licenseImage`: Required image file upload

---

## Error Responses

### Validation Errors (400 Bad Request)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email"
    }
  ]
}
```

### File Upload Errors (400 Bad Request)
```json
{
  "success": false,
  "message": "File upload error message"
}
```

### General Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

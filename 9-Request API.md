# Request API Documentation

## Overview
Medicine request management API endpoints for users to request medicines and pharmacy staff to manage requests.

**Base URL:** `/requests`

**Authentication:** All endpoints require valid authentication token.

---

## User Request Endpoints

### 1. Create Medicine Request
**POST** `/requests/medicine`

Submits a new medicine request with optional image attachment.

**Content-Type:** `multipart/form-data`

#### Request Body (Form Data)
```
medicineName: "Paracetamol 500mg"         // Required (max 100 characters)
genericName: "Acetaminophen"              // Required (max 100 characters)
form: "Tablet"                            // Required: "Tablet" | "Syrup" | "Capsule" | "Injection" | "Ointment" | "Drops" | "Inhaler" | "Other"
packSize: "20 tablets"                    // Required (max 50 characters)
additionalNotes: "Urgent need for patient" // Optional (max 500 characters)
urgencyLevel: "high"                      // Required: "low" | "medium" | "high" | "urgent"
image: [FILE]                             // Optional (image file)
```

#### Response
```json
{
  "success": true,
  "message": "Medicine request submitted successfully",
  "data": {
    "requestId": "req_123456789",
    "status": "pending",
    "medicineName": "Paracetamol 500mg",
    "urgencyLevel": "high",
    "submittedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 2. Get User Medicine Requests
**GET** `/requests/medicine/user`

Retrieves all medicine requests submitted by the authenticated user.

#### Query Parameters
```
status: "pending"              // Optional: "pending" | "approved" | "rejected" | "fulfilled"
urgencyLevel: "high"           // Optional: "low" | "medium" | "high" | "urgent"
startDate: "2024-01-01T00:00:00.000Z"  // Optional (ISO8601 date)
endDate: "2024-12-31T23:59:59.000Z"    // Optional (ISO8601 date)
page: 1                        // Optional (integer, min 1)
limit: 20                      // Optional (integer, 1-100)
```

#### Response
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "requestId": "req_123456789",
        "medicineName": "Paracetamol 500mg",
        "genericName": "Acetaminophen",
        "form": "Tablet",
        "packSize": "20 tablets",
        "status": "pending",
        "urgencyLevel": "high",
        "submittedAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "pages": 1
    }
  }
}
```

---

### 3. Get Medicine Request Details
**GET** `/requests/medicine/:requestId`

Retrieves detailed information about a specific medicine request.

#### URL Parameters
- `requestId`: Medicine request identifier

#### Response
```json
{
  "success": true,
  "data": {
    "request": {
      "requestId": "req_123456789",
      "medicineName": "Paracetamol 500mg",
      "genericName": "Acetaminophen",
      "form": "Tablet",
      "packSize": "20 tablets",
      "additionalNotes": "Urgent need for patient",
      "urgencyLevel": "high",
      "status": "approved",
      "image": "https://example.com/request_image.jpg",
      "submittedAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-16T09:15:00.000Z",
      "approvedAt": "2024-01-16T09:15:00.000Z",
      "approvedBy": "pharmacist_user",
      "estimatedFulfillment": "2024-01-18T00:00:00.000Z",
      "pharmacyResponse": "Medicine available, will be ready for pickup tomorrow"
    }
  }
}
```

---

## Pharmacy Staff Endpoints

### 4. Get Pharmacy Medicine Requests
**GET** `/requests/medicine/pharmacy/all`

Retrieves all medicine requests for pharmacy staff to review and manage.

**Authorization:** Requires `pharmacist`, `admin`, or `assistant` role.

#### Query Parameters
```
status: "pending"              // Optional: "pending" | "approved" | "rejected" | "fulfilled"
urgencyLevel: "urgent"         // Optional: "low" | "medium" | "high" | "urgent"
startDate: "2024-01-01T00:00:00.000Z"  // Optional (ISO8601 date)
endDate: "2024-12-31T23:59:59.000Z"    // Optional (ISO8601 date)
page: 1                        // Optional (integer, min 1)
limit: 50                      // Optional (integer, 1-100)
```

#### Response
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "requestId": "req_123456789",
        "medicineName": "Paracetamol 500mg",
        "genericName": "Acetaminophen",
        "form": "Tablet",
        "packSize": "20 tablets",
        "status": "pending",
        "urgencyLevel": "high",
        "submittedBy": {
          "userId": "user_456",
          "name": "John Doe",
          "phone": "+1234567890"
        },
        "submittedAt": "2024-01-15T10:30:00.000Z",
        "image": "https://example.com/request_image.jpg"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "pages": 1
    },
    "summary": {
      "pending": 10,
      "approved": 8,
      "rejected": 2,
      "fulfilled": 5
    }
  }
}
```

---

## Validation Rules

### Create Medicine Request
- `medicineName`: Required, maximum 100 characters
- `genericName`: Required, maximum 100 characters
- `form`: Required, must be one of: "Tablet", "Syrup", "Capsule", "Injection", "Ointment", "Drops", "Inhaler", "Other"
- `packSize`: Required, maximum 50 characters
- `additionalNotes`: Optional, maximum 500 characters (trimmed)
- `urgencyLevel`: Required, must be one of: "low", "medium", "high", "urgent"
- `image`: Optional image file upload

### Query Parameters
- Date filters must be valid ISO8601 format
- Page must be positive integer
- Limit must be between 1 and 100
- Status and urgency level must match valid enum values

---

## Request Status Types
- **pending**: Request submitted, awaiting pharmacy review
- **approved**: Request approved by pharmacy staff
- **rejected**: Request denied by pharmacy staff
- **fulfilled**: Medicine provided to customer

## Urgency Levels
- **low**: Non-urgent, standard processing
- **medium**: Moderate priority
- **high**: High priority, expedited processing
- **urgent**: Emergency priority, immediate attention required

---

## Error Responses

### Authentication Error (401)
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### Authorization Error (403)
```json
{
  "success": false,
  "message": "Insufficient permissions. Pharmacy staff access required"
}
```

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "medicineName",
      "message": "Medicine name is required"
    }
  ]
}
```

### Request Not Found (404)
```json
{
  "success": false,
  "message": "Medicine request not found"
}
```

### File Upload Error (400)
```json
{
  "success": false,
  "message": "Invalid file format. Only images are allowed"
}
```

---

## File Upload Requirements

### Image Upload
- **Accepted formats:** JPG, JPEG, PNG, GIF
- **Maximum file size:** 5MB
- **Field name:** `image`
- **Upload type:** Single file
- Used for prescription images or medicine photos
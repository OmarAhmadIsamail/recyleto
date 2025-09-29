# Dashboard API Documentation

## Overview
Dashboard API endpoints for authenticated users to manage data, notifications, and requests.

**Base URL:** `/dashboard`

**Authentication:** All endpoints require valid authentication token.

---

## Endpoints

### 1. Get Dashboard Data
**GET** `/dashboard/`

Retrieves dashboard data with optional date filtering.

#### Query Parameters
```
startDate: "2024-01-01T00:00:00.000Z"  // Optional (ISO8601 date format)
endDate: "2024-12-31T23:59:59.000Z"    // Optional (ISO8601 date format)
```

#### Response
```json
{
  "success": true,
  "data": {
    // dashboard data
  }
}
```

---

### 2. Get Notifications
**GET** `/dashboard/notifications`

Retrieves user notifications.

#### Response
```json
{
  "success": true,
  "data": {
    "notifications": [
      // notification objects
    ]
  }
}
```

---

### 3. Create Request
**POST** `/dashboard/requests`

Creates a new request (stock, refund, support, etc.).

#### Request Body
```json
{
  "type": "stock_request",              // Required: "stock_request" | "refund" | "support" | "other"
  "title": "Request Title",             
  "description": "Request description", 
  "priority": "medium",                 // Optional: "low" | "medium" | "high" | "urgent"
  "dueDate": "2024-12-31T23:59:59.000Z" 
}
```

#### Response
```json
{
  "success": true,
  "message": "Request created successfully",
  "data": {
    "requestId": "unique_request_id"
  }
}
```

---

## Validation Rules

### Dashboard Filter
- `startDate`: Must be valid ISO8601 date format
- `endDate`: Must be valid ISO8601 date format

### Create Request
- `type`: Must be one of: "stock_request", "refund", "support", "other"
- `title`: Required, maximum 100 characters
- `description`: Optional, maximum 500 characters  
- `priority`: Optional, must be one of: "low", "medium", "high", "urgent"
- `dueDate`: Optional, must be valid ISO8601 date format

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
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```
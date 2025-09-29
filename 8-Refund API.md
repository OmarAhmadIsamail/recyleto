# Refund API Documentation

## Overview
Refund management API endpoints for processing transaction refunds and viewing refund history.

**Base URL:** `/refunds`

**Authentication:** All endpoints require valid authentication token.

---

## Endpoints

### 1. Get Eligible Transactions
**GET** `/refunds/eligible-transactions`

Retrieves transactions that are eligible for refund processing.

#### Response
```json
{
  "success": true,
  "data": {
    "eligibleTransactions": [
      {
        "transactionId": "txn_123456789",
        "transactionReference": "REF-2024-001",
        "date": "2024-01-15T10:30:00.000Z",
        "totalAmount": 75.50,
        "status": "completed",
        "items": [
          {
            "medicineId": "med_123",
            "medicineName": "Paracetamol 500mg",
            "quantity": 2,
            "price": 25.50
          }
        ],
        "customerInfo": {
          "name": "John Doe",
          "phone": "+1234567890"
        }
      }
    ],
    "count": 15
  }
}
```

---

### 2. Request Refund
**POST** `/refunds/request`

Submits a refund request for a specific transaction.

#### Request Body
```json
{
  "transactionReference": "REF-2024-001",  // Required (string)
  "reason": "Customer returned unused medication due to adverse reaction. Product is in original packaging and within return policy timeframe.",  // Required (10-500 characters)
  "items": [                               // Optional (array)
    {
      "medicineId": "507f1f77bcf86cd799439011",  // Optional (valid MongoDB ObjectId)
      "quantity": 1                        // Optional (integer, min 1)
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "message": "Refund request submitted successfully",
  "data": {
    "refundId": "refund_123456789",
    "status": "pending",
    "transactionReference": "REF-2024-001",
    "requestedAmount": 25.50,
    "submittedAt": "2024-01-15T14:30:00.000Z"
  }
}
```

---

### 3. Get Refund History
**GET** `/refunds/history`

Retrieves user's refund request history.

#### Query Parameters
```
status: "pending"              // Optional: "pending" | "approved" | "rejected" | "processed"
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
    "refunds": [
      {
        "refundId": "refund_123456789",
        "transactionReference": "REF-2024-001",
        "status": "approved",
        "reason": "Customer returned unused medication...",
        "requestedAmount": 25.50,
        "approvedAmount": 25.50,
        "items": [
          {
            "medicineId": "med_123",
            "medicineName": "Paracetamol 500mg",
            "quantity": 1,
            "refundAmount": 25.50
          }
        ],
        "submittedAt": "2024-01-15T14:30:00.000Z",
        "processedAt": "2024-01-16T09:15:00.000Z",
        "processedBy": "admin_user"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    },
    "summary": {
      "totalRefunds": 5,
      "totalAmount": 125.75,
      "pending": 1,
      "approved": 3,
      "rejected": 1
    }
  }
}
```

---

## Validation Rules

### Request Refund
- `transactionReference`: Required string
- `reason`: Required, 10-500 characters (trimmed)
- `items`: Optional array
- `items.*.medicineId`: Optional, valid MongoDB ObjectId format
- `items.*.quantity`: Optional integer, minimum 1

### Query Parameters
- Date filters must be valid ISO8601 format
- Page must be positive integer
- Limit must be between 1 and 100
- Status must be valid refund status

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
      "field": "reason",
      "message": "Reason must be between 10 and 500 characters"
    }
  ]
}
```

### Transaction Not Eligible (400)
```json
{
  "success": false,
  "message": "Transaction is not eligible for refund"
}
```

### Transaction Not Found (404)
```json
{
  "success": false,
  "message": "Transaction reference not found"
}
```

### Duplicate Refund Request (409)
```json
{
  "success": false,
  "message": "A refund request already exists for this transaction"
}
```

---

## Refund Status Types
- **pending**: Request submitted, awaiting review
- **approved**: Request approved, processing payment
- **rejected**: Request denied
- **processed**: Refund completed and payment issued

## Business Rules
- Only completed transactions are eligible for refunds
- Refund requests require detailed reason (10-500 characters)
- Partial refunds supported through item selection
- Transaction reference must be valid and belong to authenticated user
- One refund request per transaction allowed
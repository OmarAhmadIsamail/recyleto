# Analytics API Documentation

## Overview
This API provides comprehensive analytics for pharmacy operations including sales tracking, refund analysis, and performance metrics to help pharmacies understand their business performance.

## Base URL
```
/api/analytics
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Endpoints

### 1. Sales Analytics
**GET** `/api/analytics/sales`

Provides comprehensive sales data including revenue, top-selling medicines, and sales trends.

#### Query Parameters
```json
{
  "startDate": "2024-01-01",        // Optional (ISO date string)
  "endDate": "2024-12-31",          // Optional (ISO date string)
  "medicineId": "objectId",         // Optional (MongoDB ObjectId)
  "groupBy": "month",               // Optional (day|week|month|medicine)
  "page": 1,                        // Optional (integer, default: 1)
  "limit": 50                       // Optional (integer, max: 100, default: 50)
}
```

#### Example Request
```
GET /api/analytics/sales?startDate=2024-01-01&endDate=2024-12-31&groupBy=month&page=1&limit=10
```

#### Response
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTransactions": 150,
      "totalRevenue": 45000.50,
      "totalItemsSold": 500,
      "averageOrderValue": 300.00,
      "totalTax": 4500.05,
      "totalDiscount": 2250.00
    },
    "topMedicines": [
      {
        "_id": {
          "medicineId": "60f7b1b5e4b0c72f8c8b4567",
          "medicineName": "Paracetamol",
          "genericName": "Acetaminophen"
        },
        "totalQuantitySold": 100,
        "totalRevenue": 5000.00,
        "transactionCount": 25,
        "averagePrice": 50.00
      }
    ],
    "salesTrend": [
      {
        "_id": {
          "year": 2024,
          "month": 1
        },
        "totalSales": 15000.00,
        "totalTransactions": 50,
        "totalItemsSold": 150
      }
    ],
    "detailedSales": [
      {
        "transactionId": "TXN-20241201-1234ABC",
        "transactionNumber": "SAL-000001",
        "items": [...],
        "totalAmount": 300.00,
        "customerInfo": {
          "name": "John Doe",
          "phone": "+1234567890"
        },
        "transactionDate": "2024-12-01T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 150,
      "pages": 15
    }
  }
}
```

#### Validation Rules
- `startDate`: Must be valid ISO 8601 date format
- `endDate`: Must be valid ISO 8601 date format and after startDate
- `medicineId`: Must be valid MongoDB ObjectId
- `groupBy`: Must be one of: day, week, month, medicine
- `page`: Must be positive integer
- `limit`: Must be between 1 and 100

---

### 2. Refunds Analytics
**GET** `/api/analytics/refunds`

Provides detailed refund analysis including refund patterns, reasons, and affected medicines.

#### Query Parameters
```json
{
  "startDate": "2024-01-01",        // Optional (ISO date string)
  "endDate": "2024-12-31",          // Optional (ISO date string)
  "status": "completed",            // Optional (pending|approved|rejected|completed)
  "medicineId": "objectId",         // Optional (MongoDB ObjectId)
  "page": 1,                        // Optional (integer, default: 1)
  "limit": 50                       // Optional (integer, max: 100, default: 50)
}
```

#### Example Request
```
GET /api/analytics/refunds?status=completed&startDate=2024-01-01
```

#### Response
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRefunds": 15,
      "totalRefundAmount": 2500.00,
      "averageRefundAmount": 166.67,
      "pendingRefunds": 2,
      "approvedRefunds": 8,
      "rejectedRefunds": 3,
      "completedRefunds": 2
    },
    "refundReasons": [
      {
        "_id": "damaged_product",
        "count": 8,
        "totalAmount": 1200.00
      },
      {
        "_id": "wrong_medicine",
        "count": 4,
        "totalAmount": 800.00
      }
    ],
    "medicinesWithRefunds": [
      {
        "_id": {
          "medicineId": "60f7b1b5e4b0c72f8c8b4567",
          "medicineName": "Paracetamol",
          "genericName": "Acetaminophen"
        },
        "refundCount": 5,
        "totalRefundAmount": 500.00,
        "totalQuantityRefunded": 25
      }
    ],
    "refundsTrend": [
      {
        "_id": {
          "year": 2024,
          "month": 1
        },
        "totalRefunds": 5,
        "totalAmount": 750.00
      }
    ],
    "detailedRefunds": [
      {
        "refundId": "REF-20241201-5678DEF",
        "reason": "damaged_product",
        "refundAmount": 55.00,
        "status": "completed",
        "requestDate": "2024-12-01T15:30:00.000Z",
        "items": [...],
        "customerInfo": {
          "name": "John Doe",
          "phone": "+1234567890"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "pages": 2
    }
  }
}
```

#### Validation Rules
- `startDate`: Must be valid ISO 8601 date format
- `endDate`: Must be valid ISO 8601 date format and after startDate
- `status`: Must be one of: pending, approved, rejected, completed, cancelled
- `medicineId`: Must be valid MongoDB ObjectId
- `page`: Must be positive integer
- `limit`: Must be between 1 and 100

---

### 3. Pharmacy Performance Overview
**GET** `/api/analytics/performance`

Provides comprehensive pharmacy performance metrics including sales vs refunds comparison and operational insights.

#### Query Parameters
```json
{
  "startDate": "2024-01-01",        // Optional (ISO date string)
  "endDate": "2024-03-31",          // Optional (ISO date string)
  "compareWithPrevious": false      // Optional (boolean, default: false)
}
```

#### Example Request
```
GET /api/analytics/performance?startDate=2024-01-01&endDate=2024-03-31
```

#### Response
```json
{
  "success": true,
  "data": {
    "performance": {
      "totalSales": 50000.00,
      "totalRefunds": 2500.00,
      "netRevenue": 47500.00,
      "refundRate": 5.00,
      "totalTransactions": 200,
      "totalRefundCount": 15,
      "averageOrderValue": 250.00,
      "totalItemsSold": 800
    },
    "inventory": {
      "lowStockCount": 5,
      "lowStockMedicines": [
        {
          "_id": "60f7b1b5e4b0c72f8c8b4567",
          "name": "Aspirin",
          "genericName": "Acetylsalicylic Acid",
          "quantity": 2,
          "lowStockThreshold": 10
        }
      ]
    },
    "paymentMethods": [
      {
        "_id": "cash",
        "count": 120,
        "totalAmount": 30000.00
      },
      {
        "_id": "card",
        "count": 80,
        "totalAmount": 20000.00
      }
    ],
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-03-31"
    }
  }
}
```

#### Validation Rules
- `startDate`: Must be valid ISO 8601 date format
- `endDate`: Must be valid ISO 8601 date format and after startDate
- `compareWithPrevious`: Must be boolean value

---

### 4. Medicine-Specific Analytics
**GET** `/api/analytics/medicine/{medicineId}`

Provides detailed analytics for a specific medicine including sales history and refund patterns.

#### Path Parameters
- `medicineId`: MongoDB ObjectId of the medicine (required)

#### Query Parameters
```json
{
  "startDate": "2024-01-01",        // Optional (ISO date string)
  "endDate": "2024-12-31"           // Optional (ISO date string)
}
```

#### Example Request
```
GET /api/analytics/medicine/60f7b1b5e4b0c72f8c8b4567?startDate=2024-01-01&endDate=2024-12-31
```

#### Response
```json
{
  "success": true,
  "data": {
    "medicine": {
      "_id": "60f7b1b5e4b0c72f8c8b4567",
      "name": "Paracetamol",
      "genericName": "Acetaminophen",
      "manufacturer": "PharmaCorp",
      "price": 5.50,
      "quantity": 90,
      "lowStockThreshold": 10
    },
    "analytics": {
      "sales": {
        "totalQuantitySold": 100,
        "totalRevenue": 550.00,
        "transactionCount": 25,
        "averagePrice": 5.50,
        "minPrice": 5.00,
        "maxPrice": 6.00
      },
      "refunds": {
        "totalQuantityRefunded": 5,
        "totalRefundAmount": 27.50,
        "refundCount": 2
      },
      "netQuantitySold": 95,
      "netRevenue": 522.50,
      "refundRate": 5.00
    },
    "salesTrend": [
      {
        "_id": {
          "year": 2024,
          "month": 1
        },
        "quantitySold": 30,
        "revenue": 165.00
      }
    ]
  }
}
```

#### Validation Rules
- `medicineId`: Must be valid MongoDB ObjectId (path parameter)
- `startDate`: Must be valid ISO 8601 date format
- `endDate`: Must be valid ISO 8601 date format and after startDate

---

## MongoDB Collections Used

The analytics API reads data from existing collections:

### Transactions Collection
Stores completed sales with items, amounts, and customer information.

### Refunds Collection  
Stores refund requests and processed refunds with reasons and status.

### Medicines Collection
Stores medicine inventory with pricing and stock information.

---

## Error Responses

### Validation Errors (400 Bad Request)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "startDate",
      "message": "Start date must be a valid ISO 8601 date"
    }
  ]
}
```

### Not Found (404 Not Found)
```json
{
  "success": false,
  "message": "Medicine not found"
}
```

### Server Error (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Error fetching sales analytics"
}
```

## Usage Examples

### Track Best Selling Medicines
```bash
curl -X GET "http://localhost:5000/api/analytics/sales?groupBy=medicine&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Monthly Sales Report
```bash
curl -X GET "http://localhost:5000/api/analytics/sales?startDate=2024-01-01&endDate=2024-01-31&groupBy=day" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Refund Analysis
```bash
curl -X GET "http://localhost:5000/api/analytics/refunds?status=completed" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Overall Performance Dashboard
```bash
curl -X GET "http://localhost:5000/api/analytics/performance?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
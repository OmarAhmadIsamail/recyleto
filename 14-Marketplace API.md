# Marketplace API Testing Guide - Postman

This document provides comprehensive instructions for testing the Marketplace API endpoints using Postman.

## Base URL
```
http://localhost:5000/api/marketplace
```

## Authentication
All endpoints require authentication. Include the following header in all requests:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints Overview

### 1. Get Marketplace Medicines
**GET** `/medicines`

Browse available medicines from other pharmacies in the marketplace.

#### Query Parameters:
- `search` (string, optional): Search by medicine name, generic name, or manufacturer
- `category` (string, optional): Filter by medicine category
- `manufacturer` (string, optional): Filter by manufacturer name
- `minPrice` (number, optional): Minimum price filter
- `maxPrice` (number, optional): Maximum price filter
- `inStock` (boolean, optional, default: true): Show only medicines in stock
- `page` (number, optional, default: 1): Page number for pagination
- `limit` (number, optional, default: 20): Number of items per page

#### Example Request:
```
GET /api/marketplace/medicines?search=aspirin&category=Pain Relief&page=1&limit=10
```

#### Expected Response:
```json
{
  "success": true,
  "data": [
    {
      "_id": "medicine_id",
      "name": "Aspirin 500mg",
      "genericName": "Acetylsalicylic Acid",
      "form": "Tablet",
      "packSize": "30 tablets",
      "quantity": 100,
      "price": 5.99,
      "category": "Pain Relief",
      "manufacturer": "PharmaCorp",
      "expiryDate": "2025-12-31",
      "batchNumber": "ASP001",
      "pharmacyId": {
        "_id": "pharmacy_id",
        "pharmacyName": "Central Pharmacy",
        "contactInfo": {
          "phone": "+1234567890",
          "email": "central@pharmacy.com"
        }
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

### 2. Purchase Full Cart from Marketplace
**POST** `/purchase/full`

Complete purchase of all items in the cart from a specific seller.

#### Request Body:
```json
{
  "sellerId": "64a7b8c9d1e2f3a4b5c6d7e9",
  "description": "Bulk purchase from Central Pharmacy"
}
```

#### Expected Response:
```json
{
  "success": true,
  "message": "Marketplace purchase completed successfully",
  "data": {
    "_id": "transaction_id",
    "pharmacyId": "buyer_pharmacy_id",
    "transactionType": "purchase",
    "transactionNumber": "PUR-2024-001",
    "transactionRef": "MP-1642680000000-ABC123DEF",
    "description": "Bulk purchase from Central Pharmacy",
    "items": [
      {
        "medicineId": "64a7b8c9d1e2f3a4b5c6d7e8",
        "medicineName": "Aspirin 500mg",
        "genericName": "Acetylsalicylic Acid",
        "form": "Tablet",
        "packSize": "30 tablets",
        "quantity": 5,
        "unitPrice": 5.99,
        "totalPrice": 29.95,
        "expiryDate": "2025-12-31",
        "batchNumber": "ASP001",
        "manufacturer": "PharmaCorp"
      }
    ],
    "subtotal": 29.95,
    "totalAmount": 29.95,
    "paymentMethod": "bank_transfer",
    "status": "completed",
    "saleType": "full",
    "marketplace": {
      "isMarketplace": true,
      "sellerId": {
        "_id": "64a7b8c9d1e2f3a4b5c6d7e9",
        "pharmacyName": "Central Pharmacy",
        "contactInfo": {
          "phone": "+1234567890",
          "email": "central@pharmacy.com"
        }
      },
      "commission": 0
    },
    "transactionDate": "2024-01-20T14:30:00Z",
    "createdAt": "2024-01-20T14:30:00Z"
  }
}
```

---

### 3. Purchase Single Medicine from Marketplace
**POST** `/purchase/single`

Purchase a single medicine directly without using the cart.

#### Request Body:
```json
{
  "medicineId": "64a7b8c9d1e2f3a4b5c6d7e8",
  "quantity": 3,
  "sellerId": "64a7b8c9d1e2f3a4b5c6d7e9"
}
```

#### Expected Response:
```json
{
  "success": true,
  "message": "Single marketplace purchase completed successfully",
  "data": {
    "_id": "transaction_id",
    "pharmacyId": "buyer_pharmacy_id",
    "transactionType": "purchase",
    "transactionNumber": "PUR-2024-002",
    "transactionRef": "MP-SINGLE-1642680000000-XYZ789ABC",
    "description": "Single marketplace purchase: Aspirin 500mg",
    "items": [
      {
        "medicineId": "64a7b8c9d1e2f3a4b5c6d7e8",
        "medicineName": "Aspirin 500mg",
        "genericName": "Acetylsalicylic Acid",
        "form": "Tablet",
        "packSize": "30 tablets",
        "quantity": 3,
        "unitPrice": 5.99,
        "totalPrice": 17.97,
        "expiryDate": "2025-12-31",
        "batchNumber": "ASP001",
        "manufacturer": "PharmaCorp"
      }
    ],
    "subtotal": 17.97,
    "totalAmount": 17.97,
    "paymentMethod": "bank_transfer",
    "status": "completed",
    "saleType": "per_medicine",
    "marketplace": {
      "isMarketplace": true,
      "sellerId": {
        "_id": "64a7b8c9d1e2f3a4b5c6d7e9",
        "pharmacyName": "Central Pharmacy",
        "contactInfo": {
          "phone": "+1234567890",
          "email": "central@pharmacy.com"
        }
      },
      "commission": 0
    },
    "transactionDate": "2024-01-20T14:45:00Z"
  }
}
```

---

### 4. Get Marketplace Purchase History
**GET** `/purchases`

Retrieve your marketplace purchase history.

#### Query Parameters:
- `sellerId` (string, optional): Filter by seller ID
- `startDate` (string, optional): Start date filter (ISO format)
- `endDate` (string, optional): End date filter (ISO format)
- `page` (number, optional, default: 1): Page number
- `limit` (number, optional, default: 10): Items per page

#### Example Request:
```
GET /api/marketplace/purchases?sellerId=64a7b8c9d1e2f3a4b5c6d7e9&page=1&limit=5
```

#### Expected Response:
```json
{
  "success": true,
  "data": [
    {
      "_id": "transaction_id",
      "transactionNumber": "PUR-2024-001",
      "transactionRef": "MP-1642680000000-ABC123DEF",
      "description": "Bulk purchase from Central Pharmacy",
      "totalAmount": 29.95,
      "status": "completed",
      "saleType": "full",
      "marketplace": {
        "sellerId": {
          "pharmacyName": "Central Pharmacy",
          "contactInfo": {
            "phone": "+1234567890"
          }
        }
      },
      "transactionDate": "2024-01-20T14:30:00Z",
      "createdAt": "2024-01-20T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 12,
    "pages": 3
  }
}
```

---

## Postman Collection Setup

### 1. Create Environment Variables
Set up the following environment variables in Postman:
- `base_url`: `http://localhost:5000`
- `auth_token`: `your_jwt_token_here`

### 2. Headers Setup
For all requests, add these headers:
- `Content-Type`: `application/json`
- `Authorization`: `Bearer {{auth_token}}`

### 3. Test Scenarios

#### Scenario 1: Browse and Purchase Flow
1. **Browse Medicines**: GET `/medicines` with search parameters
2. **Complete Purchase**: POST `/purchase/full` to buy all cart items (requires existing cart)

#### Scenario 2: Quick Purchase Flow
1. **Browse Medicines**: GET `/medicines` to find desired item
2. **Direct Purchase**: POST `/purchase/single` to buy immediately

#### Scenario 3: Purchase History Review
1. **Get All Purchases**: GET `/purchases` without filters
2. **Filter by Seller**: GET `/purchases?sellerId=seller_id`
3. **Date Range Filter**: GET `/purchases?startDate=2024-01-01&endDate=2024-01-31`

---

## Error Responses

### Common Error Formats:

#### 400 - Bad Request
```json
{
  "success": false,
  "message": "Insufficient stock. Available: 5"
}
```

#### 404 - Not Found
```json
{
  "success": false,
  "message": "Medicine not found in marketplace"
}
```

#### 500 - Server Error
```json
{
  "success": false,
  "message": "Error fetching marketplace medicines"
}
```

---

## Testing Checklist

### Pre-requisites:
- [ ] Server is running on localhost:5000
- [ ] Database is connected and populated with test data
- [ ] Authentication token is valid and set in environment

### Test Cases:
- [ ] Browse medicines without filters
- [ ] Browse medicines with search filters
- [ ] Browse medicines with price range filters
- [ ] Complete full cart purchase
- [ ] Handle empty cart purchase attempt
- [ ] Purchase single medicine directly
- [ ] View purchase history
- [ ] Filter purchase history by date range
- [ ] Test authentication with invalid token
- [ ] Test with medicines from own pharmacy (should be excluded)

### Performance Tests:
- [ ] Test with large result sets (high limit values)
- [ ] Test pagination with various page sizes
- [ ] Test concurrent purchase operations

---

## Notes for Developers

1. **Stock Management**: The system automatically decreases seller stock and increases buyer inventory
2. **Price Markup**: New medicines in buyer inventory get a 20% markup for resale
3. **Transaction References**: Each transaction gets a unique reference number with marketplace prefix
4. **Cart Isolation**: Each seller has a separate cart to avoid mixing items from different pharmacies
5. **Payment Method**: Currently defaults to 'bank_transfer' for marketplace transactions

---

## Support

If you encounter any issues while testing:
1. Check server logs for detailed error messages
2. Verify all required fields are included in request bodies
3. Ensure MongoDB is running and accessible
4. Confirm authentication middleware is properly configured
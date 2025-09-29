# Sales API Testing Guide - Step by Step Postman

This guide provides detailed step-by-step instructions for testing the Sales API endpoints using Postman.

## Setup Instructions

### 1. Environment Setup
1. **Open Postman**
2. **Create New Environment** (gear icon → Add)
3. **Set Environment Variables:**
   - `base_url`: `http://localhost:5000`
   - `auth_token`: `your_jwt_token_here`
   - `pharmacy_id`: `your_pharmacy_id_here`

### 2. Collection Setup
1. **Create New Collection** → Name it "Sales API"
2. **Set Collection Authorization:**
   - Type: Bearer Token
   - Token: `{{auth_token}}`

---

## API Endpoints Testing

### Endpoint 1: Get Sales Transactions
**GET** `/api/sales/transactions`

#### Step 1: Create New Request
1. Click **"Add Request"** in Sales API collection
2. Name: `Get Sales Transactions`
3. Method: **GET**
4. URL: `{{base_url}}/api/sales/transactions`

#### Step 2: Configure Headers
```
Authorization: Bearer {{auth_token}}
Content-Type: application/json
```

#### Step 3: Add Query Parameters (Optional)
| Key | Value | Description |
|-----|--------|-------------|
| search | aspirin | Search by medicine/customer name |
| startDate | 2024-01-01 | Filter from date |
| endDate | 2024-12-31 | Filter to date |
| status | completed | Filter by status |
| saleType | full | Filter by sale type |
| paymentMethod | cash | Filter by payment method |
| page | 1 | Page number |
| limit | 10 | Items per page |

#### Step 4: Test the Request
1. Click **Send**
2. **Expected Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "transaction_id",
      "transactionNumber": "SALE-2024-001",
      "transactionRef": "TXN-1642680000000-ABC123DEF",
      "description": "Full sale transaction",
      "totalAmount": 25.50,
      "customerInfo": {
        "name": "John Doe",
        "phone": "+1234567890"
      },
      "paymentMethod": "cash",
      "status": "completed",
      "saleType": "full",
      "createdAt": "2024-01-20T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

---

### Endpoint 2: Process Full Sale
**POST** `/api/sales/full-sale`

#### Step 1: Create New Request
1. Add Request → Name: `Process Full Sale`
2. Method: **POST**
3. URL: `{{base_url}}/api/sales/full-sale`

#### Step 2: Configure Headers
```
Authorization: Bearer {{auth_token}}
Content-Type: application/json
```

#### Step 3: Request Body (JSON)
```json
{
  "customerName": "Jane Smith",
  "customerPhone": "+1987654321",
  "paymentMethod": "cash",
  "tax": 2.50,
  "discount": 1.00,
  "deliveryOption": "pickup",
  "description": "Full cart sale - morning shift"
}
```

#### Step 4: Test the Request
1. **Prerequisites:** Ensure you have an active cart with items
2. Click **Send**
3. **Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Full sale completed successfully",
  "data": {
    "_id": "transaction_id",
    "transactionNumber": "SALE-2024-002",
    "transactionRef": "TXN-1642680000000-XYZ789ABC",
    "description": "Full cart sale - morning shift",
    "items": [
      {
        "medicineId": "medicine_id",
        "medicineName": "Paracetamol 500mg",
        "quantity": 2,
        "unitPrice": 3.50,
        "totalPrice": 7.00
      }
    ],
    "subtotal": 7.00,
    "tax": 2.50,
    "discount": 1.00,
    "deliveryFee": 0,
    "totalAmount": 8.50,
    "customerInfo": {
      "name": "Jane Smith",
      "phone": "+1987654321"
    },
    "paymentMethod": "cash",
    "status": "completed",
    "saleType": "full",
    "transactionDate": "2024-01-20T14:45:00Z"
  }
}
```

---

### Endpoint 3: Process Per-Medicine Sale
**POST** `/api/sales/per-medicine-sale`

#### Step 1: Create New Request
1. Add Request → Name: `Process Per-Medicine Sale`
2. Method: **POST**
3. URL: `{{base_url}}/api/sales/per-medicine-sale`

#### Step 2: Configure Headers
```
Authorization: Bearer {{auth_token}}
Content-Type: application/json
```

#### Step 3: Request Body (JSON)
```json
{
  "items": [
    {
      "medicineId": "64a7b8c9d1e2f3a4b5c6d7e8",
      "quantity": 2,
      "unitPrice": 5.99
    },
    {
      "medicineId": "64a7b8c9d1e2f3a4b5c6d7e9",
      "quantity": 1
    }
  ],
  "customerName": "Robert Johnson",
  "customerPhone": "+1122334455",
  "paymentMethod": "card",
  "tax": 1.20,
  "discount": 0,
  "deliveryOption": "delivery",
  "deliveryAddressId": "64a7b8c9d1e2f3a4b5c6d7f0",
  "description": "Individual medicine sale"
}
```

#### Step 4: Test the Request
1. Click **Send**
2. **Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Per-medicine sale completed successfully",
  "data": {
    "_id": "transaction_id",
    "transactionNumber": "SALE-2024-003",
    "transactionRef": "TXN-1642680000000-DEF456GHI",
    "description": "Individual medicine sale",
    "items": [
      {
        "medicineId": "64a7b8c9d1e2f3a4b5c6d7e8",
        "medicineName": "Aspirin 325mg",
        "quantity": 2,
        "unitPrice": 5.99,
        "totalPrice": 11.98
      }
    ],
    "subtotal": 11.98,
    "tax": 1.20,
    "discount": 0,
    "deliveryFee": 5.00,
    "totalAmount": 18.18,
    "customerInfo": {
      "name": "Robert Johnson",
      "phone": "+1122334455"
    },
    "paymentMethod": "card",
    "deliveryOption": "delivery",
    "deliveryStatus": "pending",
    "status": "completed",
    "saleType": "per_medicine",
    "transactionDate": "2024-01-20T15:00:00Z"
  }
}
```

---

### Endpoint 4: Get Sale Statistics
**GET** `/api/sales/statistics`

#### Step 1: Create New Request
1. Add Request → Name: `Get Sale Statistics`
2. Method: **GET**
3. URL: `{{base_url}}/api/sales/statistics`

#### Step 2: Configure Headers
```
Authorization: Bearer {{auth_token}}
Content-Type: application/json
```

#### Step 3: Add Query Parameters (Optional)
| Key | Value | Description |
|-----|--------|-------------|
| period | month | Options: today, week, month, year |

#### Step 4: Test the Request
1. Click **Send**
2. **Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "salesTrend": [
      {
        "_id": "2024-01-20",
        "totalSales": 150.75,
        "transactionCount": 8
      },
      {
        "_id": "2024-01-21",
        "totalSales": 89.25,
        "transactionCount": 5
      }
    ],
    "paymentDistribution": [
      {
        "_id": "cash",
        "totalAmount": 120.50,
        "count": 6
      },
      {
        "_id": "card",
        "totalAmount": 119.50,
        "count": 7
      }
    ],
    "saleTypeDistribution": [
      {
        "_id": "full",
        "totalAmount": 180.25,
        "count": 8
      },
      {
        "_id": "per_medicine",
        "totalAmount": 59.75,
        "count": 5
      }
    ],
    "period": "month"
  }
}
```

---

## Complete Testing Workflow

### Test Scenario 1: Complete Sales Flow
1. **Prepare Cart** (if testing full sale)
   - Add medicines to cart using cart API
2. **Process Full Sale**
   - Use the full sale endpoint
   - Verify cart is cleared after sale
3. **View Transaction**
   - Use get transactions endpoint to verify sale

### Test Scenario 2: Individual Medicine Sales
1. **Get Medicine IDs**
   - Use medicine API to get valid medicine IDs
2. **Process Per-Medicine Sale**
   - Use individual medicine sale endpoint
3. **Verify Stock Update**
   - Check medicine inventory is reduced

### Test Scenario 3: Analytics and Reporting
1. **View Statistics**
   - Test different time periods
2. **Search Transactions**
   - Test various search parameters
3. **Filter by Payment Methods**
   - Test payment method filters

---

## Testing Checklist

### Pre-Test Setup
- [ ] Server running on port 5000
- [ ] Database connected and populated
- [ ] Valid JWT token obtained
- [ ] Postman environment configured

### Basic Functionality Tests
- [ ] **Get Sales Transactions** - No filters
- [ ] **Get Sales Transactions** - With search filter
- [ ] **Get Sales Transactions** - With date range
- [ ] **Get Sales Transactions** - With pagination
- [ ] **Process Full Sale** - With active cart
- [ ] **Process Per-Medicine Sale** - Single item
- [ ] **Process Per-Medicine Sale** - Multiple items
- [ ] **Get Sale Statistics** - Default period
- [ ] **Get Sale Statistics** - Different periods

### Error Handling Tests
- [ ] **Full Sale** - Empty cart error
- [ ] **Full Sale** - Insufficient stock error
- [ ] **Per-Medicine Sale** - Invalid medicine ID
- [ ] **Per-Medicine Sale** - Insufficient stock
- [ ] **Get Transactions** - Invalid date format
- [ ] **Authentication** - Invalid/missing token

### Edge Cases
- [ ] **Large Quantities** - Test with high quantity values
- [ ] **Zero Prices** - Test with discount greater than subtotal
- [ ] **Special Characters** - Test with special chars in customer info
- [ ] **Concurrent Sales** - Multiple simultaneous requests

---

## Common Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "message": "Cart is empty"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "message": "Medicine with ID 64a7b8c9d1e2f3a4b5c6d7e8 not found"
}
```

### 500 - Server Error
```json
{
  "success": false,
  "message": "Error processing full sale"
}
```

---

## Tips for Effective Testing

### 1. Data Preparation
- Create test medicines with sufficient stock
- Set up test customer data
- Prepare valid delivery addresses if testing delivery

### 2. Environment Variables
- Use variables for frequently changing values
- Store medicine IDs in environment for reuse
- Keep separate environments for different test scenarios

### 3. Test Data Management
- Use pre-request scripts to set up test data
- Clean up after tests to maintain consistent state
- Document expected vs actual results

### 4. Response Validation
- Check response status codes
- Validate response structure
- Verify calculated totals are correct
- Confirm stock updates in database

This comprehensive guide should help you thoroughly test all sales functionality in your pharmacy management system!
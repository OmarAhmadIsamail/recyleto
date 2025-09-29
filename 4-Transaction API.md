# Transaction API Testing Guide

This README provides comprehensive testing examples for all transaction API endpoints.

## Base URL
```
http://localhost:5000/api/transactions
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 1. Cart Management Endpoints

### 1.1 Add Medicine to Cart (Creates Pending Transaction)
**POST** `/item`

Creates a new pending transaction or adds to existing pending transaction.

```json
{
  "medicineId": "60d5f484f8d2b8001f8e4b8a",
  "quantity": 2,
  "transactionType": "sale"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Medicine added to cart",
  "data": {
    "_id": "675e123456789abc12345678",
    "pharmacyId": "68bec48ffb8310e37e14c4af",
    "transactionType": "sale",
    "transactionId": "TXN-20241215-1234ABC",
    "transactionNumber": "SAL-000001",
    "transactionRef": "REF-ABC123DE",
    "items": [
      {
        "medicineId": "60d5f484f8d2b8001f8e4b8a",
        "medicineName": "Paracetamol",
        "genericName": "Acetaminophen",
        "quantity": 2,
        "unitPrice": 10.50,
        "totalPrice": 21.00
      }
    ],
    "subtotal": 21.00,
    "totalAmount": 21.00,
    "status": "pending"
  }
}
```

**Test Cases:**
- Valid medicine ID with sufficient stock
- Invalid medicine ID
- Insufficient stock
- Adding same medicine twice (should update quantity)

---

### 1.2 Get Cart (Pending Transaction)
**GET** `/items?transactionType=sale`

Retrieves the current pending transaction (cart).

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "675e123456789abc12345678",
    "pharmacyId": "68bec48ffb8310e37e14c4af",
    "transactionType": "sale",
    "items": [
      {
        "medicineId": "60d5f484f8d2b8001f8e4b8a",
        "medicineName": "Paracetamol",
        "quantity": 2,
        "unitPrice": 10.50,
        "totalPrice": 21.00
      }
    ],
    "subtotal": 21.00,
    "totalAmount": 21.00,
    "status": "pending"
  }
}
```

**Test Cases:**
- Get cart when empty
- Get cart with items
- Different transaction types

---

### 1.3 Update Cart Item
**PUT** `/item/:itemId`

Updates quantity or price of a specific item in the cart.

```json
{
  "quantity": 3,
  "unitPrice": 12.00
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Cart item updated",
  "data": {
    "_id": "675e123456789abc12345678",
    "items": [
      {
        "_id": "675e123456789abc12345679",
        "quantity": 3,
        "unitPrice": 12.00,
        "totalPrice": 36.00
      }
    ],
    "subtotal": 36.00,
    "totalAmount": 36.00
  }
}
```

**Test Cases:**
- Update quantity only
- Update price only
- Update both quantity and price
- Invalid item ID
- Quantity exceeding stock

---

### 1.4 Remove Item from Cart
**DELETE** `/item/:itemId`

Removes a specific item from the cart.

**Expected Response:**
```json
{
  "success": true,
  "message": "Item removed from cart",
  "data": {
    "_id": "675e123456789abc12345678",
    "items": [],
    "subtotal": 0,
    "totalAmount": 0
  }
}
```

**Test Cases:**
- Remove existing item
- Remove non-existent item
- Remove last item (should delete transaction)

---

### 1.5 Clear Cart
**DELETE** `/items`

Clears all items from the cart (deletes pending transaction).

```json
{
  "transactionType": "sale"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Cart cleared successfully"
}
```

**Test Cases:**
- Clear cart with items
- Clear empty cart

---

## 2. Purchase Endpoints

### 2.1 Purchase Single Medicine
**POST** `/purchase/:itemId`

Purchases a single medicine from the cart, creating a completed transaction.

```json
{
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "paymentMethod": "cash"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Single medicine purchased successfully",
  "data": {
    "completedTransaction": {
      "_id": "675e123456789abc12345680",
      "transactionId": "TXN-20241215-5678DEF",
      "transactionNumber": "SAL-000002",
      "status": "completed",
      "totalAmount": 21.00
    },
    "remainingCart": {
      "_id": "675e123456789abc12345678",
      "items": [],
      "totalAmount": 0
    }
  }
}
```

**Test Cases:**
- Purchase single item from multi-item cart
- Purchase only item in cart
- Invalid item ID
- Item not in pending transaction

---

### 2.2 Checkout Complete Cart
**POST** `/checkout`

Completes the entire pending transaction.

```json
{
  "transactionType": "sale",
  "description": "Complete sale transaction",
  "customerName": "Jane Smith",
  "customerPhone": "+0987654321",
  "paymentMethod": "card",
  "tax": 2.10,
  "discount": 1.00
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Checkout successful",
  "data": {
    "_id": "675e123456789abc12345678",
    "transactionId": "TXN-20241215-1234ABC",
    "status": "completed",
    "totalAmount": 22.10,
    "customerInfo": {
      "name": "Jane Smith",
      "phone": "+0987654321"
    }
  }
}
```

**Test Cases:**
- Checkout with customer info
- Checkout without customer info
- Checkout with tax and discount
- Checkout empty cart
- Different payment methods

---

## 3. Transaction Management

### 3.1 Create Direct Transaction
**POST** `/`

Creates a transaction directly without using cart.

```json
{
  "transactionType": "sale",
  "description": "Direct sale",
  "items": [
    {
      "medicineId": "60d5f484f8d2b8001f8e4b8a",
      "quantity": 1,
      "unitPrice": 15.00
    }
  ],
  "customerName": "Alice Johnson",
  "customerPhone": "+1122334455",
  "paymentMethod": "mobile_money",
  "tax": 1.50,
  "discount": 0,
  "status": "completed"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "_id": "675e123456789abc12345681",
    "transactionId": "TXN-20241215-9012GHI",
    "transactionNumber": "SAL-000003",
    "status": "completed",
    "totalAmount": 16.50
  }
}
```

**Test Cases:**
- Sale transaction
- Purchase transaction
- Return transaction
- Adjustment transaction
- Transfer transaction

---

### 3.2 Get All Transactions
**GET** `/`

Retrieves transactions with filtering and pagination.

**Query Parameters:**
- `search` - Search term
- `startDate` - Start date (ISO format)
- `endDate` - End date (ISO format)
- `status` - Transaction status
- `transactionType` - Transaction type
- `medicineId` - Specific medicine
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Examples:**
```
GET /?search=paracetamol&status=completed&page=1&limit=5
GET /?startDate=2024-12-01&endDate=2024-12-31
GET /?transactionType=sale&status=pending
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "675e123456789abc12345678",
      "transactionId": "TXN-20241215-1234ABC",
      "transactionNumber": "SAL-000001",
      "transactionType": "sale",
      "status": "completed",
      "totalAmount": 22.10,
      "createdAt": "2024-12-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

**Test Cases:**
- No filters
- Search by medicine name
- Filter by date range
- Filter by status
- Filter by transaction type
- Pagination

---

### 3.3 Get Transaction by ID
**GET** `/:id`

Retrieves a specific transaction by MongoDB ObjectId.

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "675e123456789abc12345678",
    "transactionId": "TXN-20241215-1234ABC",
    "transactionNumber": "SAL-000001",
    "items": [
      {
        "medicineId": {
          "name": "Paracetamol",
          "genericName": "Acetaminophen"
        },
        "quantity": 2,
        "totalPrice": 21.00
      }
    ],
    "totalAmount": 22.10,
    "status": "completed"
  }
}
```

**Test Cases:**
- Valid transaction ID
- Invalid transaction ID
- Non-existent transaction ID
- Transaction from different pharmacy

---

### 3.4 Update Transaction
**PUT** `/:id`

Updates transaction details (limited updates for completed transactions).

```json
{
  "status": "cancelled",
  "description": "Updated description",
  "customerInfo": {
    "name": "Updated Name",
    "phone": "+9999999999"
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Transaction updated successfully",
  "data": {
    "_id": "675e123456789abc12345678",
    "status": "cancelled",
    "description": "Updated description"
  }
}
```

**Test Cases:**
- Update pending transaction
- Update completed transaction (limited fields)
- Invalid status values
- Update non-existent transaction

---

### 3.5 Delete Transaction
**DELETE** `/:id`

Deletes a transaction and restores stock if necessary.

**Expected Response:**
```json
{
  "success": true,
  "message": "Transaction deleted successfully"
}
```

**Test Cases:**
- Delete pending transaction
- Delete completed sale transaction (stock restoration)
- Delete completed purchase transaction
- Delete non-existent transaction

---

## 4. Error Testing

### Common Error Scenarios

#### 4.1 Validation Errors
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "quantity",
      "message": "Quantity must be at least 1"
    }
  ]
}
```

#### 4.2 Insufficient Stock
```json
{
  "success": false,
  "message": "Insufficient stock for Paracetamol. Available: 5"
}
```

#### 4.3 Not Found
```json
{
  "success": false,
  "message": "Transaction not found"
}
```

#### 4.4 Server Error
```json
{
  "success": false,
  "message": "Server error while fetching transactions"
}
```

---

## 5. Test Data Setup

### Sample Medicine Document
```json
{
  "_id": "60d5f484f8d2b8001f8e4b8a",
  "name": "Paracetamol",
  "genericName": "Acetaminophen",
  "form": "tablet",
  "packSize": "100 tablets",
  "price": 10.50,
  "quantity": 100,
  "expiryDate": "2025-12-31T00:00:00.000Z",
  "batchNumber": "BATCH001"
}
```

---

## 6. Testing Tools

### Using curl
```bash
# Add to cart
curl -X POST http://localhost:3000/api/transactions/item \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"medicineId": "60d5f484f8d2b8001f8e4b8a", "quantity": 2}'

# Get cart
curl -X GET http://localhost:3000/api/transactions/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Checkout
curl -X POST http://localhost:3000/api/transactions/checkout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod": "cash", "customerName": "John Doe"}'
```

### Using Postman
1. Create a new collection "Transaction API"
2. Set up environment variables for `BASE_URL` and `JWT_TOKEN`
3. Import the endpoints above
4. Set up tests for response validation

---

## 7. Test Sequence

### Complete Workflow Test
1. **Setup**: Create test medicine documents
2. **Add to Cart**: Add multiple medicines
3. **Update Cart**: Modify quantities and prices
4. **Purchase Single**: Buy one item from cart
5. **Add More**: Add more items to remaining cart
6. **Checkout**: Complete remaining transaction
7. **Query**: Search and filter transactions
8. **Update**: Modify transaction details
9. **Cleanup**: Delete test transactions

This sequence tests the complete transaction lifecycle and ensures all endpoints work together correctly.
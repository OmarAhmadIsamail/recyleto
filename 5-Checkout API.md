# Checkout API Documentation

## Overview
Checkout API endpoints for cart summary and payment processing.

**Base URL:** `/checkout`

**Authentication:** All endpoints require valid authentication token.

---

## Endpoints

### 1. Get Cart Summary
**GET** `/checkout/summary`

Retrieves cart summary with totals and item details before checkout.

#### Response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "medicineId": "med_123",
        "medicineName": "Paracetamol 500mg",
        "quantity": 2,
        "unitPrice": 15.50,
        "totalPrice": 31.00
      }
    ],
    "subtotal": 31.00,
    "tax": 2.48,
    "discount": 0.00,
    "totalAmount": 33.48,
    "itemCount": 2
  }
}
```

---

### 2. Process Checkout
**POST** `/checkout/process`

Processes the checkout with payment and customer information.

#### Request Body
```json
{
  "paymentMethod": "cash",                    // Required: "cash" | "card" | "bank_transfer" | "digital_wallet"
  "customerInfo": {                           
    "name": "John Doe",                       
    "phone": "+1234567890"                   
  },
  "receiptOptions": {                         
    "print": true,                            
    "email": false,                           
    "sms": false                             
  },
  "transactionNotes": "Customer paid cash"   
}
```

#### Response
```json
{
  "success": true,
  "message": "Checkout processed successfully",
  "data": {
    "transactionId": "txn_123456789",
    "status": "completed",
    "paymentMethod": "cash",
    "totalAmount": 33.48,
    "receiptGenerated": true,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Validation Rules

### Process Checkout
- `paymentMethod`: Required, must be one of: "cash", "card", "bank_transfer", "digital_wallet"
- `customerInfo.name`: Optional, 2-50 characters
- `customerInfo.phone`: Optional, valid mobile phone format
- `receiptOptions.print`: Optional boolean
- `receiptOptions.email`: Optional boolean
- `receiptOptions.sms`: Optional boolean
- `transactionNotes`: Optional, maximum 500 characters

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
      "field": "paymentMethod",
      "message": "Invalid payment method"
    }
  ]
}
```

### Empty Cart Error (400)
```json
{
  "success": false,
  "message": "Cart is empty"
}
```

### Processing Error (500)
```json
{
  "success": false,
  "message": "Checkout processing failed",
  "error": "Payment gateway error"
}
```
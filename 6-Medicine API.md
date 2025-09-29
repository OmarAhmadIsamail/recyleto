# Medicine & Market API Documentation

## Overview
API endpoints for medicine management and market search functionality.

**Authentication:** All endpoints require valid authentication token.

---

## Medicine Management Endpoints

**Base URL:** `/medicines`

### 1. Add Medicine
**POST** `/medicines/`

Adds a new medicine to the inventory.

#### Request Body
```json
{
  "name": "Paracetamol 500mg",              
  "genericName": "Acetaminophen",           
  "form": "Tablet",                         // Required: "Tablet" | "Capsule" | "Syrup" | "Injection" | "Ointment" | "Cream" | "Drops" | "Inhaler" | "Other"
  "packSize": "20 tablets",                 
  "quantity": 100,                          
  "price": 25.50,                         
  "expiryDate": "2025-12-31T23:59:59.000Z", 
  "manufacturer": "ABC Pharma",             
  "batchNumber": "BATCH123"                
}
```

#### Response
```json
{
  "success": true,
  "message": "Medicine added successfully",
  "data": {
    "medicineId": "med_123456789",
    "name": "Paracetamol 500mg",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 2. Search Medicines (Medicine Endpoint)
**GET** `/medicines/search`

Searches medicines in inventory.

#### Query Parameters
```
q: "paracetamol"          // Search query
form: "Tablet"            // Medicine form filter
manufacturer: "ABC Pharma" // Manufacturer filter
page: 1                   // Page number
limit: 20                 // Results per page
```

#### Response
```json
{
  "success": true,
  "data": {
    "medicines": [
      {
        "id": "med_123",
        "name": "Paracetamol 500mg",
        "form": "Tablet",
        "price": 25.50,
        "quantity": 100
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

---

### 3. Get Medicine by ID (Medicine Endpoint)
**GET** `/medicines/:id`

Retrieves detailed information about a specific medicine.

#### URL Parameters
- `id`: Medicine identifier

#### Response
```json
{
  "success": true,
  "data": {
    "medicine": {
      "id": "med_123",
      "name": "Paracetamol 500mg",
      "genericName": "Acetaminophen",
      "form": "Tablet",
      "packSize": "20 tablets",
      "quantity": 100,
      "price": 25.50,
      "expiryDate": "2025-12-31T23:59:59.000Z",
      "manufacturer": "ABC Pharma",
      "batchNumber": "BATCH123",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### 4. Update Medicine
**PUT** `/medicines/:id`

Updates an existing medicine.

#### URL Parameters
- `id`: Medicine identifier

#### Request Body
```json
{
  "name": "Paracetamol 500mg Updated",      
  "genericName": "Acetaminophen",           
  "form": "Tablet",                         // Required: "Tablet" | "Capsule" | "Syrup" | "Injection" | "Ointment" | "Cream" | "Drops" | "Inhaler" | "Other"
  "packSize": "30 tablets",                
  "quantity": 150,                          
  "price": 30.00,                           
  "expiryDate": "2025-12-31T23:59:59.000Z", 
  "manufacturer": "ABC Pharma",             
  "batchNumber": "BATCH456"                 
}
```

#### Response
```json
{
  "success": true,
  "message": "Medicine updated successfully",
  "data": {
    "medicine": {
      "id": "med_123",
      "name": "Paracetamol 500mg Updated",
      "updatedAt": "2024-01-15T11:30:00.000Z"
    }
  }
}
```

---

## Market Search Endpoints

**Base URL:** `/market`

### 5. Search Market Medicines
**GET** `/market/search`

Searches medicines in the market/catalog.

#### Query Parameters
```
q: "paracetamol"          // Search query
category: "pain-relief"   // Category filter
minPrice: 10.00           // Minimum price
maxPrice: 50.00           // Maximum price
inStock: true             // Stock availability
page: 1                   // Page number
limit: 20                 // Results per page
```

#### Response
```json
{
  "success": true,
  "data": {
    "medicines": [
      {
        "id": "med_456",
        "name": "Paracetamol 500mg",
        "form": "Tablet",
        "price": 25.50,
        "availability": "in_stock",
        "supplier": "XYZ Distributor"
      }
    ],
    "filters": {
      "categories": ["pain-relief", "antibiotics"],
      "priceRange": {
        "min": 5.00,
        "max": 200.00
      }
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 75,
      "pages": 4
    }
  }
}
```

---

### 6. Get Market Medicine by ID
**GET** `/market/:id`

Retrieves detailed information about a specific medicine from the market.

#### URL Parameters
- `id`: Medicine identifier

#### Response
```json
{
  "success": true,
  "data": {
    "medicine": {
      "id": "med_456",
      "name": "Paracetamol 500mg",
      "genericName": "Acetaminophen",
      "form": "Tablet",
      "description": "Pain relief medication",
      "price": 25.50,
      "availability": "in_stock",
      "supplier": {
        "name": "XYZ Distributor",
        "contact": "+1234567890"
      },
      "specifications": {
        "strength": "500mg",
        "packSize": "20 tablets"
      }
    }
  }
}
```

---

## Validation Rules

### Medicine Management
- `name`: 
- `genericName`: 
- `form`: 
- `packSize`: 
- `quantity`: 
- `price`: 
- `expiryDate`:
- `manufacturer`: 
- `batchNumber`: 

### Search Parameters
- Search queries are validated for length and format
- Pagination parameters must be positive integers
- Price ranges must be valid numbers

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
      "field": "expiryDate",
      "message": "Expiry date must be in the future"
    }
  ]
}
```

### Not Found Error (404)
```json
{
  "success": false,
  "message": "Medicine not found"
}
```

### Duplicate Error (409)
```json
{
  "success": false,
  "message": "Medicine with this name already exists"
}
```
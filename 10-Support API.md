# Support API Documentation

## Overview
Support ticket system API endpoints for users to create tickets, add messages, and for administrators to manage support operations.

**Base URL:** `/support`

**Authentication:** All endpoints require valid authentication token.

---

## User Support Endpoints

### 1. Create Support Ticket
**POST** `/support/tickets`

Creates a new support ticket with optional file attachments.

**Content-Type:** `multipart/form-data`

#### Request Body (Form Data)
```
subject: "Technical Issue"                // Required: "Technical Issue" | "Billing" | "Account" | "Feature Request" | "General Inquiry" | "Other"
priority: "Medium"                        // Optional: "Low" | "Medium" | "High" | "Urgent"
message: "Experiencing login issues when trying to access the dashboard"  // Required (min 10 characters)
appVersion: "1.2.3"                       // Optional (string)
deviceInfo: "Chrome 120, Windows 11"     // Optional (string)
attachments: [FILE1, FILE2]               // Optional (max 3 files)
```

#### Response
```json
{
  "success": true,
  "message": "Support ticket created successfully",
  "data": {
    "ticketId": "TKT-2024-001",
    "status": "Open",
    "subject": "Technical Issue",
    "priority": "Medium",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 2. Get User Tickets
**GET** `/support/tickets`

Retrieves all support tickets created by the authenticated user.

#### Query Parameters
```
status: "Open"                 // Optional: "Open" | "In Progress" | "Resolved" | "Closed"
subject: "Technical Issue"     // Optional: filter by subject type
priority: "High"               // Optional: "Low" | "Medium" | "High" | "Urgent"
page: 1                        // Optional (integer, min 1)
limit: 20                      // Optional (integer, 1-100)
```

#### Response
```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "ticketId": "TKT-2024-001",
        "subject": "Technical Issue",
        "status": "Open",
        "priority": "Medium",
        "lastActivity": "2024-01-15T10:30:00.000Z",
        "messageCount": 3,
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

---

### 3. Get Ticket Details
**GET** `/support/tickets/:ticketId`

Retrieves detailed information about a specific support ticket including all messages.

#### URL Parameters
- `ticketId`: Support ticket identifier

#### Response
```json
{
  "success": true,
  "data": {
    "ticket": {
      "ticketId": "TKT-2024-001",
      "subject": "Technical Issue",
      "status": "In Progress",
      "priority": "Medium",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-16T09:15:00.000Z",
      "appVersion": "1.2.3",
      "deviceInfo": "Chrome 120, Windows 11",
      "messages": [
        {
          "messageId": "msg_123",
          "content": "Experiencing login issues...",
          "sender": "user",
          "attachments": [
            {
              "filename": "screenshot.png",
              "url": "https://example.com/attachments/screenshot.png"
            }
          ],
          "timestamp": "2024-01-15T10:30:00.000Z"
        }
      ]
    }
  }
}
```

---

### 4. Add Message to Ticket
**POST** `/support/tickets/:ticketId/messages`

Adds a new message to an existing support ticket.

**Content-Type:** `multipart/form-data`

#### URL Parameters
- `ticketId`: Support ticket identifier

#### Request Body (Form Data)
```
content: "Here's additional information about the issue"  // Required (min 1 character)
attachments: [FILE1, FILE2]               // Optional (max 3 files)
```

#### Response
```json
{
  "success": true,
  "message": "Message added successfully",
  "data": {
    "messageId": "msg_456",
    "ticketId": "TKT-2024-001",
    "timestamp": "2024-01-16T14:30:00.000Z"
  }
}
```

---

## Admin Support Endpoints

### 5. Get All Tickets (Admin)
**GET** `/support/admin/tickets`

Retrieves all support tickets across all users for administrative management.

**Authorization:** Requires `admin` role.

#### Query Parameters
```
status: "Open"                 // Optional: "Open" | "In Progress" | "Resolved" | "Closed"
subject: "Technical Issue"     // Optional: filter by subject type
priority: "Urgent"             // Optional: "Low" | "Medium" | "High" | "Urgent"
assignedTo: "admin_user_123"   // Optional: filter by assigned admin
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
    "tickets": [
      {
        "ticketId": "TKT-2024-001",
        "subject": "Technical Issue",
        "status": "Open",
        "priority": "Medium",
        "user": {
          "userId": "user_123",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "assignedTo": "admin_user_456",
        "lastActivity": "2024-01-15T10:30:00.000Z",
        "messageCount": 3,
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 125,
      "pages": 3
    }
  }
}
```

---

### 6. Update Ticket Status (Admin)
**PATCH** `/support/admin/tickets/:ticketId/status`

Updates the status of a support ticket.

**Authorization:** Requires `admin` role.

#### URL Parameters
- `ticketId`: Support ticket identifier

#### Request Body
```json
{
  "status": "In Progress"      // Required: "Open" | "In Progress" | "Resolved" | "Closed"
}
```

#### Response
```json
{
  "success": true,
  "message": "Ticket status updated successfully",
  "data": {
    "ticketId": "TKT-2024-001",
    "status": "In Progress",
    "updatedAt": "2024-01-16T09:15:00.000Z"
  }
}
```

---

### 7. Add Admin Response
**POST** `/support/admin/tickets/:ticketId/messages`

Adds an administrative response to a support ticket.

**Authorization:** Requires `admin` role.

**Content-Type:** `multipart/form-data`

#### URL Parameters
- `ticketId`: Support ticket identifier

#### Request Body (Form Data)
```
content: "Thank you for contacting support. We're investigating this issue."  // Required (min 1 character)
attachments: [FILE1, FILE2]               // Optional (max 3 files)
```

#### Response
```json
{
  "success": true,
  "message": "Admin response added successfully",
  "data": {
    "messageId": "msg_789",
    "ticketId": "TKT-2024-001",
    "sender": "admin",
    "timestamp": "2024-01-16T15:45:00.000Z"
  }
}
```

---

### 8. Get Support Statistics (Admin)
**GET** `/support/admin/support-stats`

Retrieves support system statistics and metrics.

**Authorization:** Requires `admin` role.

#### Query Parameters
```
period: "week"                 // Optional: "day" | "week" | "month" | "year"
startDate: "2024-01-01T00:00:00.000Z"  // Optional (ISO8601 date)
endDate: "2024-12-31T23:59:59.000Z"    // Optional (ISO8601 date)
```

#### Response
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalTickets": 250,
      "openTickets": 45,
      "inProgressTickets": 32,
      "resolvedTickets": 150,
      "closedTickets": 23
    },
    "priorityBreakdown": {
      "Low": 50,
      "Medium": 120,
      "High": 65,
      "Urgent": 15
    },
    "subjectBreakdown": {
      "Technical Issue": 100,
      "Billing": 45,
      "Account": 35,
      "Feature Request": 40,
      "General Inquiry": 25,
      "Other": 5
    },
    "responseMetrics": {
      "averageResponseTime": "2.5 hours",
      "averageResolutionTime": "24 hours"
    },
    "trends": {
      "ticketsThisPeriod": 45,
      "ticketsLastPeriod": 38,
      "percentageChange": "+18.4%"
    }
  }
}
```

---

## Validation Rules

### Create Support Ticket
- `subject`: Required, must be one of: "Technical Issue", "Billing", "Account", "Feature Request", "General Inquiry", "Other"
- `priority`: Optional, must be one of: "Low", "Medium", "High", "Urgent"
- `message`: Required, minimum 10 characters
- `appVersion`: Optional string
- `deviceInfo`: Optional string
- `attachments`: Optional, maximum 3 files

### Add Message
- `content`: Required, minimum 1 character
- `attachments`: Optional, maximum 3 files

### Update Ticket Status
- `status`: Required, must be one of: "Open", "In Progress", "Resolved", "Closed"

---

## File Upload Requirements

### Attachment Upload
- **Maximum files:** 3 per message/ticket
- **Accepted formats:** Images (JPG, PNG, GIF), Documents (PDF, DOC, DOCX, TXT)
- **Maximum file size:** 10MB per file
- **Field name:** `attachments`
- **Upload type:** Array of files

---

## Ticket Status Lifecycle
1. **Open**: New ticket created, awaiting review
2. **In Progress**: Admin is actively working on the ticket
3. **Resolved**: Issue has been resolved, awaiting user confirmation
4. **Closed**: Ticket completed and closed

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
  "message": "Admin access required"
}
```

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "subject",
      "message": "Please select a valid subject"
    }
  ]
}
```

### Ticket Not Found (404)
```json
{
  "success": false,
  "message": "Support ticket not found"
}
```

### File Upload Error (400)
```json
{
  "success": false,
  "message": "Maximum 3 attachments allowed per message"
}
```
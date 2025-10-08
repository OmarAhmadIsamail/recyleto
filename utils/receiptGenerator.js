const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

/**
 * Generate receipt for transaction
 */
exports.generateReceipt = async (receiptData) => {
  try {
    const { transaction, cart, payment, delivery } = receiptData;
    
    // Prepare data for template
    const templateData = {
      pharmacy: transaction.pharmacyInfo || {
        businessName: 'Pharmacy',
        address: 'Not specified',
        phone: 'Not specified',
        email: 'Not specified',
        taxNumber: 'Not specified'
      },
      transaction: {
        number: transaction.transactionNumber,
        date: transaction.transactionDate || new Date(),
        type: transaction.transactionType,
        subtotal: transaction.subtotal || 0,
        tax: transaction.tax || 0,
        discount: transaction.discount || 0,
        total: transaction.totalAmount || 0
      },
      customer: transaction.customerInfo || {
        name: 'Customer',
        phone: 'Not specified',
        email: 'Not specified'
      },
      items: cart.items || [],
      payment: {
        method: payment.method,
        transactionId: payment.transactionId,
        details: payment.details
      },
      delivery: delivery || {
        option: 'pickup',
        fee: 0,
        estimatedDelivery: null
      },
      summary: {
        totalItems: cart.totalItems || 0,
        totalQuantity: cart.totalQuantity || 0
      }
    };

    // Generate receipt template
    const receiptTemplate = createReceiptTemplate();
    const html = ejs.render(receiptTemplate, templateData);
    
    // Generate text version
    const text = generateTextReceipt(templateData);

    return {
      html,
      text,
      transactionNumber: transaction.number
    };

  } catch (error) {
    console.error('Receipt generation error:', error);
    throw new Error('Failed to generate receipt');
  }
};

/**
 * Create receipt template
 */
function createReceiptTemplate() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - <%= transaction.number %></title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      margin: 0; 
      padding: 20px;
      background-color: #f5f5f5;
    }
    .receipt-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      border-radius: 8px;
    }
    .header { 
      text-align: center; 
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .pharmacy-name { 
      font-size: 28px; 
      font-weight: bold; 
      color: #2c5aa0;
      margin-bottom: 10px;
    }
    .receipt-info { 
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .section { 
      margin: 25px 0; 
    }
    .section-title { 
      font-weight: bold; 
      border-bottom: 1px solid #ddd; 
      padding-bottom: 8px;
      margin-bottom: 15px;
      font-size: 18px;
      color: #333;
    }
    .items-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 15px 0;
      font-size: 14px;
    }
    .items-table th, .items-table td { 
      border: 1px solid #ddd; 
      padding: 12px 8px; 
      text-align: left; 
    }
    .items-table th { 
      background-color: #2c5aa0; 
      color: white;
      font-weight: bold;
    }
    .items-table tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    .totals { 
      margin-top: 25px; 
      text-align: right;
      font-size: 16px;
    }
    .total-row { 
      margin: 8px 0; 
      padding: 5px 0;
    }
    .final-total { 
      font-size: 20px; 
      font-weight: bold; 
      border-top: 2px solid #333; 
      padding-top: 15px;
      color: #2c5aa0;
    }
    .footer { 
      margin-top: 40px; 
      text-align: center; 
      font-size: 14px; 
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 20px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .info-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #2c5aa0;
    }
    .barcode {
      text-align: center;
      margin: 20px 0;
      font-family: 'Barcode', monospace;
      font-size: 36px;
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="pharmacy-name"><%= pharmacy.businessName %></div>
      <div><%= pharmacy.address %></div>
      <div>Phone: <%= pharmacy.phone %> | Email: <%= pharmacy.email %></div>
      <div>Tax Number: <%= pharmacy.taxNumber %></div>
    </div>

    <div class="receipt-info">
      <div><strong>Receipt #:</strong> <%= transaction.number %></div>
      <div><strong>Date:</strong> <%= new Date(transaction.date).toLocaleString() %></div>
      <div><strong>Transaction Type:</strong> <%= transaction.type.toUpperCase() %></div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="section-title">Customer Information</div>
        <div><strong>Name:</strong> <%= customer.name %></div>
        <div><strong>Phone:</strong> <%= customer.phone %></div>
        <% if (customer.email) { %>
        <div><strong>Email:</strong> <%= customer.email %></div>
        <% } %>
      </div>

      <div class="info-card">
        <div class="section-title">Payment Information</div>
        <div><strong>Method:</strong> <%= payment.method.toUpperCase() %></div>
        <div><strong>Payment ID:</strong> <%= payment.transactionId %></div>
        <div><strong>Status:</strong> Completed</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Items Purchased (<%= items.length %> items)</div>
      <table class="items-table">
        <thead>
          <tr>
            <th>Medicine Name</th>
            <th>Generic Name</th>
            <th>Form</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <% items.forEach(item => { %>
          <tr>
            <td><%= item.medicineName %></td>
            <td><%= item.genericName %></td>
            <td><%= item.form %></td>
            <td><%= item.quantity %></td>
            <td>$<%= (item.unitPrice || 0).toFixed(2) %></td>
            <td>$<%= (item.totalPrice || 0).toFixed(2) %></td>
          </tr>
          <% }); %>
        </tbody>
      </table>
    </div>

    <div class="totals">
      <div class="total-row"><strong>Subtotal:</strong> $<%= (transaction.subtotal || 0).toFixed(2) %></div>
      <% if (transaction.tax > 0) { %>
      <div class="total-row"><strong>Tax:</strong> $<%= (transaction.tax || 0).toFixed(2) %></div>
      <% } %>
      <% if (transaction.discount > 0) { %>
      <div class="total-row"><strong>Discount:</strong> -$<%= (transaction.discount || 0).toFixed(2) %></div>
      <% } %>
      <% if (delivery.fee > 0) { %>
      <div class="total-row"><strong>Delivery Fee:</strong> $<%= (delivery.fee || 0).toFixed(2) %></div>
      <% } %>
      <div class="total-row final-total"><strong>Total Amount:</strong> $<%= (transaction.total || 0).toFixed(2) %></div>
    </div>

    <% if (delivery.option === 'delivery') { %>
    <div class="section">
      <div class="section-title">Delivery Information</div>
      <div><strong>Delivery Option:</strong> <%= delivery.option.toUpperCase() %></div>
      <div><strong>Delivery Fee:</strong> $<%= (delivery.fee || 0).toFixed(2) %></div>
      <% if (delivery.estimatedDelivery) { %>
      <div><strong>Estimated Delivery:</strong> <%= new Date(delivery.estimatedDelivery).toLocaleDateString() %></div>
      <% } %>
    </div>
    <% } else { %>
    <div class="section">
      <div class="section-title">Delivery Information</div>
      <div><strong>Delivery Option:</strong> PICKUP</div>
      <div>Please collect your order from the pharmacy</div>
    </div>
    <% } %>

    <div class="barcode">
      *<%= transaction.number %>*
    </div>

    <div class="footer">
      <div><strong>Thank you for your business!</strong></div>
      <div>For inquiries, please contact: <%= pharmacy.phone %></div>
      <div>Generated on: <%= new Date().toLocaleString() %></div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate text version of receipt
 */
function generateTextReceipt(data) {
  const { pharmacy, transaction, customer, items, payment, delivery } = data;
  
  let text = `
${pharmacy.businessName}
${pharmacy.address}
Phone: ${pharmacy.phone} | Email: ${pharmacy.email}
Tax Number: ${pharmacy.taxNumber}

${'='.repeat(50)}
RECEIPT #: ${transaction.number}
Date: ${new Date(transaction.date).toLocaleString()}
Transaction Type: ${transaction.type.toUpperCase()}

CUSTOMER INFORMATION:
Name: ${customer.name}
Phone: ${customer.phone}
${customer.email ? `Email: ${customer.email}` : ''}

PAYMENT INFORMATION:
Method: ${payment.method.toUpperCase()}
Payment ID: ${payment.transactionId}
Status: Completed

ITEMS PURCHASED:
${'='.repeat(50)}
`;

  items.forEach((item, index) => {
    text += `${index + 1}. ${item.medicineName} (${item.genericName})
   Form: ${item.form}
   Quantity: ${item.quantity} x $${(item.unitPrice || 0).toFixed(2)} = $${(item.totalPrice || 0).toFixed(2)}
\n`;
  });

  text += `
${'='.repeat(50)}
SUMMARY:
Subtotal: $${(transaction.subtotal || 0).toFixed(2)}
${transaction.tax > 0 ? `Tax: $${(transaction.tax || 0).toFixed(2)}\n` : ''}
${transaction.discount > 0 ? `Discount: -$${(transaction.discount || 0).toFixed(2)}\n` : ''}
${delivery.fee > 0 ? `Delivery Fee: $${(delivery.fee || 0).toFixed(2)}\n` : ''}
TOTAL: $${(transaction.total || 0).toFixed(2)}

DELIVERY INFORMATION:
Option: ${delivery.option.toUpperCase()}
${delivery.option === 'delivery' ? `Fee: $${(delivery.fee || 0).toFixed(2)}` : 'Pickup at pharmacy'}

Thank you for your business!
For inquiries, please contact: ${pharmacy.phone}
Generated on: ${new Date().toLocaleString()}
  `;

  return text;
}
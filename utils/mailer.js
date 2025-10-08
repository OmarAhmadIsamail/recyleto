const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Create transporter with reliable configuration
const createTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
    port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || process.env.SMTP_USER,
      pass: process.env.EMAIL_PASS || process.env.SMTP_PASS
    },
    // Connection pool settings
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    // Timeout settings
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  };

  return nodemailer.createTransport(config);
};

const transporter = createTransporter();

/**
 * Get from address with fallbacks
 */
const getFromAddress = () => {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || 
         `"${process.env.FROM_NAME || 'Recyleto'}" <${process.env.EMAIL_USER || 'noreply@recyleto.com'}>`;
};

/**
 * Render email template with robust fallback system
 */
async function renderTemplate(templateName, data) {
  const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.ejs`);
  
  try {
    // Check if template file exists
    if (fs.existsSync(templatePath)) {
      return await ejs.renderFile(templatePath, data);
    } else {
      console.log(`📧 Template ${templateName}.ejs not found, using fallback`);
      return createFallbackTemplate(data);
    }
  } catch (error) {
    console.error('❌ Error rendering email template:', error.message);
    return createFallbackTemplate(data);
  }
}

/**
 * Simple fallback template
 */
function createFallbackTemplate(data) {
  const {
    transactionNumber,
    totalAmount,
    customerName,
    items = [],
    message,
    subject
  } = data;

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${subject || 'Receipt'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 20px; }
        .info { margin: 15px 0; }
        .items { margin: 20px 0; }
        .total { font-size: 18px; font-weight: bold; margin: 20px 0; }
        .footer { margin-top: 30px; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Recyleto Pharmacy Receipt</h2>
    </div>
    
    <div class="info">
        <p><strong>Receipt #:</strong> ${transactionNumber || 'N/A'}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        ${customerName ? `<p><strong>Customer:</strong> ${customerName}</p>` : ''}
    </div>
    
    ${items.length > 0 ? `
    <div class="items">
        <h3>Items:</h3>
        <ul>
            ${items.map(item => `
                <li>${item.medicineName || 'Item'} - ${item.quantity} x $${(item.unitPrice || 0).toFixed(2)} = $${(item.totalPrice || 0).toFixed(2)}</li>
            `).join('')}
        </ul>
    </div>
    ` : ''}
    
    ${totalAmount ? `
    <div class="total">
        Total Amount: $${(totalAmount || 0).toFixed(2)}
    </div>
    ` : ''}
    
    ${message ? `<div class="message">${message}</div>` : ''}
    
    <div class="footer">
        <p>Thank you for your business!</p>
        <p>This is an automated receipt from Recyleto.</p>
    </div>
</body>
</html>
  `;
}

/**
 * Send email with comprehensive error handling
 */
async function sendEmail(emailOptions) {
  // If no email configuration, skip sending
  if (!isEmailConfigured()) {
    console.log('📧 Email not configured, skipping email send');
    return { 
      success: true, 
      message: 'Email not configured',
      skipped: true 
    };
  }

  try {
    // Render email template
    const html = await renderTemplate(emailOptions.template || 'receipt', emailOptions.data || {});

    const mailOptions = {
      from: getFromAddress(),
      to: emailOptions.to,
      subject: emailOptions.subject,
      html: html,
      text: emailOptions.text || 'Please view this email in an HTML-compatible email client.',
      attachments: emailOptions.attachments || []
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    
    return { 
      success: true, 
      messageId: result.messageId,
      response: result.response 
    };
    
  } catch (error) {
    console.error('❌ Email sending error:', error.message);
    return { 
      success: false, 
      message: 'Failed to send email',
      error: error.message 
    };
  }
}

/**
 * Check if email is configured
 */
function isEmailConfigured() {
  return !!(process.env.EMAIL_USER || process.env.SMTP_USER) && 
         !!(process.env.EMAIL_PASS || process.env.SMTP_PASS);
}

/**
 * Verify transporter connection
 */
async function verifyTransporter() {
  try {
    await transporter.verify();
    console.log('✅ Email transporter is ready');
    return { 
      success: true, 
      message: 'Email transporter is ready' 
    };
  } catch (error) {
    console.error('❌ Email transporter verification failed:', error);
    return { 
      success: false, 
      message: 'Email transporter verification failed',
      error: error.message 
    };
  }
}

/**
 * Get service status
 */
function getServiceStatus() {
  return {
    email: {
      configured: isEmailConfigured(),
      service: process.env.EMAIL_HOST || 'Unknown'
    }
  };
}

module.exports = {
  transporter,
  sendEmail,
  verifyTransporter,
  isEmailConfigured,
  getServiceStatus
};
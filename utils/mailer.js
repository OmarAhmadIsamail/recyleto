const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const twilio = require('twilio');
require('dotenv').config();

// Create transporter with comprehensive configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
  port: process.env.EMAIL_PORT || process.env.SMTP_PORT,
  secure: process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || process.env.SMTP_USER,
    pass: process.env.EMAIL_PASS || process.env.SMTP_PASS
  },
  // Additional options for better reliability
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5
});

// Initialize Twilio if credentials exist
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Get from address with fallback
const getFromAddress = () => {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || 
         `"${process.env.FROM_NAME || 'Recyleto'}" <noreply@recyleto.com>`;
};

// Function to render email template
const renderTemplate = async (templateName, data) => {
  try {
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.ejs`);
    const html = await ejs.renderFile(templatePath, data);
    return html;
  } catch (error) {
    console.error('Error rendering email template:', error);
    return null;
  }
};

// Generic email sending method with EJS templates
const sendEmail = async (to, subject, template, data, attachments = []) => {
  try {
    let html = '';
    
    // Use EJS template if provided
    if (template) {
      html = await renderTemplate(template, data);
      if (!html) {
        throw new Error('Failed to render email template');
      }
    } else {
      // Fallback to simple HTML if no template
      html = `<p>${data.message || data.text || ''}</p>`;
    }

    const mailOptions = {
      from: getFromAddress(),
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      attachments
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw new Error('Failed to send email');
  }
};

// SMS sending function
const sendSMS = async (to, message) => {
  if (!twilioClient) {
    console.warn('Twilio not configured, SMS not sent');
    return false;
  }
  
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    console.log('✅ SMS sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    return false;
  }
};

// Unified notification function that respects user preferences
const sendNotification = async (user, subject, message) => {
  try {
    // Send email notification if enabled
    if (user.notificationPreferences?.email) {
      await sendEmail(
        user.email,
        subject,
        null,
        { message }
      );
    }
    
    // Send SMS notification if enabled and user has mobile number
    if (user.notificationPreferences?.sms && user.mobileNumber) {
      await sendSMS(user.mobileNumber, `${subject}: ${message}`);
    }
    
    // Push notifications would require additional setup
    if (user.notificationPreferences?.push) {
      // Implement push notification logic here
      console.log('📱 Push notification would be sent:', subject, message);
    }
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
};

// Support email templates
const sendSupportTicketConfirmation = async (user, ticket) => {
  const data = {
    name: user.name,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    message: ticket.messages[0]?.content || '',
    priority: ticket.priority
  };
  
  return sendEmail(
    user.email,
    `Support Ticket Created: ${ticket.ticketNumber}`,
    'supportTicketConfirmation',
    data
  );
};

const sendSupportStatusUpdate = async (user, ticket) => {
  const data = {
    name: user.name,
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    subject: ticket.subject
  };
  
  return sendEmail(
    user.email,
    `Support Ticket Update: ${ticket.ticketNumber}`,
    'supportStatusUpdate',
    data
  );
};

const sendSupportResponse = async (user, ticket, message) => {
  const data = {
    name: user.name,
    ticketNumber: ticket.ticketNumber,
    message: message,
    subject: ticket.subject
  };
  
  return sendEmail(
    user.email,
    `New Response on Support Ticket: ${ticket.ticketNumber}`,
    'supportResponse',
    data
  );
};

// Send reset code
const sendResetCode = async (email, code) => {
  try {
    return await sendEmail(
      email,
      "Password Reset Code",
      "reset-code",
      { code }
    );
  } catch (error) {
    console.error("❌ Failed to send reset code email:", error);
    throw new Error("Failed to send reset email");
  }
};
// Send welcome email for pharmacy registration
const sendWelcomeEmail = async (email, pharmacyName, address = null, logoFilename = null, latitude = null, longitude = null) => {
  try {
      let logoUrl = null;
      if (logoFilename) {
          // Generate URL for the logo
          logoUrl = `${process.env.BACKEND_URL}/uploads/logos/${logoFilename}`;
      }

      // Prepare the data object with the exact variables the template expects
      const templateData = {
          email: email, // Passed directly to template
          pharmacyName: pharmacyName, // Passed directly to template
          businessAddress: address, // Changed from address to businessAddress to match template
          logoUrl: logoUrl,
          latitude: latitude,
          longitude: longitude,
          currentDate: new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
          }),
          process: { env: process.env } // Make process.env available in template
      };

      console.log('Sending welcome email with data:', {
          email: email,
          pharmacyName: pharmacyName,
          hasAddress: !!address,
          hasLogo: !!logoUrl
      });

      return await sendEmail(
          email,
          `Welcome to Recyleto, ${pharmacyName}!`,
          'welcome', // Template name
          templateData // Pass the complete data object
      );
  } catch (error) {
      console.error("❌ Failed to send welcome email:", error);
      throw new Error("Failed to send welcome email");
  }
};
// Send receipt email with PDF attachment
const sendReceiptEmail = async (email, receiptData) => {
  try {
    // Generate PDF attachment (assuming generateReceiptPDF function exists)
    const pdfBuffer = await generateReceiptPDF(receiptData);

    return await sendEmail(
      email,
      `Your Recyleto Receipt - ${receiptData.receipt.receiptNumber}`,
      'receipt',
      { receipt: receiptData },
      [
        {
          filename: `receipt-${receiptData.receipt.receiptNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    );
  } catch (error) {
    console.error("❌ Failed to send receipt email:", error);
    throw new Error("Failed to send receipt email");
  }
};

// Registration confirmation
const sendRegistrationEmail = async (userEmail, pharmacyName) => {
  return sendEmail(
    userEmail,
    'Welcome to Recyleto - Pharmacy Registration Successful',
    'registration',
    { pharmacyName }
  );
};

// Password reset with link
const sendPasswordResetEmail = async (userEmail, resetToken) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  return sendEmail(
    userEmail,
    'Recyleto - Password Reset Request',
    'password-reset',
    { resetLink }
  );
};

// Order confirmation
const sendOrderConfirmation = async (userEmail, orderData) => {
  return sendEmail(
    userEmail,
    `Recyleto - Order Confirmation #${orderData.reference}`,
    'order-confirmation',
    { order: orderData }
  );
};

// Refund confirmation email
const sendRefundConfirmation = async (userEmail, refundData) => {
  return sendEmail(
    userEmail,
    `Recyleto - Refund Request Received #${refundData.reference}`,
    'refund-confirmation',
    { refund: refundData }
  );
};

// Refund status update
const sendRefundStatusUpdate = async (userEmail, refundData) => {
  return sendEmail(
    userEmail,
    `Recyleto - Refund Status Update #${refundData.reference}`,
    'refund-status',
    { refund: refundData }
  );
};

// Refund approved notification
const sendRefundApproved = async (userEmail, refundData) => {
  return sendEmail(
    userEmail,
    `Recyleto - Refund Approved #${refundData.reference}`,
    'refund-approved',
    { refund: refundData }
  );
};

// Refund rejected notification
const sendRefundRejected = async (userEmail, refundData) => {
  return sendEmail(
    userEmail,
    `Recyleto - Refund Request Rejected #${refundData.reference}`,
    'refund-rejected',
    { refund: refundData }
  );
};

// Low stock alert
const sendLowStockAlert = async (userEmail, medicineData) => {
  return sendEmail(
    userEmail,
    'Recyleto - Low Stock Alert',
    'low-stock',
    { medicine: medicineData }
  );
};

// Expiry alert
const sendExpiryAlert = async (userEmail, medicines) => {
  return sendEmail(
    userEmail,
    'Recyleto - Medicine Expiry Alert',
    'expiry-alert',
    { medicines }
  );
};

// Test email
const sendTestEmail = async (userEmail) => {
  return sendEmail(
    userEmail,
    'Recyleto - Test Email',
    'test',
    { message: 'This is a test email from Recyleto' }
  );
};

// Verify transporter connection
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email transporter is ready');
    return true;
  } catch (error) {
    console.error('❌ Email transporter verification failed:', error);
    return false;
  }
};

module.exports = {
  transporter,
  sendEmail,
  sendSMS,
  sendNotification,
  sendSupportTicketConfirmation,
  sendSupportStatusUpdate,
  sendSupportResponse,
  sendResetCode,
  sendWelcomeEmail,
  sendReceiptEmail,
  sendRegistrationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmation,
  sendRefundConfirmation,
  sendRefundStatusUpdate,
  sendRefundApproved,
  sendRefundRejected,
  sendLowStockAlert,
  sendExpiryAlert,
  sendTestEmail,
  verifyTransporter
};
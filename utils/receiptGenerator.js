const pdf = require('html-pdf');
const ejs = require('ejs');
const path = require('path');
const QRCode = require('qrcode');

const generateReceiptPDF = async (receiptData) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Generate QR code
      const qrCodeData = JSON.stringify({
        transactionId: receiptData.transaction._id.toString(),
        receiptNumber: receiptData.receipt.receiptNumber,
        total: receiptData.transaction.total,
        date: receiptData.transaction.createdAt
      });
      
      const qrCodeImage = await QRCode.toDataURL(qrCodeData);

      // Render EJS template
      const templatePath = path.join(__dirname, '../templates/receipt.ejs');
      const html = await ejs.renderFile(templatePath, {
        ...receiptData,
        qrCodeImage,
        formatDate: (date) => new Date(date).toLocaleDateString(),
        formatCurrency: (amount) => amount.toFixed(2)
      });

      // Generate PDF
      const options = {
        format: 'A5',
        border: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      };

      pdf.create(html, options).toBuffer((err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateReceiptPDF };
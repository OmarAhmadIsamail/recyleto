// utils/encryption.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class EncryptionService {
  constructor() {
    // Use environment variables for encryption keys
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateKey();
    this.algorithm = 'aes-256-gcm';
  }

  generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, Buffer.from(this.encryptionKey, 'hex'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        iv: iv.toString('hex'),
        data: encrypted,
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  decrypt(encryptedData) {
    try {
      const decipher = crypto.createDecipher(
        this.algorithm, 
        Buffer.from(this.encryptionKey, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  // Hash sensitive data that doesn't need to be retrieved (like CVV)
  async hashData(data) {
    const saltRounds = 12;
    return await bcrypt.hash(data, saltRounds);
  }

  // Verify hashed data
  async verifyHash(data, hash) {
    return await bcrypt.compare(data, hash);
  }

  // Mask card number for display
  maskCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 4) return '****';
    return '****' + cardNumber.slice(-4);
  }

  // Validate card number using Luhn algorithm
  validateCardNumber(cardNumber) {
    const cleaned = cardNumber.replace(/\D/g, '');
    
    if (cleaned.length < 13 || cleaned.length > 19) {
      return false;
    }

    // Luhn algorithm validation
    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i), 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return (sum % 10) === 0;
  }
}

module.exports = new EncryptionService();
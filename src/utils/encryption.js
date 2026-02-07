/**
 * Encryption Utilities
 * Handles encryption and decryption of sensitive data fields
 */

const crypto = require('crypto');

class EncryptionManager {
  /**
   * Initialize encryption with master key from environment
   */
  static initialize() {
    this.masterKey = process.env.ENCRYPTION_MASTER_KEY || 'default-dev-key-do-not-use-in-production';
    this.algorithm = 'aes-256-gcm';
    this.ivLength = 12; // 12 bytes for GCM
    this.tagLength = 16; // 16 bytes for GCM
  }

  /**
   * Encrypt a string value
   * Returns: encryptedData:iv:authTag (base64 encoded)
   */
  static encrypt(plaintext) {
    if (!plaintext) return null;

    const iv = crypto.randomBytes(this.ivLength);
    const keyHash = crypto.createHash('sha256').update(this.masterKey).digest();

    const cipher = crypto.createCipheriv(this.algorithm, keyHash, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return as: encryptedData:iv:authTag (all base64 encoded)
    const encryptedData = Buffer.from(encrypted, 'hex').toString('base64');
    const ivBase64 = iv.toString('base64');
    const tagBase64 = authTag.toString('base64');

    return `${encryptedData}:${ivBase64}:${tagBase64}`;
  }

  /**
   * Decrypt an encrypted value
   */
  static decrypt(encryptedValue) {
    if (!encryptedValue) return null;

    try {
      const [encryptedData, ivBase64, tagBase64] = encryptedValue.split(':');
      
      if (!encryptedData || !ivBase64 || !tagBase64) {
        throw new Error('Invalid encrypted data format');
      }

      const encrypted = Buffer.from(encryptedData, 'base64').toString('hex');
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(tagBase64, 'base64');

      const keyHash = crypto.createHash('sha256').update(this.masterKey).digest();

      const decipher = crypto.createDecipheriv(this.algorithm, keyHash, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  /**
   * Hash a value (one-way, for comparison)
   */
  static hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Encrypt sensitive patient fields
   */
  static encryptPatientData(patient) {
    if (!patient) return null;

    const encrypted = { ...patient };

    // Fields to encrypt
    const sensitiveFields = ['ssn', 'address', 'phone', 'emergency_contact_phone'];

    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt sensitive patient fields
   */
  static decryptPatientData(encryptedPatient) {
    if (!encryptedPatient) return null;

    const decrypted = { ...encryptedPatient };

    const sensitiveFields = ['ssn', 'address', 'phone', 'emergency_contact_phone'];

    for (const field of sensitiveFields) {
      if (decrypted[field]) {
        decrypted[field] = this.decrypt(decrypted[field]);
      }
    }

    return decrypted;
  }

  /**
   * Hash password (using bcrypt is better, but this can be used for verification)
   */
  static hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify hashed password
   */
  static verifyPassword(password, hashedPassword) {
    const [salt, hash] = hashedPassword.split(':');
    const newHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === newHash;
  }

  /**
   * Generate random token
   */
  static generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Create hash for token storage
   */
  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

// Initialize on module load
EncryptionManager.initialize();

module.exports = EncryptionManager;

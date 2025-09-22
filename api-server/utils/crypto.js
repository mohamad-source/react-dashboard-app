const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Generate encryption key from environment variable or create fallback
 */
const getEncryptionKey = () => {
  const envKey = process.env.ENCRYPTION_KEY;

  if (envKey && envKey.length >= 64) {
    // Convert hex string to buffer
    return Buffer.from(envKey, 'hex');
  }

  // Fallback - derive key from JWT_SECRET (not ideal but better than nothing)
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
  return crypto.scryptSync(jwtSecret, 'encryption-salt', KEY_LENGTH);
};

/**
 * Encrypt sensitive data
 */
const encrypt = (text) => {
  if (!text || typeof text !== 'string') {
    return text; // Return as-is if not a string
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipherGCM(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine iv, tag, and encrypted data
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.warn('Encryption failed, storing as plaintext:', error.message);
    return text; // Return plaintext if encryption fails
  }
};

/**
 * Decrypt sensitive data
 */
const decrypt = (encryptedData) => {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return encryptedData; // Return as-is if not a string
  }

  // Check if data is encrypted (contains colons)
  if (!encryptedData.includes(':')) {
    return encryptedData; // Return as-is if not encrypted
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipherGCM(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.warn('Decryption failed, returning as-is:', error.message);
    return encryptedData; // Return as-is if decryption fails
  }
};

/**
 * Hash sensitive data (one-way, for search/indexing)
 */
const hash = (text) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  try {
    return crypto.createHash('sha256').update(text).digest('hex');
  } catch (error) {
    console.warn('Hashing failed:', error.message);
    return text;
  }
};

/**
 * Generate secure random string
 */
const generateSecureRandom = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Encrypt object fields selectively
 */
const encryptObject = (obj, fieldsToEncrypt = []) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const encrypted = { ...obj };

  fieldsToEncrypt.forEach(field => {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  });

  return encrypted;
};

/**
 * Decrypt object fields selectively
 */
const decryptObject = (obj, fieldsToDecrypt = []) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const decrypted = { ...obj };

  fieldsToDecrypt.forEach(field => {
    if (decrypted[field]) {
      decrypted[field] = decrypt(decrypted[field]);
    }
  });

  return decrypted;
};

/**
 * Check if encryption is properly configured
 */
const isEncryptionConfigured = () => {
  return !!(process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 64);
};

/**
 * Generate new encryption key (for setup)
 */
const generateEncryptionKey = () => {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateSecureRandom,
  encryptObject,
  decryptObject,
  isEncryptionConfigured,
  generateEncryptionKey
};
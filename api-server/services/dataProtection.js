const { encryptObject, decryptObject, isEncryptionConfigured } = require('../utils/crypto');
const logger = require('../utils/logger');

/**
 * Fields that should be encrypted in the database
 */
const SENSITIVE_FIELDS = {
  akten: [
    'kunde',           // Customer name
    'telefon',         // Phone number
    'email',           // Email address
    'kennzeichen',     // License plate
    'vin',             // Vehicle identification number
    'fahrzeughalter',  // Vehicle owner
    'anschrift'        // Address
  ],
  signatures: [
    'signature_data'   // Base64 signature data
  ],
  abtretungen: [
    'data'            // PDF data
  ]
};

/**
 * Encrypt sensitive fields before database storage
 */
const encryptForStorage = (tableName, data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const fieldsToEncrypt = SENSITIVE_FIELDS[tableName] || [];

  if (fieldsToEncrypt.length === 0) {
    return data; // No encryption needed for this table
  }

  if (!isEncryptionConfigured()) {
    logger.warn('Encryption not properly configured, storing data as plaintext', {
      table: tableName,
      encryptionConfigured: false
    });
    return data;
  }

  try {
    const encrypted = encryptObject(data, fieldsToEncrypt);

    logger.debug('Data encrypted for storage', {
      table: tableName,
      fieldsEncrypted: fieldsToEncrypt.filter(field => data[field])
    });

    return encrypted;
  } catch (error) {
    logger.error('Encryption failed for storage', {
      table: tableName,
      error: error.message
    });
    return data; // Return original data if encryption fails
  }
};

/**
 * Decrypt sensitive fields after database retrieval
 */
const decryptFromStorage = (tableName, data) => {
  if (!data) {
    return data;
  }

  // Handle arrays of data
  if (Array.isArray(data)) {
    return data.map(item => decryptFromStorage(tableName, item));
  }

  if (typeof data !== 'object') {
    return data;
  }

  const fieldsToDecrypt = SENSITIVE_FIELDS[tableName] || [];

  if (fieldsToDecrypt.length === 0) {
    return data; // No decryption needed for this table
  }

  try {
    const decrypted = decryptObject(data, fieldsToDecrypt);

    logger.debug('Data decrypted from storage', {
      table: tableName,
      recordId: data.id || 'unknown'
    });

    return decrypted;
  } catch (error) {
    logger.error('Decryption failed for retrieval', {
      table: tableName,
      recordId: data.id || 'unknown',
      error: error.message
    });
    return data; // Return original data if decryption fails
  }
};

/**
 * Middleware for automatic encryption before database operations
 */
const encryptionMiddleware = {
  /**
   * Encrypt data before INSERT operations
   */
  beforeInsert: (tableName) => {
    return (data) => {
      return encryptForStorage(tableName, data);
    };
  },

  /**
   * Encrypt data before UPDATE operations
   */
  beforeUpdate: (tableName) => {
    return (data) => {
      return encryptForStorage(tableName, data);
    };
  },

  /**
   * Decrypt data after SELECT operations
   */
  afterSelect: (tableName) => {
    return (data) => {
      return decryptFromStorage(tableName, data);
    };
  }
};

/**
 * Check if field encryption is working properly
 */
const testEncryption = () => {
  try {
    const testData = {
      kunde: 'Test Customer',
      email: 'test@example.com',
      kennzeichen: 'AB-CD-123'
    };

    const encrypted = encryptForStorage('akten', testData);
    const decrypted = decryptFromStorage('akten', encrypted);

    const encryptionWorking =
      encrypted.kunde !== testData.kunde &&  // Data should be encrypted
      decrypted.kunde === testData.kunde;    // Should decrypt back to original

    logger.info('Encryption test completed', {
      encryptionConfigured: isEncryptionConfigured(),
      encryptionWorking,
      testPassed: encryptionWorking
    });

    return encryptionWorking;
  } catch (error) {
    logger.error('Encryption test failed', { error: error.message });
    return false;
  }
};

/**
 * Get encryption status for monitoring
 */
const getEncryptionStatus = () => {
  return {
    configured: isEncryptionConfigured(),
    working: testEncryption(),
    protectedTables: Object.keys(SENSITIVE_FIELDS),
    protectedFields: SENSITIVE_FIELDS
  };
};

module.exports = {
  encryptForStorage,
  decryptFromStorage,
  encryptionMiddleware,
  testEncryption,
  getEncryptionStatus,
  SENSITIVE_FIELDS
};
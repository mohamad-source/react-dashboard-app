const { body, param, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
};

/**
 * Validate ID parameter
 */
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
  handleValidationErrors
];

/**
 * Validate Akte creation data
 */
const validateAkteCreate = [
  body('kunde')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Kunde must be between 2 and 100 characters'),
  body('kennzeichen')
    .trim()
    .isLength({ min: 2, max: 15 })
    .withMessage('Kennzeichen must be between 2 and 15 characters'),
  body('fahrzeugtyp')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Fahrzeugtyp is required (max 50 characters)'),
  body('schadenort')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Schadenort must be between 2 and 200 characters'),
  body('versicherungsnummer')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Versicherungsnummer max 50 characters'),
  body('vin')
    .optional()
    .trim()
    .isLength({ min: 17, max: 17 })
    .matches(/^[A-HJ-NPR-Z0-9]{17}$/)
    .withMessage('VIN must be exactly 17 characters (no I, O, Q)'),
  body('schadentag')
    .optional()
    .isISO8601()
    .withMessage('Schadentag must be a valid date'),
  handleValidationErrors
];

/**
 * Validate Akte update data
 */
const validateAkteUpdate = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
  ...validateAkteCreate
];

/**
 * Validate signature data
 */
const validateSignature = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
  body('signature')
    .matches(/^data:image\/png;base64,/)
    .withMessage('Signature must be a valid PNG base64 data URL'),
  body('formData')
    .isObject()
    .withMessage('Form data must be an object'),
  handleValidationErrors
];

/**
 * Validate file uploads
 */
const validateFileUpload = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      error: 'No files uploaded',
      code: 'NO_FILES'
    });
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  for (const file of req.files) {
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`,
        code: 'INVALID_FILE_TYPE'
      });
    }

    if (file.size > maxSize) {
      return res.status(400).json({
        error: `File too large: ${file.originalname}. Max size: 10MB`,
        code: 'FILE_TOO_LARGE'
      });
    }
  }

  next();
};

/**
 * Validate status update
 */
const validateStatusUpdate = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
  body('status')
    .isIn(['Entwurf', 'In Bearbeitung', 'Abgeschlossen', 'Abgebrochen'])
    .withMessage('Invalid status value'),
  handleValidationErrors
];

/**
 * Validate Kalkulation request
 */
const validateKalkulation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
  body('action')
    .isIn(['start', 'calculate'])
    .withMessage('Action must be start or calculate'),
  body('az')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('AZ number must be between 1 and 50 characters'),
  handleValidationErrors
];

/**
 * Sanitize string input
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

/**
 * Sanitize request body
 */
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  next();
};

module.exports = {
  handleValidationErrors,
  validateId,
  validateAkteCreate,
  validateAkteUpdate,
  validateSignature,
  validateFileUpload,
  validateStatusUpdate,
  validateKalkulation,
  sanitizeBody
};
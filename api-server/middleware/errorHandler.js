/**
 * Secure Error Handler Middleware
 * Prevents information disclosure in production
 */

/**
 * Global error handler
 */
const errorHandler = (error, req, res, next) => {
  // Log full error details for debugging (server-side only)
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Determine if we're in production
  const isProduction = process.env.NODE_ENV === 'production';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: isProduction ? undefined : error.message
    });
  }

  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: 'Duplicate entry',
      code: 'DUPLICATE_ENTRY'
    });
  }

  if (error.code && error.code.startsWith('ER_')) {
    // MySQL errors
    return res.status(500).json({
      error: isProduction ? 'Database error' : `Database error: ${error.message}`,
      code: 'DATABASE_ERROR'
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Default error response
  if (isProduction) {
    // Production: Don't leak sensitive information
    res.status(error.status || 500).json({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  } else {
    // Development: Show detailed error information
    res.status(error.status || 500).json({
      error: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_ERROR',
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Database error handler
 */
const handleDatabaseError = (error) => {
  console.error('Database error:', error);

  if (error.code === 'ECONNREFUSED') {
    return {
      status: 503,
      message: 'Database connection failed',
      code: 'DB_CONNECTION_FAILED'
    };
  }

  if (error.code === 'ER_NO_SUCH_TABLE') {
    return {
      status: 500,
      message: 'Required table does not exist',
      code: 'DB_TABLE_MISSING'
    };
  }

  return {
    status: 500,
    message: process.env.NODE_ENV === 'production'
      ? 'Database error'
      : error.message,
    code: 'DATABASE_ERROR'
  };
};

/**
 * Validation error formatter
 */
const formatValidationError = (errors) => {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }))
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleDatabaseError,
  formatValidationError
};
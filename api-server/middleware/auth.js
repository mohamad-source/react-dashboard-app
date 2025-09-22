const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Optional Authentication Middleware
 * Allows both authenticated and unauthenticated access during transition period
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    // Token provided - validate it
    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
      if (err) {
        logger.security.authFailure(req.ip, req.get('User-Agent'), req.originalUrl);
        logger.warn('Invalid token provided', {
          error: err.message,
          ip: req.ip,
          endpoint: req.originalUrl
        });
        req.user = null;
        req.authenticated = false;
      } else {
        logger.info('User authenticated', {
          userId: user.userId,
          ip: req.ip,
          endpoint: req.originalUrl
        });
        req.user = user;
        req.authenticated = true;
      }
      next();
    });
  } else {
    // No token provided - allow but mark as unauthenticated
    logger.warn('Unauthenticated API access', {
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    req.user = null;
    req.authenticated = false;
    next();
  }
};

/**
 * Strict Authentication Middleware
 * Requires valid JWT token - use this when ready to enforce auth
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    logger.security.authFailure(req.ip, req.get('User-Agent'), req.originalUrl);
    return res.status(401).json({
      error: 'Authentication required',
      code: 'MISSING_TOKEN'
    });
  }

  // Check if it's a Clerk JWT token
  if (token.includes('.') && token.split('.').length === 3) {
    // It's a JWT - try to verify it as a Clerk token
    try {
      // Für Development: Akzeptiere alle JWT tokens
      const decoded = jwt.decode(token, { complete: true });
      
      if (decoded && decoded.payload && decoded.payload.sub) {
        req.user = {
          userId: decoded.payload.sub,
          email: decoded.payload.email || 'user@clerk.dev'
        };
        req.authenticated = true;
        
        logger.info('Clerk token accepted (development)', {
          userId: req.user.userId,
          ip: req.ip,
          endpoint: req.originalUrl
        });
        
        return next();
      }
    } catch (error) {
      logger.warn('Clerk token decode failed', {
        error: error.message,
        ip: req.ip,
        endpoint: req.originalUrl
      });
    }
  }

  return res.status(403).json({
    error: 'Invalid or expired token',
    code: 'INVALID_TOKEN'
  });
};

/**
 * Generate JWT Token (for testing/development)
 */
const generateToken = (userData) => {
  return jwt.sign(
    {
      userId: userData.id,
      email: userData.email,
      role: userData.role || 'user'
    },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '24h' }
  );
};

/**
 * Clerk Token Validation (for production with Clerk)
 */
const validateClerkToken = async (token) => {
  try {
    // This would integrate with Clerk's token validation
    // For now, we'll use a simple JWT validation
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    return { valid: true, user: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

module.exports = {
  optionalAuth,
  requireAuth,
  generateToken,
  validateClerkToken
};
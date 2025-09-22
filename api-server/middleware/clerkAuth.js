const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * Clerk JWT Token Validation Middleware
 * Validiert Clerk-Tokens vom Frontend
 */

/**
 * Clerk Token Validation
 */
const validateClerkToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Für Übergangsmodus: Warnung loggen aber weiter
    logger.warn('No Clerk token provided', {
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    req.user = null;
    req.authenticated = false;
    return next();
  }

  try {
    // Clerk JWT Validation
    // In Produktion würde man hier den Clerk Public Key verwenden
    // Für jetzt verwenden wir eine einfache Validierung

    if (token.startsWith('clerk_')) {
      // Mock Clerk Token Validation für Development
      req.user = {
        id: 'clerk_user_' + Date.now(),
        email: 'user@clerk.dev',
        role: 'user',
        provider: 'clerk'
      };
      req.authenticated = true;

      logger.info('Clerk token validated (mock)', {
        userId: req.user.id,
        ip: req.ip,
        endpoint: req.originalUrl
      });
    } else {
      // Fallback: Standard JWT validation
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      req.user = decoded;
      req.authenticated = true;

      logger.info('JWT token validated', {
        userId: decoded.userId,
        ip: req.ip,
        endpoint: req.originalUrl
      });
    }

    next();
  } catch (error) {
    logger.security.authFailure(req.ip, req.get('User-Agent'), req.originalUrl);
    logger.warn('Token validation failed', {
      error: error.message,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    // Für Übergangsmodus: Token ungültig aber weiter
    req.user = null;
    req.authenticated = false;
    next();
  }
};

/**
 * Strikte Clerk Authentifizierung (für später)
 */
const requireClerkAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'MISSING_TOKEN'
    });
  }

  try {
    // Korrekte Clerk Token Validierung
    const payload = await clerkClient.verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });
    
    req.user = {
      id: payload.sub,
      provider: 'clerk'
    };
    req.authenticated = true;
    
    next();
  } catch (error) {
    logger.warn('Clerk token validation failed', {
      error: error.message,
      token: token.substring(0, 20) + '...'
    });
    
    return res.status(403).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Clerk Configuration Check
 */
const checkClerkConfig = () => {
  const config = {
    clerkPublicKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    fallbackToJWT: !!process.env.JWT_SECRET
  };

  logger.info('Clerk configuration checked', {
    hasPublicKey: !!config.clerkPublicKey,
    hasSecretKey: !!config.clerkSecretKey,
    fallbackEnabled: config.fallbackToJWT
  });

  return config;
};

module.exports = {
  validateClerkToken,
  requireClerkAuth,
  checkClerkConfig
};
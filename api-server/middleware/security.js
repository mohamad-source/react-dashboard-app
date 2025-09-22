const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * CORS Configuration
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://91.98.83.251'
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.security.suspiciousActivity(null, 'CORS_VIOLATION', { origin, blockedOrigin: origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control'
  ],
  optionsSuccessStatus: 200
};

/**
 * Rate Limiting Configuration
 */

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Max 100 requests per window per IP
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/';
  },
  handler: (req, res) => {
    logger.security.rateLimitExceeded(req.ip, req.originalUrl);
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 15 * 60
    });
  }
});

// Strict rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 attempts per window
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security.rateLimitExceeded(req.ip, req.originalUrl);
    logger.security.suspiciousActivity(req.ip, 'AUTH_BRUTE_FORCE', { endpoint: req.originalUrl });
    res.status(429).json({
      error: 'Too many authentication attempts',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: 15 * 60
    });
  }
});

// File upload rate limit
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: {
    error: 'Too many file uploads',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  },
  handler: (req, res) => {
    logger.security.rateLimitExceeded(req.ip, req.originalUrl);
    
    // CORS-Header bei Rate Limit
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED', 
      retryAfter: 60
    });
  }
});

/**
 * Security Headers Configuration
 */
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://www.dat.de', 'https://api.fahrzeugschein-scanner.de'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
};

/**
 * Request size limits
 */
const requestLimits = {
  json: { limit: '10mb' }, // For base64 images
  urlencoded: { limit: '10mb', extended: true },
  raw: { limit: '10mb' }
};

/**
 * Security middleware setup
 */
const setupSecurity = (app) => {
  // Security headers
  app.use(helmet(helmetConfig));

  // Request size limits
  app.use('/api/akten/:id/bilder', uploadLimiter);
  app.use('/api/akten/:id/abtretung', uploadLimiter);

  // Trust proxy (important for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);

  // Disable unnecessary headers
  app.disable('x-powered-by');
};

/**
 * IP Whitelist (optional - for admin endpoints)
 */
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
      next();
    } else {
      logger.security.suspiciousActivity(clientIP, 'IP_BLOCKED', { path: req.path, method: req.method });
      res.status(403).json({
        error: 'Access denied',
        code: 'IP_BLOCKED'
      });
    }
  };
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'unauthenticated',
      authenticated: req.authenticated || false
    };

    // Log based on status and performance
    if (res.statusCode >= 500) {
      logger.error('Server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Client error', logData);

      // Log potential security issues
      if (res.statusCode === 401) {
        logger.security.authFailure(req.ip, req.get('User-Agent'), req.originalUrl);
      } else if (res.statusCode === 403) {
        logger.security.suspiciousActivity(req.ip, 'ACCESS_DENIED', { endpoint: req.originalUrl });
      }
    } else if (duration > 2000) {
      logger.warn('Slow request', logData);
    } else {
      logger.info('Request completed', logData);
    }

    // Log data access for sensitive endpoints
    if (req.originalUrl.includes('/api/akten') && res.statusCode < 400) {
      logger.security.dataAccess(
        req.user?.id || 'anonymous',
        req.method,
        req.originalUrl,
        req.ip
      );
    }
  });

  next();
};

module.exports = {
  corsOptions,
  apiLimiter,
  authLimiter,
  uploadLimiter,
  helmetConfig,
  requestLimits,
  setupSecurity,
  ipWhitelist,
  requestLogger
};
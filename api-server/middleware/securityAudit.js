const logger = require('../utils/logger');

/**
 * Security audit middleware for monitoring and alerting
 */

// Track failed authentication attempts per IP
const authFailureTracker = new Map();
const AUTH_FAILURE_THRESHOLD = 10; // Max failed attempts before alert
const AUTH_FAILURE_WINDOW = 15 * 60 * 1000; // 15 minutes

// Track suspicious patterns
const suspiciousPatterns = [
  /\.\.\//g,           // Directory traversal
  /<script/i,          // XSS attempts
  /union.*select/i,    // SQL injection
  /drop\s+table/i,     // SQL injection
  /exec\s*\(/i,        // Command injection
  /eval\s*\(/i,        // Code injection
  /javascript:/i,      // Javascript protocol
  /vbscript:/i,        // VBScript protocol
  /onload\s*=/i,       // Event handler injection
  /onerror\s*=/i,      // Event handler injection
];

// File upload patterns to watch
const suspiciousFilePatterns = [
  /\.php$/i,
  /\.jsp$/i,
  /\.asp$/i,
  /\.exe$/i,
  /\.sh$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.scr$/i
];

/**
 * Check for suspicious request patterns
 */
const detectSuspiciousPatterns = (req) => {
  const threats = [];
  const requestData = JSON.stringify({
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body,
    headers: req.headers
  });

  // Check for suspicious patterns in request data
  suspiciousPatterns.forEach((pattern, index) => {
    if (pattern.test(requestData)) {
      threats.push({
        type: 'SUSPICIOUS_PATTERN',
        pattern: pattern.toString(),
        severity: 'HIGH'
      });
    }
  });

  // Check User-Agent for known bad patterns
  const userAgent = req.get('User-Agent') || '';
  if (userAgent.includes('sqlmap') ||
      userAgent.includes('nikto') ||
      userAgent.includes('nmap') ||
      userAgent.includes('masscan') ||
      userAgent.includes('gobuster')) {
    threats.push({
      type: 'SCANNING_TOOL_DETECTED',
      userAgent,
      severity: 'HIGH'
    });
  }

  // Check for suspicious file uploads
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach(file => {
      if (suspiciousFilePatterns.some(pattern => pattern.test(file.originalname))) {
        threats.push({
          type: 'SUSPICIOUS_FILE_UPLOAD',
          filename: file.originalname,
          severity: 'HIGH'
        });
      }
    });
  }

  return threats;
};

/**
 * Track authentication failures
 */
const trackAuthFailure = (ip) => {
  const now = Date.now();

  if (!authFailureTracker.has(ip)) {
    authFailureTracker.set(ip, []);
  }

  const failures = authFailureTracker.get(ip);

  // Clean old failures outside the window
  const validFailures = failures.filter(timestamp => now - timestamp < AUTH_FAILURE_WINDOW);
  validFailures.push(now);

  authFailureTracker.set(ip, validFailures);

  // Check if threshold exceeded
  if (validFailures.length >= AUTH_FAILURE_THRESHOLD) {
    logger.security.suspiciousActivity(ip, 'AUTH_BRUTE_FORCE_DETECTED', {
      failureCount: validFailures.length,
      timeWindow: `${AUTH_FAILURE_WINDOW / 60000} minutes`,
      recommendation: 'Consider blocking this IP'
    });

    // Reset counter after alert
    authFailureTracker.set(ip, []);

    return true; // Threshold exceeded
  }

  return false;
};

/**
 * Security audit middleware
 */
const securityAuditMiddleware = (req, res, next) => {
  const start = Date.now();

  // Check for suspicious patterns
  const threats = detectSuspiciousPatterns(req);

  if (threats.length > 0) {
    logger.security.suspiciousActivity(req.ip, 'THREAT_DETECTED', {
      threats,
      endpoint: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      origin: req.get('Origin')
    });
  }

  // Monitor response for additional threats
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;

    // Log security events based on response
    if (res.statusCode === 401) {
      const thresholdExceeded = trackAuthFailure(req.ip);
      if (thresholdExceeded) {
        // Could trigger additional security measures here
      }
    }

    // Log slow responses that might indicate attacks
    if (duration > 5000) {
      logger.security.suspiciousActivity(req.ip, 'SLOW_RESPONSE', {
        endpoint: req.originalUrl,
        duration,
        statusCode: res.statusCode,
        possibleCause: 'DoS attack or resource exhaustion'
      });
    }

    // Log unusual error patterns
    if (res.statusCode >= 500) {
      logger.security.suspiciousActivity(req.ip, 'SERVER_ERROR', {
        endpoint: req.originalUrl,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent')
      });
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Generate security report
 */
const generateSecurityReport = () => {
  const now = Date.now();
  const activeThreats = [];

  // Check for active authentication failure tracking
  authFailureTracker.forEach((failures, ip) => {
    const recentFailures = failures.filter(timestamp => now - timestamp < AUTH_FAILURE_WINDOW);
    if (recentFailures.length > 0) {
      activeThreats.push({
        type: 'AUTH_FAILURES',
        ip,
        count: recentFailures.length,
        lastFailure: new Date(Math.max(...recentFailures)).toISOString()
      });
    }
  });

  return {
    timestamp: new Date().toISOString(),
    activeThreats,
    monitorsActive: [
      'Suspicious pattern detection',
      'Authentication brute force protection',
      'File upload scanning',
      'Performance monitoring',
      'Error pattern analysis'
    ],
    thresholds: {
      authFailures: AUTH_FAILURE_THRESHOLD,
      authWindow: `${AUTH_FAILURE_WINDOW / 60000} minutes`,
      slowResponseThreshold: '5 seconds'
    }
  };
};

/**
 * Clean up old tracking data
 */
const cleanupSecurityData = () => {
  const now = Date.now();

  authFailureTracker.forEach((failures, ip) => {
    const validFailures = failures.filter(timestamp => now - timestamp < AUTH_FAILURE_WINDOW);
    if (validFailures.length === 0) {
      authFailureTracker.delete(ip);
    } else {
      authFailureTracker.set(ip, validFailures);
    }
  });
};

// Cleanup every 5 minutes
setInterval(cleanupSecurityData, 5 * 60 * 1000);

module.exports = {
  securityAuditMiddleware,
  trackAuthFailure,
  generateSecurityReport,
  detectSuspiciousPatterns
};
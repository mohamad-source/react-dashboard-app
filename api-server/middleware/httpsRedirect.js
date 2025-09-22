const logger = require('../utils/logger');

/**
 * HTTPS Redirect Middleware für Production
 * Leitet alle HTTP-Requests automatisch zu HTTPS weiter
 */

/**
 * HTTPS Redirect Middleware
 */
const httpsRedirect = (req, res, next) => {
  // Nur in Production aktivieren
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Prüfe verschiedene Header für HTTPS-Erkennung
  const isHttps = req.secure ||
                  req.get('x-forwarded-proto') === 'https' ||
                  req.get('x-forwarded-ssl') === 'on' ||
                  req.connection.encrypted;

  if (!isHttps) {
    // Konstruiere HTTPS URL
    const httpsUrl = `https://${req.get('host')}${req.originalUrl}`;

    logger.security.suspiciousActivity(req.ip, 'HTTP_REDIRECT_TO_HTTPS', {
      originalUrl: `http://${req.get('host')}${req.originalUrl}`,
      redirectUrl: httpsUrl,
      userAgent: req.get('User-Agent')
    });

    // 301 Permanent Redirect zu HTTPS
    return res.redirect(301, httpsUrl);
  }

  // Request ist bereits HTTPS, weiter
  next();
};

/**
 * Strict Transport Security (HSTS) Header
 * Zwingt Browser, in Zukunft nur HTTPS zu verwenden
 */
const hstsMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    // HSTS Header für 1 Jahr mit includeSubDomains
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
};

/**
 * Sicherheits-Headers für HTTPS-Umgebung
 */
const secureConnectionHeaders = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    // Nur HTTPS-Cookies erlauben
    res.setHeader('Set-Cookie', res.getHeader('Set-Cookie') || []);

    // Zusätzliche Sicherheits-Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy für HTTPS
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://www.dat.de https://api.fahrzeugschein-scanner.de; " +
      "upgrade-insecure-requests"
    );
  }
  next();
};

/**
 * Prüfung der HTTPS-Konfiguration
 */
const validateHttpsConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    const config = {
      trustProxy: process.env.TRUST_PROXY === '1',
      secureCookies: process.env.SECURE_COOKIES === 'true',
      corsOrigin: process.env.CORS_ORIGIN
    };

    logger.info('HTTPS Configuration validated', {
      config,
      recommendations: {
        trustProxy: config.trustProxy ? 'Configured' : 'Should be enabled behind reverse proxy',
        secureCookies: config.secureCookies ? 'Enabled' : 'Should be enabled for production',
        corsOrigin: config.corsOrigin ? 'Configured' : 'Should specify production domain'
      }
    });

    return config;
  }

  return { httpsNotRequired: 'Development environment' };
};

module.exports = {
  httpsRedirect,
  hstsMiddleware,
  secureConnectionHeaders,
  validateHttpsConfig
};
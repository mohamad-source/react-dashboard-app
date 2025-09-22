const logger = require('../utils/logger');
const { generateSecurityReport } = require('../middleware/securityAudit');

/**
 * Security monitoring service for periodic checks and alerts
 */

class SecurityMonitor {
  constructor() {
    this.alerts = [];
    this.metrics = {
      totalRequests: 0,
      suspiciousRequests: 0,
      blockedRequests: 0,
      authFailures: 0,
      sqlInjectionAttempts: 0,
      xssAttempts: 0,
      fileUploadThreats: 0
    };

    this.startTime = Date.now();
    this.isMonitoring = false;
  }

  /**
   * Start security monitoring
   */
  start() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    logger.info('Security monitoring started');

    // Generate security reports every 30 minutes
    this.reportInterval = setInterval(() => {
      this.generatePeriodicReport();
    }, 30 * 60 * 1000);

    // Metrics cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000);
  }

  /**
   * Stop security monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    logger.info('Security monitoring stopped');
  }

  /**
   * Record security event
   */
  recordEvent(type, severity = 'MEDIUM', details = {}) {
    this.metrics.totalRequests++;

    const event = {
      id: Date.now() + Math.random(),
      type,
      severity,
      details,
      timestamp: new Date().toISOString()
    };

    // Update specific metrics
    switch (type) {
      case 'SUSPICIOUS_REQUEST':
        this.metrics.suspiciousRequests++;
        break;
      case 'BLOCKED_REQUEST':
        this.metrics.blockedRequests++;
        break;
      case 'AUTH_FAILURE':
        this.metrics.authFailures++;
        break;
      case 'SQL_INJECTION_ATTEMPT':
        this.metrics.sqlInjectionAttempts++;
        break;
      case 'XSS_ATTEMPT':
        this.metrics.xssAttempts++;
        break;
      case 'FILE_UPLOAD_THREAT':
        this.metrics.fileUploadThreats++;
        break;
    }

    // Store high severity alerts
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      this.alerts.push(event);

      logger.security.suspiciousActivity(
        details.ip || 'unknown',
        type,
        details
      );

      // Trigger immediate alert for critical events
      if (severity === 'CRITICAL') {
        this.triggerCriticalAlert(event);
      }
    }

    return event;
  }

  /**
   * Trigger critical alert
   */
  triggerCriticalAlert(event) {
    logger.error('CRITICAL SECURITY ALERT', {
      event,
      recommendation: 'Immediate investigation required',
      actionRequired: true
    });

    // In production, this could trigger:
    // - Email alerts
    // - Slack notifications
    // - SMS alerts
    // - Automatic IP blocking
  }

  /**
   * Generate periodic security report
   */
  generatePeriodicReport() {
    const uptime = Date.now() - this.startTime;
    const report = generateSecurityReport();

    const securitySummary = {
      uptime: `${Math.floor(uptime / (1000 * 60 * 60))} hours`,
      metrics: this.metrics,
      recentAlerts: this.alerts.slice(-10), // Last 10 alerts
      auditReport: report,
      recommendations: this.generateRecommendations()
    };

    logger.info('Periodic security report generated', securitySummary);

    return securitySummary;
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Check metrics for concerning patterns
    if (this.metrics.authFailures > 50) {
      recommendations.push({
        type: 'HIGH_AUTH_FAILURES',
        message: 'High number of authentication failures detected',
        action: 'Consider implementing stronger rate limiting or CAPTCHA'
      });
    }

    if (this.metrics.sqlInjectionAttempts > 10) {
      recommendations.push({
        type: 'SQL_INJECTION_ATTEMPTS',
        message: 'Multiple SQL injection attempts detected',
        action: 'Review input validation and consider WAF implementation'
      });
    }

    if (this.metrics.xssAttempts > 5) {
      recommendations.push({
        type: 'XSS_ATTEMPTS',
        message: 'Cross-site scripting attempts detected',
        action: 'Review output encoding and CSP headers'
      });
    }

    const suspiciousRatio = this.metrics.suspiciousRequests / Math.max(this.metrics.totalRequests, 1);
    if (suspiciousRatio > 0.1) {
      recommendations.push({
        type: 'HIGH_SUSPICIOUS_RATIO',
        message: 'High ratio of suspicious requests',
        action: 'Investigate potential coordinated attack'
      });
    }

    return recommendations;
  }

  /**
   * Clean up old alerts
   */
  cleanupOldAlerts() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert =>
      new Date(alert.timestamp).getTime() > oneDayAgo
    );

    logger.debug('Security alerts cleanup completed', {
      remainingAlerts: this.alerts.length
    });
  }

  /**
   * Get current security status
   */
  getSecurityStatus() {
    return {
      monitoring: this.isMonitoring,
      uptime: Date.now() - this.startTime,
      metrics: this.metrics,
      recentAlerts: this.alerts.slice(-5),
      lastReport: this.generatePeriodicReport()
    };
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      suspiciousRequests: 0,
      blockedRequests: 0,
      authFailures: 0,
      sqlInjectionAttempts: 0,
      xssAttempts: 0,
      fileUploadThreats: 0
    };

    this.alerts = [];

    logger.info('Security metrics reset');
  }
}

// Create singleton instance
const securityMonitor = new SecurityMonitor();

module.exports = {
  securityMonitor,
  SecurityMonitor
};
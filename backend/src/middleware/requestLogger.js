const { captureLog } = require('../services/monitoringService');

// Generate simple request ID without uuid dependency
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Request logger middleware
 * Adds request ID and logs request details
 */
const requestLogger = (req, res, next) => {
  // Generate unique request ID
  req.requestId = generateRequestId();
  const startTime = Date.now();
  const getActorId = () => req.userId || req.user?.id || null;
  let responseLogged = false;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);
  
  // Log request start
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${req.ip} - ${req.requestId}`);
  
  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${req.requestId}`);
    responseLogged = true;
    captureLog({
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      source: 'HTTP',
      action: 'REQUEST_COMPLETED',
      message: `${req.method} ${req.originalUrl} -> ${res.statusCode}`,
      actorId: getActorId(),
      request: {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      },
      metadata: {
        statusCode: res.statusCode,
        durationMs: Date.now() - startTime
      }
    });
    return originalJson.call(this, body);
  };

  res.on('finish', () => {
    if (responseLogged) return;
    captureLog({
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      source: 'HTTP',
      action: 'REQUEST_FINISHED',
      message: `${req.method} ${req.originalUrl} -> ${res.statusCode}`,
      actorId: getActorId(),
      request: {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      },
      metadata: {
        statusCode: res.statusCode,
        durationMs: Date.now() - startTime
      }
    });
  });
  
  next();
};

module.exports = requestLogger;

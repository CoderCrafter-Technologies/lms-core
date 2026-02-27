const config = require('../config');
const { captureError } = require('../services/monitoringService');

/**
 * Global error handler middleware
 * Handles all errors thrown in the application
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error caught by global handler:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error response
  let error = {
    message: 'Internal server error',
    status: 500
  };

  // MongoDB/Mongoose errors
  if (err.name === 'ValidationError') {
    error = {
      message: 'Validation failed',
      status: 400,
      details: Object.values(err.errors).map(e => e.message)
    };
  }

  if (err.name === 'CastError') {
    error = {
      message: 'Invalid ID format',
      status: 400
    };
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    error = {
      message: `${field} already exists`,
      status: 409
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      status: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      status: 401
    };
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'File size too large',
      status: 413
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      message: 'Unexpected file field',
      status: 400
    };
  }

  // Custom application errors
  if (err.status) {
    error = {
      message: err.message,
      status: err.status
    };
  }

  // Rate limiting errors
  if (err.status === 429) {
    error = {
      message: 'Too many requests, please try again later',
      status: 429
    };
  }

  // Construct response
  const response = {
    error: error.message,
    status: error.status,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Add details in development mode
  if (config.nodeEnv === 'development') {
    response.stack = err.stack;
    if (error.details) {
      response.details = error.details;
    }
  }

  // Add request ID if available
  if (req.requestId) {
    response.requestId = req.requestId;
  }

  captureError({
    source: 'HTTP',
    action: 'REQUEST_ERROR',
    message: err?.message || 'Unhandled request error',
    actorId: req.userId || req.user?.id || null,
    request: {
      requestId: req.requestId || null,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    },
    metadata: {
      status: error.status,
      errorName: err?.name || null,
      stack: err?.stack || null
    }
  });

  res.status(error.status).json(response);
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    status: 404,
    timestamp: new Date().toISOString()
  });
};

/**
 * Async error wrapper to catch async errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error
 * @param {String} message - Error message
 * @param {Number} status - HTTP status code
 * @returns {Error} Custom error
 */
const createError = (message, status = 500) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError
};

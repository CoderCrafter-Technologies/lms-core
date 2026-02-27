// utils/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'lms-service' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      }`;
    })
  );

  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Custom stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Helper methods for different log levels
logger.debug = (message, meta) => {
  logger.log('debug', message, meta);
};

logger.info = (message, meta) => {
  logger.log('info', message, meta);
};

logger.warn = (message, meta) => {
  logger.log('warn', message, meta);
};

logger.error = (message, meta) => {
  logger.log('error', message, meta);
};

// Method to log HTTP requests
logger.http = (req, res, error = null) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    params: req.params,
    body: req.body,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user.id : 'anonymous',
    statusCode: res.statusCode,
    responseTime: res.responseTime,
    error: error ? error.message : null
  };

  if (error) {
    logger.error('HTTP Request Error', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('HTTP Request Warning', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

// Method to log database operations
logger.db = (operation, collection, query, result, error = null) => {
  const logData = {
    operation,
    collection,
    query,
    resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
    error: error ? error.message : null
  };

  if (error) {
    logger.error('Database Operation Error', logData);
  } else {
    logger.debug('Database Operation', logData);
  }
};

// Method to log cron job executions
logger.cron = (jobName, status, message, meta = {}) => {
  const logData = {
    jobName,
    status,
    ...meta
  };

  switch (status) {
    case 'started':
      logger.info(`Cron Job Started: ${jobName} - ${message}`, logData);
      break;
    case 'completed':
      logger.info(`Cron Job Completed: ${jobName} - ${message}`, logData);
      break;
    case 'failed':
      logger.error(`Cron Job Failed: ${jobName} - ${message}`, logData);
      break;
    case 'skipped':
      logger.warn(`Cron Job Skipped: ${jobName} - ${message}`, logData);
      break;
    default:
      logger.info(`Cron Job: ${jobName} - ${message}`, logData);
  }
};

// Method to log application events
logger.event = (eventName, data, userId = null) => {
  logger.info(`Event: ${eventName}`, {
    event: eventName,
    userId,
    data
  });
};

// Graceful shutdown handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = logger;
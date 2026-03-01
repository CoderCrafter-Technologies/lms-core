const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');

// Import configurations and utilities
const config = require('./config');
const database = require('./config/database');

// Import middleware
const { authenticateToken: authMiddleware } = require('./middleware/auth');
const {errorHandler} = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const courseRoutes = require('./routes/courses');
const batchRoutes = require('./routes/batches');
const liveClassRoutes = require('./routes/liveClasses');
const permissionRoutes = require('./routes/permissions');
const studentRoutes = require('./routes/students');
const adminRoutes = require('./routes/admin');
const instructorRoutes = require("./routes/instructor");
const instructorsRoutes = require("./routes/instructors");
const enrollmentsRoutes = require("./routes/enrollments");
const assessmentRoutes = require('./routes/assessments');
const resourceRoutes = require('./routes/resources');
const supportRoutes = require('./routes/support');
const publicResources = require('./routes/publickResources')
const notificationsRoutes = require('./routes/notifications');
const monitoringRoutes = require('./routes/monitoring');
const managerRoutes = require('./routes/manager');
const setupRoutes = require('./routes/setup');
const dynamicCors = require('./utils/dynamicCors');

// Import Socket.io handlers
const EnhancedSocketHandler = require('./services/newSocketHandler');
const liveClassCron = require('./cron/liveClassCron');
const notificationDigestCron = require('./cron/notificationDigestCron');
const telemetryHeartbeatCron = require('./cron/telemetryHeartbeatCron');
const { setSocketHandler } = require('./services/socketBridge');
const { captureError } = require('./services/monitoringService');

class Server {
  constructor() {
    this.app = express();
    this.app.set('trust proxy', 1);
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: dynamicCors.socketCorsOptions
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      }
    }));

    // CORS
    this.app.use(cors(dynamicCors.corsOptions));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({
      limit: '50mb',
      verify: (req, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(cookieParser());
    // Logging
    if (config.nodeEnv === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Custom request logger
    this.app.use(requestLogger);

    // Serve uploaded assets (ticket/resource attachments)
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    // Health check endpoint (before auth middleware)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        uptime: process.uptime()
      });
    });

    // API info endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'LMS Future-Proof API',
        version: '1.0.0',
        description: 'Future-proof LMS API with MongoDB to PostgreSQL migration path',
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          courses: '/api/courses',
          batches: '/api/batches',
          liveClasses: '/api/live-classes',
          permissions: '/api/permissions',
          students: '/api/students',
          admin: '/api/admin',
          assessments: '/api/assessments',
          resources: '/api/resources',
          support: '/api/support',
          notifications: '/api/notifications',
          monitoring: '/api/monitoring',
          setup: '/api/setup'
        }
      });
    });
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/setup', setupRoutes);
    this.app.use('/api/users', authMiddleware, userRoutes);
    this.app.use('/api/courses', authMiddleware, courseRoutes);
    this.app.use('/api/batches', authMiddleware, batchRoutes);
    this.app.use('/api/live-classes', authMiddleware, liveClassRoutes);  
    this.app.use('/api/permissions', authMiddleware, permissionRoutes);
    this.app.use('/api/students', authMiddleware, studentRoutes);
    this.app.use('/api/admin', authMiddleware, adminRoutes);
    this.app.use('/api/instructors', authMiddleware, instructorsRoutes);
    this.app.use('/api/instructor', authMiddleware, instructorRoutes);
    this.app.use('/api/enrollments', authMiddleware, enrollmentsRoutes);
    this.app.use('/api/assessments', authMiddleware, assessmentRoutes);
    this.app.use('/api/resources', authMiddleware, resourceRoutes);
    this.app.use('/api/support', authMiddleware, supportRoutes);
    this.app.use('/api/notifications', authMiddleware, notificationsRoutes);
    this.app.use('/api/monitoring', authMiddleware, monitoringRoutes);
    this.app.use('/api/manager', authMiddleware, managerRoutes);
    this.app.use('/api/public/resource', publicResources)

    // 404 handler for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        error: 'API endpoint not found',
        message: `Cannot ${req.method} ${req.originalUrl}`
      });
    });

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'LMS Future-Proof API Server',
        version: '1.0.0',
        documentation: '/api',
        health: '/health'
      });
    });
  }

  setupSocketHandlers() {
    // Initialize enhanced socket handler
    try {
      this.socketHandler = new EnhancedSocketHandler(this.io);
      setSocketHandler(this.socketHandler);
      console.log('[OK] Enhanced Socket.IO handler initialized successfully');
      
      // Test Socket.IO is working
      this.io.engine.on('connection_error', (err) => {
        console.log('[SOCKET_ERROR] Socket.IO connection error:', err.message);
      });
      
    } catch (error) {
      console.error('[ERROR] Failed to initialize Socket.IO handler:', error);
    }
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use(errorHandler);

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err, promise) => {
      console.error('[ERROR] Unhandled Promise Rejection:', err);
      captureError({
        source: 'PROCESS',
        action: 'UNHANDLED_REJECTION',
        message: err?.message || 'Unhandled promise rejection',
        metadata: {
          stack: err?.stack || null,
          promise: !!promise
        }
      });
      // Close server & exit process
      this.server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('[ERROR] Uncaught Exception:', err);
      captureError({
        source: 'PROCESS',
        action: 'UNCAUGHT_EXCEPTION',
        message: err?.message || 'Uncaught exception',
        metadata: {
          stack: err?.stack || null
        }
      });
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }

  async gracefulShutdown(signal) {
    console.log(`\n[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    this.server.close(async () => {
      console.log('[OK] HTTP server closed');
      
      try {
        // Close database connection
        telemetryHeartbeatCron.stop();
        await database.disconnect();
        console.log('[OK] Database connection closed');
        
        console.log('[OK] Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force close after 30 seconds
    setTimeout(() => {
      console.error('[ERROR] Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  }

  async start() {
    try {
      // Connect to database
      await database.connect();
      await dynamicCors.refreshAllowedOrigins();
      liveClassCron.start();
      notificationDigestCron.start();
      await telemetryHeartbeatCron.start();
      // Start server
      this.server.listen(config.port, () => {
        console.log(`
[STARTED] LMS Future-Proof Server Started
[INFO] Environment: ${config.nodeEnv}
[INFO] Port: ${config.port}
[INFO] Runtime Database Mode: ${database.getRuntimeMode()}
[INFO] Runtime Data Access Mode: ${database.getDataAccessMode()}
[INFO] Mongo URI (data-access): ${config.mongodb.uri}
[INFO] API Docs: http://localhost:${config.port}/api
[INFO] Health Check: http://localhost:${config.port}/health
        `);
      });

      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`[ERROR] Port ${config.port} is already in use`);
        } else {
          console.error('[ERROR] Server error:', error);
        }
        process.exit(1);
      });

    } catch (error) {
      console.error('[ERROR] Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Create and start server
const server = new Server();
server.start();

module.exports = server;


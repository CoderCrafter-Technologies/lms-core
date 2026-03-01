const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const dynamicCors = require('./utils/dynamicCors');

const app = express();

// Middleware
app.use(helmet());
app.use(cors(dynamicCors.corsOptions));
app.use(express.json());

// Basic routes without database
app.get('/', (req, res) => {
  res.json({
    message: 'LMS Future-Proof API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime()
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'LMS Future-Proof API',
    version: '1.0.0',
    description: 'Future-proof LMS API with MongoDB to PostgreSQL migration path',
    status: 'Database connection required for full functionality',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      courses: '/api/courses',
      batches: '/api/batches',
      liveClasses: '/api/live-classes',
      permissions: '/api/permissions'
    }
  });
});

// Mock auth endpoint for testing
app.post('/api/auth/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    status: 404,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    status: 500,
    timestamp: new Date().toISOString()
  });
});

const port = config.port;

app.listen(port, () => {
  console.log(`
🚀 LMS Future-Proof Test Server Started
🔗 Environment: ${config.nodeEnv}
🔗 Port: ${port}
🔗 URL: http://localhost:${port}
🔗 API: http://localhost:${port}/api
🔗 Health: http://localhost:${port}/health

⚠️  Note: This is a test server without database connectivity.
   For full functionality, ensure MongoDB is running and use 'npm run dev'
  `);
});

module.exports = app;

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const database = require('./config/database');
const authRoutes = require('./routes/auth');
const config = require('./config');

const app = express();

// Middleware
app.use(cors(config.cors));
app.use(express.json());
app.use(cookieParser());

// Connect to database
database.connect().then(() => {
  console.log('✅ MongoDB connected successfully');
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err);
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'LMS Future-Proof API Server with MongoDB',
    version: '1.0.0',
    database: 'MongoDB connected',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

const port = config.port;
app.listen(port, () => {
  console.log(`
🚀 LMS Backend Server Started
🔗 Port: ${port}
🔗 URL: http://localhost:${port}
🔗 Database: MongoDB (localhost:27017)
🔗 Health: http://localhost:${port}/health
  `);
});

module.exports = app;

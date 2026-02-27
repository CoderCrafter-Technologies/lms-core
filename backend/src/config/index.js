require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof',
    dbName: process.env.DB_NAME || 'lms_futureproof'
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  // Export jwtSecret for backward compatibility
  get jwtSecret() {
    return this.jwt.secret;
  },
  
  // CORS
  cors: {
     origin: process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',') 
    : 'http://localhost:3000',
  credentials: true
  },
  
  // File Upload
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200
  },
  
  // WebRTC
  webrtc: {
    turnServer: {
      url: process.env.TURN_SERVER_URL,
      username: process.env.TURN_SERVER_USERNAME,
      credential: process.env.TURN_SERVER_CREDENTIAL
    }
  },
  
  // Pagination
  pagination: {
    defaultLimit: 10,
    maxLimit: 100
  }
};

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(`⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`);
  if (config.nodeEnv === 'production') {
    console.error('❌ Required environment variables missing in production');
    process.exit(1);
  }
}

module.exports = config;

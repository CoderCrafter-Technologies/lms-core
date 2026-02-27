const mongoose = require('mongoose');
const { Pool: PgPool } = require('pg');
const systemSettingsStore = require('../services/systemSettingsStore');
const { DATABASE_MODES } = require('../services/databaseSettingsService');

class DatabaseConnection {
  constructor() {
    this.connection = null;
    this.postgresPool = null;
    this.mongoCompatibilityConnection = null;
    this.runtimeMode = DATABASE_MODES.MONGODB;
    this.dataAccessMode = DATABASE_MODES.MONGODB;
  }

  getMongoConnectOptions() {
    return {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 5000
      },
      readPreference: 'primaryPreferred',
      readConcern: { level: 'majority' }
    };
  }

  async connectMongoAsPrimary(mongoUri) {
    this.connection = await mongoose.connect(mongoUri, this.getMongoConnectOptions());
    this.mongoCompatibilityConnection = this.connection;
    this.runtimeMode = DATABASE_MODES.MONGODB;
    this.dataAccessMode = DATABASE_MODES.MONGODB;
    process.env.RUNTIME_DATABASE_MODE = this.runtimeMode;
    process.env.RUNTIME_DATABASE_DATA_ACCESS_MODE = this.dataAccessMode;

    console.log(`[DB] MongoDB connected: ${this.connection.connection.host}`);
  }

  buildPostgresConfig(persistedSettings) {
    const selectedMode = persistedSettings?.mode || DATABASE_MODES.MONGODB;

    if (selectedMode === DATABASE_MODES.POSTGRES_URI) {
      const uri = String(persistedSettings?.postgresUri || '').trim();
      if (!uri) throw new Error('PostgreSQL URI mode selected but postgresUri is empty');
      return {
        connectionString: uri,
        ssl: uri.includes('sslmode=require') ? { rejectUnauthorized: false } : false
      };
    }

    const same = persistedSettings?.postgresSameServer || {};
    return {
      host: same.host || 'postgres',
      port: Number(same.port) || 5432,
      database: same.database || 'lms_futureproof',
      user: same.user || 'postgres',
      password: same.password || '',
      ssl: Boolean(same.ssl) ? { rejectUnauthorized: false } : false
    };
  }

  async connectPostgresAsPrimary(persistedSettings) {
    const selectedMode = persistedSettings?.mode || DATABASE_MODES.MONGODB;
    const pgConfig = this.buildPostgresConfig(persistedSettings);
    this.postgresPool = new PgPool(pgConfig);
    const pgClient = await this.postgresPool.connect();
    try {
      await pgClient.query('SELECT 1');
    } finally {
      pgClient.release();
    }

    this.runtimeMode = selectedMode;
    process.env.RUNTIME_DATABASE_MODE = this.runtimeMode;

    // Current repositories/models are Mongoose-based. Keep compatibility connection
    // so existing application flows continue to work while setup-selected runtime
    // mode is still reflected for operations/telemetry.
    const allowMongoFallback = String(process.env.ENABLE_MONGODB_COMPAT_FALLBACK || 'true').toLowerCase() !== 'false';
    if (!allowMongoFallback) {
      throw new Error(
        'PostgreSQL mode selected, but Mongo compatibility fallback is disabled. Set ENABLE_MONGODB_COMPAT_FALLBACK=true or migrate repositories to PostgreSQL first.'
      );
    }

    const mongoUri = String(
      persistedSettings?.mongodbUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof'
    ).trim();
    if (!mongoUri) {
      throw new Error('Mongo compatibility URI is required for current Mongoose repositories');
    }

    this.mongoCompatibilityConnection = await mongoose.connect(mongoUri, this.getMongoConnectOptions());
    this.connection = this.postgresPool;
    this.dataAccessMode = DATABASE_MODES.MONGODB;
    process.env.RUNTIME_DATABASE_DATA_ACCESS_MODE = this.dataAccessMode;

    console.log('[DB] PostgreSQL runtime adapter connected');
    console.warn('[DB] Running in PostgreSQL runtime with MongoDB compatibility data-access mode until repositories are fully migrated.');
  }

  async connect() {
    try {
      const persistedSettings = await systemSettingsStore.getDatabaseSettings();
      const selectedMode = persistedSettings?.mode || DATABASE_MODES.MONGODB;
      if (selectedMode === DATABASE_MODES.MONGODB) {
        const mongoUri = String(
          persistedSettings?.mongodbUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof'
        ).trim();
        await this.connectMongoAsPrimary(mongoUri);
      } else if (
        selectedMode === DATABASE_MODES.POSTGRES_URI
        || selectedMode === DATABASE_MODES.POSTGRES_SAME_SERVER
      ) {
        await this.connectPostgresAsPrimary(persistedSettings);
      } else {
        throw new Error(`Unsupported database mode: ${selectedMode}`);
      }

      mongoose.connection.on('error', (err) => {
        console.error('[DB] MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('[DB] MongoDB disconnected');
      });

      return this.connection;
    } catch (error) {
      console.error('[DB] Database connection failed:', error);
      process.exit(1);
    }
  }

  async disconnect() {
    try {
      if (mongoose.connection?.readyState) {
        await mongoose.connection.close();
      }
      if (this.postgresPool) {
        await this.postgresPool.end();
        this.postgresPool = null;
      }
      console.log('[DB] Database adapters disconnected');
    } catch (error) {
      console.error('[DB] Error disconnecting from database:', error);
    }
  }

  async startSession() {
    if (this.runtimeMode !== DATABASE_MODES.MONGODB) {
      throw new Error('MongoDB sessions are not available when runtime mode is PostgreSQL');
    }
    return mongoose.startSession();
  }

  async withTransaction(callback) {
    const session = await this.startSession();
    try {
      return await session.withTransaction(callback, {
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' }
      });
    } finally {
      await session.endSession();
    }
  }

  getConnection() {
    return this.connection;
  }

  getRuntimeMode() {
    return this.runtimeMode;
  }

  getDataAccessMode() {
    return this.dataAccessMode;
  }

  async isHealthy() {
    try {
      if (this.runtimeMode === DATABASE_MODES.MONGODB) {
        await mongoose.connection.db.admin().ping();
        return true;
      }

      if (this.postgresPool) {
        await this.postgresPool.query('SELECT 1');
      }

      // Data-access path currently remains Mongoose-backed.
      if (mongoose.connection?.readyState) {
        await mongoose.connection.db.admin().ping();
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new DatabaseConnection();

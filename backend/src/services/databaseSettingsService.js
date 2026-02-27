const mongoose = require('mongoose');
let PgClient = null;
try {
  ({ Client: PgClient } = require('pg'));
} catch {
  PgClient = null;
}

const systemSettingsStore = require('./systemSettingsStore');

const DATABASE_MODES = {
  MONGODB: 'mongodb',
  POSTGRES_URI: 'postgres_uri',
  POSTGRES_SAME_SERVER: 'postgres_same_server'
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const toSafeInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeSettings = (settings, includeSecrets = false) => ({
  mode: settings.mode,
  mongodbUri: includeSecrets ? settings.mongodbUri : '',
  postgresUri: includeSecrets ? settings.postgresUri : '',
  postgresSameServer: {
    host: settings.postgresSameServer?.host || 'postgres',
    port: toSafeInt(settings.postgresSameServer?.port, 5432),
    database: settings.postgresSameServer?.database || 'lms_futureproof',
    user: settings.postgresSameServer?.user || 'postgres',
    password: includeSecrets ? (settings.postgresSameServer?.password || '') : '',
    ssl: Boolean(settings.postgresSameServer?.ssl)
  },
  updatedAt: settings.updatedAt || null,
  updatedBy: settings.updatedBy || null
});

const buildPostgresConfigFromSameServer = (settings) => ({
  host: settings.postgresSameServer.host,
  port: toSafeInt(settings.postgresSameServer.port, 5432),
  database: settings.postgresSameServer.database,
  user: settings.postgresSameServer.user,
  password: settings.postgresSameServer.password,
  ssl: settings.postgresSameServer.ssl ? { rejectUnauthorized: false } : false
});

const testMongoConnection = async (uri) => {
  const connection = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000
  }).asPromise();

  try {
    await connection.db.admin().ping();
  } finally {
    await connection.close();
  }
};

const testPostgresConnection = async (config) => {
  if (!PgClient) {
    throw new Error('PostgreSQL driver missing. Install backend dependency "pg" first.');
  }

  const client = new PgClient(config);
  await client.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    await client.end();
  }
};

class DatabaseSettingsService {
  async getDatabaseSettings(options = {}) {
    const includeSecrets = options.includeSecrets === true;
    const settings = await systemSettingsStore.getDatabaseSettings();
    return sanitizeSettings(settings, includeSecrets);
  }

  validateIncomingSettings(payload) {
    const mode = payload?.mode;
    if (!Object.values(DATABASE_MODES).includes(mode)) {
      throw new Error('Invalid database mode');
    }

    const normalized = {
      mode,
      mongodbUri: isNonEmptyString(payload?.mongodbUri) ? payload.mongodbUri.trim() : '',
      postgresUri: isNonEmptyString(payload?.postgresUri) ? payload.postgresUri.trim() : '',
      postgresSameServer: {
        host: isNonEmptyString(payload?.postgresSameServer?.host) ? payload.postgresSameServer.host.trim() : 'postgres',
        port: toSafeInt(payload?.postgresSameServer?.port, 5432),
        database: isNonEmptyString(payload?.postgresSameServer?.database) ? payload.postgresSameServer.database.trim() : 'lms_futureproof',
        user: isNonEmptyString(payload?.postgresSameServer?.user) ? payload.postgresSameServer.user.trim() : 'postgres',
        password: typeof payload?.postgresSameServer?.password === 'string' ? payload.postgresSameServer.password : '',
        ssl: Boolean(payload?.postgresSameServer?.ssl)
      }
    };

    if (mode === DATABASE_MODES.MONGODB && !normalized.mongodbUri) {
      throw new Error('MongoDB URI is required');
    }

    if (mode === DATABASE_MODES.POSTGRES_URI && !normalized.postgresUri) {
      throw new Error('PostgreSQL URI is required');
    }

    const allowMongoFallback = String(process.env.ENABLE_MONGODB_COMPAT_FALLBACK || 'true').toLowerCase() !== 'false';
    if (allowMongoFallback && mode !== DATABASE_MODES.MONGODB && !normalized.mongodbUri) {
      normalized.mongodbUri = String(process.env.MONGODB_URI || '').trim();
      if (!normalized.mongodbUri) {
        throw new Error('MongoDB URI is required in compatibility mode until repositories are migrated from Mongoose');
      }
    }

    return normalized;
  }

  async validateConnectivity(normalizedSettings) {
    if (normalizedSettings.mode === DATABASE_MODES.MONGODB) {
      await testMongoConnection(normalizedSettings.mongodbUri);
      return;
    }

    if (normalizedSettings.mode === DATABASE_MODES.POSTGRES_URI) {
      await testPostgresConnection({
        connectionString: normalizedSettings.postgresUri,
        ssl: normalizedSettings.postgresUri.includes('sslmode=require') ? { rejectUnauthorized: false } : false
      });
      return;
    }

    if (normalizedSettings.mode === DATABASE_MODES.POSTGRES_SAME_SERVER) {
      await testPostgresConnection(buildPostgresConfigFromSameServer(normalizedSettings));
    }
  }

  async updateDatabaseSettings(payload, context = {}) {
    const normalized = this.validateIncomingSettings(payload);
    await this.validateConnectivity(normalized);

    const nextSettings = {
      ...normalized,
      updatedAt: new Date().toISOString(),
      updatedBy: context.updatedBy || null
    };

    const persisted = await systemSettingsStore.updateDatabaseSettings(nextSettings);
    return sanitizeSettings(persisted, true);
  }

  async getRuntimeDatabaseContext() {
    const settings = await this.getDatabaseSettings({ includeSecrets: false });
    const runtimeMode = process.env.RUNTIME_DATABASE_MODE || 'mongodb';
    const dataAccessMode = process.env.RUNTIME_DATABASE_DATA_ACCESS_MODE || 'mongodb';
    return {
      configuredMode: settings.mode,
      runtimeMode,
      dataAccessMode,
      compatibilityMode: runtimeMode !== dataAccessMode,
      requiresRestart: settings.mode !== runtimeMode
    };
  }
}

module.exports = {
  databaseSettingsService: new DatabaseSettingsService(),
  DATABASE_MODES
};

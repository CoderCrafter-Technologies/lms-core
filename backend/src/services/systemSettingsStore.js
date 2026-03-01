const fs = require('fs/promises');
const path = require('path');

const SETTINGS_DIR = path.join(__dirname, '../../data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'system-settings.json');
const buildTmpPath = () => `${SETTINGS_FILE}.${process.pid}.${Date.now()}.tmp`;
const SETTINGS_FILE_BAK = `${SETTINGS_FILE}.bak`;

const DEFAULT_SETTINGS = {
  database: {
    mode: 'mongodb',
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof',
    postgresUri: '',
    postgresSameServer: {
      host: 'postgres',
      port: 5432,
      database: 'lms_futureproof',
      user: 'postgres',
      password: 'postgres',
      ssl: false
    },
    updatedAt: null,
    updatedBy: null
  },
  setup: {
    completed: false,
    completedAt: null,
    completedBy: null,
    institute: {
      name: 'Institute',
      website: '',
      supportEmail: '',
      supportPhone: '',
      address: ''
    },
    branding: {
      appName: 'Institute LMS',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#2563EB',
      accentColor: '#0EA5E9',
      whiteLabelEnabled: false,
      showCoderCrafterWatermark: true
    },
    publicLanding: {
      enabled: true,
      layoutPreset: 'aurora',
      showHeader: true,
      sections: [
        { id: 'hero', label: 'Hero', enabled: true, layout: 'centered' },
        { id: 'courses', label: 'Popular Courses', enabled: true, layout: 'grid-4' },
        { id: 'features', label: 'Key Features', enabled: true, layout: 'cards' },
        { id: 'stats', label: 'Stats', enabled: true, layout: 'metrics' },
        { id: 'cta', label: 'Call To Action', enabled: true, layout: 'banner' }
      ],
      content: {
        hero: {
          headline: 'Launch Your Tech Career with',
          subheadline: 'Master in-demand technologies with industry experts. Learn with hands-on projects.',
          primaryCtaText: 'Get Started',
          primaryCtaUrl: '/auth/register',
          secondaryCtaText: 'Explore Courses',
          secondaryCtaUrl: '/auth/login'
        },
        courses: {
          title: 'Most Popular Courses',
          subtitle: 'Join thousands of students learning the most in-demand skills in the tech industry.',
          items: [
            {
              title: 'Full Stack Development',
              description: 'Master MERN stack, React, Node.js and build real-world applications.',
              gradient: 'from-blue-500 to-blue-700'
            },
            {
              title: 'DevOps Engineering',
              description: 'Learn Docker, Kubernetes, AWS, CI/CD and infrastructure automation.',
              gradient: 'from-green-500 to-green-700'
            },
            {
              title: 'Mobile Development',
              description: 'Build iOS and Android apps with React Native, Flutter and Swift.',
              gradient: 'from-purple-500 to-purple-700'
            },
            {
              title: 'Data Science and AI',
              description: 'Master Python, Machine Learning, TensorFlow and data visualization.',
              gradient: 'from-red-500 to-red-700'
            }
          ]
        },
        features: {
          title: 'Why Choose Us?',
          items: [
            {
              title: 'Industry Expert Instructors',
              description: 'Learn from professionals working at top tech companies with real-world experience.'
            },
            {
              title: 'Live Interactive Classes',
              description: 'Live sessions with code collaboration, whiteboard, and real-time doubt solving.'
            },
            {
              title: 'Career Support',
              description: 'Resume building, mock interviews, and placement assistance to launch your career.'
            }
          ]
        },
        stats: {
          items: [
            { value: '5000+', label: 'Students Trained' },
            { value: '100+', label: 'Industry Experts' },
            { value: '85%', label: 'Placement Rate' },
            { value: '24/7', label: 'Mentor Support' }
          ]
        },
        cta: {
          headline: 'Ready to launch your tech career?',
          subheadline: 'Join thousands of students who have transformed their careers.',
          buttonText: 'Get Started Today',
          buttonUrl: '/auth/register'
        }
      },
      styles: {
        pageBackground: '',
        heroBackground: '',
        coursesBackground: '',
        featuresBackground: '',
        statsBackground: '',
        ctaBackground: '',
        textColor: '',
        secondaryTextColor: '',
        headingColor: '',
        primaryColor: '',
        accentColor: '',
        fontFamily: '',
        headingFontFamily: '',
        baseFontSize: 14,
        heroHeadingSize: 56,
        sectionHeadingSize: 32
      }
    },
    dashboardTheme: {
      fontFamily: 'Inter, system-ui, sans-serif',
      baseFontSize: 14,
      headingFontSize: 18,
      textColor: '',
      backgroundColor: '',
      surfaceColor: '',
      cardBackground: '',
      cardBorder: '',
      sidebarColor: '',
      sidebarTextColor: '',
      primaryColor: '',
      accentColor: '',
      modalBackground: '',
      modalTextColor: '',
      toastBackground: '',
      toastTextColor: '',
      cardRadius: 12,
      buttonRadius: 10,
      updatedAt: null
    },
    defaults: {
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
      locale: 'en-US'
    },
    customDomains: [],
    marketing: null
  },
  telemetryLicensing: {
    instanceId: '',
    licenseKey: '',
    edition: 'SELF_HOSTED',
    licenseType: 'FREE',
    planCode: 'free_self_hosted',
    status: 'ACTIVE',
    firstSeenAt: null,
    activatedAt: null,
    lastHeartbeatAt: null,
    lastSyncAt: null,
    lastSyncStatus: 'NEVER',
    lastSyncError: '',
    controlPlane: {
      enabled: false,
      baseUrl: '',
      registerPath: '/api/v1/instances/register',
      heartbeatPath: '/api/v1/instances/heartbeat',
      usagePath: '/api/v1/instances/usage',
      signingKeyId: 'default',
      syncIntervalMinutes: 60
    },
    metadata: {
      appVersion: '1.0.0',
      buildChannel: 'stable',
      runtime: 'docker',
      deploymentTag: '',
      regionHint: '',
      instituteName: '',
      timezone: 'UTC'
    },
    policyCache: {
      version: null,
      fetchedAt: null,
      expiresAt: null,
      features: {},
      limits: {},
      raw: null
    }
  },
  smtp: {
    enabled: false,
    provider: 'smtp',
    host: '',
    port: 587,
    secure: false,
    requireTLS: false,
    authUser: '',
    authPass: '',
    fromName: 'LMS',
    fromEmail: '',
    replyTo: '',
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDeltaMs: 1000,
    rateLimit: 10,
    rejectUnauthorized: false,
    updatedAt: null,
    updatedBy: null
  }
};

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

const deepMerge = (target, source) => {
  const output = { ...target };
  if (!source || typeof source !== 'object') {
    return output;
  }

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      output[key] = deepMerge(targetValue, sourceValue);
      return;
    }

    output[key] = sourceValue;
  });

  return output;
};

class SystemSettingsStore {
  async ensureStore() {
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
  }

  async read() {
    await this.ensureStore();
    try {
      const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return deepMerge(cloneDefaults(), parsed);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const defaults = cloneDefaults();
        await this.write(defaults);
        return defaults;
      }
      if (error instanceof SyntaxError) {
        try {
          const rawBak = await fs.readFile(SETTINGS_FILE_BAK, 'utf8');
          const parsedBak = JSON.parse(rawBak);
          await this.write(parsedBak);
          return deepMerge(cloneDefaults(), parsedBak);
        } catch {
          const defaults = cloneDefaults();
          await this.write(defaults);
          return defaults;
        }
      }
      throw error;
    }
  }

  async write(nextSettings) {
    await this.ensureStore();
    const merged = deepMerge(cloneDefaults(), nextSettings || {});
    const payload = JSON.stringify(merged, null, 2);
    const tmpPath = buildTmpPath();
    await fs.writeFile(tmpPath, payload, 'utf8');
    try {
      await fs.rename(SETTINGS_FILE, SETTINGS_FILE_BAK);
    } catch {
      // ignore if main doesn't exist
    }
    try {
      await fs.rename(tmpPath, SETTINGS_FILE);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        await fs.writeFile(SETTINGS_FILE, payload, 'utf8');
      } else {
        throw error;
      }
    }
    return merged;
  }

  async getDatabaseSettings() {
    const settings = await this.read();
    return settings.database;
  }

  async updateDatabaseSettings(nextDatabaseSettings) {
    const settings = await this.read();
    settings.database = deepMerge(settings.database, nextDatabaseSettings || {});
    await this.write(settings);
    return settings.database;
  }

  async getSetupSettings() {
    const settings = await this.read();
    return settings.setup;
  }

  async updateSetupSettings(nextSetupSettings) {
    const settings = await this.read();
    settings.setup = deepMerge(settings.setup, nextSetupSettings || {});
    await this.write(settings);
    return settings.setup;
  }

  async getPublicAppSettings() {
    const settings = await this.read();
    return {
      completed: Boolean(settings.setup?.completed),
      institute: settings.setup?.institute || {},
      branding: settings.setup?.branding || {},
      defaults: settings.setup?.defaults || {},
      publicLanding: settings.setup?.publicLanding || {},
      dashboardTheme: settings.setup?.dashboardTheme || {}
    };
  }

  async getTelemetryLicensingSettings() {
    const settings = await this.read();
    return settings.telemetryLicensing;
  }

  async updateTelemetryLicensingSettings(nextTelemetrySettings) {
    const settings = await this.read();
    settings.telemetryLicensing = deepMerge(
      settings.telemetryLicensing,
      nextTelemetrySettings || {}
    );
    await this.write(settings);
    return settings.telemetryLicensing;
  }

  async getSmtpSettings() {
    const settings = await this.read();
    return settings.smtp;
  }

  async updateSmtpSettings(nextSmtpSettings) {
    const settings = await this.read();
    settings.smtp = deepMerge(settings.smtp, nextSmtpSettings || {});
    await this.write(settings);
    return settings.smtp;
  }

  async resetToDefaults() {
    const defaults = cloneDefaults();
    await this.write(defaults);
    return defaults;
  }
}

module.exports = new SystemSettingsStore();

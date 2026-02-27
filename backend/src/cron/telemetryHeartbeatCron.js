const cron = require('node-cron');
const { telemetryLicensingService } = require('../services/telemetryLicensingService');
const systemSettingsStore = require('../services/systemSettingsStore');

const CRON_SCHEDULE = process.env.TELEMETRY_HEARTBEAT_CRON_SCHEDULE || '0 * * * *';
const ENABLE_CRON = process.env.ENABLE_TELEMETRY_HEARTBEAT_CRON !== 'false';

class TelemetryHeartbeatCron {
  constructor() {
    this.job = null;
    this.running = false;
  }

  async runHeartbeat(reason = 'scheduled') {
    if (this.running) return null;
    this.running = true;
    try {
      const result = await telemetryLicensingService.syncHeartbeatNow(reason);
      if (!result.ok && !result.skipped) {
        console.error('[TELEMETRY] Heartbeat sync failed:', result.message);
      }
      return result;
    } catch (error) {
      console.error('[TELEMETRY] Heartbeat error:', error.message || error);
      return null;
    } finally {
      this.running = false;
    }
  }

  async start() {
    if (!ENABLE_CRON) {
      console.log('[TELEMETRY] Heartbeat cron disabled by env');
      return;
    }

    if (this.job) {
      console.log('[TELEMETRY] Heartbeat cron already running');
      return;
    }

    await telemetryLicensingService.ensureIdentity();
    const telemetry = await systemSettingsStore.getTelemetryLicensingSettings();
    const timezone = telemetry?.metadata?.timezone || process.env.TZ || 'UTC';

    console.log(`[TELEMETRY] Starting heartbeat cron: ${CRON_SCHEDULE} (${timezone})`);

    this.runHeartbeat('startup');
    this.job = cron.schedule(CRON_SCHEDULE, async () => {
      await this.runHeartbeat('scheduled');
    }, {
      scheduled: true,
      timezone
    });
  }

  stop() {
    if (!this.job) return;
    this.job.stop();
    this.job = null;
  }
}

module.exports = new TelemetryHeartbeatCron();

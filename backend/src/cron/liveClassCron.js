const cron = require('node-cron');
const liveClassCronService = require('../services/liveClassCronService');
const systemSettingsStore = require('../services/systemSettingsStore');

// Configuration
const CRON_SCHEDULE = process.env.LIVE_CLASS_CRON_SCHEDULE || '* * * * *'; // Every 5 minutes
const ENABLE_CRON = process.env.ENABLE_LIVE_CLASS_CRON !== 'false'; // Enabled by default
const getRuntimeTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

class LiveClassCron {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  async logTimezoneSelection() {
    try {
      const setupSettings = await systemSettingsStore.getSetupSettings();
      const appSelectedTimezone = setupSettings?.defaults?.timezone || 'UTC';
      const cronTimezone = process.env.TZ || 'UTC';
      const runtimeTimezone = getRuntimeTimezone();

      console.log(
        `[CRON] LiveClass timezone selection -> app selected: ${appSelectedTimezone}, cron scheduler: ${cronTimezone}, runtime: ${runtimeTimezone}`
      );
    } catch (error) {
      console.warn(
        `[CRON] LiveClass timezone selection unavailable. cron scheduler: ${process.env.TZ || 'UTC'}, runtime: ${getRuntimeTimezone()}, error: ${error.message || error}`
      );
    }
  }

  /**
   * Initialize and start the cron job
   */
  start() {
    if (!ENABLE_CRON) {
      console.log('LiveClass cron job is disabled');
      return;
    }

    if (this.job) {
      console.log('LiveClass cron job is already running');
      return;
    }

    console.log(`Starting LiveClass cron job with schedule: ${CRON_SCHEDULE}`);
    this.logTimezoneSelection().catch(() => undefined);

    this.job = cron.schedule(CRON_SCHEDULE, async () => {
      if (this.isRunning) {
        console.log('Previous LiveClass cron job still running, skipping...');
        return;
      }

      this.isRunning = true;
      const startTime = Date.now();

      try {
        const result = await liveClassCronService.updateLiveClassStatuses();
        const duration = Date.now() - startTime;
        console.log(
          `LiveClass cron job completed in ${duration}ms` +
          ` | scheduled->live: ${result?.transitions?.scheduledToLive?.updated || 0}` +
          ` | scheduled->ended: ${result?.transitions?.scheduledToEnded?.updated || 0}` +
          ` | live->ended: ${result?.transitions?.liveToEnded?.updated || 0}` +
          ` | processed: ${result?.processed || 0}` +
          ` | updated: ${result?.updated || 0}`
        );
      } catch (error) {
        console.error('LiveClass cron job failed:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    });

    // Run immediately on startup
    setTimeout(() => {
      liveClassCronService
        .updateLiveClassStatuses()
        .then((result) => {
          console.log(
            `[CRON] LiveClass startup run completed` +
            ` | scheduled->live: ${result?.transitions?.scheduledToLive?.updated || 0}` +
            ` | scheduled->ended: ${result?.transitions?.scheduledToEnded?.updated || 0}` +
            ` | live->ended: ${result?.transitions?.liveToEnded?.updated || 0}` +
            ` | processed: ${result?.processed || 0}` +
            ` | updated: ${result?.updated || 0}`
          );
        })
        .catch(console.error);
    }, 5000); // Wait 5 seconds after server start
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('LiveClass cron job stopped');
    }
  }

  /**
   * Manually trigger the status update (for testing or admin purposes)
   */
  async triggerManualUpdate() {
    console.log('Manually triggering LiveClass status update...');
    return liveClassCronService.updateLiveClassStatuses();
  }

  /**
   * Get current cron job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: !!this.job,
      schedule: CRON_SCHEDULE,
      enabled: ENABLE_CRON
    };
  }

  /**
   * Get statistics about class statuses
   */
  async getStatistics() {
    return liveClassCronService.getStatusStatistics();
  }
}

// Create singleton instance
const liveClassCron = new LiveClassCron();

module.exports = liveClassCron;

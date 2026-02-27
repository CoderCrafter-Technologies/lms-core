const cron = require('node-cron');
const liveClassCronService = require('../services/liveClassCronService');

// Configuration
const CRON_SCHEDULE = process.env.LIVE_CLASS_CRON_SCHEDULE || '* * * * *'; // Every 5 minutes
const ENABLE_CRON = process.env.ENABLE_LIVE_CLASS_CRON !== 'false'; // Enabled by default

class LiveClassCron {
  constructor() {
    this.job = null;
    this.isRunning = false;
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

    this.job = cron.schedule(CRON_SCHEDULE, async () => {
      if (this.isRunning) {
        console.log('Previous LiveClass cron job still running, skipping...');
        return;
      }

      this.isRunning = true;
      const startTime = Date.now();

      try {
        await liveClassCronService.updateLiveClassStatuses();
        const duration = Date.now() - startTime;
        console.log(`LiveClass cron job completed in ${duration}ms`);
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
      liveClassCronService.updateLiveClassStatuses().catch(console.error);
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
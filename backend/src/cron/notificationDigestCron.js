const cron = require('node-cron');
const notificationDigestService = require('../services/notificationDigestService');

const CRON_SCHEDULE = process.env.NOTIFICATION_DIGEST_CRON_SCHEDULE || '0 * * * *';
const ENABLE_CRON = process.env.ENABLE_NOTIFICATION_DIGEST_CRON !== 'false';

class NotificationDigestCron {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  async runSweep(now = new Date()) {
    if (this.isRunning) return null;
    this.isRunning = true;
    try {
      const result = await notificationDigestService.runDigestSweep(now);
      console.log(
        `Notification digest sweep completed. Users scanned: ${result.scannedUsers}, due: ${result.dueCount}, digests sent: ${result.sentCount}`
      );
      return result;
    } catch (error) {
      console.error('Notification digest sweep failed:', error);
      return null;
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (!ENABLE_CRON) {
      console.log('Notification digest cron is disabled');
      return;
    }

    if (this.job) {
      console.log('Notification digest cron is already running');
      return;
    }

    console.log(`Starting notification digest cron with schedule: ${CRON_SCHEDULE}`);

    // Run once on startup so we do not miss digest windows after downtime.
    this.runSweep(new Date());

    this.job = cron.schedule(CRON_SCHEDULE, async () => {
      await this.runSweep(new Date());
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    });
  }

  stop() {
    if (!this.job) return;
    this.job.stop();
    this.job = null;
  }
}

module.exports = new NotificationDigestCron();

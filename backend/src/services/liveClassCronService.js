const LiveClass = require('../models/LiveClass');
const Enrollment = require('../models/Enrollment');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const User = require('../models/User');
const notificationService = require('./notificationService');
const emailService = require('./emailService');
const { userRepository } = require('../repositories');
const logger = require('../utils/logger');
const { getStudentAttendanceForClass } = require('./liveClassAttendanceService');

class LiveClassCronService {
  constructor() {
    this.isRunning = false;
    this.batchSize = 100;
  }

  async updateLiveClassStatuses() {
    if (this.isRunning) {
      logger.info('LiveClass status update already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const now = new Date();
    let processedCount = 0;
    let updatedCount = 0;

    try {
      logger.info('Starting LiveClass status update cron job...');

      await this.sendClassStartReminders(now);

      const scheduledToLiveResult = await this.updateScheduledToLive(now);
      processedCount += scheduledToLiveResult.processed;
      updatedCount += scheduledToLiveResult.updated;

      const liveToEndedResult = await this.updateLiveToEnded(now);
      processedCount += liveToEndedResult.processed;
      updatedCount += liveToEndedResult.updated;

      await this.processMissedClassNotifications(now);

      logger.info(`LiveClass status update completed. Processed: ${processedCount}, Updated: ${updatedCount}`);
    } catch (error) {
      logger.error('Error in LiveClass status update cron job:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async sendClassStartReminders(now) {
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    const classes = await LiveClass.find({
      status: 'SCHEDULED',
      scheduledStartTime: { $gte: now, $lte: fiveMinutesFromNow },
      'notificationState.startReminderSentAt': null
    })
      .select('_id title batchId instructorId scheduledStartTime roomId')
      .lean();

    for (const cls of classes) {
      try {
        const enrollments = await Enrollment.find({
          batchId: cls.batchId,
          status: 'ENROLLED'
        }).select('studentId').lean();

        const batch = await Batch.findById(cls.batchId).select('name courseId').lean();
        const course = batch?.courseId
          ? await Course.findById(batch.courseId).select('title').lean()
          : null;

        const recipientIds = [
          cls.instructorId?.toString(),
          ...enrollments.map((enrollment) => enrollment.studentId?.toString())
        ].filter(Boolean);

        await notificationService.createForUsers(recipientIds, {
          type: 'CLASS_STARTING_SOON',
          title: 'Class starts in 5 minutes',
          message: `${cls.title} is starting soon. Join your class room now.`,
          priority: 'high',
          data: {
            classId: cls._id.toString(),
            batchId: cls.batchId?.toString(),
            roomId: cls.roomId,
            scheduledStartTime: cls.scheduledStartTime
          }
        });

        const emailRecipients = await User.find(
          { _id: { $in: recipientIds }, isActive: true },
          { email: 1, firstName: 1, lastName: 1 }
        ).lean();

        for (const recipient of emailRecipients) {
          try {
            await emailService.sendClassReminderEmail(recipient, cls, batch, course);
          } catch (emailError) {
            logger.error(`Failed email reminder for class ${cls._id} user ${recipient._id}:`, emailError);
          }
        }

        await LiveClass.updateOne(
          { _id: cls._id },
          { $set: { 'notificationState.startReminderSentAt': now } }
        );
      } catch (error) {
        logger.error(`Failed sending class reminder for class ${cls._id}:`, error);
      }
    }
  }

  async processMissedClassNotifications(now) {
    const endedClasses = await LiveClass.find({
      status: 'ENDED',
      scheduledEndTime: { $lte: now },
      'notificationState.missedClassProcessedAt': null
    })
      .select('_id title batchId instructorId attendees attendanceRecords roomId scheduledStartTime scheduledEndTime actualStartTime actualEndTime status')
      .lean();

    if (endedClasses.length === 0) return;

    const adminManagerUsers = await userRepository.find({}, {
      populate: { path: 'roleId', select: 'name' },
      select: 'isActive roleId'
    });

    const adminManagerIds = adminManagerUsers
      .filter((user) => user.isActive && ['ADMIN', 'MANAGER'].includes(user.roleId?.name))
      .map((user) => user.id?.toString())
      .filter(Boolean);

    for (const cls of endedClasses) {
      try {
        const enrollments = await Enrollment.find({
          batchId: cls.batchId,
          status: 'ENROLLED'
        }).select('_id studentId attendance').lean();

        const bulkOps = [];
        const missedStudentIds = [];
        let attendedCount = 0;

        for (const enrollment of enrollments) {
          const attendance = getStudentAttendanceForClass(cls, enrollment.studentId);
          const isPresent = attendance.attendanceStatus === 'PRESENT';
          const isLeftEarly = attendance.attendanceStatus === 'LEFT_EARLY';
          const isCountedAttended = isPresent || isLeftEarly;

          if (isCountedAttended) {
            attendedCount += 1;
          } else {
            missedStudentIds.push(enrollment.studentId.toString());
          }

          const nextTotalClasses = (enrollment.attendance?.totalClasses || 0) + 1;
          const nextAttendedClasses = (enrollment.attendance?.attendedClasses || 0) + (isPresent ? 1 : 0);
          const nextAttendancePercentage = nextTotalClasses > 0
            ? Math.round((nextAttendedClasses / nextTotalClasses) * 100)
            : 0;

          bulkOps.push({
            updateOne: {
              filter: { _id: enrollment._id },
              update: {
                $set: {
                  'attendance.totalClasses': nextTotalClasses,
                  'attendance.attendedClasses': nextAttendedClasses,
                  'attendance.attendancePercentage': nextAttendancePercentage
                }
              }
            }
          });
        }

        if (bulkOps.length > 0) {
          await Enrollment.bulkWrite(bulkOps);
        }

        if (missedStudentIds.length > 0) {
          await notificationService.createForUsers(missedStudentIds, {
            type: 'CLASS_MISSED',
            title: 'Missed live class',
            message: `You missed ${cls.title}. Check recording/resources if available.`,
            priority: 'high',
            data: {
              classId: cls._id.toString(),
              roomId: cls.roomId,
              batchId: cls.batchId?.toString(),
              scheduledStartTime: cls.scheduledStartTime,
              scheduledEndTime: cls.scheduledEndTime
            }
          });
        }

        const instructorRecipientIds = [cls.instructorId?.toString(), ...adminManagerIds].filter(Boolean);
        await notificationService.createForUsers(instructorRecipientIds, {
          type: 'CLASS_MISSED',
          title: 'Class attendance summary',
          message: `${cls.title}: ${attendedCount}/${enrollments.length} attended, ${missedStudentIds.length} missed.`,
          priority: 'normal',
          data: {
            classId: cls._id.toString(),
            batchId: cls.batchId?.toString(),
            attendedCount,
            missedCount: missedStudentIds.length,
            totalEnrolled: enrollments.length
          }
        });

        await LiveClass.updateOne(
          { _id: cls._id },
          { $set: { 'notificationState.missedClassProcessedAt': now } }
        );
      } catch (error) {
        logger.error(`Failed missed-class processing for class ${cls._id}:`, error);
      }
    }
  }

  async updateScheduledToLive(now) {
    let processed = 0;
    let updated = 0;
    let lastId = null;
    let hasMore = true;

    while (hasMore) {
      const query = {
        status: 'SCHEDULED',
        scheduledStartTime: { $lte: now },
        scheduledEndTime: { $gt: now }
      };

      if (lastId) {
        query._id = { $gt: lastId };
      }

      const classes = await LiveClass.find(query)
        .select('_id status scheduledStartTime scheduledEndTime actualStartTime')
        .sort({ _id: 1 })
        .limit(this.batchSize)
        .lean();

      if (classes.length === 0) {
        hasMore = false;
        break;
      }

      for (const cls of classes) {
        try {
          const updateData = {
            status: 'LIVE'
          };

          if (!cls.actualStartTime) {
            updateData.actualStartTime = now;
          }

          const updateResult = await LiveClass.updateOne(
            { _id: cls._id },
            { $set: updateData }
          );

          if (updateResult.modifiedCount > 0) {
            updated += 1;
          }
        } catch (error) {
          logger.error(`Error updating class ${cls._id}:`, error);
        }
      }

      processed += classes.length;
      lastId = classes[classes.length - 1]._id;

      if (hasMore && classes.length === this.batchSize) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return { processed, updated };
  }

  async updateLiveToEnded(now) {
    let processed = 0;
    let updated = 0;
    let lastId = null;
    let hasMore = true;

    while (hasMore) {
      const query = {
        status: 'LIVE',
        scheduledEndTime: { $lte: now }
      };

      if (lastId) {
        query._id = { $gt: lastId };
      }

      const classes = await LiveClass.find(query)
        .select('_id status scheduledEndTime actualEndTime')
        .sort({ _id: 1 })
        .limit(this.batchSize)
        .lean();

      if (classes.length === 0) {
        hasMore = false;
        break;
      }

      for (const cls of classes) {
        try {
          const updateData = {
            status: 'ENDED'
          };

          if (!cls.actualEndTime) {
            updateData.actualEndTime = now;
          }

          const updateResult = await LiveClass.updateOne(
            { _id: cls._id },
            { $set: updateData }
          );

          if (updateResult.modifiedCount > 0) {
            updated += 1;
          }
        } catch (error) {
          logger.error(`Error updating class ${cls._id}:`, error);
        }
      }

      processed += classes.length;
      lastId = classes[classes.length - 1]._id;

      if (hasMore && classes.length === this.batchSize) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return { processed, updated };
  }

  async getStatusStatistics() {
    const now = new Date();

    const stats = await LiveClass.aggregate([
      {
        $facet: {
          statusCounts: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          shouldBeLive: [
            {
              $match: {
                status: 'SCHEDULED',
                scheduledStartTime: { $lte: now },
                scheduledEndTime: { $gt: now }
              }
            },
            { $count: 'count' }
          ],
          shouldBeEnded: [
            {
              $match: {
                status: 'LIVE',
                scheduledEndTime: { $lte: now }
              }
            },
            { $count: 'count' }
          ],
          totalClasses: [
            { $count: 'count' }
          ]
        }
      }
    ]);

    return {
      statusCounts: stats[0].statusCounts,
      needUpdate: {
        toLive: stats[0].shouldBeLive[0]?.count || 0,
        toEnded: stats[0].shouldBeEnded[0]?.count || 0
      },
      total: stats[0].totalClasses[0]?.count || 0
    };
  }
}

const liveClassCronService = new LiveClassCronService();

module.exports = liveClassCronService;

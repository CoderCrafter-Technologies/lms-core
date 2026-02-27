const LiveClass = require('../models/LiveClass');
const {
  toCanonicalTimezone,
  parseDateInput,
  addDaysToDateParts,
  compareDateParts,
  getDayNameForDateParts,
  zonedDateTimeToUtc
} = require('./timezone');

function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const classScheduler = async (batchData) => {
  try {
    const startDate = parseDateInput(batchData.startDate);
    const endDate = parseDateInput(batchData.endDate);
    const timezone = toCanonicalTimezone(batchData?.schedule?.timezone) || 'UTC';

    if (!startDate || !endDate) {
      throw new Error('Invalid batch start/end date for class scheduling');
    }

    const classDays = batchData?.schedule?.days || [];
    const [startHour, startMinute] = String(batchData?.schedule?.startTime || '00:00').split(':').map(Number);
    const [endHour, endMinute] = String(batchData?.schedule?.endTime || '00:00').split(':').map(Number);

    const liveClasses = [];
    let currentDate = { ...startDate };
    let classIndex = 0;

    while (compareDateParts(currentDate, endDate) <= 0) {
      const dayName = getDayNameForDateParts(currentDate);

      if (classDays.includes(dayName)) {
        const classStart = zonedDateTimeToUtc(
          {
            year: currentDate.year,
            month: currentDate.month,
            day: currentDate.day,
            hour: startHour,
            minute: startMinute
          },
          timezone
        );

        let classEnd = zonedDateTimeToUtc(
          {
            year: currentDate.year,
            month: currentDate.month,
            day: currentDate.day,
            hour: endHour,
            minute: endMinute
          },
          timezone
        );

        if (classEnd <= classStart) {
          classEnd = new Date(classEnd.getTime() + 24 * 60 * 60 * 1000);
        }

        liveClasses.push({
          title: `${batchData.name} - Class ${classIndex + 1}`,
          roomId: generateRoomId(),
          description: `Live class for ${batchData.name}`,
          batchId: batchData.id || batchData._id,
          courseId: batchData.courseId,
          scheduledStartTime: classStart,
          scheduledEndTime: classEnd,
          status: 'SCHEDULED',
          instructorId: batchData.instructorId,
          createdBy: batchData.createdBy,
          stats: {
            totalParticipants: 0,
            peakParticipants: 0,
            averageParticipants: 0,
            totalChatMessages: 0
          },
          recording: {
            isRecorded: false,
            recordingUrl: null,
            recordingId: null,
            recordingSize: 0,
            recordingDuration: 0
          },
          settings: {
            allowRecording: Boolean(batchData?.settings?.recordClasses),
            allowChat: Boolean(batchData?.settings?.allowStudentChat),
            allowLateJoin: Boolean(batchData?.settings?.allowLateJoin)
          }
        });

        classIndex += 1;
      }

      currentDate = addDaysToDateParts(currentDate, 1);
    }

    if (liveClasses.length > 0) {
      await LiveClass.insertMany(liveClasses);
    }
  } catch (err) {
    console.error('Class Scheduler Failed:', err);
    throw err;
  }
};

module.exports = {
  classScheduler
};

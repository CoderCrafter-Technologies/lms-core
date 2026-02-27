const mongoose = require('mongoose');

const pastEnrollmentSchema = new mongoose.Schema({
  originalEnrollmentId: {
    type: String,
    required: true,
    index: true
  },
  deletedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  deletedBy: {
    type: String,
    default: null
  },
  deleteReason: {
    type: String,
    default: 'COURSE_DELETED'
  },
  student: {
    id: String,
    firstName: String,
    lastName: String,
    email: String,
    phone: String
  },
  course: {
    id: String,
    title: String,
    slug: String,
    category: String,
    level: String,
    status: String
  },
  batch: {
    id: String,
    name: String,
    batchCode: String,
    startDate: Date,
    endDate: Date,
    schedule: {
      days: [String],
      startTime: String,
      endTime: String,
      timezone: String
    },
    status: String,
    instructorId: String
  },
  enrolledBy: {
    id: String,
    firstName: String,
    lastName: String,
    email: String
  },
  enrollmentDate: Date,
  status: String,
  progress: {
    completedClasses: Number,
    totalClasses: Number,
    completionPercentage: Number
  },
  attendance: {
    totalClasses: Number,
    attendedClasses: Number,
    attendancePercentage: Number
  },
  grades: mongoose.Schema.Types.Mixed,
  payment: mongoose.Schema.Types.Mixed,
  completedAt: Date,
  certificate: mongoose.Schema.Types.Mixed,
  notes: String,
  enrollmentSnapshot: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

pastEnrollmentSchema.index({ 'course.id': 1, deletedAt: -1 });
pastEnrollmentSchema.index({ 'batch.id': 1, deletedAt: -1 });
pastEnrollmentSchema.index({ 'student.id': 1, deletedAt: -1 });


module.exports = mongoose.model('PastEnrollment', pastEnrollmentSchema);




const mongoose = require('mongoose');

// PostgreSQL equivalent: enrollments table
const enrollmentSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
    // PostgreSQL: id SERIAL PRIMARY KEY
  },
  
  // Student reference (Foreign Key)
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
    // PostgreSQL: student_id INTEGER REFERENCES users(id)
  },
  
  // Course reference (Foreign Key)
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
    // PostgreSQL: course_id INTEGER REFERENCES courses(id)
  },
  
  // Batch reference (Foreign Key)
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    index: true
    // PostgreSQL: batch_id INTEGER REFERENCES batches(id)
  },
  
  // Enrollment details
  enrollmentDate: {
    type: Date,
    default: Date.now,
    index: true
    // PostgreSQL: enrollment_date TIMESTAMP DEFAULT NOW()
  },
  
  // Enrollment status
  status: {
    type: String,
    enum: ['ENROLLED', 'COMPLETED', 'DROPPED', 'SUSPENDED'],
    default: 'ENROLLED'
    // PostgreSQL: status VARCHAR(20) DEFAULT 'ENROLLED'
  },
  
  // Progress tracking
  progress: {
    completedClasses: {
      type: Number,
      default: 0,
      min: 0
      // PostgreSQL: completed_classes INTEGER DEFAULT 0
    },
    totalClasses: {
      type: Number,
      default: 0,
      min: 0
      // PostgreSQL: total_classes INTEGER DEFAULT 0
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
      // PostgreSQL: completion_percentage DECIMAL(5,2) DEFAULT 0
    }
  },
  
  // Attendance tracking
  attendance: {
    totalClasses: {
      type: Number,
      default: 0
      // PostgreSQL: total_classes_attended INTEGER DEFAULT 0
    },
    attendedClasses: {
      type: Number,
      default: 0
      // PostgreSQL: attended_classes INTEGER DEFAULT 0
    },
    attendancePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
      // PostgreSQL: attendance_percentage DECIMAL(5,2) DEFAULT 0
    }
  },
  
  // Grades and assessment
  grades: {
    assignments: [{
      title: String,
      score: Number,
      maxScore: Number,
      submittedAt: Date
      // PostgreSQL: Separate assignment_grades table
    }],
    finalGrade: {
      type: String,
      enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'INCOMPLETE'],
      default: null
      // PostgreSQL: final_grade VARCHAR(10)
    },
    finalScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100
      // PostgreSQL: final_score DECIMAL(5,2)
    }
  },
  
  // Payment information (if applicable)
  payment: {
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'OVERDUE', 'WAIVED'],
      default: 'PENDING'
      // PostgreSQL: payment_status VARCHAR(20) DEFAULT 'PENDING'
    },
    amount: {
      type: Number,
      default: 0
      // PostgreSQL: payment_amount DECIMAL(10,2) DEFAULT 0
    },
    paidAt: {
      type: Date,
      default: null
      // PostgreSQL: paid_at TIMESTAMP
    },
    transactionId: {
      type: String,
      default: null
      // PostgreSQL: transaction_id VARCHAR(100)
    }
  },
  
  // Completion details
  completedAt: {
    type: Date,
    default: null
    // PostgreSQL: completed_at TIMESTAMP
  },
  
  // Certificate information
  certificate: {
    issued: {
      type: Boolean,
      default: false
      // PostgreSQL: certificate_issued BOOLEAN DEFAULT FALSE
    },
    issuedAt: {
      type: Date,
      default: null
      // PostgreSQL: certificate_issued_at TIMESTAMP
    },
    certificateUrl: {
      type: String,
      default: null
      // PostgreSQL: certificate_url VARCHAR(500)
    }
  },
  
  // Notes and comments
  notes: {
    type: String,
    default: ''
    // PostgreSQL: notes TEXT
  },
  
  // Enrollment by (admin who enrolled the student)
  enrolledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // PostgreSQL: enrolled_by INTEGER REFERENCES users(id)
  }
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

// Compound indexes for performance
enrollmentSchema.index({ studentId: 1, status: 1 });
enrollmentSchema.index({ courseId: 1, status: 1 });
enrollmentSchema.index({ batchId: 1, status: 1 });
enrollmentSchema.index({ enrollmentDate: -1 });
enrollmentSchema.index({ 'payment.status': 1 });

// Virtual for progress percentage
enrollmentSchema.virtual('progressPercentage').get(function() {
  if (this.progress.totalClasses === 0) return 0;
  return Math.round((this.progress.completedClasses / this.progress.totalClasses) * 100);
});

// Virtual for attendance percentage
enrollmentSchema.virtual('attendancePercentage').get(function() {
  if (this.attendance.totalClasses === 0) return 0;
  return Math.round((this.attendance.attendedClasses / this.attendance.totalClasses) * 100);
});

// Virtual for enrollment duration
enrollmentSchema.virtual('enrollmentDuration').get(function() {
  const now = this.completedAt || new Date();
  const diffTime = Math.abs(now - this.enrollmentDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for overall grade
enrollmentSchema.virtual('overallGrade').get(function() {
  if (this.grades.finalScore === null) return 'Not graded';
  
  const score = this.grades.finalScore;
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
});

// Pre-save middleware
enrollmentSchema.pre('save', function(next) {
  // Update progress percentage
  if (this.progress.totalClasses > 0) {
    this.progress.completionPercentage = Math.round(
      (this.progress.completedClasses / this.progress.totalClasses) * 100
    );
  }
  
  // Update attendance percentage
  if (this.attendance.totalClasses > 0) {
    this.attendance.attendancePercentage = Math.round(
      (this.attendance.attendedClasses / this.attendance.totalClasses) * 100
    );
  }
  
  // Set completed date when status changes to completed
  if (this.isModified('status') && this.status === 'COMPLETED' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Static methods
enrollmentSchema.statics.findByStudent = function(studentId) {
  return this.find({ studentId })
    .populate('courseId', 'title category level')
    .populate('batchId', 'name batchCode startDate endDate')
    .sort({ enrollmentDate: -1 });
};

enrollmentSchema.statics.findByCourse = function(courseId) {
  return this.find({ courseId })
    .populate('studentId', 'firstName lastName email')
    .populate('batchId', 'name batchCode')
    .sort({ enrollmentDate: -1 });
};

enrollmentSchema.statics.findByBatch = function(batchId) {
  return this.find({ batchId })
    .populate('studentId', 'firstName lastName email phone avatar')
    .populate('courseId', 'title')
    .sort({ enrollmentDate: -1 });
};

enrollmentSchema.statics.findActiveEnrollments = function() {
  return this.find({ status: 'ENROLLED' })
    .populate('studentId', 'firstName lastName email')
    .populate('courseId', 'title')
    .populate('batchId', 'name batchCode');
};

// Instance methods
enrollmentSchema.methods.updateProgress = function(completedClasses, totalClasses) {
  this.progress.completedClasses = completedClasses;
  this.progress.totalClasses = totalClasses;
  this.progress.completionPercentage = totalClasses > 0 ? 
    Math.round((completedClasses / totalClasses) * 100) : 0;
  return this.save();
};

enrollmentSchema.methods.updateAttendance = function(attendedClasses, totalClasses) {
  this.attendance.attendedClasses = attendedClasses;
  this.attendance.totalClasses = totalClasses;
  this.attendance.attendancePercentage = totalClasses > 0 ? 
    Math.round((attendedClasses / totalClasses) * 100) : 0;
  return this.save();
};

enrollmentSchema.methods.addGrade = function(assignmentTitle, score, maxScore) {
  this.grades.assignments.push({
    title: assignmentTitle,
    score: score,
    maxScore: maxScore,
    submittedAt: new Date()
  });
  
  // Calculate average score for final grade
  const totalScore = this.grades.assignments.reduce((sum, grade) => sum + grade.score, 0);
  const totalMaxScore = this.grades.assignments.reduce((sum, grade) => sum + grade.maxScore, 0);
  
  if (totalMaxScore > 0) {
    this.grades.finalScore = Math.round((totalScore / totalMaxScore) * 100);
    this.grades.finalGrade = this.overallGrade;
  }
  
  return this.save();
};

enrollmentSchema.methods.completeEnrollment = function() {
  this.status = 'COMPLETED';
  this.completedAt = new Date();
  return this.save();
};

enrollmentSchema.methods.issueCertificate = function(certificateUrl) {
  this.certificate.issued = true;
  this.certificate.issuedAt = new Date();
  this.certificate.certificateUrl = certificateUrl;
  return this.save();
};


const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

module.exports = Enrollment;




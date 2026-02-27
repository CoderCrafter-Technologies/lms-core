const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  answer: mongoose.Schema.Types.Mixed, // Can be string, array, number, etc.
  timeSpent: Number, // in seconds
  isCorrect: Boolean,
  points: Number,
  feedback: String
}, { _id: false });

const assessmentSubmissionSchema = new mongoose.Schema({
  assessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  enrollmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment',
    required: true
  },
  
  // Attempt information
  attemptNumber: {
    type: Number,
    required: true,
    default: 1
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  revisionNumber: {
    type: Number,
    default: 0
  },
  revisionOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssessmentSubmission',
    default: null
  },
  
  // Timing
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  abandonedAt: Date,
  expiresAt: Date,
  timeLimit: Number, // in minutes, copied from assessment at submission time
  timeSpent: Number, // in seconds
  
  // Answers
  answers: [answerSchema],
  
  // Scoring
  scoring: {
    totalQuestions: Number,
    answeredQuestions: Number,
    correctAnswers: Number,
    totalPoints: Number,
    earnedPoints: Number,
    percentage: Number,
    grade: String, // A, B, C, D, F or custom
    isPassed: Boolean
  },
  
  // Status
  status: {
    type: String,
    enum: ['in-progress', 'submitted', 'graded', 'late', 'incomplete', 'abandoned'],
    default: 'in-progress'
  },
  
  // Flags
  flags: {
    isLate: Boolean,
    hasViolations: Boolean,
    needsReview: Boolean,
    isExcused: Boolean
  },
  
  // Violations and monitoring
  violations: [{
    type: {
      type: String,
      enum: ['tab-switch', 'copy-paste', 'right-click', 'fullscreen-exit', 'time-exceeded', 'multiple-devices']
    },
    timestamp: Date,
    details: String
  }],
  
  // Device/browser info
  deviceInfo: {
    userAgent: String,
    ipAddress: String,
    screenResolution: String,
    timezone: String
  },
  
  // Instructor feedback
  feedback: {
    overallComments: String,
    questionComments: [{
      questionId: String,
      comment: String,
      points: Number
    }],
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    gradedAt: Date
  },

  rubricScores: [{
    criterionId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    maxPoints: {
      type: Number,
      default: 0
    },
    earnedPoints: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      default: ''
    }
  }],

  gradeOverride: {
    isOverridden: {
      type: Boolean,
      default: false
    },
    points: {
      type: Number,
      default: null
    },
    percentage: {
      type: Number,
      default: null
    },
    reason: {
      type: String,
      default: ''
    },
    overriddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    overriddenAt: {
      type: Date,
      default: null
    }
  },

  latePolicyApplied: {
    isLate: {
      type: Boolean,
      default: false
    },
    lateByMinutes: {
      type: Number,
      default: 0
    },
    penaltyPercent: {
      type: Number,
      default: 0
    },
    penaltyPoints: {
      type: Number,
      default: 0
    },
    pointsBeforePenalty: {
      type: Number,
      default: 0
    },
    pointsAfterPenalty: {
      type: Number,
      default: 0
    }
  },

  plagiarismReport: {
    status: {
      type: String,
      enum: ['not-requested', 'pending', 'checked', 'flagged', 'error'],
      default: 'not-requested'
    },
    provider: {
      type: String,
      default: ''
    },
    similarityScore: {
      type: Number,
      default: null
    },
    flagged: {
      type: Boolean,
      default: false
    },
    reportUrl: {
      type: String,
      default: ''
    },
    details: {
      type: String,
      default: ''
    },
    checkedAt: {
      type: Date,
      default: null
    }
  },

  revisionRequest: {
    requested: {
      type: Boolean,
      default: false
    },
    requestedAt: {
      type: Date,
      default: null
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    dueAt: {
      type: Date,
      default: null
    },
    reason: {
      type: String,
      default: ''
    }
  },
  
  // Files (for essay questions or assignments)
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    uploadedAt: Date
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
assessmentSubmissionSchema.index({ studentId: 1, status: 1 });
assessmentSubmissionSchema.index({ assessmentId: 1, status: 1 });
assessmentSubmissionSchema.index({ enrollmentId: 1 });
assessmentSubmissionSchema.index({ startedAt: 1 });
assessmentSubmissionSchema.index({ completedAt: 1 });
assessmentSubmissionSchema.index({ revisionOf: 1 });
assessmentSubmissionSchema.index({ 'gradeOverride.isOverridden': 1 });
assessmentSubmissionSchema.index({ 'plagiarismReport.flagged': 1 });

// Virtual for duration in a readable format
assessmentSubmissionSchema.virtual('durationFormatted').get(function() {
  if (!this.timeSpent) return '0 minutes';
  
  const hours = Math.floor(this.timeSpent / 3600);
  const minutes = Math.floor((this.timeSpent % 3600) / 60);
  const seconds = this.timeSpent % 60;
  
  let duration = '';
  if (hours > 0) duration += `${hours}h `;
  if (minutes > 0) duration += `${minutes}m `;
  if (seconds > 0 && hours === 0) duration += `${seconds}s`;
  
  return duration.trim() || '0 seconds';
});

// Virtual for remaining time
assessmentSubmissionSchema.virtual('remainingTime').get(function() {
  if (!this.timeLimit || this.isCompleted) return null;
  
  const elapsedMinutes = Math.floor((Date.now() - this.startedAt) / (1000 * 60));
  const remaining = this.timeLimit - elapsedMinutes;
  
  return Math.max(0, remaining);
});

// Pre-save middleware to calculate scoring
assessmentSubmissionSchema.pre('save', function(next) {
  if (this.isModified('answers') || this.isModified('isCompleted')) {
    this.scoring.answeredQuestions = this.answers.length;
    this.scoring.correctAnswers = this.answers.filter(answer => answer.isCorrect).length;
    this.scoring.earnedPoints = this.answers.reduce((total, answer) => total + (answer.points || 0), 0);
    
    if (this.scoring.totalPoints > 0) {
      this.scoring.percentage = Math.round((this.scoring.earnedPoints / this.scoring.totalPoints) * 100);
    }
    
    // Determine pass/fail (this could be more sophisticated)
    const passingPercentage = 60; // This should come from assessment settings
    this.scoring.isPassed = this.scoring.percentage >= passingPercentage;
    
    // Assign letter grade
    if (this.scoring.percentage >= 90) this.scoring.grade = 'A';
    else if (this.scoring.percentage >= 80) this.scoring.grade = 'B';
    else if (this.scoring.percentage >= 70) this.scoring.grade = 'C';
    else if (this.scoring.percentage >= 60) this.scoring.grade = 'D';
    else this.scoring.grade = 'F';
  }
  
  // Set completion time
  if (this.isModified('isCompleted') && this.isCompleted && !this.completedAt) {
    this.completedAt = new Date();
    this.timeSpent = Math.floor((this.completedAt - this.startedAt) / 1000);
    this.status = 'submitted';
  }
  
  next();
});


module.exports = mongoose.model('AssessmentSubmission', assessmentSubmissionSchema);




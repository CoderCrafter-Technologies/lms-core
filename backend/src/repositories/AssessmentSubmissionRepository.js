const BaseRepository = require('./BaseRepository');
const { AssessmentSubmission } = require('../models');
const { buildExecutableCode } = require('../utils/codingRunner');
const { executeCode: executeWithCompiler } = require('../services/codeExecutionService');

const toLetterGrade = (percentage = 0) => {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
};

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));

class AssessmentSubmissionRepository extends BaseRepository {
  constructor() {
    super(AssessmentSubmission);
  }

  async findByStudent(studentId, options = {}) {
    const defaultOptions = {
      populate: [
        { 
          path: 'assessmentId', 
          select: 'title type grading.totalPoints schedule.endDate',
          populate: { path: 'courseId', select: 'title' }
        },
        { path: 'studentId', select: 'firstName lastName email' }
      ],
      sort: { startedAt: -1 }
    };

    return this.find({ studentId }, { ...defaultOptions, ...options });
  }

  async findByAssessment(assessmentId, options = {}) {
    const defaultOptions = {
      populate: [
        { path: 'studentId', select: 'firstName lastName email' },
        { path: 'enrollmentId', select: 'enrollmentDate' }
      ],
      sort: { startedAt: -1 }
    };

    return this.find({ assessmentId }, { ...defaultOptions, ...options });
  }

  async findStudentAttempts(assessmentId, studentId) {
    return this.find(
      { assessmentId, studentId },
      {
        sort: { attemptNumber: 1 },
        populate: [{ path: 'assessmentId', select: 'title settings.attempts' }]
      }
    );
  }

  async getLatestAttempt(assessmentId, studentId) {
    return this.findOne(
      { assessmentId, studentId },
      {
        sort: { attemptNumber: -1 },
        populate: [{ path: 'assessmentId', select: 'title settings' }]
      }
    );
  }

  async getBestAttempt(assessmentId, studentId) {
    return this.findOne(
      { assessmentId, studentId, isCompleted: true },
      {
        sort: { 'scoring.percentage': -1, completedAt: 1 },
        populate: [{ path: 'assessmentId', select: 'title' }]
      }
    );
  }

  async findActiveSubmission(assessmentId, studentId) {
    return this.findOne({
      assessmentId,
      studentId,
      status: 'in-progress'
    });
  }

  async createNewAttempt(assessmentId, studentId, enrollmentId, timeLimit) {
    // Check for any existing active submissions first and clean them up
    const activeSubmission = await this.findOne({
      assessmentId,
      studentId,
      status: 'in-progress'
    });
    
    if (activeSubmission) {
      // Mark as abandoned if it exists
      activeSubmission.status = 'abandoned';
      activeSubmission.abandonedAt = new Date();
      await activeSubmission.save();
    }

    // Get the next attempt number
    const existingAttempts = await this.find({ assessmentId, studentId });
    const attemptNumber = existingAttempts.length + 1;

    const submissionData = {
      assessmentId,
      studentId,
      enrollmentId,
      attemptNumber,
      startedAt: new Date(),
      status: 'in-progress'
    };

    // Only add timeLimit if it exists
    if (timeLimit) {
      submissionData.timeLimit = timeLimit;
      submissionData.expiresAt = new Date(Date.now() + timeLimit * 60000); // timeLimit in minutes
    }

    const submission = new this.model(submissionData);
    return submission.save();
  }

  async submitAssessment(submissionId, answers, deviceInfo = {}) {
    const submission = await AssessmentSubmission.findById(submissionId).populate('assessmentId');
    if (!submission) {
      throw new Error('Submission not found');
    }

    if (!answers || !Array.isArray(answers)) {
      throw new Error('Invalid answers format');
    }

    // Ensure answers are properly formatted
    const formattedAnswers = answers.map(answer => ({
      questionId: answer.questionId,
      answer: answer.answer,
      timestamp: answer.timestamp || new Date()
    }));

    submission.answers = formattedAnswers;
    submission.isCompleted = true;
    submission.completedAt = new Date();
    submission.deviceInfo = { ...submission.deviceInfo, ...deviceInfo };

    const assessment = submission.assessmentId;
    const isScheduled = Boolean(assessment?.schedule?.isScheduled && assessment?.schedule?.endDate);
    const assessmentEnd = isScheduled ? new Date(assessment.schedule.endDate) : null;

    let isLate = false;
    let lateByMinutes = 0;
    if (assessmentEnd && submission.completedAt > assessmentEnd) {
      isLate = true;
      lateByMinutes = Math.max(0, Math.ceil((submission.completedAt - assessmentEnd) / 60000));
    }

    const latePolicy = assessment?.settings?.latePolicy || { mode: 'allow' };
    if (isLate && latePolicy.mode === 'disallow') {
      throw new Error('Late submissions are not allowed for this assessment');
    }

    if (isLate && latePolicy.mode === 'grace-period' && lateByMinutes <= Number(latePolicy.graceMinutes || 0)) {
      isLate = false;
      lateByMinutes = 0;
    }

    submission.flags = {
      ...submission.flags,
      isLate
    };
    submission.status = isLate ? 'late' : 'submitted';
    submission.latePolicyApplied = {
      ...submission.latePolicyApplied,
      isLate,
      lateByMinutes,
      penaltyPercent: 0,
      penaltyPoints: 0,
      pointsBeforePenalty: 0,
      pointsAfterPenalty: 0
    };

    const savedSubmission = await submission.save();

    return savedSubmission;
  }

  async addViolation(submissionId, violationType, details) {
    return this.updateById(submissionId, {
      $push: {
        violations: {
          type: violationType,
          timestamp: new Date(),
          details
        }
      },
      $set: {
        'flags.hasViolations': true
      }
    });
  }

  async updateProgress(submissionId, questionId, answer, timeSpent) {
    const submission = await AssessmentSubmission.findById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }
    if (!questionId || typeof questionId !== 'string') {
      throw new Error('Question ID is required');
    }

    // Recover from previously corrupted entries where questionId was missing.
    if (Array.isArray(submission.answers) && submission.answers.length > 0) {
      submission.answers = submission.answers.filter((entry) => entry && entry.questionId);
    }

    // Find existing answer or create new one
    const existingAnswerIndex = submission.answers.findIndex(a => a.questionId === questionId);
    
    if (existingAnswerIndex >= 0) {
      submission.answers[existingAnswerIndex].answer = answer;
      if (timeSpent !== undefined) {
        submission.answers[existingAnswerIndex].timeSpent = timeSpent;
      }
    } else {
      const newAnswer = {
        questionId,
        answer
      };
      if (timeSpent !== undefined) {
        newAnswer.timeSpent = timeSpent;
      }
      submission.answers.push(newAnswer);
    }

    return submission.save();
  }

  async gradeSubmission(submissionId, feedback, gradedBy) {
    const submission = await AssessmentSubmission.findById(submissionId)
      .populate('assessmentId');

    if (!submission) {
      throw new Error('Submission not found');
    }

    if (!submission.answers || !Array.isArray(submission.answers)) {
      throw new Error(`Submission has no answers to grade. Found: ${typeof submission.answers}, Length: ${submission.answers?.length || 'undefined'}`);
    }

    if (submission.answers.length === 0) {
      throw new Error('Submission has empty answers array');
    }

    // Auto-grade what can be auto-graded
    const assessment = submission.assessmentId;
    if (!assessment || !assessment.questions) {
      throw new Error('Assessment or questions not found');
    }

    let totalEarnedPoints = 0;
    let correctAnswers = 0;

    for (let index = 0; index < submission.answers.length; index += 1) {
      const answer = submission.answers[index];

      const question = assessment.questions.find(q => {
        return q.id === answer.questionId;
      });
      
      if (!question) {
        continue;
      }

      let isCorrect = false;
      let points = 0;

      // Auto-grading logic based on question type
      switch (question.type) {
        case 'multiple-choice':
          const correctOption = question.options?.find(opt => opt.isCorrect);
          const submittedValue = String(answer.answer ?? '').trim();
          const normalizedSubmitted = submittedValue.toLowerCase();
          const normalizedCorrectOptionText = String(correctOption?.text ?? '').trim().toLowerCase();
          const normalizedQuestionCorrectAnswer = String(question.correctAnswer ?? '').trim().toLowerCase();
          // Backward-compatible check: support both option-id and option-text based submissions.
          isCorrect = Boolean(
            submittedValue &&
            (
              submittedValue === correctOption?.id ||
              normalizedSubmitted === normalizedCorrectOptionText ||
              normalizedSubmitted === normalizedQuestionCorrectAnswer
            )
          );
          points = isCorrect ? question.points : 0;
          break;

        case 'true-false':
          isCorrect = answer.answer === question.correctAnswer;
          points = isCorrect ? question.points : 0;
          break;

        case 'fill-blank':
          // Support pipe-separated and array-based accepted answers.
          const submitted = String(answer.answer ?? '').trim().toLowerCase();
          const acceptedAnswers = Array.isArray(question.correctAnswer)
            ? question.correctAnswer
            : String(question.correctAnswer ?? '')
                .split('|')
                .map((value) => value.trim())
                .filter(Boolean);
          isCorrect = acceptedAnswers
            .map((value) => String(value).trim().toLowerCase())
            .includes(submitted);
          points = isCorrect ? question.points : 0;
          break;

        case 'short-answer':
        case 'essay':
          // These need manual grading
          const manualGrade = feedback.questionComments?.find(c => c.questionId === question.id);
          points = manualGrade?.points || 0;
          isCorrect = points > (question.points * 0.6); // 60% threshold
          break;

        case 'coding':
          if (answer.answer && typeof answer.answer === 'object' && answer.answer.code && answer.answer.language) {
            const codingTestCases = question.coding?.testCases || [];
            const allowedLanguages = question.coding?.allowedLanguages || [];
            if (allowedLanguages.length > 0 && !allowedLanguages.includes(answer.answer.language)) {
              points = 0;
              isCorrect = false;
              break;
            }
            const totalCases = codingTestCases.length;
            let passedCases = 0;

            for (const testCase of codingTestCases) {
              try {
                const executable = buildExecutableCode({
                  question,
                  language: answer.answer.language,
                  userCode: answer.answer.code,
                  rawInput: testCase.input || ''
                });

                const execData = await executeWithCompiler({
                  language: answer.answer.language,
                  code: executable.code,
                  stdin: executable.stdin,
                  version: '*'
                });
                const stdout = String(execData?.stdout || execData?.output || '').trim();
                const expected = String(testCase.expectedOutput || '').trim();
                if (stdout === expected) {
                  passedCases += 1;
                }
              } catch (codingExecutionError) {
                console.error('Coding execution failed during grading:', codingExecutionError);
              }
            }

            if (totalCases > 0) {
              const ratio = Math.max(0, Math.min(1, passedCases / totalCases));
              points = Math.round(question.points * ratio);
              isCorrect = passedCases === totalCases;
              answer.answer.passedTestCases = passedCases;
              answer.answer.totalTestCases = totalCases;
            } else {
              points = 0;
              isCorrect = false;
            }
          } else {
            points = 0;
            isCorrect = false;
          }
          break;
      }

      answer.isCorrect = isCorrect;
      answer.points = points;
      totalEarnedPoints += points;
      if (isCorrect) correctAnswers++;
    }

    // Optional rubric scoring for assignment-style grading.
    const rubricCriteria = assessment.grading?.rubric?.criteria || [];
    const rubricScores = Array.isArray(feedback?.rubricScores) ? feedback.rubricScores : [];
    if (rubricCriteria.length > 0 && rubricScores.length > 0) {
      let rubricMax = 0;
      let rubricEarned = 0;

      for (let index = 0; index < rubricCriteria.length; index += 1) {
        const criterion = rubricCriteria[index];
        const match = rubricScores.find((item) => item.criterionId === criterion.id);
        const maxPoints = Number(criterion.maxPoints || 0);
        const earnedPoints = Math.max(0, Math.min(maxPoints, Number(match?.earnedPoints || 0)));
        rubricMax += maxPoints;
        rubricEarned += earnedPoints;
      }

      if (rubricMax > 0 && Number(assessment.grading?.totalPoints || 0) > 0) {
        totalEarnedPoints = Math.round((rubricEarned / rubricMax) * Number(assessment.grading.totalPoints));
      }

      submission.rubricScores = rubricCriteria.map((criterion) => {
        const match = rubricScores.find((item) => item.criterionId === criterion.id);
        return {
          criterionId: criterion.id,
          title: criterion.title,
          maxPoints: Number(criterion.maxPoints || 0),
          earnedPoints: Math.max(0, Math.min(Number(criterion.maxPoints || 0), Number(match?.earnedPoints || 0))),
          notes: String(match?.notes || '')
        };
      });
    }

    let effectiveEarnedPoints = totalEarnedPoints;
    const latePolicy = assessment.settings?.latePolicy || {};
    let penaltyPercent = 0;

    if (submission.latePolicyApplied?.isLate && latePolicy.mode === 'penalty') {
      const lateMinutes = Number(submission.latePolicyApplied.lateByMinutes || 0);
      const lateDays = Math.max(1, Math.ceil(lateMinutes / (60 * 24)));
      const perDay = Number(latePolicy.penaltyPercentPerDay || 0);
      const maxPenalty = Number(latePolicy.maxPenaltyPercent ?? 100);
      penaltyPercent = clampPercent(Math.min(maxPenalty, lateDays * perDay));
      effectiveEarnedPoints = Math.max(0, Math.round(totalEarnedPoints * (1 - penaltyPercent / 100)));
    }

    // Update scoring
    submission.scoring = {
      ...submission.scoring,
      totalQuestions: assessment.questions.length,
      answeredQuestions: submission.answers.length,
      correctAnswers,
      totalPoints: assessment.grading.totalPoints,
      earnedPoints: effectiveEarnedPoints,
      percentage: assessment.grading.totalPoints > 0
        ? Math.round((effectiveEarnedPoints / assessment.grading.totalPoints) * 100)
        : 0,
      isPassed: assessment.grading.totalPoints > 0
        ? (effectiveEarnedPoints / assessment.grading.totalPoints) * 100 >= assessment.grading.passingScore
        : false
    };

    submission.scoring.grade = toLetterGrade(submission.scoring.percentage);

    submission.latePolicyApplied = {
      ...submission.latePolicyApplied,
      penaltyPercent,
      penaltyPoints: Math.max(0, totalEarnedPoints - effectiveEarnedPoints),
      pointsBeforePenalty: totalEarnedPoints,
      pointsAfterPenalty: effectiveEarnedPoints
    };

    // Set feedback
    submission.feedback = {
      ...feedback,
      gradedBy,
      gradedAt: new Date()
    };
    submission.revisionRequest = {
      ...submission.revisionRequest,
      requested: false
    };

    submission.status = 'graded';

    
    const savedSubmission = await submission.save();
    
    return savedSubmission;
  }

  async requestRevision(submissionId, { requestedBy, reason = '', dueAt = null } = {}) {
    const submission = await AssessmentSubmission.findById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    submission.revisionRequest = {
      requested: true,
      requestedAt: new Date(),
      requestedBy: requestedBy || null,
      dueAt: dueAt ? new Date(dueAt) : null,
      reason: String(reason || '')
    };
    submission.status = 'incomplete';

    return submission.save();
  }

  async recordPlagiarismReport(
    submissionId,
    {
      provider = '',
      similarityScore = null,
      reportUrl = '',
      details = '',
      flagged = false,
      status = null
    } = {}
  ) {
    const submission = await AssessmentSubmission.findById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    const hasSimilarity = similarityScore !== null && similarityScore !== undefined;
    const finalFlagged = Boolean(flagged || (hasSimilarity && Number(similarityScore) > 0));
    submission.plagiarismReport = {
      status: status || (finalFlagged ? 'flagged' : 'checked'),
      provider: String(provider || ''),
      similarityScore: hasSimilarity ? Number(similarityScore) : null,
      flagged: finalFlagged,
      reportUrl: String(reportUrl || ''),
      details: String(details || ''),
      checkedAt: new Date()
    };
    submission.flags = {
      ...submission.flags,
      needsReview: finalFlagged || submission.flags?.needsReview
    };

    return submission.save();
  }

  async overrideGrade(submissionId, { points = null, percentage = null, reason = '', overriddenBy } = {}) {
    const submission = await AssessmentSubmission.findById(submissionId).populate('assessmentId');
    if (!submission) {
      throw new Error('Submission not found');
    }

    const totalPoints = Number(submission.scoring?.totalPoints || submission.assessmentId?.grading?.totalPoints || 0);
    let resolvedPercentage = percentage !== null && percentage !== undefined ? clampPercent(percentage) : null;
    let resolvedPoints = points !== null && points !== undefined ? Number(points) : null;

    if (resolvedPoints === null && resolvedPercentage === null) {
      throw new Error('Either points or percentage is required');
    }

    if (resolvedPoints === null && totalPoints > 0) {
      resolvedPoints = Math.round((resolvedPercentage / 100) * totalPoints);
    }

    if (resolvedPercentage === null && totalPoints > 0) {
      resolvedPercentage = Math.round((resolvedPoints / totalPoints) * 100);
    }

    submission.scoring = {
      ...submission.scoring,
      earnedPoints: resolvedPoints ?? submission.scoring?.earnedPoints ?? 0,
      percentage: resolvedPercentage ?? submission.scoring?.percentage ?? 0
    };
    submission.scoring.grade = toLetterGrade(submission.scoring.percentage);
    submission.scoring.isPassed = submission.scoring.percentage >= Number(submission.assessmentId?.grading?.passingScore || 60);

    submission.gradeOverride = {
      isOverridden: true,
      points: resolvedPoints,
      percentage: resolvedPercentage,
      reason: String(reason || ''),
      overriddenBy: overriddenBy || null,
      overriddenAt: new Date()
    };
    submission.status = 'graded';

    return submission.save();
  }

  async getSubmissionStats(assessmentId) {
    const pipeline = [
      { $match: { assessmentId: this.toObjectId(assessmentId), isCompleted: true } },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          averageScore: { $avg: '$scoring.percentage' },
          highestScore: { $max: '$scoring.percentage' },
          lowestScore: { $min: '$scoring.percentage' },
          passedCount: {
            $sum: { $cond: ['$scoring.isPassed', 1, 0] }
          },
          gradeDistribution: {
            $push: '$scoring.grade'
          },
          averageTimeSpent: { $avg: '$timeSpent' }
        }
      },
      {
        $addFields: {
          passRate: {
            $multiply: [
              { $divide: ['$passedCount', '$totalSubmissions'] },
              100
            ]
          }
        }
      }
    ];

    const result = await this.model.aggregate(pipeline);
    return result[0] || null;
  }

  async getStudentProgress(studentId, courseId) {
    const pipeline = [
      {
        $match: {
          studentId: this.toObjectId(studentId),
          isCompleted: true
        }
      },
      {
        $lookup: {
          from: 'assessments',
          localField: 'assessmentId',
          foreignField: '_id',
          as: 'assessment'
        }
      },
      {
        $unwind: '$assessment'
      },
      {
        $match: {
          'assessment.courseId': this.toObjectId(courseId)
        }
      },
      {
        $group: {
          _id: '$studentId',
          totalAssessments: { $sum: 1 },
          averageScore: { $avg: '$scoring.percentage' },
          totalPoints: { $sum: '$scoring.earnedPoints' },
          maxPoints: { $sum: '$scoring.totalPoints' },
          passedAssessments: {
            $sum: { $cond: ['$scoring.isPassed', 1, 0] }
          }
        }
      }
    ];

    const result = await this.model.aggregate(pipeline);
    return result[0] || null;
  }
}

module.exports = AssessmentSubmissionRepository;

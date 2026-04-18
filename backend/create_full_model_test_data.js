const mongoose = require('mongoose');
require('dotenv').config();

const {
  User,
  Role,
  Permission,
  RolePermission,
  Course,
  Batch,
  LiveClass,
  Enrollment,
  PastEnrollment,
  Assessment,
  AssessmentSubmission,
  RefreshSession,
  Notification,
  MonitoringRecord,
  MonitoringPolicy,
  Resource,
  Ticket,
} = require('./src/models');

const DATABASE_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof';
const DEFAULT_PASSWORD = 'Test@12345';

const TEST_EMAILS = {
  admin: 'admin@lmsfutureproof.com',
  manager: 'himanshu26198@gmail.comNavigation ',
  instructor: 'bloodyraj330@gmail.com',
  students: ['nayansigupta29@gmail.com', 'bloodyraj30@gmail.com'],
};

const IDS = {
  courseSlug: 'qa-full-day-3-month-lms-course',
  batchCode: 'QA3M-FULLDAY-001',
  liveClassTitle: 'QA Full-Day Orientation Class',
  policyScope: 'GLOBAL',
  monitoringRecordSeed: 'QA_MONITORING_RECORD',
};

function addMonths(source, months) {
  const date = new Date(source);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() < day) {
    date.setDate(0);
  }
  return date;
}

function titleCaseFromEmail(email) {
  const localPart = String(email || '').split('@')[0] || 'User';
  const clean = localPart.replace(/[^a-zA-Z]+/g, ' ').trim();
  const words = clean ? clean.split(/\s+/) : ['User'];
  const firstName = (words[0] || 'User').slice(0, 1).toUpperCase() + (words[0] || 'user').slice(1);
  const lastNameSource = words.slice(1).join(' ') || 'Tester';
  const lastName = lastNameSource.slice(0, 1).toUpperCase() + lastNameSource.slice(1);
  return {firstName, lastName};
}

function requiredPathsForModel(Model) {
  return Object.entries(Model.schema.paths)
    .filter(([path, schemaType]) => {
      if (path.startsWith('_')) return false;
      if (path.includes('.')) return false;
      return schemaType?.isRequired === true || schemaType?.options?.required === true;
    })
    .map(([path]) => path)
    .sort();
}

async function printStructureSummary() {
  console.log('\n[1/5] Model structure snapshot (required top-level fields):');
  const entries = [
    ['Role', Role],
    ['Permission', Permission],
    ['RolePermission', RolePermission],
    ['User', User],
    ['Course', Course],
    ['Batch', Batch],
    ['LiveClass', LiveClass],
    ['Enrollment', Enrollment],
    ['PastEnrollment', PastEnrollment],
    ['Assessment', Assessment],
    ['AssessmentSubmission', AssessmentSubmission],
    ['RefreshSession', RefreshSession],
    ['Notification', Notification],
    ['MonitoringPolicy', MonitoringPolicy],
    ['MonitoringRecord', MonitoringRecord],
    ['Resource', Resource],
    ['Ticket', Ticket],
  ];

  entries.forEach(([name, model]) => {
    const required = requiredPathsForModel(model);
    console.log(`- ${name}: ${required.length} required -> ${required.join(', ') || 'none'}`);
  });
}

async function ensureRole(rolePayload) {
  return Role.findOneAndUpdate(
    {name: rolePayload.name},
    {$set: rolePayload},
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
}

async function ensurePermission(permissionPayload) {
  return Permission.findOneAndUpdate(
    {name: permissionPayload.name},
    {$set: permissionPayload},
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
}

async function ensureUser({email, firstName, lastName, roleId, phone}) {
  let user = await User.findOne({email: email.toLowerCase()});

  if (!user) {
    user = new User({
      email,
      password: DEFAULT_PASSWORD,
      firstName,
      lastName,
      phone: phone || null,
      roleId,
      isActive: true,
      isEmailVerified: true,
    });
    await user.save();
    return {user, created: true};
  }

  let dirty = false;
  if (!user.firstName || user.firstName !== firstName) {
    user.firstName = firstName;
    dirty = true;
  }
  if (!user.lastName || user.lastName !== lastName) {
    user.lastName = lastName;
    dirty = true;
  }
  if (!user.roleId || String(user.roleId) !== String(roleId)) {
    user.roleId = roleId;
    dirty = true;
  }
  if (phone && user.phone !== phone) {
    user.phone = phone;
    dirty = true;
  }
  if (!user.isActive) {
    user.isActive = true;
    dirty = true;
  }
  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    dirty = true;
  }

  if (dirty) {
    await user.save();
  }

  return {user, created: false};
}

async function ensureRolePermission(roleId, permissionId, grantedBy) {
  return RolePermission.findOneAndUpdate(
    {roleId, permissionId},
    {
      $set: {
        roleId,
        permissionId,
        grantedBy,
        isActive: true,
        expiresAt: null,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
}

async function seedCoreData() {
  console.log('\n[2/5] Seeding roles, permissions, and users...');

  const roles = {
    ADMIN: await ensureRole({
      name: 'ADMIN',
      displayName: 'Administrator',
      description: 'Full system control',
      level: 1,
      isActive: true,
      isSystemRole: true,
    }),
    MANAGER: await ensureRole({
      name: 'MANAGER',
      displayName: 'Manager',
      description: 'Operations and academics manager',
      level: 2,
      isActive: true,
      isSystemRole: true,
    }),
    INSTRUCTOR: await ensureRole({
      name: 'INSTRUCTOR',
      displayName: 'Instructor',
      description: 'Teaching role',
      level: 3,
      isActive: true,
      isSystemRole: true,
    }),
    STUDENT: await ensureRole({
      name: 'STUDENT',
      displayName: 'Student',
      description: 'Learner role',
      level: 4,
      isActive: true,
      isSystemRole: true,
    }),
  };

  const permissions = {
    USER_MANAGE: await ensurePermission({
      name: 'USER_MANAGE',
      displayName: 'Manage Users',
      description: 'Create/read/update/delete users',
      category: 'USER_MANAGEMENT',
      resource: 'USER',
      action: 'MANAGE',
      level: 1,
      isActive: true,
    }),
    COURSE_MANAGE: await ensurePermission({
      name: 'COURSE_MANAGE',
      displayName: 'Manage Courses',
      description: 'Create and update courses',
      category: 'COURSE_MANAGEMENT',
      resource: 'COURSE',
      action: 'MANAGE',
      level: 1,
      isActive: true,
    }),
    BATCH_MANAGE: await ensurePermission({
      name: 'BATCH_MANAGE',
      displayName: 'Manage Batches',
      description: 'Create and update batches',
      category: 'BATCH_MANAGEMENT',
      resource: 'BATCH',
      action: 'MANAGE',
      level: 1,
      isActive: true,
    }),
    LIVE_CLASS_MANAGE: await ensurePermission({
      name: 'LIVE_CLASS_MANAGE',
      displayName: 'Manage Live Classes',
      description: 'Schedule and run live classes',
      category: 'LIVE_CLASS_MANAGEMENT',
      resource: 'LIVE_CLASS',
      action: 'MANAGE',
      level: 1,
      isActive: true,
    }),
    ASSESSMENT_MANAGE: await ensurePermission({
      name: 'ASSESSMENT_MANAGE',
      displayName: 'Manage Assessments',
      description: 'Create and evaluate assessments',
      category: 'ASSESSMENT_MANAGEMENT',
      resource: 'ASSESSMENT',
      action: 'MANAGE',
      level: 1,
      isActive: true,
    }),
    REPORTING_READ: await ensurePermission({
      name: 'REPORTING_READ',
      displayName: 'View Reporting',
      description: 'View analytics and reports',
      category: 'REPORTING',
      resource: 'REPORTING',
      action: 'READ',
      level: 1,
      isActive: true,
    }),
    CONTENT_MANAGE: await ensurePermission({
      name: 'CONTENT_MANAGE',
      displayName: 'Manage Content',
      description: 'Manage LMS content assets',
      category: 'CONTENT_MANAGEMENT',
      resource: 'CONTENT',
      action: 'MANAGE',
      level: 1,
      isActive: true,
    }),
    SYSTEM_MANAGE: await ensurePermission({
      name: 'SYSTEM_MANAGE',
      displayName: 'Manage System',
      description: 'System administration controls',
      category: 'SYSTEM_ADMINISTRATION',
      resource: 'SYSTEM',
      action: 'MANAGE',
      level: 1,
      isActive: true,
    }),
  };

  const adminNames = titleCaseFromEmail(TEST_EMAILS.admin);
  const managerNames = titleCaseFromEmail(TEST_EMAILS.manager);
  const instructorNames = titleCaseFromEmail(TEST_EMAILS.instructor);

  const {user: adminUser} = await ensureUser({
    email: TEST_EMAILS.admin,
    firstName: adminNames.firstName,
    lastName: adminNames.lastName,
    roleId: roles.ADMIN._id,
    phone: '+10000000001',
  });

  const {user: managerUser} = await ensureUser({
    email: TEST_EMAILS.manager,
    firstName: managerNames.firstName,
    lastName: managerNames.lastName,
    roleId: roles.MANAGER._id,
    phone: '+10000000002',
  });

  const {user: instructorUser} = await ensureUser({
    email: TEST_EMAILS.instructor,
    firstName: instructorNames.firstName,
    lastName: instructorNames.lastName,
    roleId: roles.INSTRUCTOR._id,
    phone: '+10000000003',
  });

  const studentUsers = [];
  for (let index = 0; index < TEST_EMAILS.students.length; index += 1) {
    const email = TEST_EMAILS.students[index];
    const names = titleCaseFromEmail(email);
    const {user} = await ensureUser({
      email,
      firstName: names.firstName,
      lastName: names.lastName,
      roleId: roles.STUDENT._id,
      phone: `+1000000001${index + 4}`,
    });
    studentUsers.push(user);
  }

  const allPermissions = Object.values(permissions);
  for (const permission of allPermissions) {
    await ensureRolePermission(roles.ADMIN._id, permission._id, adminUser._id);
  }

  const managerPermissions = [
    permissions.USER_MANAGE,
    permissions.COURSE_MANAGE,
    permissions.BATCH_MANAGE,
    permissions.ASSESSMENT_MANAGE,
    permissions.REPORTING_READ,
    permissions.CONTENT_MANAGE,
  ];
  for (const permission of managerPermissions) {
    await ensureRolePermission(roles.MANAGER._id, permission._id, adminUser._id);
  }

  const instructorPermissions = [
    permissions.COURSE_MANAGE,
    permissions.BATCH_MANAGE,
    permissions.LIVE_CLASS_MANAGE,
    permissions.ASSESSMENT_MANAGE,
    permissions.CONTENT_MANAGE,
  ];
  for (const permission of instructorPermissions) {
    await ensureRolePermission(roles.INSTRUCTOR._id, permission._id, adminUser._id);
  }

  const studentPermissions = [permissions.REPORTING_READ];
  for (const permission of studentPermissions) {
    await ensureRolePermission(roles.STUDENT._id, permission._id, adminUser._id);
  }

  console.log(
    `- Users ensured: admin(${TEST_EMAILS.admin}), manager(${TEST_EMAILS.manager}), instructor(${TEST_EMAILS.instructor}), students(${TEST_EMAILS.students.join(', ')})`,
  );

  return {
    roles,
    permissions,
    users: {
      admin: adminUser,
      manager: managerUser,
      instructor: instructorUser,
      students: studentUsers,
    },
  };
}

async function seedAcademicData(seedContext) {
  console.log('\n[3/5] Seeding course, batch, class, assessments, and enrollments...');

  const {admin, instructor, students} = seedContext.users;

  const course = await Course.findOneAndUpdate(
    {slug: IDS.courseSlug},
    {
      $set: {
        title: 'QA Full-Day LMS Testing Course',
        slug: IDS.courseSlug,
        description: 'Comprehensive test course to validate LMS web/mobile flows for admin, instructor, and students.',
        shortDescription: 'Full LMS testing course with complete linked test data.',
        category: 'PROGRAMMING',
        tags: ['qa', 'lms', 'mobile', 'testing'],
        level: 'BEGINNER',
        estimatedDuration: {hours: 120, minutes: 0},
        pricing: {type: 'FREE', amount: 0, currency: 'USD'},
        createdBy: admin._id,
        status: 'PUBLISHED',
        isPublic: true,
        authoringWorkflow: {
          approvalRequired: false,
          stage: 'APPROVED',
          submittedForReviewAt: new Date(),
          submittedBy: admin._id,
          reviewedAt: new Date(),
          reviewedBy: admin._id,
          reviewNotes: 'Auto-approved for QA testing.',
        },
        curriculum: {
          modules: [
            {
              id: 'mod-1',
              title: 'Orientation',
              description: 'Initial module for onboarding.',
              order: 1,
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'LMS Overview',
                  type: 'reading',
                  durationMinutes: 30,
                  order: 1,
                  isRequired: true,
                },
              ],
            },
          ],
        },
        activeCurriculumVersion: 1,
      },
      $setOnInsert: {
        publishedAt: new Date(),
        curriculumVersions: [
          {
            versionNumber: 1,
            label: 'Initial QA Curriculum',
            changeSummary: 'Baseline curriculum for testing',
            workflowStage: 'APPROVED',
            curriculum: {
              modules: [
                {
                  id: 'mod-1',
                  title: 'Orientation',
                  description: 'Initial module for onboarding.',
                  order: 1,
                  lessons: [
                    {
                      id: 'lesson-1',
                      title: 'LMS Overview',
                      type: 'reading',
                      durationMinutes: 30,
                      order: 1,
                      isRequired: true,
                    },
                  ],
                },
              ],
            },
            createdBy: admin._id,
            approvedBy: admin._id,
            approvedAt: new Date(),
            isActive: true,
            createdAt: new Date(),
          },
        ],
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  const batchStartDate = new Date();
  batchStartDate.setHours(0, 0, 0, 0);
  const batchEndDate = addMonths(batchStartDate, 3);
  batchEndDate.setHours(23, 59, 0, 0);

  const batch = await Batch.findOneAndUpdate(
    {batchCode: IDS.batchCode},
    {
      $set: {
        name: 'QA Full-Day Three Month Batch',
        courseId: course._id,
        batchCode: IDS.batchCode,
        startDate: batchStartDate,
        endDate: batchEndDate,
        schedule: {
          days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
          startTime: '00:00',
          endTime: '23:59',
          timezone: 'UTC',
        },
        maxStudents: 250,
        currentEnrollment: students.length,
        instructorId: instructor._id,
        status: 'ACTIVE',
        settings: {
          allowLateJoin: true,
          autoEnrollment: false,
          recordClasses: true,
          allowStudentChat: true,
        },
        description: 'Batch configured for complete-day schedule over 3 months for QA.',
        prerequisites: 'None',
        createdBy: admin._id,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  const classStart = new Date(batchStartDate);
  classStart.setHours(9, 0, 0, 0);
  const classEnd = new Date(classStart);
  classEnd.setHours(12, 0, 0, 0);

  const liveClass = await LiveClass.findOneAndUpdate(
    {title: IDS.liveClassTitle, batchId: batch._id},
    {
      $set: {
        title: IDS.liveClassTitle,
        batchId: batch._id,
        instructorId: instructor._id,
        scheduledStartTime: classStart,
        scheduledEndTime: classEnd,
        actualStartTime: null,
        actualEndTime: null,
        description: 'Kickoff class used for QA testing paths.',
        agenda: 'Introduction, navigation demo, and role-based access checks.',
        roomId: `qa-room-${batch._id.toString().slice(-8)}`,
        status: 'SCHEDULED',
        settings: {
          maxParticipants: 250,
          allowRecording: true,
          allowScreenShare: true,
          allowWhiteboard: true,
          allowChat: true,
          allowStudentMic: true,
          allowStudentCamera: false,
          requireApproval: false,
        },
        stats: {
          totalParticipants: 0,
          peakParticipants: 0,
          averageParticipants: 0,
          totalChatMessages: 0,
        },
        createdBy: admin._id,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  const enrollments = [];
  for (const student of students) {
    const enrollment = await Enrollment.findOneAndUpdate(
      {studentId: student._id, batchId: batch._id},
      {
        $set: {
          studentId: student._id,
          courseId: course._id,
          batchId: batch._id,
          enrollmentDate: new Date(),
          status: 'ENROLLED',
          progress: {
            completedClasses: 0,
            totalClasses: 90,
            completionPercentage: 0,
          },
          attendance: {
            totalClasses: 0,
            attendedClasses: 0,
            attendancePercentage: 0,
          },
          payment: {
            status: 'PAID',
            amount: 0,
            paidAt: new Date(),
            transactionId: `FREE-${student._id.toString().slice(-6)}`,
          },
          notes: 'Auto-enrolled by QA seed script',
          enrolledBy: admin._id,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    enrollments.push(enrollment);
  }

  const assessmentTypes = ['quiz', 'exam', 'assignment', 'practice'];
  const assessments = [];
  const submissions = [];

  for (const assessmentType of assessmentTypes) {
    const title = `QA ${assessmentType.toUpperCase()} Assessment`;
    const sectionId = `sec-${assessmentType}`;
    const questionId = `q-${assessmentType}-1`;

    const assessment = await Assessment.findOneAndUpdate(
      {title, courseId: course._id, type: assessmentType},
      {
        $set: {
          title,
          description: `Automated ${assessmentType} created for LMS testing.`,
          instructions: {
            general: 'Read all instructions carefully before starting.',
            additional: 'This is seeded test data.',
          },
          type: assessmentType,
          courseId: course._id,
          batchId: batch._id,
          moduleId: 'mod-1',
          lessonId: 'lesson-1',
          settings: {
            timeLimit: assessmentType === 'assignment' ? null : 60,
            attempts: 3,
            shuffleQuestions: false,
            shuffleOptions: false,
            showResults: 'immediately',
            showCorrectAnswers: true,
            allowReview: true,
            requireCamera: false,
            requireFullScreen: false,
            preventCopyPaste: false,
            latePolicy: {
              mode: 'allow',
              graceMinutes: 30,
              penaltyPercentPerDay: 5,
              maxPenaltyPercent: 30,
            },
            revisionPolicy: {
              maxRevisions: 2,
              allowResubmissionAfterGrading: true,
              revisionWindowDays: 7,
            },
            plagiarismPolicy: {
              enabled: assessmentType === 'assignment',
              provider: assessmentType === 'assignment' ? 'internal' : '',
              similarityThreshold: 30,
              autoFlag: true,
            },
          },
          sections: [
            {
              id: sectionId,
              title: `${assessmentType.toUpperCase()} Section`,
              type: assessmentType === 'assignment' ? 'theory' : 'mcq',
              description: 'Primary section for seeded test assessment',
              order: 1,
            },
          ],
          questions: [
            {
              id: questionId,
              type: assessmentType === 'assignment' ? 'essay' : 'multiple-choice',
              sectionId,
              question: `Sample ${assessmentType} question for QA testing`,
              options:
                assessmentType === 'assignment'
                  ? []
                  : [
                      {id: 'opt-a', text: 'Option A', isCorrect: true},
                      {id: 'opt-b', text: 'Option B', isCorrect: false},
                    ],
              correctAnswer: assessmentType === 'assignment' ? null : 'opt-a',
              points: 10,
              explanation: 'Seeded answer explanation.',
              difficulty: 'easy',
              tags: ['qa', 'seed'],
              order: 1,
              coding: {
                allowedLanguages: ['javascript'],
                starterCode: {},
                testCases: [],
              },
            },
          ],
          grading: {
            totalPoints: 10,
            passingScore: 60,
            gradingMethod: assessmentType === 'assignment' ? 'hybrid' : 'automatic',
            weightage: 25,
            rubric: {
              scoringMode: 'points',
              criteria: [
                {
                  id: `rubric-${assessmentType}-1`,
                  title: 'Accuracy',
                  description: 'Measures correctness',
                  maxPoints: 10,
                  weight: 1,
                },
              ],
            },
          },
          schedule: {
            isScheduled: true,
            startDate: new Date(),
            endDate: addMonths(new Date(), 1),
            timezone: 'UTC',
          },
          status: 'published',
          createdBy: admin._id,
          lastModifiedBy: instructor._id,
          stats: {
            totalAttempts: 0,
            averageScore: 0,
            passRate: 0,
            completionRate: 0,
          },
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    assessments.push(assessment);
  }

  for (const assessment of assessments) {
    for (const student of students) {
      const enrollment = enrollments.find(item => String(item.studentId) === String(student._id));
      const question = assessment.questions[0];
      const answerPayload = question?.type === 'essay' ? 'Seeded assignment response.' : 'opt-a';

      const submission = await AssessmentSubmission.findOneAndUpdate(
        {
          assessmentId: assessment._id,
          studentId: student._id,
          attemptNumber: 1,
          revisionNumber: 0,
        },
        {
          $set: {
            assessmentId: assessment._id,
            studentId: student._id,
            enrollmentId: enrollment._id,
            attemptNumber: 1,
            isCompleted: true,
            revisionNumber: 0,
            revisionOf: null,
            startedAt: new Date(Date.now() - 15 * 60 * 1000),
            completedAt: new Date(),
            timeLimit: assessment.settings?.timeLimit || null,
            timeSpent: 900,
            answers: [
              {
                questionId: question?.id || 'q-1',
                answer: answerPayload,
                timeSpent: 240,
                isCorrect: true,
                points: 10,
                feedback: 'Good answer',
              },
            ],
            scoring: {
              totalQuestions: 1,
              answeredQuestions: 1,
              correctAnswers: 1,
              totalPoints: 10,
              earnedPoints: 10,
              percentage: 100,
              grade: 'A',
              isPassed: true,
            },
            status: 'graded',
            flags: {
              isLate: false,
              hasViolations: false,
              needsReview: false,
              isExcused: false,
            },
            violations: [],
            deviceInfo: {
              userAgent: 'QA Seeder',
              ipAddress: '127.0.0.1',
              screenResolution: '1170x2532',
              timezone: 'UTC',
            },
            feedback: {
              overallComments: 'Seeded graded submission.',
              questionComments: [
                {
                  questionId: question?.id || 'q-1',
                  comment: 'Correct response',
                  points: 10,
                },
              ],
              gradedBy: instructor._id,
              gradedAt: new Date(),
            },
            rubricScores: [
              {
                criterionId: `rubric-${assessment.type}-1`,
                title: 'Accuracy',
                maxPoints: 10,
                earnedPoints: 10,
                notes: 'Seeded full marks',
              },
            ],
            gradeOverride: {
              isOverridden: false,
              points: null,
              percentage: null,
              reason: '',
              overriddenBy: null,
              overriddenAt: null,
            },
            latePolicyApplied: {
              isLate: false,
              lateByMinutes: 0,
              penaltyPercent: 0,
              penaltyPoints: 0,
              pointsBeforePenalty: 10,
              pointsAfterPenalty: 10,
            },
            plagiarismReport: {
              status: 'not-requested',
              provider: '',
              similarityScore: null,
              flagged: false,
              reportUrl: '',
              details: '',
              checkedAt: null,
            },
            revisionRequest: {
              requested: false,
              requestedAt: null,
              requestedBy: null,
              dueAt: null,
              reason: '',
            },
            attachments: [],
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );
      submissions.push(submission);
    }
  }

  await Batch.findByIdAndUpdate(batch._id, {$set: {currentEnrollment: enrollments.length}});

  console.log(`- Academic entities ensured: course(${course.title}), batch(${batch.batchCode}), class(${liveClass.title})`);
  console.log(`- Assessments ensured: ${assessments.map(item => `${item.type}:${item.title}`).join(' | ')}`);
  console.log(`- Student enrollments ensured: ${enrollments.length}, submissions ensured: ${submissions.length}`);

  return {
    course,
    batch,
    liveClass,
    enrollments,
    assessments,
    submissions,
  };
}

async function seedOperationalData(seedContext, academicContext) {
  console.log('\n[4/5] Seeding operational/support models...');

  const {admin, instructor, students} = seedContext.users;
  const {course, batch, liveClass, enrollments} = academicContext;
  const primaryStudent = students[0];

  await RefreshSession.findOneAndUpdate(
    {sessionId: `qa-session-${instructor._id.toString().slice(-8)}`},
    {
      $set: {
        userId: instructor._id,
        sessionId: `qa-session-${instructor._id.toString().slice(-8)}`,
        tokenVersion: 1,
        deviceName: 'iPhone QA Device',
        ipAddress: '127.0.0.1',
        userAgent: 'Expo Go QA',
        lastUsedAt: new Date(),
        expiresAt: addMonths(new Date(), 1),
        revokedAt: null,
        revokedReason: null,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  await Notification.findOneAndUpdate(
    {
      recipientId: primaryStudent._id,
      type: 'ASSESSMENT_PUBLISHED',
      'data.seedKey': 'QA_NOTIFICATION_ASSESSMENT_PUBLISHED',
    },
    {
      $set: {
        recipientId: primaryStudent._id,
        actorId: admin._id,
        type: 'ASSESSMENT_PUBLISHED',
        title: 'Assessments are live',
        message: 'All assessment types are available for testing in your batch.',
        priority: 'high',
        data: {
          seedKey: 'QA_NOTIFICATION_ASSESSMENT_PUBLISHED',
          batchId: batch._id,
          courseId: course._id,
        },
        readAt: null,
        isArchived: false,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  await MonitoringPolicy.findOneAndUpdate(
    {scope: IDS.policyScope},
    {
      $set: {
        scope: IDS.policyScope,
        retentionDays: 120,
        archiveWindowDays: 45,
        exportMaxRecords: 5000,
        alertThresholds: {
          warnPerHour: 200,
          errorPerHour: 60,
          criticalPerHour: 20,
          memoryRssMb: 4096,
        },
        updatedBy: admin._id,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  await MonitoringRecord.findOneAndUpdate(
    {
      category: 'EVENT',
      source: 'QA_SEEDER',
      'metadata.seedKey': IDS.monitoringRecordSeed,
    },
    {
      $set: {
        category: 'EVENT',
        level: 'info',
        source: 'QA_SEEDER',
        action: 'FULL_MODEL_TEST_DATA_SEEDED',
        entityType: 'BATCH',
        entityId: String(batch._id),
        message: 'Seeded all LMS models for integrated testing.',
        actorId: admin._id,
        request: {
          requestId: `seed-${Date.now()}`,
          method: 'SCRIPT',
          path: 'create_full_model_test_data.js',
          ip: '127.0.0.1',
          userAgent: 'node-script',
        },
        metadata: {
          seedKey: IDS.monitoringRecordSeed,
          emails: {
            instructor: TEST_EMAILS.instructor,
            students: TEST_EMAILS.students,
          },
        },
        isArchived: false,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  const resourcePayloads = [
    {
      title: 'QA Course Handbook',
      fileName: 'qa-course-handbook.pdf',
      originalName: 'qa-course-handbook.pdf',
      fileType: 'PDF',
      mimeType: 'application/pdf',
      fileSize: 1024,
      fileUrl: 'https://example.com/resources/qa-course-handbook.pdf',
      resourceLevel: 'COURSE',
      courseId: course._id,
      batchId: null,
      liveClassId: null,
      accessLevel: 'ENROLLED_ONLY',
      uploadedBy: instructor._id,
      tags: ['qa', 'course'],
    },
    {
      title: 'QA Batch Schedule Sheet',
      fileName: 'qa-batch-schedule.xlsx',
      originalName: 'qa-batch-schedule.xlsx',
      fileType: 'SPREADSHEET',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileSize: 2048,
      fileUrl: 'https://example.com/resources/qa-batch-schedule.xlsx',
      resourceLevel: 'BATCH',
      courseId: null,
      batchId: batch._id,
      liveClassId: null,
      accessLevel: 'ENROLLED_ONLY',
      uploadedBy: instructor._id,
      tags: ['qa', 'batch'],
    },
    {
      title: 'QA Class Slides',
      fileName: 'qa-class-slides.pptx',
      originalName: 'qa-class-slides.pptx',
      fileType: 'PRESENTATION',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileSize: 3072,
      fileUrl: 'https://example.com/resources/qa-class-slides.pptx',
      resourceLevel: 'CLASS',
      courseId: null,
      batchId: null,
      liveClassId: liveClass._id,
      accessLevel: 'ENROLLED_ONLY',
      uploadedBy: instructor._id,
      tags: ['qa', 'class'],
    },
  ];

  for (const payload of resourcePayloads) {
    const query = {
      title: payload.title,
      resourceLevel: payload.resourceLevel,
      ...(payload.resourceLevel === 'COURSE' ? {courseId: payload.courseId} : {}),
      ...(payload.resourceLevel === 'BATCH' ? {batchId: payload.batchId} : {}),
      ...(payload.resourceLevel === 'CLASS' ? {liveClassId: payload.liveClassId} : {}),
    };

    await Resource.findOneAndUpdate(
      query,
      {
        $set: {
          ...payload,
          isPublic: false,
          status: 'ACTIVE',
          downloadCount: 0,
          viewCount: 0,
          uploadedAt: new Date(),
          expiresAt: null,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  await Ticket.findOneAndUpdate(
    {
      type: 'ticket',
      title: 'QA Access Verification Ticket',
      createdBy: primaryStudent._id,
    },
    {
      $set: {
        type: 'ticket',
        title: 'QA Access Verification Ticket',
        description: 'Please verify student permissions for all seeded LMS entities.',
        status: 'in-progress',
        priority: 'high',
        createdBy: primaryStudent._id,
        courseId: course._id,
        batchId: batch._id,
        liveClassIds: [liveClass._id],
        assignedTo: admin._id,
        replies: [
          {
            message: 'Ticket created by seed script for validation.',
            from: primaryStudent._id,
            attachments: [],
          },
          {
            message: 'Acknowledged. QA checks in progress.',
            from: admin._id,
            attachments: [],
          },
        ],
        isUrgent: true,
        reminderSent: false,
        tags: ['qa', 'permissions'],
        category: 'access',
        attachments: [],
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  const seedEnrollment = enrollments[0];
  await PastEnrollment.findOneAndUpdate(
    {originalEnrollmentId: `archived-${seedEnrollment._id.toString()}`},
    {
      $set: {
        originalEnrollmentId: `archived-${seedEnrollment._id.toString()}`,
        deletedAt: new Date(),
        deletedBy: TEST_EMAILS.admin,
        deleteReason: 'COURSE_DELETED',
        student: {
          id: String(primaryStudent._id),
          firstName: primaryStudent.firstName,
          lastName: primaryStudent.lastName,
          email: primaryStudent.email,
          phone: primaryStudent.phone || '',
        },
        course: {
          id: String(course._id),
          title: course.title,
          slug: course.slug,
          category: course.category,
          level: course.level,
          status: course.status,
        },
        batch: {
          id: String(batch._id),
          name: batch.name,
          batchCode: batch.batchCode,
          startDate: batch.startDate,
          endDate: batch.endDate,
          schedule: {
            days: batch.schedule.days,
            startTime: batch.schedule.startTime,
            endTime: batch.schedule.endTime,
            timezone: batch.schedule.timezone,
          },
          status: batch.status,
          instructorId: String(batch.instructorId),
        },
        enrolledBy: {
          id: String(admin._id),
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
        },
        enrollmentDate: seedEnrollment.enrollmentDate,
        status: seedEnrollment.status,
        progress: seedEnrollment.progress,
        attendance: seedEnrollment.attendance,
        grades: seedEnrollment.grades,
        payment: seedEnrollment.payment,
        completedAt: seedEnrollment.completedAt,
        certificate: seedEnrollment.certificate,
        notes: `${seedEnrollment.notes || ''} Archived QA snapshot`.trim(),
        enrollmentSnapshot: seedEnrollment.toObject(),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  console.log(
    '- Operational entities ensured: refresh session, notification, monitoring policy/record, resources, ticket, past enrollment',
  );
}

async function printVerificationSummary() {
  console.log('\n[5/5] Seed verification summary:');

  const counts = {
    roles: await Role.countDocuments(),
    permissions: await Permission.countDocuments(),
    rolePermissions: await RolePermission.countDocuments(),
    users: await User.countDocuments(),
    courses: await Course.countDocuments(),
    batches: await Batch.countDocuments(),
    liveClasses: await LiveClass.countDocuments(),
    enrollments: await Enrollment.countDocuments(),
    pastEnrollments: await PastEnrollment.countDocuments(),
    assessments: await Assessment.countDocuments(),
    assessmentSubmissions: await AssessmentSubmission.countDocuments(),
    refreshSessions: await RefreshSession.countDocuments(),
    notifications: await Notification.countDocuments(),
    monitoringPolicies: await MonitoringPolicy.countDocuments(),
    monitoringRecords: await MonitoringRecord.countDocuments(),
    resources: await Resource.countDocuments(),
    tickets: await Ticket.countDocuments(),
  };

  Object.entries(counts).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });

  const instructor = await User.findOne({email: TEST_EMAILS.instructor}).lean();
  const students = await User.find({email: {$in: TEST_EMAILS.students}}).lean();
  const batch = await Batch.findOne({batchCode: IDS.batchCode}).lean();
  const assessments = await Assessment.find({courseId: batch.courseId}).lean();
  const studentIds = students.map(item => item._id);
  const enrollments = await Enrollment.find({batchId: batch._id, studentId: {$in: studentIds}}).lean();

  const missingAssessmentTypes = ['quiz', 'exam', 'assignment', 'practice'].filter(
    type => !assessments.some(item => item.type === type),
  );

  console.log('\nIntegrity checks:');
  console.log(`- Instructor present (${TEST_EMAILS.instructor}): ${instructor ? 'yes' : 'no'}`);
  console.log(
    `- Students present (${TEST_EMAILS.students.join(', ')}): ${students.length}/${TEST_EMAILS.students.length}`,
  );
  console.log(
    `- Batch schedule full-day: ${batch?.schedule?.startTime === '00:00' && batch?.schedule?.endTime === '23:59' ? 'yes' : 'no'}`,
  );
  console.log(
    `- Batch duration >= 3 months: ${batch && new Date(batch.endDate) - new Date(batch.startDate) >= 89 * 24 * 60 * 60 * 1000 ? 'yes' : 'no'}`,
  );
  console.log(`- Student enrollments in batch: ${enrollments.length}/${TEST_EMAILS.students.length}`);
  console.log(
    `- Assessment types seeded: ${missingAssessmentTypes.length === 0 ? 'all types present' : `missing ${missingAssessmentTypes.join(', ')}`}`,
  );

  console.log('\nCredentials for seeded users (new users get default password):');
  console.log(`- Admin: ${TEST_EMAILS.admin} / ${DEFAULT_PASSWORD}`);
  console.log(`- Manager: ${TEST_EMAILS.manager} / ${DEFAULT_PASSWORD}`);
  console.log(`- Instructor: ${TEST_EMAILS.instructor} / ${DEFAULT_PASSWORD}`);
  TEST_EMAILS.students.forEach(email => {
    console.log(`- Student: ${email} / ${DEFAULT_PASSWORD}`);
  });
}

async function run() {
  try {
    console.log('Starting full-model LMS test data seed...');
    console.log(`Connecting to ${DATABASE_URI}`);
    await mongoose.connect(DATABASE_URI);

    await printStructureSummary();
    const seedContext = await seedCoreData();
    const academicContext = await seedAcademicData(seedContext);
    await seedOperationalData(seedContext, academicContext);
    await printVerificationSummary();

    console.log('\nSeed script completed successfully.');
  } catch (error) {
    console.error('Seed script failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

if (require.main === module) {
  run();
}

module.exports = run;

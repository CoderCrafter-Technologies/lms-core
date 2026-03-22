const axios = require('axios');
const readline = require('readline');
require('dotenv').config();

const DEFAULT_PASSWORD = 'Test@12345';

const TEST_EMAILS = {
  admin: process.env.SEED_ADMIN_EMAIL || 'admin@lmsfutureproof.com',
  instructor: 'bloodyraj330@gmail.com',
  students: ['nayansigupta29@gmail.com', 'bloodyraj30@gmail.com'],
};

const IDS = {
  courseTitle: 'QA Full-Day LMS Testing Course',
  batchCode: 'QA3M-FULLDAY-001',
  liveClassTitle: 'QA Full-Day Orientation Class',
};

const ASSESSMENT_TYPES = ['quiz', 'exam', 'assignment', 'practice'];

function addMonths(sourceDate, months) {
  const date = new Date(sourceDate);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() < day) {
    date.setDate(0);
  }
  return date;
}

function normalizeBaseUrl(input) {
  const value = String(input || '').trim();
  if (!value) return '';

  const hasProtocol = /^https?:\/\//i.test(value);
  const withProtocol = hasProtocol
    ? value
    : value.startsWith('localhost') || value.startsWith('127.0.0.1')
      ? `http://${value}`
      : `https://${value}`;

  return withProtocol.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function titleCaseFromEmail(email) {
  const localPart = String(email || '').split('@')[0] || 'User';
  const clean = localPart.replace(/[^a-zA-Z]+/g, ' ').trim();
  const words = clean ? clean.split(/\s+/) : ['User'];
  const first = words[0] || 'User';
  const last = words.slice(1).join(' ') || 'Tester';
  return {
    firstName: first.charAt(0).toUpperCase() + first.slice(1),
    lastName: last.charAt(0).toUpperCase() + last.slice(1),
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function extractId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value.id) return String(value.id);
    if (value._id) return String(value._id);
  }
  return null;
}

function extractData(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return payload.data !== undefined ? payload.data : payload;
}

function toLower(value) {
  return String(value || '').trim().toLowerCase();
}

function isAxiosError(error) {
  return Boolean(error && error.isAxiosError);
}

function formatApiError(error) {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error.message : String(error);
  }

  const status = error.response?.status;
  const responseData = error.response?.data || {};
  const message =
    responseData.message ||
    responseData.error ||
    (Array.isArray(responseData.errors) ? responseData.errors.map((item) => item.msg || item.message).join('; ') : null) ||
    error.message;

  return `HTTP ${status || 'ERR'}: ${message}`;
}

function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(String(answer || '').trim()));
  });
}

async function promptConfig() {
  const rl = createPrompt();
  try {
    const defaultLmsUrl = process.env.SEED_LMS_URL || 'http://localhost:5000';
    const defaultAdminEmail = TEST_EMAILS.admin;
    const defaultAdminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;

    const lmsUrlInput = await ask(rl, `LMS URL (${defaultLmsUrl}): `);
    const adminEmailInput = await ask(rl, `Admin email (${defaultAdminEmail}): `);
    const adminPasswordInput = await ask(
      rl,
      `Admin password (${defaultAdminPassword ? 'press Enter to use default' : 'required'}): `,
    );

    const baseUrl = normalizeBaseUrl(lmsUrlInput || defaultLmsUrl);
    if (!baseUrl) {
      throw new Error('LMS URL is required.');
    }

    const adminEmail = toLower(adminEmailInput || defaultAdminEmail);
    const adminPassword = adminPasswordInput || defaultAdminPassword;
    if (!adminEmail || !adminPassword) {
      throw new Error('Admin email and password are required to call protected APIs.');
    }

    return {
      baseUrl,
      adminEmail,
      adminPassword,
    };
  } finally {
    rl.close();
  }
}

function createApiClient(baseUrl) {
  return axios.create({
    baseURL: `${baseUrl}/api`,
    timeout: 45000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function login(api, email, password) {
  const response = await api.post('/auth/login', { email, password });
  const token = response.data?.token;
  if (!token) {
    throw new Error('Login succeeded but no token was returned.');
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  return extractData(response.data?.user) || null;
}

function findByEmail(items, email) {
  const needle = toLower(email);
  return asArray(items).find((item) => toLower(item?.email) === needle) || null;
}

async function findInstructorByEmail(api, email) {
  const response = await api.get('/admin/instructors');
  const items = extractData(response.data);
  return findByEmail(items, email);
}

async function findStudentByEmail(api, email) {
  const response = await api.get('/students', {
    params: {
      page: 1,
      limit: 50,
      search: email,
    },
  });
  const items = extractData(response.data);
  return findByEmail(items, email);
}

async function ensureInstructor(api, email) {
  const existing = await findInstructorByEmail(api, email);
  if (existing) {
    return { entity: existing, created: false };
  }

  const names = titleCaseFromEmail(email);
  const response = await api.post('/admin/instructors', {
    firstName: names.firstName,
    lastName: names.lastName,
    email,
    phone: '+10000000003',
    sendEmail: false,
  });

  return { entity: extractData(response.data), created: true };
}

async function ensureStudent(api, email) {
  const existing = await findStudentByEmail(api, email);
  if (existing) {
    return { entity: existing, created: false };
  }

  const names = titleCaseFromEmail(email);
  const response = await api.post('/admin/create-student', {
    firstName: names.firstName,
    lastName: names.lastName,
    email,
    sendEmail: false,
  });

  const student = extractData(response.data)?.student;
  if (!student) {
    throw new Error(`Student create response did not include student payload for ${email}`);
  }

  return { entity: student, created: true };
}

async function findCourseByTitle(api, title) {
  const response = await api.get('/courses', {
    params: {
      page: 1,
      limit: 100,
      search: title,
    },
  });

  const items = asArray(extractData(response.data));
  return items.find((item) => toLower(item?.title) === toLower(title)) || null;
}

async function ensureCoursePublished(api, courseId) {
  try {
    await api.post(`/courses/${courseId}/publish`);
    return;
  } catch (error) {
    const message = String(error?.response?.data?.message || error?.message || '').toLowerCase();
    const requiresApproval =
      error?.response?.status === 400 &&
      message.includes('must be approved before publishing');

    if (!requiresApproval) {
      throw error;
    }
  }

  await api.post(`/courses/${courseId}/submit-review`, {
    reviewNotes: 'Submitted automatically by API seed script.',
  });
  await api.post(`/courses/${courseId}/approve`, {
    reviewNotes: 'Approved automatically by API seed script.',
  });
  await api.post(`/courses/${courseId}/publish`);
}

async function ensureCourse(api, adminId) {
  const existing = await findCourseByTitle(api, IDS.courseTitle);
  if (existing) {
    const courseId = extractId(existing);
    if (courseId && String(existing.status || '').toUpperCase() !== 'PUBLISHED') {
      await ensureCoursePublished(api, courseId);
    }
    return { entity: existing, created: false };
  }

  const response = await api.post('/courses', {
    title: IDS.courseTitle,
    description: 'Comprehensive test course to validate LMS web/mobile flows for admin, instructor, and students.',
    shortDescription: 'Full LMS testing course with complete linked test data.',
    category: 'PROGRAMMING',
    level: 'BEGINNER',
    pricing: { type: 'FREE', amount: 0, currency: 'USD' },
    estimatedDuration: { hours: 120, minutes: 0 },
    tags: ['qa', 'lms', 'mobile', 'testing'],
    isPublic: true,
    createdBy: adminId || undefined,
  });

  const course = extractData(response.data);
  const courseId = extractId(course);
  if (!courseId) {
    throw new Error('Course create response did not include course ID.');
  }

  await ensureCoursePublished(api, courseId);
  return { entity: course, created: true };
}

async function findBatchByCode(api, courseId, batchCode) {
  const response = await api.get('/batches', {
    params: {
      page: 1,
      limit: 100,
      courseId,
    },
  });

  const items = asArray(extractData(response.data));
  return items.find((item) => String(item?.batchCode || '') === batchCode) || null;
}

async function ensureBatch(api, courseId, instructorId) {
  const existing = await findBatchByCode(api, courseId, IDS.batchCode);
  if (existing) {
    return { entity: existing, created: false };
  }

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = addMonths(startDate, 3);
  endDate.setHours(23, 59, 0, 0);

  const response = await api.post('/batches', {
    name: 'QA Full-Day Three Month Batch',
    courseId,
    instructorId,
    batchCode: IDS.batchCode,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    maxStudents: 250,
    schedule: {
      days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      startTime: '00:00',
      endTime: '23:59',
      timezone: 'UTC',
    },
    description: 'Batch configured for complete-day schedule over 3 months for QA.',
    prerequisites: 'None',
  });

  return { entity: extractData(response.data), created: true };
}

async function ensureLiveClass(api, batchId, batchStartDate) {
  const listResponse = await api.get(`/batches/${batchId}/classes`);
  const existing = asArray(extractData(listResponse.data)).find(
    (item) => toLower(item?.title) === toLower(IDS.liveClassTitle),
  );

  if (existing) {
    return { entity: existing, created: false };
  }

  const classStart = new Date(batchStartDate || new Date());
  classStart.setUTCHours(9, 0, 0, 0);
  const classEnd = new Date(classStart);
  classEnd.setUTCHours(12, 0, 0, 0);

  const response = await api.post(`/batches/${batchId}/classes`, {
    title: IDS.liveClassTitle,
    scheduledStartTime: classStart.toISOString(),
    scheduledEndTime: classEnd.toISOString(),
    description: 'Kickoff class used for QA testing paths.',
  });

  return { entity: extractData(response.data), created: true };
}

async function listBatchEnrollments(api, batchId) {
  const response = await api.get(`/enrollments/batch/${batchId}`);
  return asArray(extractData(response.data));
}

async function ensureEnrollment(api, { studentId, courseId, batchId }) {
  const enrollments = await listBatchEnrollments(api, batchId);
  const existing = enrollments.find((item) => {
    const existingStudentId = extractId(item?.studentId);
    return existingStudentId && existingStudentId === String(studentId);
  });

  if (existing) {
    return { entity: existing, created: false };
  }

  const response = await api.post('/enrollments', {
    studentId,
    courseId,
    batchId,
    status: 'ENROLLED',
    payment: {
      status: 'PAID',
      amount: 0,
      transactionId: `FREE-${String(studentId).slice(-6)}`,
    },
    notes: 'Auto-enrolled by QA API seed script',
  });

  return { entity: extractData(response.data), created: true };
}

function buildAssessmentPayload(type, courseId, batchId) {
  const sectionId = `sec-${type}`;
  const questionId = `q-${type}-1`;
  const isAssignment = type === 'assignment';

  return {
    title: `QA ${type.toUpperCase()} Assessment`,
    description: `Automated ${type} created for LMS testing.`,
    instructions: {
      general: 'Read all instructions carefully before starting.',
      additional: 'This is seeded test data.',
    },
    type,
    courseId,
    batchId,
    sections: [
      {
        id: sectionId,
        title: `${type.toUpperCase()} Section`,
        type: isAssignment ? 'theory' : 'mcq',
        description: 'Primary section for seeded test assessment',
        order: 1,
      },
    ],
    questions: [
      {
        id: questionId,
        type: isAssignment ? 'essay' : 'multiple-choice',
        sectionId,
        question: `Sample ${type} question for QA testing`,
        options: isAssignment
          ? []
          : [
              { id: 'opt-a', text: 'Option A', isCorrect: true },
              { id: 'opt-b', text: 'Option B', isCorrect: false },
            ],
        correctAnswer: isAssignment ? null : 'opt-a',
        points: 10,
        difficulty: 'easy',
        order: 1,
      },
    ],
    settings: {
      attempts: 3,
      showResults: 'immediately',
      allowReview: true,
      timeLimit: isAssignment ? null : 60,
    },
    status: 'draft',
  };
}

async function ensureAssessments(api, courseId, batchId) {
  const listResponse = await api.get(`/assessments/course/${courseId}`);
  const existing = asArray(extractData(listResponse.data));
  const results = [];

  for (const type of ASSESSMENT_TYPES) {
    let assessment = existing.find((item) => String(item?.type || '').toLowerCase() === type);
    let created = false;

    if (!assessment) {
      const response = await api.post('/assessments', buildAssessmentPayload(type, courseId, batchId));
      assessment = extractData(response.data);
      created = true;
    }

    const assessmentId = extractId(assessment);
    const status = String(assessment?.status || '').toLowerCase();
    if (assessmentId && status !== 'published') {
      await api.patch(`/assessments/${assessmentId}/publish`);
      assessment.status = 'published';
    }

    results.push({ entity: assessment, created });
  }

  return results;
}

async function run() {
  try {
    console.log('Starting API-based LMS full test data seed...');
    console.log('This script will ask for LMS URL, login as admin, then create batch + assessments via APIs.');

    const config = await promptConfig();
    const api = createApiClient(config.baseUrl);

    console.log(`\n[1/4] Logging in to ${config.baseUrl} ...`);
    const adminUser = await login(api, config.adminEmail, config.adminPassword);
    const adminId = extractId(adminUser);
    console.log(`- Authenticated as ${config.adminEmail}`);

    console.log('\n[2/4] Resolving existing instructor...');
    const instructor = await findInstructorByEmail(api, TEST_EMAILS.instructor);
    if (!instructor) {
      throw new Error(
        `Instructor not found: ${TEST_EMAILS.instructor}. Please create instructor first, then rerun the script.`,
      );
    }
    console.log(`- Instructor found: ${TEST_EMAILS.instructor}`);

    const instructorId = extractId(instructor);
    if (!instructorId) {
      throw new Error('Could not resolve instructor ID from API response.');
    }

    console.log('\n[3/4] Ensuring course and batch...');
    const courseResult = await ensureCourse(api, adminId);
    const courseId = extractId(courseResult.entity);
    if (!courseId) throw new Error('Course ID missing from API response.');

    const batchResult = await ensureBatch(api, courseId, instructorId);
    const batchId = extractId(batchResult.entity);
    if (!batchId) throw new Error('Batch ID missing from API response.');
    console.log(`- Course ${courseResult.created ? 'created' : 'found'}: ${IDS.courseTitle}`);
    console.log(`- Batch ${batchResult.created ? 'created' : 'found'}: ${IDS.batchCode}`);

    console.log('\n[4/4] Ensuring assessments...');
    const assessmentResults = await ensureAssessments(api, courseId, batchId);
    console.log(
      `- Assessments ensured: ${assessmentResults.length} (${assessmentResults.filter((item) => item.created).length} new)`,
    );

    console.log('\nSeed summary');
    console.log(`- LMS URL: ${config.baseUrl}`);
    console.log(`- Instructor: ${TEST_EMAILS.instructor}`);
    console.log(`- Course ID: ${courseId}`);
    console.log(`- Batch ID: ${batchId}`);
    console.log(`- Test login default (if applicable): ${DEFAULT_PASSWORD}`);
    console.log('\nSeed script completed successfully through APIs.');
  } catch (error) {
    console.error(`Seed script failed: ${formatApiError(error)}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run();
}

module.exports = run;

const axios = require('axios');
const readline = require('readline');
require('dotenv').config();

const DEFAULT_PASSWORD = 'Test@12345';
const DEFAULT_SEED_TAG = process.env.SEED_TAG || new Date().toISOString().slice(0, 10).replace(/-/g, '');
const DEFAULT_COUNTS = {
  instructors: Number(process.env.SEED_INSTRUCTOR_COUNT || 4),
  students: Number(process.env.SEED_STUDENT_COUNT || 18),
  courses: Number(process.env.SEED_COURSE_COUNT || 4),
  batchesPerCourse: Number(process.env.SEED_BATCHES_PER_COURSE || 2),
  classesPerBatch: Number(process.env.SEED_CLASSES_PER_BATCH || 4),
  minCoursesPerStudent: Number(process.env.SEED_MIN_COURSES_PER_STUDENT || 2),
  maxCoursesPerStudent: Number(process.env.SEED_MAX_COURSES_PER_STUDENT || 3),
};

const ROLE_PASSWORDS = {
  instructor: process.env.SEED_INSTRUCTOR_PASSWORD || 'Instructor@123',
  student: process.env.SEED_STUDENT_PASSWORD || 'Student@123',
};

const ASSESSMENT_TYPES = ['quiz', 'exam', 'assignment', 'practice'];
const BATCH_TEMPLATES = [
  {
    label: 'Morning Cohort',
    schedule: {
      days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      startTime: '09:00',
      endTime: '11:00',
      timezone: 'UTC',
    },
    maxStudents: 40,
    startOffsetDays: -14,
    durationDays: 90,
  },
  {
    label: 'Evening Cohort',
    schedule: {
      days: ['TUESDAY', 'THURSDAY'],
      startTime: '18:30',
      endTime: '20:30',
      timezone: 'UTC',
    },
    maxStudents: 45,
    startOffsetDays: 10,
    durationDays: 100,
  },
  {
    label: 'Weekend Intensive',
    schedule: {
      days: ['SATURDAY', 'SUNDAY'],
      startTime: '10:00',
      endTime: '13:00',
      timezone: 'UTC',
    },
    maxStudents: 35,
    startOffsetDays: 21,
    durationDays: 75,
  },
];

const CLASS_TOPICS = [
  'Orientation and Platform Walkthrough',
  'Core Concepts Deep Dive',
  'Hands-on Workshop',
  'Team Lab and Practice Review',
  'Case Study Discussion',
  'Problem Solving Session',
  'Project Build Sprint',
  'Feedback and Assessment Prep',
];

const FIRST_NAMES = [
  'Aarav', 'Aisha', 'Arjun', 'Ananya', 'Vivaan', 'Ishita', 'Kabir', 'Meera',
  'Rohan', 'Priya', 'Rahul', 'Sana', 'Dev', 'Kavya', 'Neha', 'Aditya',
  'Nisha', 'Aryan', 'Sara', 'Kiran', 'Tara', 'Manav', 'Reyansh', 'Diya',
  'Ira', 'Zara', 'Varun', 'Maya', 'Nikhil', 'Pooja', 'Riya', 'Ishan',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Reddy', 'Mehta', 'Gupta', 'Kapoor', 'Verma', 'Nair',
  'Rao', 'Iyer', 'Malhotra', 'Joshi', 'Singh', 'Bose', 'Chopra', 'Arora',
  'Khanna', 'Bhat', 'Desai', 'Kulkarni', 'Jain', 'Mishra', 'Saxena', 'Kohli',
];

const EXPERTISE_AREAS = [
  'JavaScript Architecture',
  'React and Frontend Systems',
  'Python for Analytics',
  'UI and Product Design',
  'Performance Marketing',
  'Data Storytelling',
  'Node.js Backend Engineering',
  'Business Operations',
];

const COURSE_TEMPLATES = [
  {
    title: 'Applied React Engineering',
    category: 'PROGRAMMING',
    level: 'INTERMEDIATE',
    pricing: { type: 'PAID', amount: 299, currency: 'USD' },
    tags: ['React', 'Frontend', 'JavaScript', 'UI Engineering'],
    description:
      'A practical frontend engineering course covering component architecture, state management, testing, and production-ready React workflows.',
    shortDescription: 'Production-focused React engineering program.',
    durationHours: 96,
  },
  {
    title: 'Python Analytics Bootcamp',
    category: 'DATA_SCIENCE',
    level: 'BEGINNER',
    pricing: { type: 'PAID', amount: 249, currency: 'USD' },
    tags: ['Python', 'Analytics', 'Pandas', 'Visualization'],
    description:
      'Build strong fundamentals in analytics with Python, data cleaning, dashboards, reporting, and exploratory analysis using practical business datasets.',
    shortDescription: 'Python analytics for real-world reporting and insights.',
    durationHours: 88,
  },
  {
    title: 'Product Design Studio',
    category: 'DESIGN',
    level: 'BEGINNER',
    pricing: { type: 'PAID', amount: 219, currency: 'USD' },
    tags: ['UX', 'UI', 'Figma', 'Design Systems'],
    description:
      'A studio-style design course focused on user flows, wireframes, interface design, usability critique, and collaborative product thinking.',
    shortDescription: 'Hands-on UI and UX design studio.',
    durationHours: 72,
  },
  {
    title: 'Performance Marketing Lab',
    category: 'MARKETING',
    level: 'INTERMEDIATE',
    pricing: { type: 'PAID', amount: 199, currency: 'USD' },
    tags: ['SEO', 'Paid Ads', 'Campaigns', 'Analytics'],
    description:
      'Learn paid campaigns, funnel optimization, campaign tracking, attribution basics, and the reporting habits needed for performance marketing teams.',
    shortDescription: 'Campaign planning and performance optimization course.',
    durationHours: 70,
  },
  {
    title: 'Business Data Operations',
    category: 'BUSINESS',
    level: 'BEGINNER',
    pricing: { type: 'FREE', amount: 0, currency: 'USD' },
    tags: ['Operations', 'Dashboards', 'Reporting', 'Process'],
    description:
      'Improve team operations with dashboards, workflows, measurement, stakeholder updates, and practical methods for business process execution.',
    shortDescription: 'Operational excellence through data and process basics.',
    durationHours: 64,
  },
  {
    title: 'Career English for Teams',
    category: 'LANGUAGE',
    level: 'BEGINNER',
    pricing: { type: 'FREE', amount: 0, currency: 'USD' },
    tags: ['English', 'Communication', 'Presentation', 'Workplace'],
    description:
      'Strengthen workplace communication through speaking drills, writing practice, presentations, meeting language, and confidence-building activities.',
    shortDescription: 'Workplace communication and presentation skills.',
    durationHours: 52,
  },
];

function addMonths(sourceDate, months) {
  const date = new Date(sourceDate);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() < day) {
    date.setDate(0);
  }
  return date;
}

function addDays(sourceDate, days) {
  const date = new Date(sourceDate);
  date.setDate(date.getDate() + days);
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

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-{2,}/g, '-');
}

function toLower(value) {
  return String(value || '').trim().toLowerCase();
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
    const defaultAdminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@lmsfutureproof.com';
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

function extractData(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return payload.data !== undefined ? payload.data : payload;
}

function extractCollection(payload) {
  const root = extractData(payload);
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.users)) return root.users;
  if (Array.isArray(root?.documents)) return root.documents;
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

function findByEmail(items, email) {
  const needle = toLower(email);
  return items.find((item) => toLower(item?.email) === needle) || null;
}

function findByTitle(items, title) {
  const needle = toLower(title);
  return items.find((item) => toLower(item?.title) === needle) || null;
}

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createPrng(seedText) {
  let seed = hashString(String(seedText || 'seed')) || 1;
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithPrng(items, prng) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(prng() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;
  }
  return copy;
}

function pickDistinct(items, count, prng) {
  return shuffleWithPrng(items, prng).slice(0, Math.max(0, Math.min(count, items.length)));
}

function randomInt(prng, min, max) {
  return min + Math.floor(prng() * (max - min + 1));
}

function readCounts() {
  const counts = { ...DEFAULT_COUNTS };
  counts.maxCoursesPerStudent = Math.max(counts.minCoursesPerStudent, counts.maxCoursesPerStudent);
  counts.courses = Math.max(1, Math.min(counts.courses, COURSE_TEMPLATES.length));
  counts.batchesPerCourse = Math.max(1, Math.min(counts.batchesPerCourse, BATCH_TEMPLATES.length));
  counts.classesPerBatch = Math.max(1, counts.classesPerBatch);
  counts.instructors = Math.max(1, counts.instructors);
  counts.students = Math.max(1, counts.students);
  return counts;
}

function buildSeedEmail(role, firstName, lastName, index, tag, domain) {
  const local = `${role}.${tag}.${slugify(firstName)}.${slugify(lastName)}.${String(index + 1).padStart(2, '0')}`;
  return `${local}@${domain}`;
}

function buildPeople(role, count, seedTag, domain) {
  const prng = createPrng(`${seedTag}:${role}:people`);
  const firstNames = shuffleWithPrng(FIRST_NAMES, prng);
  const lastNames = shuffleWithPrng(LAST_NAMES, prng);
  const people = [];

  for (let index = 0; index < count; index += 1) {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[(index * 3) % lastNames.length];
    people.push({
      firstName,
      lastName,
      email: buildSeedEmail(role, firstName, lastName, index, seedTag, domain),
    });
  }

  return people;
}

function buildCourseSpecs(seedTag, count) {
  const prng = createPrng(`${seedTag}:courses`);
  return pickDistinct(COURSE_TEMPLATES, count, prng).map((template, index) => ({
    ...template,
    seedIndex: index,
    title: `${template.title} - Seed ${seedTag}`,
    label: `${template.title} (${seedTag})`,
  }));
}

function buildCurriculum(courseTitle, seedTag, courseIndex) {
  return {
    modules: [
      {
        id: `mod-${seedTag}-${courseIndex + 1}-1`,
        title: `${courseTitle} Foundations`,
        description: 'Seeded orientation and fundamentals module.',
        order: 1,
        lessons: [
          {
            id: `lesson-${seedTag}-${courseIndex + 1}-1`,
            title: 'Program Overview',
            type: 'reading',
            durationMinutes: 25,
            order: 1,
            isRequired: true,
          },
          {
            id: `lesson-${seedTag}-${courseIndex + 1}-2`,
            title: 'Tooling and Workflow',
            type: 'reading',
            durationMinutes: 35,
            order: 2,
            isRequired: true,
          },
        ],
      },
    ],
  };
}

function buildCoursePayload(spec, adminId) {
  const curriculum = buildCurriculum(spec.title, DEFAULT_SEED_TAG, spec.seedIndex);
  return {
    title: spec.title,
    description: spec.description,
    shortDescription: spec.shortDescription,
    category: spec.category,
    level: spec.level,
    pricing: spec.pricing,
    estimatedDuration: {
      hours: spec.durationHours,
      minutes: 0,
    },
    tags: [...spec.tags, 'seeded', `seed-${DEFAULT_SEED_TAG}`],
    isPublic: true,
    createdBy: adminId || undefined,
    curriculum,
    curriculumVersions: [
      {
        versionNumber: 1,
        label: `Seed Baseline ${DEFAULT_SEED_TAG}`,
        changeSummary: 'Initial seeded curriculum snapshot',
        workflowStage: 'APPROVED',
        curriculum,
        createdBy: adminId,
        approvedBy: adminId,
        approvedAt: new Date().toISOString(),
        isActive: true,
      },
    ],
    activeCurriculumVersion: 1,
    authoringWorkflow: {
      approvalRequired: false,
      stage: 'APPROVED',
      submittedForReviewAt: new Date().toISOString(),
      submittedBy: adminId,
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminId,
      reviewNotes: 'Seeded course auto-approved for mock data generation.',
    },
  };
}

function buildBatchSpec({ course, courseIndex, batchIndex, instructor, seedTag }) {
  const template = BATCH_TEMPLATES[batchIndex % BATCH_TEMPLATES.length];
  const baseDate = new Date();
  const startDate = addDays(baseDate, template.startOffsetDays + courseIndex * 7 + batchIndex * 5);
  startDate.setHours(0, 0, 0, 0);
  const endDate = addDays(startDate, template.durationDays);
  endDate.setHours(23, 59, 0, 0);

  const courseCode = slugify(course.title).replace(/-/g, '').slice(0, 5).toUpperCase() || `C${courseIndex + 1}`;
  const batchCode = `${courseCode}-${seedTag}-${courseIndex + 1}${batchIndex + 1}`;

  return {
    title: `${course.title} - ${template.label}`,
    batchCode,
    startDate,
    endDate,
    schedule: template.schedule,
    maxStudents: template.maxStudents,
    instructor,
    description: `${template.label} for ${course.title}. Assigned instructor: ${instructor.firstName} ${instructor.lastName}.`,
    prerequisites: 'No mandatory prerequisites. Basic commitment to complete the program is recommended.',
  };
}

function buildClassPlan(batch, course, classesPerBatch) {
  const classes = [];
  for (let index = 0; index < classesPerBatch; index += 1) {
    const start = addDays(batch.startDate, index * 7);
    const [hour, minute] = String(batch.schedule.startTime || '09:00').split(':').map(Number);
    const [endHour, endMinute] = String(batch.schedule.endTime || '11:00').split(':').map(Number);
    start.setUTCHours(hour, minute, 0, 0);
    const end = new Date(start);
    end.setUTCHours(endHour, endMinute, 0, 0);
    if (end <= start) {
      end.setTime(start.getTime() + 2 * 60 * 60 * 1000);
    }

    classes.push({
      title: `${CLASS_TOPICS[index % CLASS_TOPICS.length]} - ${batch.batchCode}`,
      description: `Seeded live class for ${course.title} in ${batch.title}.`,
      scheduledStartTime: start.toISOString(),
      scheduledEndTime: end.toISOString(),
    });
  }
  return classes;
}

function buildAssessmentPayload(type, courseId, batchId, courseTitle, batchCode) {
  const sectionId = `sec-${batchCode}-${type}`;
  const questionId = `q-${batchCode}-${type}-1`;
  const isAssignment = type === 'assignment';
  const isPractice = type === 'practice';
  const title = `${courseTitle} ${type.toUpperCase()} - ${batchCode}`;

  return {
    title,
    description: `Seeded ${type} assessment for ${courseTitle} (${batchCode}).`,
    instructions: {
      general: 'Read all questions carefully before answering.',
      additional: 'This assessment was generated by the API mock-data seeder.',
    },
    type,
    courseId,
    batchId,
    moduleId: `seed-module-${batchCode}`,
    lessonId: `seed-lesson-${batchCode}`,
    sections: [
      {
        id: sectionId,
        title: `${type.toUpperCase()} Section`,
        type: isAssignment ? 'theory' : isPractice ? 'coding' : 'mcq',
        description: 'Primary seeded section.',
        order: 1,
      },
    ],
    questions: [
      {
        id: questionId,
        type: isAssignment ? 'essay' : isPractice ? 'coding' : 'multiple-choice',
        sectionId,
        question: `Sample ${type} prompt for ${batchCode}`,
        options: isAssignment || isPractice
          ? []
          : [
              { id: 'opt-a', text: 'Option A', isCorrect: true },
              { id: 'opt-b', text: 'Option B', isCorrect: false },
              { id: 'opt-c', text: 'Option C', isCorrect: false },
            ],
        correctAnswer: isAssignment || isPractice ? null : 'opt-a',
        points: 10,
        explanation: 'Seeded assessment explanation.',
        difficulty: 'easy',
        order: 1,
        coding: isPractice
          ? {
              allowedLanguages: ['javascript'],
              starterCode: {
                javascript: 'function solve() {\n  return true;\n}',
              },
              testCases: [
                {
                  input: '',
                  expectedOutput: 'true',
                  isHidden: false,
                  weight: 1,
                },
              ],
            }
          : undefined,
      },
    ],
    settings: {
      attempts: 3,
      showResults: 'immediately',
      allowReview: true,
      showCorrectAnswers: true,
      timeLimit: isAssignment ? null : 45,
      shuffleQuestions: false,
      shuffleOptions: false,
      requireCamera: false,
      requireFullScreen: false,
      preventCopyPaste: false,
    },
    grading: {
      totalPoints: 10,
      passingScore: 60,
      gradingMethod: isAssignment ? 'hybrid' : 'automatic',
      weightage: 25,
    },
    schedule: {
      isScheduled: true,
      startDate: new Date().toISOString(),
      endDate: addMonths(new Date(), 1).toISOString(),
      timezone: 'UTC',
    },
    status: 'draft',
  };
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

async function findInstructorByEmail(api, email) {
  const response = await api.get('/instructors', {
    params: { page: 1, limit: 100, search: email },
  });
  return findByEmail(extractCollection(response.data), email);
}

async function findStudentByEmail(api, email) {
  const response = await api.get('/students', {
    params: { page: 1, limit: 100, search: email },
  });
  return findByEmail(extractCollection(response.data), email);
}

async function ensureInstructor(api, person) {
  const existing = await findInstructorByEmail(api, person.email);
  if (existing) {
    return { entity: existing, created: false };
  }

  const response = await api.post('/instructors', {
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    password: ROLE_PASSWORDS.instructor,
    expertise: person.expertise,
    bio: `Seeded instructor profile for ${person.firstName} ${person.lastName}.`,
    qualifications: ['Seeded Profile'],
  });

  return { entity: extractData(response.data), created: true };
}

async function ensureStudent(api, person) {
  const existing = await findStudentByEmail(api, person.email);
  if (existing) {
    return { entity: existing, created: false };
  }

  const response = await api.post('/students', {
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    password: ROLE_PASSWORDS.student,
  });

  return { entity: extractData(response.data), created: true };
}

async function findCourseByTitle(api, title) {
  const response = await api.get('/courses', {
    params: { page: 1, limit: 100, search: title },
  });
  return findByTitle(extractCollection(response.data), title);
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

async function ensureCourse(api, spec, adminId) {
  const existing = await findCourseByTitle(api, spec.title);
  if (existing) {
    const courseId = extractId(existing);
    if (courseId && String(existing.status || '').toUpperCase() !== 'PUBLISHED') {
      await ensureCoursePublished(api, courseId);
    }
    return { entity: existing, created: false };
  }

  const response = await api.post('/courses', buildCoursePayload(spec, adminId));
  const course = extractData(response.data);
  const courseId = extractId(course);
  if (!courseId) {
    throw new Error(`Course create response did not include course ID for "${spec.title}".`);
  }

  await ensureCoursePublished(api, courseId);
  return { entity: course, created: true };
}

async function findBatchByCode(api, courseId, batchCode) {
  const response = await api.get('/batches', {
    params: {
      page: 1,
      limit: 200,
      courseId,
    },
  });
  const items = extractCollection(response.data);
  return items.find((item) => String(item?.batchCode || '') === batchCode) || null;
}

async function ensureBatch(api, spec, courseId, instructorId) {
  const existing = await findBatchByCode(api, courseId, spec.batchCode);
  if (existing) {
    return { entity: existing, created: false };
  }

  const response = await api.post('/batches', {
    name: spec.title,
    courseId,
    instructorId,
    batchCode: spec.batchCode,
    startDate: spec.startDate.toISOString(),
    endDate: spec.endDate.toISOString(),
    maxStudents: spec.maxStudents,
    schedule: spec.schedule,
    description: spec.description,
    prerequisites: spec.prerequisites,
  });

  return { entity: extractData(response.data), created: true };
}

async function listBatchClasses(api, batchId) {
  const response = await api.get(`/batches/${batchId}/classes`);
  return extractCollection(response.data);
}

async function ensureLiveClasses(api, batch, courseTitle, classesPerBatch) {
  const batchId = extractId(batch);
  if (!batchId) {
    throw new Error(`Could not resolve batch ID for class generation (${courseTitle}).`);
  }

  const existingClasses = await listBatchClasses(api, batchId);
  const existingByTitle = new Map(existingClasses.map((item) => [toLower(item?.title), item]));
  const plannedClasses = buildClassPlan(
    {
      batchCode: batch.batchCode,
      batchId,
      startDate: new Date(batch.startDate),
      schedule: batch.schedule || { startTime: '09:00', endTime: '11:00' },
      title: batch.name,
    },
    { title: courseTitle },
    classesPerBatch,
  );

  const results = [];
  for (const classSpec of plannedClasses) {
    const existing = existingByTitle.get(toLower(classSpec.title));
    if (existing) {
      results.push({ entity: existing, created: false });
      continue;
    }

    const response = await api.post(`/batches/${batchId}/classes`, classSpec);
    results.push({ entity: extractData(response.data), created: true });
  }

  return results;
}

async function listCourseAssessments(api, courseId) {
  const response = await api.get(`/assessments/course/${courseId}`);
  return extractCollection(response.data);
}

async function ensureAssessments(api, course, batch) {
  const courseId = extractId(course);
  const batchId = extractId(batch);
  const existingAssessments = await listCourseAssessments(api, courseId);
  const existingByTitle = new Map(existingAssessments.map((item) => [toLower(item?.title), item]));
  const results = [];

  for (const type of ASSESSMENT_TYPES) {
    const payload = buildAssessmentPayload(type, courseId, batchId, course.title, batch.batchCode);
    const existing = existingByTitle.get(toLower(payload.title));
    let assessment = existing;
    let created = false;

    if (!assessment) {
      const response = await api.post('/assessments', payload);
      assessment = extractData(response.data);
      created = true;
    }

    const assessmentId = extractId(assessment);
    if (!assessmentId) {
      throw new Error(`Assessment ID missing for "${payload.title}".`);
    }

    if (String(assessment?.status || '').toLowerCase() !== 'published') {
      await api.patch(`/assessments/${assessmentId}/publish`);
      assessment.status = 'published';
    }

    results.push({ entity: assessment, created });
  }

  return results;
}

async function listBatchEnrollments(api, batchId) {
  const response = await api.get(`/enrollments/batch/${batchId}`);
  return extractCollection(response.data);
}

async function ensureEnrollment(api, { student, course, batch }) {
  const batchId = extractId(batch);
  const courseId = extractId(course);
  const studentId = extractId(student);
  const enrollments = await listBatchEnrollments(api, batchId);
  const existing = enrollments.find((item) => {
    const existingStudentId = extractId(item?.studentId);
    return existingStudentId && existingStudentId === studentId;
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
      status: course.pricing?.type === 'FREE' || Number(course.pricing?.amount || 0) === 0 ? 'WAIVED' : 'PAID',
      amount: Number(course.pricing?.amount || 0),
      transactionId: `SEED-${batch.batchCode}-${studentId.slice(-6)}`,
    },
    notes: `Seeded enrollment for ${student.firstName} ${student.lastName}`,
  });

  return { entity: extractData(response.data), created: true };
}

async function decorateEnrollment(api, enrollment, batch, seedTag) {
  const enrollmentId = extractId(enrollment);
  if (!enrollmentId) return;

  const classCount = Math.max(1, Number(batch.classCount || 1));
  const prng = createPrng(`${seedTag}:${enrollmentId}`);
  const completedClasses = randomInt(prng, 0, classCount);
  const attendedClasses = randomInt(prng, completedClasses, classCount);
  const assignmentScore = randomInt(prng, 65, 98);

  await api.put(`/enrollments/${enrollmentId}/progress`, {
    completedClasses,
    totalClasses: classCount,
  });

  await api.put(`/enrollments/${enrollmentId}/attendance`, {
    attendedClasses,
    totalClasses: classCount,
  });

  await api.post(`/enrollments/${enrollmentId}/grades`, {
    title: `Seeded Assignment - ${batch.batchCode}`,
    score: assignmentScore,
    maxScore: 100,
  });
}

function buildEnrollmentPlan(students, courseRecords, counts, seedTag) {
  const prng = createPrng(`${seedTag}:enrollment-plan`);
  const assignments = [];

  for (const student of students) {
    const desiredCourseCount = randomInt(
      prng,
      Math.min(counts.minCoursesPerStudent, courseRecords.length),
      Math.min(counts.maxCoursesPerStudent, courseRecords.length),
    );
    const chosenCourses = pickDistinct(courseRecords, desiredCourseCount, prng);

    for (const courseRecord of chosenCourses) {
      const batch = courseRecord.batches[Math.floor(prng() * courseRecord.batches.length)];
      if (!batch) continue;
      assignments.push({
        student,
        course: courseRecord.course,
        batch,
      });
    }
  }

  return assignments;
}

function track(statsBucket, result) {
  if (result.created) {
    statsBucket.created += 1;
  } else {
    statsBucket.found += 1;
  }
}

function buildScenario({ adminEmail, counts, seedTag }) {
  const domain = process.env.SEED_EMAIL_DOMAIN || String(adminEmail || '').split('@')[1] || 'example.com';
  const instructors = buildPeople('instructor', counts.instructors, seedTag, domain).map((person, index) => ({
    ...person,
    expertise: EXPERTISE_AREAS[index % EXPERTISE_AREAS.length],
  }));
  const students = buildPeople('student', counts.students, seedTag, domain);
  const courses = buildCourseSpecs(seedTag, counts.courses);

  return {
    seedTag,
    domain,
    instructors,
    students,
    courses,
  };
}

async function run() {
  try {
    console.log('Starting API-based LMS comprehensive mock-data seed...');
    console.log('This script logs in as admin, creates realistic users, courses, batches, classes, assessments, and student enrollments.');

    const config = await promptConfig();
    const counts = readCounts();
    const scenario = buildScenario({
      adminEmail: config.adminEmail,
      counts,
      seedTag: DEFAULT_SEED_TAG,
    });
    const api = createApiClient(config.baseUrl);
    const stats = {
      instructors: { created: 0, found: 0 },
      students: { created: 0, found: 0 },
      courses: { created: 0, found: 0 },
      batches: { created: 0, found: 0 },
      classes: { created: 0, found: 0 },
      assessments: { created: 0, found: 0 },
      enrollments: { created: 0, found: 0 },
    };

    console.log(`\nSeed tag: ${scenario.seedTag}`);
    console.log(
      `Planned volume: ${counts.instructors} instructors, ${counts.students} students, ${counts.courses} courses, ${counts.batchesPerCourse} batches/course, ${counts.classesPerBatch} classes/batch.`,
    );

    console.log(`\n[1/5] Logging in to ${config.baseUrl} ...`);
    const adminUser = await login(api, config.adminEmail, config.adminPassword);
    const adminId = extractId(adminUser);
    console.log(`- Authenticated as ${config.adminEmail}`);

    console.log('\n[2/5] Ensuring instructor and student users...');
    const instructors = [];
    for (const person of scenario.instructors) {
      const result = await ensureInstructor(api, person);
      instructors.push({ ...person, ...result.entity });
      track(stats.instructors, result);
      console.log(`- Instructor ${result.created ? 'created' : 'found'}: ${person.email}`);
    }

    const students = [];
    for (const person of scenario.students) {
      const result = await ensureStudent(api, person);
      students.push({ ...person, ...result.entity });
      track(stats.students, result);
    }
    console.log(`- Student accounts ensured: ${students.length}`);

    console.log('\n[3/5] Ensuring courses, batches, and live classes...');
    const courseRecords = [];
    for (let courseIndex = 0; courseIndex < scenario.courses.length; courseIndex += 1) {
      const courseSpec = scenario.courses[courseIndex];
      const courseResult = await ensureCourse(api, courseSpec, adminId);
      const course = { ...courseSpec, ...courseResult.entity };
      track(stats.courses, courseResult);
      console.log(`- Course ${courseResult.created ? 'created' : 'found'}: ${course.title}`);

      const batches = [];
      for (let batchIndex = 0; batchIndex < counts.batchesPerCourse; batchIndex += 1) {
        const instructor = instructors[(courseIndex + batchIndex) % instructors.length];
        const batchSpec = buildBatchSpec({
          course,
          courseIndex,
          batchIndex,
          instructor,
          seedTag: scenario.seedTag,
        });
        const batchResult = await ensureBatch(api, batchSpec, extractId(course), extractId(instructor));
        const batch = {
          ...batchSpec,
          ...batchResult.entity,
          instructor,
        };
        track(stats.batches, batchResult);

        const classResults = await ensureLiveClasses(api, batch, course.title, counts.classesPerBatch);
        classResults.forEach((result) => track(stats.classes, result));
        batch.classCount = classResults.length;

        console.log(
          `  - Batch ${batchResult.created ? 'created' : 'found'}: ${batch.batchCode} | instructor ${instructor.firstName} ${instructor.lastName} | classes ${classResults.length}`,
        );
        batches.push(batch);
      }

      courseRecords.push({ course, batches });
    }

    console.log('\n[4/5] Ensuring assessments for generated batches...');
    for (const courseRecord of courseRecords) {
      for (const batch of courseRecord.batches) {
        const assessmentResults = await ensureAssessments(api, courseRecord.course, batch);
        assessmentResults.forEach((result) => track(stats.assessments, result));
      }
      console.log(`- Assessments ensured for ${courseRecord.course.title}`);
    }

    console.log('\n[5/5] Enrolling students and decorating progress...');
    const enrollmentPlan = buildEnrollmentPlan(students, courseRecords, counts, scenario.seedTag);
    for (const assignment of enrollmentPlan) {
      const enrollmentResult = await ensureEnrollment(api, assignment);
      track(stats.enrollments, enrollmentResult);
      if (enrollmentResult.created) {
        await decorateEnrollment(api, enrollmentResult.entity, assignment.batch, scenario.seedTag);
      }
    }
    console.log(`- Enrollment assignments processed: ${enrollmentPlan.length}`);

    console.log('\nSeed summary');
    console.log(`- LMS URL: ${config.baseUrl}`);
    console.log(`- Seed tag: ${scenario.seedTag}`);
    console.log(`- Instructors: ${stats.instructors.created} created, ${stats.instructors.found} reused`);
    console.log(`- Students: ${stats.students.created} created, ${stats.students.found} reused`);
    console.log(`- Courses: ${stats.courses.created} created, ${stats.courses.found} reused`);
    console.log(`- Batches: ${stats.batches.created} created, ${stats.batches.found} reused`);
    console.log(`- Classes: ${stats.classes.created} created, ${stats.classes.found} reused`);
    console.log(`- Assessments: ${stats.assessments.created} created, ${stats.assessments.found} reused`);
    console.log(`- Enrollments: ${stats.enrollments.created} created, ${stats.enrollments.found} reused`);
    console.log(`- Instructor login password: ${ROLE_PASSWORDS.instructor}`);
    console.log(`- Student login password: ${ROLE_PASSWORDS.student}`);
    console.log('- Instructor-to-batch linkage is modeled as assignment, not enrollment, because this API only supports student enrollments.');

    console.log('\nSample seeded accounts');
    scenario.instructors.slice(0, 3).forEach((person) => {
      console.log(`- Instructor: ${person.email}`);
    });
    scenario.students.slice(0, 5).forEach((person) => {
      console.log(`- Student: ${person.email}`);
    });

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

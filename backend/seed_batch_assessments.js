const axios = require('axios');
const readline = require('readline');
require('dotenv').config();

const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@lmsfutureproof.com';
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Test@12345';
const DEFAULT_LMS_URL = process.env.SEED_LMS_URL || 'http://localhost:5000';

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

function normalizeBaseUrl(input) {
  const value = String(input || '').trim();
  if (!value) return '';

  const withProtocol = /^https?:\/\//i.test(value)
    ? value
    : value.startsWith('localhost') || value.startsWith('127.0.0.1')
      ? `http://${value}`
      : `https://${value}`;

  return withProtocol.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function toLower(value) {
  return String(value || '').trim().toLowerCase();
}

function extractData(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return payload.data !== undefined ? payload.data : payload;
}

function extractCollection(payload) {
  const root = extractData(payload);
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.documents)) return root.documents;
  return [];
}

function extractId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (value.id) return String(value.id);
    if (value._id) return String(value._id);
  }
  return null;
}

function isAxiosError(error) {
  return Boolean(error && error.isAxiosError);
}

function formatApiError(error) {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error.message : String(error);
  }

  const status = error.response?.status;
  const payload = error.response?.data || {};
  const message =
    payload.message ||
    payload.error ||
    (Array.isArray(payload.errors)
      ? payload.errors.map((item) => item.msg || item.message).join('; ')
      : null) ||
    error.message;

  return `HTTP ${status || 'ERR'}: ${message}`;
}

async function promptConfig() {
  const rl = createPrompt();
  try {
    const lmsUrlInput = await ask(rl, `LMS URL (${DEFAULT_LMS_URL}): `);
    const adminEmailInput = await ask(rl, `Admin email (${DEFAULT_ADMIN_EMAIL}): `);
    const adminPasswordInput = await ask(
      rl,
      `Admin password (${DEFAULT_ADMIN_PASSWORD ? 'press Enter to use default' : 'required'}): `,
    );

    const baseUrl = normalizeBaseUrl(lmsUrlInput || DEFAULT_LMS_URL);
    const adminEmail = toLower(adminEmailInput || DEFAULT_ADMIN_EMAIL);
    const adminPassword = adminPasswordInput || DEFAULT_ADMIN_PASSWORD;

    if (!baseUrl) {
      throw new Error('LMS URL is required.');
    }
    if (!adminEmail || !adminPassword) {
      throw new Error('Admin email and password are required.');
    }

    return { baseUrl, adminEmail, adminPassword };
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

async function fetchAllBatches(api) {
  const all = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response = await api.get('/batches', {
      params: {
        page,
        limit: 100,
      },
    });

    const items = extractCollection(response.data);
    all.push(...items);

    const pagination = response.data?.pagination || {};
    hasNext = Boolean(pagination.hasNext);
    page += 1;

    if (!pagination || items.length === 0) {
      hasNext = false;
    }
  }

  return all;
}

async function listBatchAssessments(api, courseId, batchId) {
  const response = await api.get('/assessments', {
    params: {
      page: 1,
      limit: 100,
      courseId,
      batchId,
    },
  });
  return extractCollection(response.data);
}

function buildQuestionSet(batchCode) {
  return [
    {
      id: `mcq-${batchCode}`,
      type: 'multiple-choice',
      question: `Which statement best matches the core concept for ${batchCode}?`,
      options: [
        { id: 'mcq-a', text: 'Option A', isCorrect: true },
        { id: 'mcq-b', text: 'Option B', isCorrect: false },
        { id: 'mcq-c', text: 'Option C', isCorrect: false },
        { id: 'mcq-d', text: 'Option D', isCorrect: false },
      ],
      correctAnswer: 'mcq-a',
      points: 10,
      explanation: 'The first option is intentionally marked as correct for seed data.',
      difficulty: 'easy',
      order: 1,
    },
    {
      id: `tf-${batchCode}`,
      type: 'true-false',
      question: `True or false: ${batchCode} follows a structured learning sequence.`,
      options: [
        { id: 'true', text: 'True', isCorrect: true },
        { id: 'false', text: 'False', isCorrect: false },
      ],
      correctAnswer: 'true',
      points: 5,
      explanation: 'This seeded question is designed with a true answer.',
      difficulty: 'easy',
      order: 2,
    },
    {
      id: `short-${batchCode}`,
      type: 'short-answer',
      question: `In one or two lines, describe the main outcome expected from ${batchCode}.`,
      correctAnswer: 'A concise learner outcome summary.',
      points: 10,
      explanation: 'Short-answer questions help test conceptual understanding.',
      difficulty: 'medium',
      order: 3,
    },
    {
      id: `essay-${batchCode}`,
      type: 'essay',
      question: `Write a short reflection on how students can apply the lessons from ${batchCode} in a real project.`,
      correctAnswer: 'Open-ended instructor-reviewed response.',
      points: 20,
      explanation: 'Essay questions are included for manual grading flow.',
      difficulty: 'medium',
      order: 4,
    },
    {
      id: `blank-${batchCode}`,
      type: 'fill-blank',
      question: `Complete the phrase: ${batchCode} is designed for ______ learning.`,
      correctAnswer: 'practical',
      points: 5,
      explanation: 'Fill-blank questions are seeded with a simple exact answer.',
      difficulty: 'easy',
      order: 5,
    },
    {
      id: `code-${batchCode}`,
      type: 'coding',
      question: `Return the string "seeded-${batchCode.toLowerCase()}" from the solve function.`,
      points: 25,
      explanation: 'Coding question verifies the basic code runner path.',
      difficulty: 'medium',
      order: 6,
      coding: {
        allowedLanguages: ['javascript', 'python'],
        starterCode: {
          javascript: 'function solve() {\n  return "seeded-' + batchCode.toLowerCase() + '";\n}\n',
          python: 'def solve():\n    return "seeded-' + batchCode.toLowerCase() + '"\n',
        },
        testCases: [
          {
            input: '',
            expectedOutput: `seeded-${batchCode.toLowerCase()}`,
            isHidden: false,
            weight: 1,
          },
          {
            input: '',
            expectedOutput: `seeded-${batchCode.toLowerCase()}`,
            isHidden: true,
            weight: 2,
          },
        ],
      },
    },
  ];
}

function buildAssessmentPayload(batch) {
  const batchId = extractId(batch);
  const courseId = extractId(batch.courseId);
  const courseTitle = String(batch.courseId?.title || 'Course').trim();
  const batchCode = String(batch.batchCode || batch.name || batchId || 'BATCH').trim();
  const timezone = String(batch.schedule?.timezone || 'UTC').trim() || 'UTC';
  const title = `Comprehensive Seed Assessment - ${batchCode}`;
  const questions = buildQuestionSet(batchCode);
  const totalPoints = questions.reduce((sum, question) => sum + Number(question.points || 0), 0);
  const now = new Date();
  const end = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

  return {
    title,
    description: `Production-style seeded assessment for ${courseTitle} (${batchCode}) with every supported question type.`,
    instructions: {
      general: 'Answer all sections carefully. Objective questions are auto-graded while subjective ones may need review.',
      additional: 'This assessment was seeded automatically through the batch assessment generator.',
    },
    type: 'exam',
    courseId,
    batchId,
    sections: [
      {
        id: `section-objective-${batchCode}`,
        title: 'Objective Section',
        type: 'mcq',
        description: 'Auto-graded objective questions.',
        order: 1,
      },
      {
        id: `section-subjective-${batchCode}`,
        title: 'Subjective and Coding Section',
        type: 'theory',
        description: 'Manual review and coding evaluation section.',
        order: 2,
      },
    ],
    questions: questions.map((question) => ({
      ...question,
      sectionId:
        question.type === 'multiple-choice' ||
        question.type === 'true-false' ||
        question.type === 'fill-blank'
          ? `section-objective-${batchCode}`
          : `section-subjective-${batchCode}`,
    })),
    settings: {
      attempts: 2,
      showResults: 'immediately',
      showCorrectAnswers: true,
      allowReview: true,
      timeLimit: 75,
      shuffleQuestions: false,
      shuffleOptions: false,
      requireCamera: false,
      requireFullScreen: false,
      preventCopyPaste: false,
    },
    grading: {
      totalPoints,
      passingScore: 60,
      gradingMethod: 'hybrid',
      weightage: 25,
    },
    schedule: {
      isScheduled: true,
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      timezone,
    },
    status: 'draft',
  };
}

async function ensureAssessmentForBatch(api, batch) {
  const batchId = extractId(batch);
  const courseId = extractId(batch.courseId);

  if (!batchId || !courseId) {
    throw new Error(`Batch ${batch.name || batch.batchCode || 'unknown'} is missing batch/course identifiers.`);
  }

  const payload = buildAssessmentPayload(batch);
  const existingAssessments = await listBatchAssessments(api, courseId, batchId);
  const existing = existingAssessments.find(
    (item) => toLower(item?.title) === toLower(payload.title),
  );

  let assessment = existing;
  let created = false;

  if (!assessment) {
    const response = await api.post('/assessments', payload);
    assessment = extractData(response.data);
    created = true;
  }

  const assessmentId = extractId(assessment);
  if (!assessmentId) {
    throw new Error(`Assessment ID missing for batch ${batch.batchCode || batch.name}.`);
  }

  if (String(assessment?.status || '').trim().toLowerCase() !== 'published') {
    await api.patch(`/assessments/${assessmentId}/publish`);
    assessment.status = 'published';
  }

  return {
    created,
    assessment,
    title: payload.title,
  };
}

async function run() {
  try {
    console.log('Starting batch assessment generator...');
    console.log('This script logs in as admin and creates one comprehensive assessment for every available batch.');

    const config = await promptConfig();
    const api = createApiClient(config.baseUrl);

    console.log(`\n[1/3] Logging in to ${config.baseUrl} ...`);
    await login(api, config.adminEmail, config.adminPassword);
    console.log(`- Authenticated as ${config.adminEmail}`);

    console.log('\n[2/3] Loading batches ...');
    const batches = await fetchAllBatches(api);
    if (batches.length === 0) {
      console.log('- No batches found. Nothing to seed.');
      return;
    }
    console.log(`- Found ${batches.length} batch(es)`);

    console.log('\n[3/3] Creating assessments ...');
    const stats = {
      created: 0,
      reused: 0,
      failed: 0,
    };

    for (const batch of batches) {
      const batchLabel = `${batch.batchCode || batch.name || extractId(batch)}${batch.courseId?.title ? ` | ${batch.courseId.title}` : ''}`;
      try {
        const result = await ensureAssessmentForBatch(api, batch);
        if (result.created) {
          stats.created += 1;
        } else {
          stats.reused += 1;
        }
        console.log(`- ${result.created ? 'Created' : 'Reused'}: ${result.title} (${batchLabel})`);
      } catch (error) {
        stats.failed += 1;
        console.log(`- Failed for ${batchLabel}: ${formatApiError(error)}`);
      }
    }

    console.log('\nBatch assessment summary');
    console.log(`- LMS URL: ${config.baseUrl}`);
    console.log(`- Batches processed: ${batches.length}`);
    console.log(`- Assessments created: ${stats.created}`);
    console.log(`- Assessments reused: ${stats.reused}`);
    console.log(`- Failures: ${stats.failed}`);
    console.log('\nEach created assessment is published and includes: multiple-choice, true-false, short-answer, essay, fill-blank, and coding questions.');
  } catch (error) {
    console.error(`Batch assessment generator failed: ${formatApiError(error)}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run();
}

module.exports = run;

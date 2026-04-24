const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@lmsfutureproof.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin123456';
const STUDENT_EMAIL = process.env.TEST_STUDENT_EMAIL || 'student@lmsfutureproof.com';
const STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD || 'student123';
const SHOULD_RUN = process.env.RUN_ASSESSMENT_INTEGRATION === '1';

const getId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id || value.id || null;
};

const createClient = (token) =>
  axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

async function login(email, password) {
  const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });
  const token = response.data?.token;
  assert.ok(token, `Login succeeded but token missing for ${email}`);
  return token;
}

test(
  'assessment end-to-end flow (create -> publish -> attempt -> submit -> results)',
  { skip: !SHOULD_RUN },
  async () => {
    const [adminToken, studentToken] = await Promise.all([
      login(ADMIN_EMAIL, ADMIN_PASSWORD),
      login(STUDENT_EMAIL, STUDENT_PASSWORD)
    ]);

    const adminClient = createClient(adminToken);
    const studentClient = createClient(studentToken);
    let createdAssessmentId = null;

    try {
      const enrollmentsResponse = await studentClient.get('/students/my-enrollments');
      const enrollments = enrollmentsResponse.data?.data || [];
      assert.ok(Array.isArray(enrollments) && enrollments.length > 0, 'Student has no enrollments');

      const enrollment = enrollments[0];
      const courseId = getId(enrollment.courseId);
      const batchId = getId(enrollment.batchId);
      assert.ok(courseId, 'Could not resolve courseId from enrollment');

      const unique = Date.now();
      const createPayload = {
        title: `Assessment Integration ${unique}`,
        description: 'Automated assessment integration test',
        type: 'quiz',
        courseId,
        ...(batchId ? { batchId } : {}),
        settings: {
          timeLimit: 30,
          attempts: 2,
          shuffleQuestions: false,
          shuffleOptions: false,
          showResults: 'immediately',
          showCorrectAnswers: true,
          allowReview: true
        },
        grading: {
          passingScore: 50,
          gradingMethod: 'automatic',
          weightage: 100
        },
        questions: [
          {
            id: `q_${unique}`,
            type: 'true-false',
            question: 'Automated test question: true or false?',
            correctAnswer: true,
            points: 1,
            explanation: 'Validates submission pipeline'
          }
        ]
      };

      const createResponse = await adminClient.post('/assessments', createPayload);
      createdAssessmentId = getId(createResponse.data?.data);
      assert.ok(createdAssessmentId, 'Assessment was not created');

      await adminClient.patch(`/assessments/${createdAssessmentId}/publish`);

      const startResponse = await studentClient.post(`/assessments/${createdAssessmentId}/start`);
      const submissionId = getId(startResponse.data?.data?.submission);
      const firstQuestionId = startResponse.data?.data?.questions?.[0]?.id;
      assert.ok(submissionId, 'Submission was not created on start');
      assert.ok(firstQuestionId, 'Question id missing on start response');

      await studentClient.patch(`/assessments/submissions/${submissionId}/progress`, {
        questionId: firstQuestionId,
        answer: true,
        timeSpent: 5
      });

      await studentClient.post(`/assessments/submissions/${submissionId}/submit`, {
        answers: [{ questionId: firstQuestionId, answer: true }],
        deviceInfo: {
          userAgent: 'node-test-assessment-integration',
          screenResolution: '1920x1080',
          timezone: 'UTC'
        }
      });

      const resultsResponse = await studentClient.get(`/assessments/${createdAssessmentId}/results`);
      const totalAttempts = resultsResponse.data?.data?.totalAttempts;
      assert.ok(Number(totalAttempts) >= 1, 'Results endpoint did not include attempts');

      const submissionsResponse = await adminClient.get(`/assessments/${createdAssessmentId}/submissions?limit=10`);
      const submissions = submissionsResponse.data?.data || [];
      assert.ok(Array.isArray(submissions) && submissions.length >= 1, 'Submissions endpoint returned no rows');
    } finally {
      if (createdAssessmentId) {
        try {
          await adminClient.delete(`/assessments/${createdAssessmentId}`);
        } catch (cleanupError) {
          // Keep test result focused on functional assertions.
          console.warn(
            `Cleanup warning for assessment ${createdAssessmentId}: ${cleanupError.message || cleanupError}`
          );
        }
      }
    }
  }
);

test(
  'student available endpoints exclude future scheduled assessments',
  { skip: !SHOULD_RUN },
  async () => {
    const [adminToken, studentToken] = await Promise.all([
      login(ADMIN_EMAIL, ADMIN_PASSWORD),
      login(STUDENT_EMAIL, STUDENT_PASSWORD)
    ]);

    const adminClient = createClient(adminToken);
    const studentClient = createClient(studentToken);
    let createdAssessmentId = null;

    try {
      const enrollmentsResponse = await studentClient.get('/students/my-enrollments');
      const enrollments = enrollmentsResponse.data?.data || [];
      assert.ok(Array.isArray(enrollments) && enrollments.length > 0, 'Student has no enrollments');

      const enrollment = enrollments[0];
      const courseId = getId(enrollment.courseId);
      const batchId = getId(enrollment.batchId);
      assert.ok(courseId, 'Could not resolve courseId from enrollment');

      const unique = Date.now();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const twoDaysLater = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const createPayload = {
        title: `Assessment Future Window ${unique}`,
        description: 'Future assessment should not appear in available endpoints',
        type: 'quiz',
        courseId,
        ...(batchId ? { batchId } : {}),
        settings: {
          timeLimit: 30,
          attempts: 1,
          shuffleQuestions: false,
          shuffleOptions: false,
          showResults: 'immediately',
          showCorrectAnswers: true,
          allowReview: true
        },
        grading: {
          passingScore: 50,
          gradingMethod: 'automatic',
          weightage: 100
        },
        schedule: {
          isScheduled: true,
          startDate: tomorrow.toISOString(),
          endDate: twoDaysLater.toISOString(),
          timezone: 'UTC'
        },
        questions: [
          {
            id: `q_future_${unique}`,
            type: 'true-false',
            question: 'Future question',
            correctAnswer: true,
            points: 1
          }
        ]
      };

      const createResponse = await adminClient.post('/assessments', createPayload);
      createdAssessmentId = getId(createResponse.data?.data);
      assert.ok(createdAssessmentId, 'Future assessment was not created');

      await adminClient.patch(`/assessments/${createdAssessmentId}/publish`);

      const [availableResponse, courseAvailableResponse] = await Promise.all([
        studentClient.get('/assessments/available'),
        studentClient.get(`/assessments/course/${courseId}`)
      ]);

      const availableAssessments = availableResponse.data?.data || [];
      const courseAssessments = courseAvailableResponse.data?.data || [];

      assert.equal(
        availableAssessments.some((item) => getId(item) === createdAssessmentId),
        false,
        'Future scheduled assessment leaked into /assessments/available'
      );
      assert.equal(
        courseAssessments.some((item) => getId(item) === createdAssessmentId),
        false,
        'Future scheduled assessment leaked into course-specific student assessment list'
      );
    } finally {
      if (createdAssessmentId) {
        try {
          await adminClient.delete(`/assessments/${createdAssessmentId}`);
        } catch (cleanupError) {
          console.warn(
            `Cleanup warning for assessment ${createdAssessmentId}: ${cleanupError.message || cleanupError}`
          );
        }
      }
    }
  }
);

test(
  'student cannot read draft assessment details directly',
  { skip: !SHOULD_RUN },
  async () => {
    const [adminToken, studentToken] = await Promise.all([
      login(ADMIN_EMAIL, ADMIN_PASSWORD),
      login(STUDENT_EMAIL, STUDENT_PASSWORD)
    ]);

    const adminClient = createClient(adminToken);
    const studentClient = createClient(studentToken);
    let createdAssessmentId = null;

    try {
      const enrollmentsResponse = await studentClient.get('/students/my-enrollments');
      const enrollments = enrollmentsResponse.data?.data || [];
      assert.ok(Array.isArray(enrollments) && enrollments.length > 0, 'Student has no enrollments');

      const enrollment = enrollments[0];
      const courseId = getId(enrollment.courseId);
      const batchId = getId(enrollment.batchId);
      assert.ok(courseId, 'Could not resolve courseId from enrollment');

      const unique = Date.now();
      const createPayload = {
        title: `Assessment Draft Access ${unique}`,
        description: 'Draft detail should not be readable by student',
        type: 'quiz',
        courseId,
        ...(batchId ? { batchId } : {}),
        status: 'draft',
        settings: {
          timeLimit: 30,
          attempts: 1,
          shuffleQuestions: false,
          shuffleOptions: false,
          showResults: 'immediately',
          showCorrectAnswers: true,
          allowReview: true
        },
        grading: {
          passingScore: 50,
          gradingMethod: 'automatic',
          weightage: 100
        },
        questions: [
          {
            id: `q_draft_${unique}`,
            type: 'true-false',
            question: 'Draft question',
            correctAnswer: true,
            points: 1
          }
        ]
      };

      const createResponse = await adminClient.post('/assessments', createPayload);
      createdAssessmentId = getId(createResponse.data?.data);
      assert.ok(createdAssessmentId, 'Draft assessment was not created');

      await assert.rejects(
        () => studentClient.get(`/assessments/${createdAssessmentId}`),
        (error) => error?.response?.status === 403
      );
    } finally {
      if (createdAssessmentId) {
        try {
          await adminClient.delete(`/assessments/${createdAssessmentId}`);
        } catch (cleanupError) {
          console.warn(
            `Cleanup warning for assessment ${createdAssessmentId}: ${cleanupError.message || cleanupError}`
          );
        }
      }
    }
  }
);

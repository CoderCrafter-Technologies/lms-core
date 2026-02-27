const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@lmsfutureproof.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin123456';
const STUDENT_EMAIL = process.env.TEST_STUDENT_EMAIL || 'student@lmsfutureproof.com';
const STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD || 'student123';

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
  if (!token) {
    throw new Error(`Login succeeded but token missing for ${email}`);
  }
  return token;
}

async function run() {
  let adminClient;
  let studentClient;
  let createdAssessmentId = null;

  try {
    console.log('Running assessment flow test...');
    console.log(`API base: ${BASE_URL}`);

    const [adminToken, studentToken] = await Promise.all([
      login(ADMIN_EMAIL, ADMIN_PASSWORD),
      login(STUDENT_EMAIL, STUDENT_PASSWORD)
    ]);

    adminClient = createClient(adminToken);
    studentClient = createClient(studentToken);

    const enrollmentsResponse = await studentClient.get('/students/my-enrollments');
    const enrollments = enrollmentsResponse.data?.data || [];
    if (!Array.isArray(enrollments) || enrollments.length === 0) {
      throw new Error(
        'No student enrollments found. Ensure the test student is enrolled before running test_assessment_flow.js.'
      );
    }

    const enrollment = enrollments[0];
    const courseId = getId(enrollment.courseId);
    const batchId = getId(enrollment.batchId);
    if (!courseId) {
      throw new Error('Could not resolve courseId from student enrollment.');
    }

    const unique = Date.now();
    const createPayload = {
      title: `Assessment Flow Test ${unique}`,
      description: 'Automated assessment test payload',
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
          explanation: 'This question validates submission pipeline.'
        }
      ]
    };

    const createResponse = await adminClient.post('/assessments', createPayload);
    createdAssessmentId = getId(createResponse.data?.data);
    if (!createdAssessmentId) {
      throw new Error('Assessment was not created properly.');
    }
    console.log(`Created assessment: ${createdAssessmentId}`);

    await adminClient.patch(`/assessments/${createdAssessmentId}/publish`);
    console.log('Published assessment');

    const startResponse = await studentClient.post(`/assessments/${createdAssessmentId}/start`);
    const submissionId = getId(startResponse.data?.data?.submission);
    const questions = startResponse.data?.data?.questions || [];
    const firstQuestionId = questions[0]?.id;

    if (!submissionId || !firstQuestionId) {
      throw new Error('Failed to start assessment attempt or resolve question id.');
    }
    console.log(`Started attempt: ${submissionId}`);

    await studentClient.patch(`/assessments/submissions/${submissionId}/progress`, {
      questionId: firstQuestionId,
      answer: true,
      timeSpent: 5
    });
    console.log('Saved progress');

    await studentClient.post(`/assessments/submissions/${submissionId}/submit`, {
      answers: [
        {
          questionId: firstQuestionId,
          answer: true
        }
      ],
      deviceInfo: {
        userAgent: 'assessment-test-script',
        screenResolution: '1920x1080',
        timezone: 'UTC'
      }
    });
    console.log('Submitted attempt');

    const resultsResponse = await studentClient.get(`/assessments/${createdAssessmentId}/results`);
    const totalAttempts = resultsResponse.data?.data?.totalAttempts || 0;
    if (totalAttempts < 1) {
      throw new Error('Results did not return expected attempts.');
    }
    console.log(`Results verified (attempts: ${totalAttempts})`);

    const submissionsResponse = await adminClient.get(`/assessments/${createdAssessmentId}/submissions?limit=10`);
    const submissions = submissionsResponse.data?.data || [];
    if (!Array.isArray(submissions) || submissions.length < 1) {
      throw new Error('Admin submissions endpoint did not return expected data.');
    }
    console.log(`Admin submissions verified (count: ${submissions.length})`);

    console.log('Assessment flow test passed.');
    process.exit(0);
  } catch (error) {
    console.error('Assessment flow test failed.');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message || error);
    }
    process.exit(1);
  } finally {
    if (createdAssessmentId && adminClient) {
      try {
        await adminClient.delete(`/assessments/${createdAssessmentId}`);
        console.log(`Cleaned up assessment: ${createdAssessmentId}`);
      } catch (cleanupError) {
        console.warn(`Cleanup warning for assessment ${createdAssessmentId}: ${cleanupError.message}`);
      }
    }
  }
}

run();

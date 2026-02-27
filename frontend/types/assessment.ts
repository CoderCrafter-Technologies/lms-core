export type AssessmentKind = 'quiz' | 'exam' | 'assignment' | 'practice';
export type AssessmentQuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'essay'
  | 'fill-blank'
  | 'coding';

export interface AssessmentQuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface AssessmentCodingTestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  weight?: number;
}

export interface AssessmentQuestion {
  id: string;
  type: AssessmentQuestionType;
  sectionId?: string;
  question: string;
  options?: AssessmentQuestionOption[];
  correctAnswer?: unknown;
  points: number;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  coding?: {
    allowedLanguages?: string[];
    starterCode?: Record<string, string>;
    testCases?: AssessmentCodingTestCase[];
  };
  tags?: string[];
  order?: number;
}

export interface AssessmentEntity {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  type: AssessmentKind;
  courseId: string | { _id?: string; id?: string; title?: string };
  batchId?: string | { _id?: string; id?: string; name?: string; batchCode?: string } | null;
  settings: {
    timeLimit?: number | null;
    attempts: number;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    showResults?: 'immediately' | 'after-deadline' | 'manual' | 'never';
    showCorrectAnswers?: boolean;
    allowReview?: boolean;
    requireCamera?: boolean;
    requireFullScreen?: boolean;
    preventCopyPaste?: boolean;
  };
  grading: {
    totalPoints?: number;
    passingScore: number;
    gradingMethod?: 'automatic' | 'manual' | 'hybrid';
    weightage?: number;
  };
  schedule?: {
    isScheduled?: boolean;
    startDate?: string;
    endDate?: string;
    timezone?: string;
  };
  status?: 'draft' | 'published' | 'archived' | 'deleted';
  questions?: AssessmentQuestion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AssessmentSubmissionAnswer {
  questionId: string;
  answer: unknown;
  isCorrect?: boolean;
  points?: number;
  timeSpent?: number;
}

export interface AssessmentSubmission {
  _id?: string;
  id?: string;
  assessmentId?: string;
  studentId?: string | { _id?: string; id?: string; firstName?: string; lastName?: string; email?: string };
  attemptNumber: number;
  isCompleted: boolean;
  status: 'in-progress' | 'submitted' | 'graded' | 'late' | 'incomplete' | 'abandoned';
  startedAt: string;
  completedAt?: string;
  timeLimit?: number | null;
  timeSpent?: number;
  answers?: AssessmentSubmissionAnswer[];
  scoring?: {
    totalQuestions?: number;
    answeredQuestions?: number;
    correctAnswers?: number;
    totalPoints?: number;
    earnedPoints?: number;
    percentage?: number;
    grade?: string;
    isPassed?: boolean;
  };
}

export interface AssessmentAttemptStartData {
  submission: {
    id: string;
    attemptNumber: number;
    startedAt: string;
    timeLimit: number | null;
    remainingTime: number | null;
  };
  assessment: AssessmentEntity;
  questions: AssessmentQuestion[];
}

export interface AssessmentResultsData {
  assessment: AssessmentEntity;
  questions: AssessmentQuestion[];
  attempts: AssessmentSubmission[];
  bestAttempt?: AssessmentSubmission | null;
  totalAttempts: number;
}

export interface AssessmentCodeRunResult {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr?: string;
  passed: boolean;
}

export interface AssessmentCodeRunData {
  passedTestCases: number;
  totalTestCases: number;
  results: AssessmentCodeRunResult[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: {
    current: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

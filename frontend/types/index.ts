export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: {
    url?: string;
    publicId?: string;
  };
  roleId: string;
  role?: Role;
  managerPermissions?: string[];
  notificationSettings?: {
    inAppEnabled?: boolean;
    browserPushEnabled?: boolean;
    digestEnabled?: boolean;
    digestFrequency?: 'DAILY' | 'WEEKLY';
    digestHourUTC?: number;
    mutedTypes?: string[];
    mutedPriorities?: Array<'low' | 'normal' | 'high' | 'urgent'>;
    quietHours?: {
      enabled?: boolean;
      startHourUTC?: number;
      endHourUTC?: number;
    };
    lastDigestSentAt?: Date | string | null;
  };
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  level: number;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  thumbnail?: {
    url?: string;
    publicId?: string;
  };
  category: 'PROGRAMMING' | 'DATA_SCIENCE' | 'DESIGN' | 'BUSINESS' | 'MARKETING' | 'LANGUAGE' | 'OTHER';
  tags: string[];
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDuration?: {
    hours: number;
    minutes: number;
  };
  pricing: {
    type: 'FREE' | 'PAID' | 'SUBSCRIPTION';
    amount: number;
    currency: string;
  };
  createdBy: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isPublic: boolean;
  enrollmentCount: number;
  averageRating: number;
  totalRatings: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Batch {
  id: string;
  name: string;
  courseId: string;
  batchCode: string;
  startDate: Date;
  endDate: Date;
  schedule: {
    days: string[];
    startTime: string;
    endTime: string;
    timezone: string;
  };
  maxStudents: number;
  currentEnrollment: number;
  instructorId: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  settings: {
    allowLateJoin: boolean;
    autoEnrollment: boolean;
    recordClasses: boolean;
    allowStudentChat: boolean;
  };
  description: string;
  prerequisites: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LiveClass {
  id: string;
  title: string;
  batchId: string;
  instructorId: string;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  description: string;
  agenda: string;
  roomId: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  settings: {
    maxParticipants: number;
    allowRecording: boolean;
    allowScreenShare: boolean;
    allowWhiteboard: boolean;
    allowChat: boolean;
    allowStudentMic: boolean;
    allowStudentCamera: boolean;
    requireApproval: boolean;
  };
  recording: {
    isRecorded: boolean;
    recordingUrl?: string;
    recordingId?: string;
    recordingSize: number;
    recordingDuration: number;
  };
  stats: {
    totalParticipants: number;
    peakParticipants: number;
    averageParticipants: number;
    totalChatMessages: number;
  };
  materials: Array<{
    type: string;
    name: string;
    url: string;
    size: number;
    uploadedAt: Date;
  }>;
  createdBy: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  batchId: string;
  enrollmentDate: Date;
  status: 'ENROLLED' | 'COMPLETED' | 'DROPPED' | 'SUSPENDED';
  progress: {
    completedClasses: number;
    totalClasses: number;
    completionPercentage: number;
  };
  attendance: {
    totalClasses: number;
    attendedClasses: number;
    attendancePercentage: number;
  };
  grades: {
    assignments: Array<{
      title: string;
      score: number;
      maxScore: number;
      submittedAt: Date;
    }>;
    finalGrade?: string;
    finalScore?: number;
  };
  payment: {
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
    amount: number;
    paidAt?: Date;
    transactionId?: string;
  };
  completedAt?: Date;
  certificate: {
    issued: boolean;
    issuedAt?: Date;
    certificateUrl?: string;
  };
  notes: string;
  enrolledBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  users: {
    total: number;
    students: number;
    instructors: number;
    active: number;
    inactive: number;
  };
  courses: {
    total: number;
    published: number;
    draft: number;
  };
  batches: {
    total: number;
    upcoming: number;
    active: number;
    completed: number;
  };
  enrollments: {
    total: number;
    active: number;
    completed: number;
  };
  recentActivities: {
    recentEnrollments: Array<{
      type: string;
      message: string;
      timestamp: Date;
    }>;
    recentCourses: Array<{
      type: string;
      message: string;
      timestamp: Date;
    }>;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    current: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  error?: string;
}

export interface CourseWithBatches extends Course {
  batches: Array<Batch & {
    scheduledClasses: LiveClass[];
    enrolledStudents: Enrollment[];
    totalClasses: number;
    totalStudents: number;
  }>;
  totalBatches: number;
  totalStudents: number;
}

export interface BatchDetails extends Batch {
  course: Course;
  instructor: User;
  scheduledClasses: LiveClass[];
  enrolledStudents: Array<Enrollment & { studentId: User }>;
  stats: {
    totalClasses: number;
    upcomingClasses: number;
    completedClasses: number;
    totalStudents: number;
    activeStudents: number;
  };
}

export * from './assessment';

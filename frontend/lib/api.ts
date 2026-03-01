import {
  clearStoredAccessToken,
  clearStoredAuthTokens,
  isJwtExpired,
  redirectToLogin,
} from './auth/jwt';
import type {
  ApiEnvelope,
  AssessmentAttemptStartData,
  AssessmentCodeRunData,
  AssessmentEntity,
  AssessmentResultsData,
  AssessmentSubmission,
} from '../types/assessment';
const resolveApiBaseUrl = () => {
  const envBase = process.env.NEXT_PUBLIC_API_URL || '';

  if (typeof window === 'undefined') {
    return envBase || 'http://localhost:5001/api';
  }

  const { origin, port, protocol, hostname } = window.location;
  const isDefaultPort = !port || port === '80' || port === '443';

  if (isDefaultPort) {
    return `${origin}/api`;
  }

  if (envBase) {
    return envBase;
  }

  const fallbackProtocol = protocol || 'http:';
  return `${fallbackProtocol}//${hostname}:5000/api`;
};

const API_BASE_URL = resolveApiBaseUrl();
const detectClientTimezone = () => {
  if (typeof window === 'undefined') return 'UTC';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone || 'UTC';
};

class ApiService {
  private static instance: ApiService;
  private token: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  private constructor() {}

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  setToken(token: string) {
    this.token = token;
  }

  getToken(): string | null {
    if (!this.token) {
      return null;
    }
    if (isJwtExpired(this.token)) {
      this.token = null;
      clearStoredAccessToken();
      return null;
    }
    return this.token;
  }

  getAuthorizationHeader(): string | undefined {
    const token = this.getToken();
    if (!token) {
      return undefined;
    }
    return `Bearer ${token}`;
  }

  clearToken() {
    this.token = null;
    clearStoredAuthTokens();
  }

  private isPublicEndpoint(endpoint: string): boolean {
    return (
      endpoint.startsWith('/auth/login') ||
      endpoint.startsWith('/auth/register') ||
      endpoint.startsWith('/auth/refresh') ||
      endpoint.startsWith('/auth/forgot-password') ||
      endpoint.startsWith('/auth/reset-password') ||
      endpoint.startsWith('/setup/status') ||
      endpoint.startsWith('/setup/prefill') ||
      endpoint.startsWith('/setup/public-settings') ||
      endpoint.startsWith('/setup/custom-domains/prepare') ||
      endpoint.startsWith('/setup/custom-domains/verify') ||
      endpoint.startsWith('/setup/custom-domains/apply-caddy') ||
      endpoint.startsWith('/setup/brand-assets') ||
      endpoint.startsWith('/setup/complete') ||
      endpoint.startsWith('/setup/smtp/test') ||
      endpoint.startsWith('/auth/register/request-otp') ||
      endpoint.startsWith('/auth/register/verify-otp') ||
      endpoint.startsWith('/auth/password-otp/verify-and-set')
    );
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        let data: any = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok || !data?.token) {
          this.clearToken();
          return null;
        }

        this.setToken(data.token);
        return data.token;
      } catch {
        this.clearToken();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async rawRequest(endpoint: string, options: RequestInit = {}, allowRetry = true) {
    const url = `${API_BASE_URL}${endpoint}`;
    const requiresAuth = !this.isPublicEndpoint(endpoint);
    let token = this.getToken();

    if (requiresAuth && !token) {
      token = await this.refreshAccessToken();
    }

    if (requiresAuth && !token) {
      this.clearToken();
      redirectToLogin();
      throw new Error('Session expired. Please log in again.');
    }

    const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const requestHeaders: Record<string, string> = {
      'x-client-timezone': detectClientTimezone(),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...((options.headers as Record<string, string>) || {}),
    };

    if (isFormDataBody) {
      delete requestHeaders['Content-Type'];
    } else if (!requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const config: RequestInit = {
      credentials: 'include',
      headers: requestHeaders,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        if (
          response.status === 401 &&
          requiresAuth &&
          allowRetry &&
          !endpoint.startsWith('/auth/refresh')
        ) {
          const refreshedToken = await this.refreshAccessToken();
          if (refreshedToken) {
            return this.rawRequest(endpoint, options, false);
          }
        }

        if (response.status === 401 && requiresAuth) {
          this.clearToken();
          redirectToLogin();
        }

        let errorData: any = null;
        try {
          errorData = await response.clone().json();
        } catch {
          errorData = null;
        }

        const validationDetails = Array.isArray(errorData?.errors)
          ? errorData.errors
              .map((item: any) => {
                const path = item?.path ? `${item.path}: ` : '';
                return `${path}${item?.msg || 'Invalid input'}`;
              })
              .filter(Boolean)
          : [];

        const message = validationDetails.length
          ? validationDetails.join(' | ')
          : (errorData?.message || errorData?.error || 'Request failed');

        const detailedError: any = new Error(message);
        detailedError.details = errorData?.errors || null;
        detailedError.code = errorData?.code || null;
        detailedError.data = errorData?.data || null;
        throw detailedError;
      }

      return response;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  async requestRaw(endpoint: string, options: RequestInit = {}) {
    return this.rawRequest(endpoint, options);
  }

  private async request(endpoint: string, options: RequestInit = {}, allowRetry = true) {
    const response = await this.rawRequest(endpoint, options, allowRetry);
    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return data;
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response?.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  async getProfile() {
    return this.request('/auth/me');
  }

  async getSetupStatus() {
    return this.request('/setup/status');
  }

  async getSetupPrefill() {
    return this.request('/setup/prefill');
  }


  async getPublicSetupSettings() {
    return this.request('/setup/public-settings');
  }

  async prepareCustomDomain(payload: { domain: string; serverIp?: string }) {
    return this.request('/setup/custom-domains/prepare', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getNginxConfig(payload: { domain: string; frontendPort?: number; backendPort?: number }) {
    return this.request('/setup/custom-domains/nginx-config', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async enableCustomDomainSsl(payload: { domain: string; email: string }) {
    return this.request('/setup/custom-domains/enable-ssl', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async applyCaddyConfig(payload: { domain: string; email?: string }) {
    return this.request('/setup/custom-domains/apply-caddy', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async saveCustomDomain(payload: { domain: string }) {
    return this.request('/setup/custom-domains/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteCustomDomain(domain: string) {
    return this.request(`/setup/custom-domains/${encodeURIComponent(domain)}`, {
      method: 'DELETE',
    });
  }

  async verifyCustomDomain(payload: { domain: string; serverIp?: string }) {
    return this.request('/setup/custom-domains/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async completeSetup(payload: {
    institute: {
      name: string;
      website?: string;
      supportEmail?: string;
      supportPhone?: string;
      address?: string;
    };
    admin: {
      email: string;
      firstName: string;
      lastName: string;
      password: string;
    };
    defaults: {
      timezone: string;
      dateFormat?: string;
      timeFormat?: string;
      locale?: string;
    };
    customDomains?: Array<{
      domain: string;
      expectedIp?: string;
      status?: string;
      verificationToken?: string;
      verifiedAt?: string | null;
      lastCheckedAt?: string | null;
    }>;
    branding: {
      appName: string;
      logoUrl?: string;
      faviconUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      whiteLabelEnabled?: boolean;
    };
    database: {
      mode: 'mongodb' | 'postgres_uri' | 'postgres_same_server';
      mongodbUri?: string;
      postgresUri?: string;
      postgresSameServer?: {
        host?: string;
        port?: number;
        database?: string;
        user?: string;
        password?: string;
        ssl?: boolean;
      };
    };
    smtp?: {
      enabled?: boolean;
      host?: string;
      port?: number;
      secure?: boolean;
      requireTLS?: boolean;
      authUser?: string;
      authPass?: string;
      fromName?: string;
      fromEmail?: string;
      replyTo?: string;
      pool?: boolean;
      maxConnections?: number;
      maxMessages?: number;
      rateDeltaMs?: number;
      rateLimit?: number;
      rejectUnauthorized?: boolean;
    };
  }) {
    return this.request('/setup/complete', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  }

  async uploadSetupBrandAssets(payload: FormData) {
    return this.request('/setup/brand-assets', {
      method: 'POST',
      body: payload
    });
  }

  async testSetupSmtp(payload: Record<string, any>) {
    return this.request('/setup/smtp/test', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  async getSecuritySettings() {
    return this.request('/auth/security-settings');
  }

  async updateSecuritySettings(settings: {
    allowConcurrentSessions?: boolean;
    loginAlerts?: boolean;
    requireReauthForSensitiveActions?: boolean;
  }) {
    return this.request('/auth/security-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getSessions() {
    return this.request('/auth/sessions');
  }

  async revokeSession(sessionId: string) {
    return this.request(`/auth/sessions/${sessionId}/revoke`, {
      method: 'POST',
    });
  }

  async revokeAllSessions(keepCurrent = true) {
    return this.request('/auth/sessions/revoke-all', {
      method: 'POST',
      body: JSON.stringify({ keepCurrent }),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Course endpoints
  async getCourses(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/courses${query}`);
  }

  async getCourse(id: string) {
    return this.request(`/courses/${id}`);
  }

  async createCourse(courseData: any) {
    const isFormData = typeof FormData !== 'undefined' && courseData instanceof FormData;
    return this.request('/courses', {
      method: 'POST',
      body: isFormData ? courseData : JSON.stringify(courseData),
    });
  }

  async updateCourse(id: string, courseData: any) {
    const isFormData = typeof FormData !== 'undefined' && courseData instanceof FormData;
    return this.request(`/courses/${id}`, {
      method: 'PUT',
      body: isFormData ? courseData : JSON.stringify(courseData),
    });
  }

  async deleteCourse(id: string) {
    return this.request(`/courses/${id}`, {
      method: 'DELETE',
    });
  }

  async publishCourse(id: string) {
    return this.request(`/courses/${id}/publish`, {
      method: 'POST',
    });
  }

  async getCourseBatches(courseId: string) {
    return this.request(`/courses/${courseId}/batches`);
  }

  // Batch endpoints
  async getBatches(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/batches${query}`);
  }

  async getBatch(id: string) {
    return this.request(`/batches/${id}`);
  }

  async createBatch(batchData: any) {
    return this.request('/batches', {
      method: 'POST',
      body: JSON.stringify(batchData),
    });
  }

  async updateBatch(id: string, batchData: any) {
    return this.request(`/batches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(batchData),
    });
  }

  async deleteBatch(id: string) {
    return this.request(`/batches/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteBatchWithOptions(id: string, options?: { deleteClasses?: boolean }) {
    const query = options ? `?${new URLSearchParams({ deleteClasses: String(!!options.deleteClasses) })}` : '';
    return this.request(`/batches/${id}${query}`, {
      method: 'DELETE',
    });
  }

  // Class endpoints
  async getBatchClasses(batchId: string) {
    return this.request(`/batches/${batchId}/classes`);
  }

  async scheduleClass(batchId: string, classData: any) {
    return this.request(`/batches/${batchId}/classes`, {
      method: 'POST',
      body: JSON.stringify(classData),
    });
  }

  async updateClass(batchId: string, classId: string, classData: any) {
    return this.request(`/batches/${batchId}/classes/${classId}`, {
      method: 'PUT',
      body: JSON.stringify(classData),
    });
  }

  async deleteClass(batchId: string, classId: string) {
    return this.request(`/batches/${batchId}/classes/${classId}`, {
      method: 'DELETE',
    });
  }

  async cancelClass(batchId: string, classId: string, reason: string) {
    return this.request(`/batches/${batchId}/classes/${classId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async autoGenerateClasses(batchId: string, options: any) {
    return this.request(`/batches/${batchId}/classes/auto-generate`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // Student endpoints
  async getStudents(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/students${query}`);
  }

  async createStudent(studentData: any) {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  }

  async enrollStudent(studentId: string, batchId: string) {
    return this.request('/students/enroll', {
      method: 'POST',
      body: JSON.stringify({ studentId, batchId }),
    });
  }

  async getStudentsByBatch(batchId: string) {
    return this.request(`/students/batch/${batchId}`);
  }

  // Admin endpoints
  async getDashboardStats() {
    return this.request('/admin/dashboard');
  }

  async getCoursesWithBatches() {
    return this.request('/admin/courses-with-batches');
  }

  async getBatchDetails(batchId: string) {
    return this.request(`/admin/batches/${batchId}/details`);
  }

  async createStudentWithEnrollment(studentData: any) {
    return this.request('/admin/create-student', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  }

  async bulkEnrollStudents(studentIds: string[], batchId: string) {
    return this.request('/admin/bulk-enroll', {
      method: 'POST',
      body: JSON.stringify({ studentIds, batchId }),
    });
  }

  async autoGenerateClassesAdmin(batchId: string, options: any) {
    return this.request(`/admin/batches/${batchId}/auto-generate-classes`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // Enrollment / Instructor helper endpoints
  async getMyEnrollments() {
    return this.request('/enrollments/myenrollments');
  }

  async getInstructorMyBatches() {
    return this.request('/instructor/my-batches');
  }

  async getLiveClassesByBatch(batchId: string) {
    return this.request(`/live-classes/batch/${batchId}`);
  }

  // Support / Ticketing endpoints
  async getSupportDashboardStats() {
    return this.request('/support/dashboard/stats');
  }

  async getMySupportTickets(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/support/tickets/my${query}`);
  }

  async getAllSupportTickets(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/support/tickets/all${query}`);
  }

  async getSupportTicket(ticketId: string) {
    return this.request(`/support/tickets/${ticketId}`);
  }

  async createSupportTicket(payload: FormData | Record<string, any>) {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    return this.request('/support/tickets', {
      method: 'POST',
      body: isFormData ? payload : JSON.stringify(payload),
    });
  }

  async updateSupportTicket(ticketId: string, payload: Record<string, any>) {
    return this.request(`/support/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async addSupportTicketMessage(ticketId: string, payload: FormData | Record<string, any>) {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    return this.request(`/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: isFormData ? payload : JSON.stringify(payload),
    });
  }

  async approveSupportLeave(ticketId: string, message?: string) {
    return this.request(`/support/tickets/${ticketId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async rejectSupportLeave(ticketId: string, reason: string) {
    return this.request(`/support/tickets/${ticketId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Notifications
  async getNotifications(params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const query = params
      ? `?${new URLSearchParams({
          ...(params.page ? { page: String(params.page) } : {}),
          ...(params.limit ? { limit: String(params.limit) } : {}),
          ...(typeof params.unreadOnly === 'boolean' ? { unreadOnly: String(params.unreadOnly) } : {}),
        })}`
      : '';

    return this.request(`/notifications${query}`);
  }

  async getUnreadNotificationCount() {
    return this.request('/notifications/unread-count');
  }

  async getNotificationPreferences() {
    return this.request('/notifications/preferences');
  }

  async updateNotificationPreferences(payload: {
    inAppEnabled?: boolean;
    browserPushEnabled?: boolean;
    digestEnabled?: boolean;
    digestFrequency?: 'DAILY' | 'WEEKLY';
    digestHourUTC?: number;
    mutedTypes?: string[];
    mutedPriorities?: Array<'low' | 'normal' | 'high' | 'urgent'>;
    quietHours?: { enabled?: boolean; startHourUTC?: number; endHourUTC?: number };
  }) {
    return this.request('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getNotificationDigestPreview() {
    return this.request('/notifications/digest/preview');
  }

  async getNotificationDigestStatus() {
    return this.request('/notifications/digest/status');
  }

  async sendNotificationDigestNow() {
    return this.request('/notifications/digest/send-now', {
      method: 'POST',
    });
  }

  async markNotificationRead(notificationId: string) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', {
      method: 'PATCH',
    });
  }

  async archiveNotification(notificationId: string) {
    return this.request(`/notifications/${notificationId}/archive`, {
      method: 'PATCH',
    });
  }

  async sendCustomNotification(payload: {
    title: string;
    message: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    type?: string;
    targetType: 'ALL_USERS' | 'ROLES' | 'COURSE' | 'BATCH' | 'USERS';
    roleNames?: string[];
    courseId?: string;
    batchId?: string;
    userIds?: string[];
    linkUrl?: string;
  }) {
    return this.request('/notifications/custom', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMonitoringRecords(params?: {
    page?: number;
    limit?: number;
    category?: 'LOG' | 'EVENT' | 'ERROR';
    level?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    source?: string;
    search?: string;
    from?: string;
    to?: string;
    includeArchived?: boolean;
  }) {
    const query = params
      ? `?${new URLSearchParams({
          ...(params.page ? { page: String(params.page) } : {}),
          ...(params.limit ? { limit: String(params.limit) } : {}),
          ...(params.category ? { category: params.category } : {}),
          ...(params.level ? { level: params.level } : {}),
          ...(params.source ? { source: params.source } : {}),
          ...(params.search ? { search: params.search } : {}),
          ...(params.from ? { from: params.from } : {}),
          ...(params.to ? { to: params.to } : {}),
          ...(typeof params.includeArchived === 'boolean' ? { includeArchived: String(params.includeArchived) } : {}),
        })}`
      : '';

    return this.request(`/monitoring/records${query}`);
  }

  async getMonitoringHealth() {
    return this.request('/monitoring/health');
  }

  async getMonitoringPolicy() {
    return this.request('/monitoring/policy');
  }

  async updateMonitoringPolicy(payload: {
    retentionDays?: number;
    archiveWindowDays?: number;
    exportMaxRecords?: number;
    alertThresholds?: {
      warnPerHour?: number;
      errorPerHour?: number;
      criticalPerHour?: number;
      memoryRssMb?: number;
    };
  }) {
    return this.request('/monitoring/policy', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getMonitoringAlertStatus() {
    return this.request('/monitoring/alerts/status');
  }

  async runMonitoringArchiveWindow() {
    return this.request('/monitoring/archive/run', {
      method: 'POST',
    });
  }

  async runMonitoringRetentionCleanup() {
    return this.request('/monitoring/retention/run', {
      method: 'POST',
    });
  }

  async exportMonitoringBundle(payload: {
    format?: 'json' | 'csv';
    category?: 'LOG' | 'EVENT' | 'ERROR';
    level?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    source?: string;
    search?: string;
    from?: string;
    to?: string;
    includeArchived?: boolean;
    limit?: number;
  }) {
    const response = await this.requestRaw('/monitoring/export', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition') || '';
    const filenameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = filenameMatch?.[1] || `monitoring_export.${payload?.format === 'csv' ? 'csv' : 'json'}`;
    return { blob, filename };
  }

  async getManagerDashboard() {
    return this.request('/manager/dashboard');
  }

  // Generic user/admin helpers
  async getUsers(params?: Record<string, any>) {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return this.request(`/users${query}`);
  }

  async getUserStats() {
    return this.request('/users/stats');
  }

  async getManagerPermissionCatalog() {
    return this.request('/admin/manager-permissions');
  }

  async getDatabaseSettings() {
    return this.request('/admin/database-settings');
  }

  async updateDatabaseSettings(payload: {
    mode: 'mongodb' | 'postgres_uri' | 'postgres_same_server';
    mongodbUri?: string;
    postgresUri?: string;
    postgresSameServer?: {
      host?: string;
      port?: number;
      database?: string;
      user?: string;
      password?: string;
      ssl?: boolean;
    };
  }) {
    return this.request('/admin/database-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getAdminSmtpSettings() {
    return this.request('/admin/smtp-settings');
  }

  async updateAdminSmtpSettings(payload: Record<string, any>) {
    return this.request('/admin/smtp-settings', {
      method: 'PUT',
      body: JSON.stringify(payload || {}),
    });
  }

  async testAdminSmtpSettings(payload: Record<string, any>) {
    return this.request('/admin/smtp-settings/test', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  async getAdminLicensingPublicSummary() {
    return this.request('/admin/licensing/public-summary');
  }

  async requestRegistrationOtp(email: string) {
    return this.request('/auth/register/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyRegistrationOtp(payload: {
    challengeToken: string;
    otp: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }) {
    return this.request('/auth/register/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async requestUserPasswordSetupOtp(userId: string) {
    return this.request(`/admin/users/${userId}/request-password-otp`, {
      method: 'POST',
    });
  }

  async forgotPassword(email: string) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(payload: {
    password: string;
    token?: string;
    email?: string;
    otp?: string;
  }) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  async verifyPasswordOtpAndSet(payload: { email: string; otp: string; newPassword: string }) {
    return this.request('/auth/password-otp/verify-and-set', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createAdminManager(payload: Record<string, any>) {
    return this.request('/admin/managers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getUserById(userId: string) {
    return this.request(`/users/${userId}`);
  }

  async updateUserById(userId: string, payload: Record<string, any>) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async updateAdminUserById(userId: string, payload: Record<string, any>) {
    return this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async resetAdminUserPassword(userId: string) {
    return this.request(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
    });
  }

  async toggleAdminUserStatus(userId: string) {
    return this.request(`/admin/users/${userId}/toggle-status`, {
      method: 'POST',
    });
  }

  // Instructors
  async getInstructors(params?: Record<string, any>) {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return this.request(`/instructors${query}`);
  }

  async getInstructorById(instructorId: string) {
    return this.request(`/instructors/${instructorId}`);
  }

  async createAdminInstructor(payload: Record<string, any>) {
    return this.request('/admin/instructors', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getAdminInstructors() {
    return this.request('/admin/instructors');
  }

  async getAdminInstructorById(instructorId: string) {
    return this.request(`/admin/instructors/${instructorId}`);
  }

  async updateInstructorById(instructorId: string, payload: Record<string, any>) {
    return this.request(`/instructors/${instructorId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async resetInstructorPassword(instructorId: string, payload?: Record<string, any>) {
    return this.request(`/instructors/${instructorId}/reset-password`, {
      method: 'POST',
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
  }

  async toggleInstructorStatus(instructorId: string) {
    return this.request(`/instructors/${instructorId}/toggle-status`, {
      method: 'PATCH',
    });
  }

  async deleteAdminInstructor(instructorId: string) {
    return this.request(`/admin/instructors/${instructorId}`, {
      method: 'DELETE',
    });
  }

  async assignInstructor(instructorId: string, payload: { courseId: string; batchId: string }) {
    return this.request(`/instructors/${instructorId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getInstructorDashboard() {
    return this.request('/instructor/dashboard');
  }

  async getInstructorMyCourses() {
    return this.request('/instructor/my-courses');
  }

  async getInstructorBatchDetails(batchId: string) {
    return this.request(`/instructor/batches/${batchId}/details`);
  }

  // Students
  async getStudentById(studentId: string) {
    return this.request(`/students/${studentId}`);
  }

  async updateStudentById(studentId: string, payload: Record<string, any>) {
    return this.request(`/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async updateStudentStatus(studentId: string, payload: Record<string, any>) {
    return this.request(`/students/${studentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteStudent(studentId: string) {
    return this.request(`/students/${studentId}`, {
      method: 'DELETE',
    });
  }

  async resetStudentPassword(studentId: string, payload: Record<string, any>) {
    return this.request(`/students/${studentId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getStudentEnrollments(studentId: string) {
    return this.request(`/enrollments/student/${studentId}`);
  }

  async getStudentsMyEnrollments() {
    return this.request('/students/my-enrollments');
  }

  async getStudentLiveClasses() {
    return this.request('/students/live-classes');
  }

  async getStudentUpcomingClasses() {
    return this.request('/students/upcoming-classes');
  }

  async getStudentPastClasses() {
    return this.request('/students/past-classes');
  }

  // Enrollments
  async getEnrollmentById(enrollmentId: string) {
    return this.request(`/enrollments/${enrollmentId}`);
  }

  async createEnrollment(payload: Record<string, any>) {
    return this.request('/enrollments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateEnrollment(enrollmentId: string, payload: Record<string, any>) {
    return this.request(`/enrollments/${enrollmentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getEnrollmentsByCourse(courseId: string) {
    return this.request(`/enrollments/course/${courseId}`);
  }

  async deleteEnrollment(enrollmentId: string) {
    return this.request(`/enrollments/${enrollmentId}`, {
      method: 'DELETE',
    });
  }

  // Batches / Classes
  async getAdminBatchDetails(batchId: string) {
    return this.request(`/admin/batches/${batchId}/details`);
  }

  async getBatchLiveClasses(batchId: string) {
    return this.request(`/live-classes/batch/${batchId}`);
  }

  async getFilteredLiveClasses() {
    return this.request('/live-classes/filtered-classes');
  }

  async getLiveClassById(classId: string) {
    return this.request(`/live-classes/${classId}`);
  }

  async getLiveClassByRoom(roomId: string) {
    return this.request(`/live-classes/room/${roomId}`);
  }

  async getLiveClasses(params?: Record<string, any>) {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return this.request(`/live-classes${query}`);
  }

  async getRecentClassAttendanceStats(params?: { limit?: number; batchId?: string }) {
    const query = params
      ? `?${new URLSearchParams({
          ...(params.limit ? { limit: String(params.limit) } : {}),
          ...(params.batchId ? { batchId: params.batchId } : {}),
        })}`
      : '';
    return this.request(`/live-classes/attendance/recent${query}`);
  }

  async getLiveClassAttendanceAnalytics(params?: {
    view?: 'class' | 'week' | 'month';
    batchId?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const query = params
      ? `?${new URLSearchParams({
          ...(params.view ? { view: params.view } : {}),
          ...(params.batchId ? { batchId: params.batchId } : {}),
          ...(params.from ? { from: params.from } : {}),
          ...(params.to ? { to: params.to } : {}),
          ...(params.limit ? { limit: String(params.limit) } : {}),
        })}`
      : '';
    return this.request(`/live-classes/attendance/analytics${query}`);
  }

  async getLiveClassAttendanceReport(
    classId: string,
    params?: {
      status?: 'ALL' | 'PRESENT' | 'LEFT_EARLY' | 'ABSENT' | 'LATE_JOINER' | 'LATE_JOINER_LEFT_EARLY';
      minPercent?: number;
      maxPercent?: number;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const query = params
      ? `?${new URLSearchParams({
          ...(params.status ? { status: params.status } : {}),
          ...(typeof params.minPercent === 'number' ? { minPercent: String(params.minPercent) } : {}),
          ...(typeof params.maxPercent === 'number' ? { maxPercent: String(params.maxPercent) } : {}),
          ...(params.search ? { search: params.search } : {}),
          ...(params.page ? { page: String(params.page) } : {}),
          ...(params.limit ? { limit: String(params.limit) } : {}),
        })}`
      : '';
    return this.request(`/live-classes/attendance/classes/${classId}${query}`);
  }

  async rebaselineHistoricalAttendance(payload?: {
    batchId?: string;
    dryRun?: boolean;
    limit?: number;
  }) {
    return this.request('/live-classes/attendance/rebaseline-historical', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  async createLiveClass(payload: Record<string, any>) {
    return this.request('/live-classes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateLiveClass(classId: string, payload: Record<string, any>) {
    return this.request(`/live-classes/${classId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async patchLiveClass(classId: string, payload: Record<string, any>) {
    return this.request(`/live-classes/${classId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteLiveClass(classId: string) {
    return this.request(`/live-classes/${classId}`, {
      method: 'DELETE',
    });
  }

  async createLeaveRequest(payload: Record<string, any>) {
    return this.request('/leave-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Analytics
  async getAdminAnalytics(days: string | number) {
    return this.request(`/admin/analytics?days=${days}`);
  }

  // Assessments
  async getAssessments(queryOrParams?: string | Record<string, any>): Promise<ApiEnvelope<AssessmentEntity[]>> {
    if (typeof queryOrParams === 'string') {
      return this.request(queryOrParams);
    }

    const query = queryOrParams ? `?${new URLSearchParams(queryOrParams as Record<string, string>)}` : '';
    return this.request(`/assessments${query}`);
  }

  async getAssessmentById(assessmentId: string): Promise<ApiEnvelope<AssessmentEntity>> {
    return this.request(`/assessments/${assessmentId}`);
  }

  async createAssessment(payload: Record<string, any>): Promise<ApiEnvelope<AssessmentEntity>> {
    return this.request('/assessments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateAssessmentById(
    assessmentId: string,
    payload: Record<string, any>
  ): Promise<ApiEnvelope<AssessmentEntity>> {
    return this.request(`/assessments/${assessmentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getAssessmentResults(assessmentId: string): Promise<ApiEnvelope<AssessmentResultsData>> {
    return this.request(`/assessments/${assessmentId}/results`);
  }

  async getAssessmentSubmissions(assessmentId: string, limit = 500): Promise<ApiEnvelope<AssessmentSubmission[]>> {
    return this.request(`/assessments/${assessmentId}/submissions?limit=${limit}`);
  }

  async startAssessmentAttempt(assessmentId: string): Promise<ApiEnvelope<AssessmentAttemptStartData>> {
    return this.request(`/assessments/${assessmentId}/start`, {
      method: 'POST',
    });
  }

  async saveAssessmentProgress(
    submissionId: string,
    payload: { questionId: string; answer: unknown; timeSpent?: number }
  ): Promise<{ success?: boolean; message?: string }> {
    return this.request(`/assessments/submissions/${submissionId}/progress`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async reportAssessmentViolation(
    submissionId: string,
    payload: { type: string; details?: string }
  ): Promise<{ success?: boolean; message?: string }> {
    return this.request(`/assessments/submissions/${submissionId}/violation`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async submitAssessmentAttempt(
    submissionId: string,
    payload: {
      answers: Array<{ questionId: string; answer: unknown; timeSpent?: number }>;
      deviceInfo?: Record<string, unknown>;
    }
  ): Promise<{
    success?: boolean;
    message?: string;
    data?: { submissionId: string; scoring?: AssessmentSubmission['scoring']; completedAt?: string };
  }> {
    return this.request(`/assessments/submissions/${submissionId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async runAssessmentCode(
    submissionId: string,
    questionKey: string,
    payload: { language: string; code: string; version?: string }
  ): Promise<ApiEnvelope<AssessmentCodeRunData>> {
    return this.request(`/assessments/submissions/${submissionId}/questions/${questionKey}/run`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Resources
  async getCourseResources(courseId: string) {
    return this.request(`/resources/course/${courseId}`);
  }

  async createResource(payload: FormData | Record<string, any>) {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    return this.request('/resources', {
      method: 'POST',
      body: isFormData ? payload : JSON.stringify(payload),
    });
  }

  async updateResource(resourceId: string, payload: FormData | Record<string, any>) {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    return this.request(`/resources/${resourceId}`, {
      method: 'PUT',
      body: isFormData ? payload : JSON.stringify(payload),
    });
  }

  async deleteResource(resourceId: string) {
    return this.request(`/resources/${resourceId}`, {
      method: 'DELETE',
    });
  }

  async downloadResource(resourceId: string) {
    return this.requestRaw(`/resources/${resourceId}/download`);
  }

  async previewResource(resourceId: string) {
    return this.requestRaw(`/resources/${resourceId}/preview`);
  }
}

export const api = ApiService.getInstance();
export default api;

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../components/providers/AuthProvider'
import { api } from '../../../lib/api'
import { Shield, Smartphone, LogOut, Lock, Bell, CheckCircle2 } from 'lucide-react'

type SecuritySettings = {
  allowConcurrentSessions: boolean
  loginAlerts: boolean
  requireReauthForSensitiveActions: boolean
}

type NotificationSettings = {
  inAppEnabled: boolean
  browserPushEnabled: boolean
  digestEnabled: boolean
  digestFrequency: 'DAILY' | 'WEEKLY'
  digestHourUTC: number
  mutedTypes: string[]
  mutedPriorities: Array<'low' | 'normal' | 'high' | 'urgent'>
  quietHours: {
    enabled: boolean
    startHourUTC: number
    endHourUTC: number
  }
}

type SignInSession = {
  id: string
  sessionId: string
  deviceName: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
  lastUsedAt: string
  expiresAt: string
  isCurrent: boolean
}

type DatabaseMode = 'mongodb' | 'postgres_uri' | 'postgres_same_server'

type DatabaseSettings = {
  mode: DatabaseMode
  mongodbUri: string
  postgresUri: string
  postgresSameServer: {
    host: string
    port: number
    database: string
    user: string
    password: string
    ssl: boolean
  }
  updatedAt?: string | null
  updatedBy?: string | null
}

type DatabaseRuntime = {
  configuredMode: DatabaseMode
  runtimeMode: string
  dataAccessMode?: string
  compatibilityMode?: boolean
  requiresRestart: boolean
}

type LicensingSummary = {
  instanceId?: string
  edition?: string
  licenseType?: string
  planCode?: string
  status?: string
  appVersion?: string | null
  runtime?: string | null
  lastHeartbeatAt?: string | null
  lastSyncAt?: string | null
  lastSyncStatus?: string | null
}

type SmtpSettings = {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  requireTLS: boolean
  authUser: string
  authPass: string
  fromName: string
  fromEmail: string
  replyTo: string
  testEmail: string
}

const defaultSecuritySettings: SecuritySettings = {
  allowConcurrentSessions: true,
  loginAlerts: true,
  requireReauthForSensitiveActions: false,
}

const defaultNotificationSettings: NotificationSettings = {
  inAppEnabled: true,
  browserPushEnabled: true,
  digestEnabled: false,
  digestFrequency: 'DAILY',
  digestHourUTC: 18,
  mutedTypes: [],
  mutedPriorities: [],
  quietHours: {
    enabled: false,
    startHourUTC: 22,
    endHourUTC: 7,
  },
}

const notificationTypeOptions = [
  'CLASS_STARTING_SOON',
  'CLASS_SCHEDULED',
  'CLASS_CANCELLED',
  'CLASS_MISSED',
  'LIVE_CHAT_MESSAGE',
  'SUPPORT_TICKET_CREATED',
  'SUPPORT_TICKET_UPDATED',
  'SUPPORT_TICKET_REPLY',
  'ASSESSMENT_PUBLISHED',
  'ASSESSMENT_CREATED',
  'ASSESSMENT_SUBMITTED',
  'RESOURCE_ADDED',
  'BATCH_AUTO_CLASSES_SCHEDULED',
  'CUSTOM_ANNOUNCEMENT',
  'SYSTEM',
]

const defaultDatabaseSettings: DatabaseSettings = {
  mode: 'mongodb',
  mongodbUri: '',
  postgresUri: '',
  postgresSameServer: {
    host: '127.0.0.1',
    port: 5432,
    database: 'lms_futureproof',
    user: 'postgres',
    password: '',
    ssl: false,
  },
  updatedAt: null,
  updatedBy: null,
}

const defaultSmtpSettings: SmtpSettings = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  requireTLS: false,
  authUser: '',
  authPass: '',
  fromName: 'LMS Notifications',
  fromEmail: '',
  replyTo: '',
  testEmail: '',
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'security' | 'signin' | 'notifications' | 'database' | 'smtp'>('security')
  const [settings, setSettings] = useState<SecuritySettings>(defaultSecuritySettings)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(defaultNotificationSettings)
  const [databaseSettings, setDatabaseSettings] = useState<DatabaseSettings>(defaultDatabaseSettings)
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>(defaultSmtpSettings)
  const [databaseRuntime, setDatabaseRuntime] = useState<DatabaseRuntime | null>(null)
  const [licensingSummary, setLicensingSummary] = useState<LicensingSummary | null>(null)
  const [digestPreview, setDigestPreview] = useState<{ totalUnread: number; summaryByPriority: Record<string, number> } | null>(null)
  const [digestStatus, setDigestStatus] = useState<{ lastDigestSentAt?: string | null; nextDigestAtUTC?: string | null; isDueNow?: boolean } | null>(null)
  const [sessions, setSessions] = useState<SignInSession[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)

  const displayRole = useMemo(() => user?.role?.displayName || user?.role?.name || 'User', [user])
  const isAdmin = useMemo(() => String(user?.role?.name || '').toUpperCase() === 'ADMIN', [user])
  const postgresRuntimeEnabled = useMemo(
    () => String(process.env.NEXT_PUBLIC_ENABLE_POSTGRES_RUNTIME || 'false').toLowerCase() === 'true',
    []
  )

  const loadSettingsData = async () => {
    try {
      setLoading(true)
      const [settingsResponse, sessionsResponse] = await Promise.all([
        api.getSecuritySettings(),
        api.getSessions(),
      ])
      setSettings(settingsResponse?.settings || defaultSecuritySettings)
      setSessions(sessionsResponse?.sessions || [])
      try {
        const notificationResponse = await api.getNotificationPreferences()
        setNotificationSettings(notificationResponse?.data || defaultNotificationSettings)
      } catch {
        setNotificationSettings(defaultNotificationSettings)
      }

      if (isAdmin) {
        try {
          const [databaseResponse, smtpResponse, licensingResponse] = await Promise.all([
            api.getDatabaseSettings(),
            api.getAdminSmtpSettings(),
            api.getAdminLicensingPublicSummary()
          ])
          setDatabaseSettings(databaseResponse?.settings || defaultDatabaseSettings)
          setDatabaseRuntime(databaseResponse?.runtime || null)
          setSmtpSettings((prev) => ({ ...prev, ...(smtpResponse?.settings || smtpResponse?.data || {}), authPass: '' }))
          const summary = licensingResponse?.data || null
          setLicensingSummary(summary)
        } catch {
          setDatabaseSettings(defaultDatabaseSettings)
          setSmtpSettings(defaultSmtpSettings)
          setDatabaseRuntime(null)
          setLicensingSummary(null)
        }
      }
    } catch (error: any) {
      setMessage(error?.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const updateNotificationToggle = (key: keyof NotificationSettings) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const saveNotificationSettings = async () => {
    try {
      setSaving(true)
      setMessage(null)
      const response = await api.updateNotificationPreferences(notificationSettings)
      setNotificationSettings(response?.data || notificationSettings)
      setMessage('Notification preferences updated successfully.')
    } catch (error: any) {
      setMessage(error?.message || 'Failed to update notification preferences')
    } finally {
      setSaving(false)
    }
  }

  const loadDigestPreview = async () => {
    try {
      const response = await api.getNotificationDigestPreview()
      setDigestPreview({
        totalUnread: Number(response?.data?.totalUnread || 0),
        summaryByPriority: response?.data?.summaryByPriority || {},
      })
    } catch {
      setDigestPreview(null)
    }
  }

  const loadDigestStatus = async () => {
    try {
      const response = await api.getNotificationDigestStatus()
      setDigestStatus(response?.data || null)
    } catch {
      setDigestStatus(null)
    }
  }

  const sendDigestNow = async () => {
    try {
      setSaving(true)
      setMessage(null)
      const response = await api.sendNotificationDigestNow()
      setMessage(response?.message || 'Digest evaluated.')
      await Promise.all([loadDigestPreview(), loadDigestStatus(), loadSettingsData()])
    } catch (error: any) {
      setMessage(error?.message || 'Failed to send digest now')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    loadSettingsData()
  }, [isAdmin])

  const handleToggle = (key: keyof SecuritySettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const saveSecuritySettings = async () => {
    try {
      setSaving(true)
      setMessage(null)
      const response = await api.updateSecuritySettings(settings)
      setSettings(response?.settings || settings)
      setMessage('Security settings updated successfully.')
      await loadSettingsData()
    } catch (error: any) {
      setMessage(error?.message || 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  const revokeDevice = async (sessionId: string) => {
    try {
      setMessage(null)
      await api.revokeSession(sessionId)
      await loadSettingsData()
    } catch (error: any) {
      setMessage(error?.message || 'Failed to revoke session')
    }
  }

  const signOutOtherDevices = async () => {
    try {
      setMessage(null)
      await api.revokeAllSessions(true)
      await loadSettingsData()
      setMessage('Signed out from all other devices.')
    } catch (error: any) {
      setMessage(error?.message || 'Failed to sign out from other devices')
    }
  }

  const signOutAllDevices = async () => {
    try {
      setMessage(null)
      await api.revokeAllSessions(false)
      logout()
    } catch (error: any) {
      setMessage(error?.message || 'Failed to sign out from all devices')
    }
  }

  const updatePassword = async () => {
    try {
      setPasswordLoading(true)
      setMessage(null)
      if (!passwordForm.currentPassword || !passwordForm.newPassword) {
        setMessage('Current and new password are required.')
        return
      }
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordForm({ currentPassword: '', newPassword: '' })
      setMessage('Password changed successfully. Other devices were signed out.')
      await loadSettingsData()
    } catch (error: any) {
      setMessage(error?.message || 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const saveDatabaseSettings = async () => {
    try {
      setSaving(true)
      setMessage(null)
      const response = await api.updateDatabaseSettings(databaseSettings)
      setDatabaseSettings(response?.settings || databaseSettings)
      setDatabaseRuntime(response?.runtime || null)
      setMessage(response?.message || 'Database settings saved successfully.')
    } catch (error: any) {
      setMessage(error?.message || 'Failed to update database settings')
    } finally {
      setSaving(false)
    }
  }

  const saveSmtpSettings = async () => {
    try {
      setSaving(true)
      setMessage(null)
      const payload: any = { ...smtpSettings }
      delete payload.testEmail
      const response = await api.updateAdminSmtpSettings(payload)
      setSmtpSettings((prev) => ({ ...prev, ...(response?.settings || response?.data || {}), authPass: '' }))
      setMessage(response?.message || 'SMTP settings saved successfully.')
    } catch (error: any) {
      setMessage(error?.message || 'Failed to update SMTP settings')
    } finally {
      setSaving(false)
    }
  }

  const testSmtpSettings = async () => {
    try {
      setSaving(true)
      setMessage(null)
      const response = await api.testAdminSmtpSettings(smtpSettings as any)
      setMessage(response?.message || 'SMTP connection verified.')
    } catch (error: any) {
      setMessage(error?.message || 'Failed to test SMTP settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6" style={{ color: 'var(--color-text)' }}>
        Loading settings...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {displayRole} account security and sign-in management
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'security' ? 'text-white' : ''}`}
          style={{
            backgroundColor: activeTab === 'security' ? 'var(--color-primary)' : 'var(--color-surface)',
            color: activeTab === 'security' ? '#fff' : 'var(--color-text)',
            border: `1px solid var(--color-border)`,
          }}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Security
        </button>
        <button
          onClick={() => setActiveTab('signin')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'signin' ? 'text-white' : ''}`}
          style={{
            backgroundColor: activeTab === 'signin' ? 'var(--color-primary)' : 'var(--color-surface)',
            color: activeTab === 'signin' ? '#fff' : 'var(--color-text)',
            border: `1px solid var(--color-border)`,
          }}
        >
          <Smartphone className="w-4 h-4 inline mr-2" />
          Sign-in
        </button>
        <button
          onClick={() => {
            setActiveTab('notifications')
            loadDigestPreview()
            loadDigestStatus()
          }}
          className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'notifications' ? 'text-white' : ''}`}
          style={{
            backgroundColor: activeTab === 'notifications' ? 'var(--color-primary)' : 'var(--color-surface)',
            color: activeTab === 'notifications' ? '#fff' : 'var(--color-text)',
            border: `1px solid var(--color-border)`,
          }}
        >
          <Bell className="w-4 h-4 inline mr-2" />
          Notifications
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'database' ? 'text-white' : ''}`}
            style={{
              backgroundColor: activeTab === 'database' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === 'database' ? '#fff' : 'var(--color-text)',
              border: `1px solid var(--color-border)`,
            }}
          >
            Database
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('smtp')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'smtp' ? 'text-white' : ''}`}
            style={{
              backgroundColor: activeTab === 'smtp' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === 'smtp' ? '#fff' : 'var(--color-text)',
              border: `1px solid var(--color-border)`,
            }}
          >
            SMTP
          </button>
        )}
      </div>

      {message && (
        <div
          className="mb-4 rounded-md px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--color-surface)', border: `1px solid var(--color-border)`, color: 'var(--color-text)' }}
        >
          {message}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Security Options</h2>

            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span style={{ color: 'var(--color-text)' }}>Allow multiple devices to stay signed in</span>
                </div>
                <input type="checkbox" checked={settings.allowConcurrentSessions} onChange={() => handleToggle('allowConcurrentSessions')} />
              </label>

              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  <span style={{ color: 'var(--color-text)' }}>Login alerts for new sessions</span>
                </div>
                <input type="checkbox" checked={settings.loginAlerts} onChange={() => handleToggle('loginAlerts')} />
              </label>

              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span style={{ color: 'var(--color-text)' }}>Require re-authentication for sensitive actions</span>
                </div>
                <input type="checkbox" checked={settings.requireReauthForSensitiveActions} onChange={() => handleToggle('requireReauthForSensitiveActions')} />
              </label>
            </div>

            <button
              onClick={saveSecuritySettings}
              disabled={saving}
              className="mt-4 px-4 py-2 rounded-md text-sm text-white"
              style={{ backgroundColor: 'var(--color-primary)', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Security Settings'}
            </button>
          </div>

          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Change Password</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="password"
                placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
              />
              <input
                type="password"
                placeholder="New password (min 6 chars)"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
              />
            </div>
            <button
              onClick={updatePassword}
              disabled={passwordLoading}
              className="mt-3 px-4 py-2 rounded-md text-sm text-white"
              style={{ backgroundColor: 'var(--color-primary)', opacity: passwordLoading ? 0.7 : 1 }}
            >
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'signin' && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={signOutOtherDevices} className="px-3 py-2 rounded-md text-sm text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                Sign out other devices
              </button>
              <button onClick={signOutAllDevices} className="px-3 py-2 rounded-md text-sm text-white bg-red-600">
                Sign out all devices
              </button>
            </div>

            <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Active Devices</h2>
            <div className="space-y-3">
              {sessions.length === 0 && (
                <p style={{ color: 'var(--color-text-secondary)' }}>No active sessions found.</p>
              )}
              {sessions.map((session) => (
                <div key={session.id} className="flex items-start justify-between border rounded-md p-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                      {session.deviceName}
                      {session.isCurrent && <span className="ml-2 text-xs text-green-600"><CheckCircle2 className="w-3 h-3 inline mr-1" />Current</span>}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>IP: {session.ipAddress || 'Unknown'}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Last active: {new Date(session.lastUsedAt).toLocaleString()}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <button
                      onClick={() => revokeDevice(session.sessionId)}
                      className="text-xs px-2 py-1 rounded border"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Notification Preferences</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span style={{ color: 'var(--color-text)' }}>Enable in-app notifications</span>
                <input type="checkbox" checked={notificationSettings.inAppEnabled} onChange={() => updateNotificationToggle('inAppEnabled')} />
              </label>
              <label className="flex items-center justify-between">
                <span style={{ color: 'var(--color-text)' }}>Enable browser pop-up notifications</span>
                <input type="checkbox" checked={notificationSettings.browserPushEnabled} onChange={() => updateNotificationToggle('browserPushEnabled')} />
              </label>
              <label className="flex items-center justify-between">
                <span style={{ color: 'var(--color-text)' }}>Enable digest automation</span>
                <input type="checkbox" checked={notificationSettings.digestEnabled} onChange={() => updateNotificationToggle('digestEnabled')} />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <select
                value={notificationSettings.digestFrequency}
                onChange={(e) => setNotificationSettings((prev) => ({ ...prev, digestFrequency: e.target.value as 'DAILY' | 'WEEKLY' }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
              >
                <option value="DAILY">Daily digest</option>
                <option value="WEEKLY">Weekly digest</option>
              </select>
              <input
                type="number"
                min={0}
                max={23}
                value={notificationSettings.digestHourUTC}
                onChange={(e) => setNotificationSettings((prev) => ({ ...prev, digestHourUTC: Math.max(0, Math.min(23, Number(e.target.value || 0))) }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="Digest hour UTC"
              />
              <select
                value={notificationSettings.quietHours.enabled ? 'on' : 'off'}
                onChange={(e) => setNotificationSettings((prev) => ({ ...prev, quietHours: { ...prev.quietHours, enabled: e.target.value === 'on' } }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
              >
                <option value="off">Quiet hours off</option>
                <option value="on">Quiet hours on</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <input
                type="number"
                min={0}
                max={23}
                value={notificationSettings.quietHours.startHourUTC}
                onChange={(e) => setNotificationSettings((prev) => ({ ...prev, quietHours: { ...prev.quietHours, startHourUTC: Math.max(0, Math.min(23, Number(e.target.value || 0))) } }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="Quiet start hour UTC"
              />
              <input
                type="number"
                min={0}
                max={23}
                value={notificationSettings.quietHours.endHourUTC}
                onChange={(e) => setNotificationSettings((prev) => ({ ...prev, quietHours: { ...prev.quietHours, endHourUTC: Math.max(0, Math.min(23, Number(e.target.value || 0))) } }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="Quiet end hour UTC"
              />
            </div>

            <div className="mt-4">
              <p className="text-sm mb-2" style={{ color: 'var(--color-text)' }}>Mute notification types</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {notificationTypeOptions.map((type) => {
                  const checked = notificationSettings.mutedTypes.includes(type)
                  return (
                    <label key={type} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setNotificationSettings((prev) => ({
                            ...prev,
                            mutedTypes: checked
                              ? prev.mutedTypes.filter((item) => item !== type)
                              : [...prev.mutedTypes, type],
                          }))
                        }}
                      />
                      {type}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm mb-2" style={{ color: 'var(--color-text)' }}>Mute priorities</p>
              <div className="flex flex-wrap gap-3">
                {(['low', 'normal', 'high', 'urgent'] as const).map((priority) => {
                  const checked = notificationSettings.mutedPriorities.includes(priority)
                  return (
                    <label key={priority} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setNotificationSettings((prev) => ({
                            ...prev,
                            mutedPriorities: checked
                              ? prev.mutedPriorities.filter((item) => item !== priority)
                              : [...prev.mutedPriorities, priority],
                          }))
                        }}
                      />
                      {priority}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={saveNotificationSettings}
                disabled={saving}
                className="px-4 py-2 rounded-md text-sm text-white"
                style={{ backgroundColor: 'var(--color-primary)', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving...' : 'Save Notification Preferences'}
              </button>
              <button
                onClick={loadDigestPreview}
                className="px-4 py-2 rounded-md text-sm"
                style={{ border: `1px solid var(--color-border)`, color: 'var(--color-text)' }}
              >
                Preview Digest
              </button>
              <button
                onClick={sendDigestNow}
                disabled={saving}
                className="px-4 py-2 rounded-md text-sm"
                style={{ border: `1px solid var(--color-border)`, color: 'var(--color-text)' }}
              >
                Send Digest Now
              </button>
            </div>
          </div>

          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <h2 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Digest Preview</h2>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Unread notifications to be included in your next digest.
            </p>
            <p style={{ color: 'var(--color-text)' }}>
              Total unread in digest window: <strong>{digestPreview?.totalUnread ?? 0}</strong>
            </p>
            {digestPreview && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {Object.entries(digestPreview.summaryByPriority || {}).map(([key, value]) => (
                  <div key={key} className="rounded border px-3 py-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                    {key}: {value}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p>Last digest sent: {digestStatus?.lastDigestSentAt ? new Date(digestStatus.lastDigestSentAt).toLocaleString() : 'Never'}</p>
              <p>Next digest window: {digestStatus?.nextDigestAtUTC ? `${new Date(digestStatus.nextDigestAtUTC).toLocaleString()} (local)` : 'N/A'}</p>
              <p>Due now: {digestStatus?.isDueNow ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'database' && isAdmin && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Database Provider</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Select the database mode for self-hosted setup. Connectivity is validated on save.
            </p>

            <div className="mb-4 rounded-md border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              <h3 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Current Plan</h3>
              <div className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                <p>Plan code: <strong style={{ color: 'var(--color-text)' }}>{licensingSummary?.planCode || 'free_self_hosted'}</strong></p>
                <p>License type: <strong style={{ color: 'var(--color-text)' }}>{licensingSummary?.licenseType || 'FREE'}</strong></p>
                <p>Status: <strong style={{ color: 'var(--color-text)' }}>{licensingSummary?.status || 'ACTIVE'}</strong></p>
              </div>
            </div>

            <select
              value={databaseSettings.mode}
              onChange={(e) => setDatabaseSettings((prev) => ({ ...prev, mode: e.target.value as DatabaseMode }))}
              className="w-full md:w-80 px-3 py-2 rounded-md border"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
            >
              <option value="mongodb">MongoDB</option>
              <option value="postgres_uri" disabled={!postgresRuntimeEnabled}>PostgreSQL (External URI)</option>
              <option value="postgres_same_server" disabled={!postgresRuntimeEnabled}>PostgreSQL (Same Server)</option>
            </select>
            {!postgresRuntimeEnabled && (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                PostgreSQL runtime is disabled in this deployment (`NEXT_PUBLIC_ENABLE_POSTGRES_RUNTIME=false`).
              </p>
            )}

            {databaseSettings.mode === 'mongodb' && (
              <div className="mt-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text)' }}>MongoDB URI</label>
                <input
                  type="text"
                  value={databaseSettings.mongodbUri}
                  onChange={(e) => setDatabaseSettings((prev) => ({ ...prev, mongodbUri: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                  placeholder="mongodb://localhost:27017/lms_futureproof"
                />
              </div>
            )}

            {databaseSettings.mode === 'postgres_uri' && (
              <div className="mt-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text)' }}>PostgreSQL URI</label>
                <input
                  type="text"
                  value={databaseSettings.postgresUri}
                  onChange={(e) => setDatabaseSettings((prev) => ({ ...prev, postgresUri: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                  placeholder="postgresql://user:password@host:5432/lms_futureproof"
                />
              </div>
            )}

            {databaseSettings.mode === 'postgres_same_server' && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={databaseSettings.postgresSameServer.host}
                  onChange={(e) => setDatabaseSettings((prev) => ({ ...prev, postgresSameServer: { ...prev.postgresSameServer, host: e.target.value } }))}
                  className="px-3 py-2 rounded-md border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                  placeholder="Host (127.0.0.1)"
                />
                <input
                  type="number"
                  value={databaseSettings.postgresSameServer.port}
                  onChange={(e) => setDatabaseSettings((prev) => ({ ...prev, postgresSameServer: { ...prev.postgresSameServer, port: Number(e.target.value || 5432) } }))}
                  className="px-3 py-2 rounded-md border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                  placeholder="Port"
                />
                <input
                  type="text"
                  value={databaseSettings.postgresSameServer.database}
                  onChange={(e) => setDatabaseSettings((prev) => ({ ...prev, postgresSameServer: { ...prev.postgresSameServer, database: e.target.value } }))}
                  className="px-3 py-2 rounded-md border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                  placeholder="Database name"
                />
                <input
                  type="text"
                  value={databaseSettings.postgresSameServer.user}
                  onChange={(e) => setDatabaseSettings((prev) => ({ ...prev, postgresSameServer: { ...prev.postgresSameServer, user: e.target.value } }))}
                  className="px-3 py-2 rounded-md border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                  placeholder="Username"
                />
                <input
                  type="password"
                  value={databaseSettings.postgresSameServer.password}
                  onChange={(e) => setDatabaseSettings((prev) => ({ ...prev, postgresSameServer: { ...prev.postgresSameServer, password: e.target.value } }))}
                  className="px-3 py-2 rounded-md border md:col-span-2"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                  placeholder="Password"
                />
                <label className="flex items-center gap-2 text-sm md:col-span-2" style={{ color: 'var(--color-text)' }}>
                  <input
                    type="checkbox"
                    checked={databaseSettings.postgresSameServer.ssl}
                    onChange={(e) => setDatabaseSettings((prev) => ({ ...prev, postgresSameServer: { ...prev.postgresSameServer, ssl: e.target.checked } }))}
                  />
                  Use SSL
                </label>
              </div>
            )}

            <div className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p>Configured mode: {databaseRuntime?.configuredMode || databaseSettings.mode}</p>
              <p>Runtime mode: {databaseRuntime?.runtimeMode || 'mongodb'}</p>
              <p>Data access mode: {databaseRuntime?.dataAccessMode || 'mongodb'}</p>
              <p>Compatibility mode: {databaseRuntime?.compatibilityMode ? 'Enabled' : 'Disabled'}</p>
              <p>Restart required: {databaseRuntime?.requiresRestart ? 'Yes' : 'No'}</p>
              {databaseSettings.updatedAt && <p>Last updated: {new Date(databaseSettings.updatedAt).toLocaleString()}</p>}
            </div>

            <button
              onClick={saveDatabaseSettings}
              disabled={saving}
              className="mt-4 px-4 py-2 rounded-md text-sm text-white"
              style={{ backgroundColor: 'var(--color-primary)', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Database Settings'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'smtp' && isAdmin && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>SMTP Configuration</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Configure email delivery for OTPs, class reminders, and system notifications.
            </p>

            <label className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={smtpSettings.enabled}
                onChange={(e) => setSmtpSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable SMTP
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={smtpSettings.host}
                  onChange={(e) => setSmtpSettings((prev) => ({ ...prev, host: e.target.value }))}
                  className="px-3 py-2 rounded-md border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                  placeholder="SMTP host (e.g. mail.codercrafter.in)"
                />
              <input
                type="number"
                value={smtpSettings.port}
                onChange={(e) => setSmtpSettings((prev) => ({ ...prev, port: Number(e.target.value || 587) }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="Port"
              />
              <input
                type="text"
                value={smtpSettings.authUser}
                onChange={(e) => setSmtpSettings((prev) => ({ ...prev, authUser: e.target.value }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="SMTP username"
              />
              <input
                type="password"
                value={smtpSettings.authPass}
                onChange={(e) => setSmtpSettings((prev) => ({ ...prev, authPass: e.target.value }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="SMTP password (leave blank to keep existing)"
              />
              <input
                type="text"
                value={smtpSettings.fromName}
                onChange={(e) => setSmtpSettings((prev) => ({ ...prev, fromName: e.target.value }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="From name"
              />
              <input
                type="email"
                value={smtpSettings.fromEmail}
                onChange={(e) => setSmtpSettings((prev) => ({ ...prev, fromEmail: e.target.value }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="From email"
              />
              <input
                type="text"
                value={smtpSettings.replyTo}
                onChange={(e) => setSmtpSettings((prev) => ({ ...prev, replyTo: e.target.value }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="Reply-to (optional)"
              />
              <input
                type="email"
                value={smtpSettings.testEmail}
                onChange={(e) => setSmtpSettings((prev) => ({ ...prev, testEmail: e.target.value }))}
                className="px-3 py-2 rounded-md border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                placeholder="Test email (optional)"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-sm" style={{ color: 'var(--color-text)' }}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={smtpSettings.secure}
                  onChange={(e) => setSmtpSettings((prev) => ({ ...prev, secure: e.target.checked }))}
                />
                Use SSL (465)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={smtpSettings.requireTLS}
                  onChange={(e) => setSmtpSettings((prev) => ({ ...prev, requireTLS: e.target.checked }))}
                />
                Require STARTTLS
              </label>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Use hostname only, not full URL. Example: <code>mail.codercrafter.in</code>
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={saveSmtpSettings}
                disabled={saving}
                className="px-4 py-2 rounded-md text-sm text-white"
                style={{ backgroundColor: 'var(--color-primary)', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving...' : 'Save SMTP Settings'}
              </button>
              <button
                onClick={testSmtpSettings}
                disabled={saving}
                className="px-4 py-2 rounded-md text-sm"
                style={{ border: `1px solid var(--color-border)`, color: 'var(--color-text)' }}
              >
                {saving ? 'Testing...' : 'Test SMTP'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

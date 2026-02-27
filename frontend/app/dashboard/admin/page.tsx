'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, Database, GraduationCap, RefreshCw, ShieldCheck, Users, Wrench } from 'lucide-react'
import { useAuth } from '../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import RecentClassStatsCard from '@/components/attendance/RecentClassStatsCard'

type AdminDashboardData = {
  users: {
    total: number
    students: number
    instructors: number
    active: number
    inactive: number
  }
  courses: {
    total: number
    published: number
    draft: number
  }
  batches: {
    total: number
    upcoming: number
    active: number
    completed: number
  }
  enrollments: {
    total: number
    active: number
    completed: number
  }
  recentActivities: {
    recentEnrollments?: Array<{ message: string; timestamp: string }>
    recentCourses?: Array<{ message: string; timestamp: string }>
  }
}

type SupportDashboardData = {
  pendingTickets: number
  inProgressTickets: number
  pendingLeaveRequests: number
  urgentTickets: number
  ticketsNeedingAttention: number
  recentTickets: Array<{
    _id: string
    title: string
    type: 'ticket' | 'leave'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    status: 'pending' | 'in-progress' | 'resolved' | 'approved' | 'rejected'
    createdAt: string
  }>
}

type MonitoringHealth = {
  app?: { uptimeSeconds?: number }
  database?: { healthy?: boolean }
}

type MonitoringAlertStatus = {
  healthy?: boolean
  breaches?: string[]
}

const emptyAdminData: AdminDashboardData = {
  users: { total: 0, students: 0, instructors: 0, active: 0, inactive: 0 },
  courses: { total: 0, published: 0, draft: 0 },
  batches: { total: 0, upcoming: 0, active: 0, completed: 0 },
  enrollments: { total: 0, active: 0, completed: 0 },
  recentActivities: { recentEnrollments: [], recentCourses: [] },
}

const emptySupportData: SupportDashboardData = {
  pendingTickets: 0,
  inProgressTickets: 0,
  pendingLeaveRequests: 0,
  urgentTickets: 0,
  ticketsNeedingAttention: 0,
  recentTickets: [],
}

const formatUptime = (seconds = 0) => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hrs}h ${mins}m`
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dashboard, setDashboard] = useState<AdminDashboardData>(emptyAdminData)
  const [support, setSupport] = useState<SupportDashboardData>(emptySupportData)
  const [health, setHealth] = useState<MonitoringHealth | null>(null)
  const [alertStatus, setAlertStatus] = useState<MonitoringAlertStatus | null>(null)

  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const [adminRes, supportRes, healthRes, alertRes] = await Promise.allSettled([
        api.getDashboardStats(),
        api.getSupportDashboardStats(),
        api.getMonitoringHealth(),
        api.getMonitoringAlertStatus(),
      ])

      if (adminRes.status === 'fulfilled') {
        setDashboard(adminRes.value?.data || emptyAdminData)
      } else {
        setDashboard(emptyAdminData)
      }

      if (supportRes.status === 'fulfilled') {
        setSupport(supportRes.value?.data || emptySupportData)
      } else {
        setSupport(emptySupportData)
      }

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value?.data || null)
      } else {
        setHealth(null)
      }

      if (alertRes.status === 'fulfilled') {
        setAlertStatus(alertRes.value?.data || null)
      } else {
        setAlertStatus(null)
      }

      if (adminRes.status === 'rejected' && supportRes.status === 'rejected') {
        throw new Error('Unable to load dashboard data')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const recentActivity = useMemo(() => {
    const items = [
      ...(dashboard.recentActivities?.recentEnrollments || []),
      ...(dashboard.recentActivities?.recentCourses || []),
    ]
      .filter((item) => item?.message && item?.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return items.slice(0, 6)
  }, [dashboard])

  const activeUsersPercent = dashboard.users.total
    ? Math.round((dashboard.users.active / dashboard.users.total) * 100)
    : 0

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-8 border-b pb-4 flex items-start justify-between gap-4" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            Admin Dashboard
          </h1>
          <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            Executive view of users, learning operations, support queue, and platform health.
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff', opacity: loading ? 0.75 : 1 }}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-8">
        {[
          { title: 'Total Users', value: dashboard.users.total, sub: `${dashboard.users.students} students, ${dashboard.users.instructors} instructors`, icon: <Users className="w-4 h-4" /> },
          { title: 'Active Users', value: dashboard.users.active, sub: `${activeUsersPercent}% of total users`, icon: <ShieldCheck className="w-4 h-4" /> },
          { title: 'Courses', value: dashboard.courses.total, sub: `${dashboard.courses.published} published, ${dashboard.courses.draft} draft`, icon: <BookOpen className="w-4 h-4" /> },
          { title: 'Active Batches', value: dashboard.batches.active, sub: `${dashboard.batches.total} total batches`, icon: <GraduationCap className="w-4 h-4" /> },
          { title: 'Active Enrollments', value: dashboard.enrollments.active, sub: `${dashboard.enrollments.total} total enrollments`, icon: <Users className="w-4 h-4" /> },
          { title: 'Tickets Needing Action', value: support.ticketsNeedingAttention, sub: `${support.urgentTickets} urgent`, icon: <AlertTriangle className="w-4 h-4" /> },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-lg border p-4"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                {card.title}
              </p>
              <span style={{ color: 'var(--color-primary)' }}>{card.icon}</span>
            </div>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {loading ? '...' : card.value}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Operational Queue
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Pending tickets</span>
              <strong style={{ color: 'var(--color-text)' }}>{loading ? '...' : support.pendingTickets}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>In-progress tickets</span>
              <strong style={{ color: 'var(--color-text)' }}>{loading ? '...' : support.inProgressTickets}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Pending leave requests</span>
              <strong style={{ color: 'var(--color-text)' }}>{loading ? '...' : support.pendingLeaveRequests}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Urgent queue</span>
              <strong style={{ color: 'var(--color-warning)' }}>{loading ? '...' : support.urgentTickets}</strong>
            </div>
          </div>
          <Link href="/dashboard/admin/support" className="inline-block mt-4 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            Open ticket console
          </Link>
        </div>

        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            System Health
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Database</span>
              <strong style={{ color: health?.database?.healthy ? 'var(--color-success)' : 'var(--color-error)' }}>
                {health?.database?.healthy ? 'Healthy' : 'Check required'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Alert thresholds</span>
              <strong style={{ color: alertStatus?.healthy === false ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {alertStatus?.healthy === false ? 'Breach detected' : 'Within limits'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>App uptime</span>
              <strong style={{ color: 'var(--color-text)' }}>
                {health?.app?.uptimeSeconds ? formatUptime(health.app.uptimeSeconds) : '--'}
              </strong>
            </div>
          </div>
          <Link href="/dashboard/monitoring" className="inline-flex items-center gap-1 mt-4 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            <Database className="w-4 h-4" />
            Open monitoring
          </Link>
        </div>

        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Quick Actions
          </h2>
          <div className="space-y-2 text-sm">
            <Link href="/dashboard/users" className="block" style={{ color: 'var(--color-primary)' }}>
              Manage users and roles
            </Link>
            <Link href="/dashboard/courses" className="block" style={{ color: 'var(--color-primary)' }}>
              Create/edit courses and batches
            </Link>
            <Link href="/dashboard/live-classes" className="block" style={{ color: 'var(--color-primary)' }}>
              Review live class schedule
            </Link>
            <Link href="/dashboard/notifications" className="block" style={{ color: 'var(--color-primary)' }}>
              Send platform notifications
            </Link>
            <Link href="/dashboard/settings" className="inline-flex items-center gap-1 block" style={{ color: 'var(--color-primary)' }}>
              <Wrench className="w-4 h-4" />
              System and security settings
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <RecentClassStatsCard limit={7} title="Last 7 Classes Attendance Snapshot" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Recent Platform Activity
          </h2>
          <div className="space-y-3">
            {recentActivity.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No recent activity available yet.
              </p>
            )}
            {recentActivity.map((activity, idx) => (
              <div key={`${activity.timestamp}-${idx}`} className="rounded-md border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>{activity.message}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  {formatDateTime(activity.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Recently Opened Tickets
          </h2>
          <div className="space-y-3">
            {support.recentTickets.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No open tickets right now.
              </p>
            )}
            {support.recentTickets.map((ticket) => (
              <div key={ticket._id} className="rounded-md border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                    {ticket.title}
                  </p>
                  <span className="text-xs uppercase font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                    {ticket.priority}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {ticket.type} | {ticket.status} | {formatDateTime(ticket.createdAt)}
                </p>
              </div>
            ))}
          </div>
          <Link href="/dashboard/admin/support" className="inline-block mt-4 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            Go to all tickets
          </Link>
        </div>
      </div>
    </div>
  )
}


'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { AlertTriangle, Bell, BookOpen, CalendarDays, GraduationCap, LifeBuoy, Users } from 'lucide-react'
import RecentClassStatsCard from '@/components/attendance/RecentClassStatsCard'

type ManagerDashboardData = {
  stats: {
    totalCourses: number
    publishedCourses: number
    totalBatches: number
    activeBatches: number
    totalStudents: number
    totalInstructors: number
    liveClasses: number
    pendingLeaveRequests: number
    pendingSupportTickets: number
    inProgressSupportTickets: number
  }
  recent: {
    courses: Array<{ _id: string; title: string; status: string; createdAt: string }>
    liveClasses: Array<{ _id: string; title: string; status: string; scheduledStartTime: string }>
    tickets: Array<{ _id: string; title: string; type: string; priority: string; status: string; createdAt: string }>
  }
}

const emptyData: ManagerDashboardData = {
  stats: {
    totalCourses: 0,
    publishedCourses: 0,
    totalBatches: 0,
    activeBatches: 0,
    totalStudents: 0,
    totalInstructors: 0,
    liveClasses: 0,
    pendingLeaveRequests: 0,
    pendingSupportTickets: 0,
    inProgressSupportTickets: 0,
  },
  recent: {
    courses: [],
    liveClasses: [],
    tickets: [],
  },
}

export default function ManagerDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<ManagerDashboardData>(emptyData)

  const canSendNotifications = Array.isArray(user?.managerPermissions) && user.managerPermissions.includes('NOTIFICATION_MANAGEMENT_SEND')

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getManagerDashboard()
      setDashboard(response?.data || emptyData)
    } catch (err: any) {
      setError(err?.message || 'Failed to load manager dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-8 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Manager Dashboard</h1>
        <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          Operational view across courses, batches, people, and support queue.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md px-3 py-2 text-sm" style={{ border: '1px solid var(--color-error)', color: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Courses', value: dashboard.stats.totalCourses, sub: `${dashboard.stats.publishedCourses} published`, icon: <BookOpen className="w-5 h-5" /> },
          { label: 'Active Batches', value: dashboard.stats.activeBatches, sub: `${dashboard.stats.totalBatches} total`, icon: <CalendarDays className="w-5 h-5" /> },
          { label: 'Students', value: dashboard.stats.totalStudents, sub: `${dashboard.stats.totalInstructors} instructors`, icon: <GraduationCap className="w-5 h-5" /> },
          { label: 'Live Classes', value: dashboard.stats.liveClasses, sub: 'currently live', icon: <Users className="w-5 h-5" /> },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</p>
              <span style={{ color: 'var(--color-primary)' }}>{item.icon}</span>
            </div>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {loading ? '...' : item.value}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="flex items-center gap-2 mb-3">
            <LifeBuoy className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Support Queue</h2>
          </div>
          <p style={{ color: 'var(--color-text)' }}>Pending: <strong>{loading ? '...' : dashboard.stats.pendingSupportTickets}</strong></p>
          <p style={{ color: 'var(--color-text)' }}>In Progress: <strong>{loading ? '...' : dashboard.stats.inProgressSupportTickets}</strong></p>
          <p style={{ color: 'var(--color-text)' }}>Pending Leave Requests: <strong>{loading ? '...' : dashboard.stats.pendingLeaveRequests}</strong></p>
          <Link href="/dashboard/admin/support" className="inline-flex mt-4 text-sm" style={{ color: 'var(--color-primary)' }}>
            Open all tickets
          </Link>
        </div>

        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Quick Actions</h2>
          </div>
          <div className="space-y-2 text-sm">
            <Link href="/dashboard/courses" className="block" style={{ color: 'var(--color-primary)' }}>Manage courses and batches</Link>
            <Link href="/dashboard/users" className="block" style={{ color: 'var(--color-primary)' }}>Review users and roles</Link>
            <Link href="/dashboard/live-classes" className="block" style={{ color: 'var(--color-primary)' }}>Monitor live classes</Link>
            {canSendNotifications && (
              <Link href="/dashboard/notifications" className="block" style={{ color: 'var(--color-primary)' }}>
                Send custom notifications
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Refresh</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Pull latest operational snapshot for manager actions.
          </p>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 rounded-md text-white text-sm"
            style={{ backgroundColor: 'var(--color-primary)', opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Dashboard'}
          </button>
        </div>
      </div>

      <div className="mb-8">
        <RecentClassStatsCard limit={7} title="Last 7 Classes Attendance Snapshot" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Recent Courses</h3>
          <div className="space-y-2 text-sm">
            {dashboard.recent.courses.length === 0 && <p style={{ color: 'var(--color-text-secondary)' }}>No recent courses</p>}
            {dashboard.recent.courses.map((item) => (
              <div key={item._id} className="rounded border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                <p style={{ color: 'var(--color-text)' }}>{item.title}</p>
                <p style={{ color: 'var(--color-text-secondary)' }}>{item.status}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Upcoming/Live Classes</h3>
          <div className="space-y-2 text-sm">
            {dashboard.recent.liveClasses.length === 0 && <p style={{ color: 'var(--color-text-secondary)' }}>No class activity</p>}
            {dashboard.recent.liveClasses.map((item) => (
              <div key={item._id} className="rounded border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                <p style={{ color: 'var(--color-text)' }}>{item.title}</p>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {item.status} - {new Date(item.scheduledStartTime).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Tickets Needing Attention</h3>
          <div className="space-y-2 text-sm">
            {dashboard.recent.tickets.length === 0 && <p style={{ color: 'var(--color-text-secondary)' }}>No active tickets</p>}
            {dashboard.recent.tickets.map((item) => (
              <div key={item._id} className="rounded border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                <p style={{ color: 'var(--color-text)' }}>{item.title}</p>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {item.type} - {item.priority} - {item.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

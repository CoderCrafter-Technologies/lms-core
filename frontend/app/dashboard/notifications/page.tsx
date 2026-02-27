'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { api } from '@/lib/api'

type TargetType = 'ALL_USERS' | 'ROLES' | 'COURSE' | 'BATCH' | 'USERS'

const ROLE_OPTIONS = ['STUDENT', 'INSTRUCTOR', 'MANAGER', 'ADMIN']

export default function NotificationsManagementPage() {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [courses, setCourses] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [resultMessage, setResultMessage] = useState('')

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [linkUrl, setLinkUrl] = useState('')
  const [targetType, setTargetType] = useState<TargetType>('ALL_USERS')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['STUDENT'])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  const canSendCustomNotification = useMemo(() => {
    if (!user?.role?.name) return false
    if (user.role.name === 'ADMIN') return true
    if (user.role.name === 'MANAGER') {
      return Array.isArray(user.managerPermissions) && user.managerPermissions.includes('NOTIFICATION_MANAGEMENT_SEND')
    }
    return false
  }, [user])

  useEffect(() => {
    if (!canSendCustomNotification) return
    const fetchData = async () => {
      setLoadingData(true)
      try {
        const [coursesResponse, batchesResponse, usersResponse] = await Promise.all([
          api.getCourses({ limit: 200 }),
          api.getBatches({ limit: 200 }),
          api.getUsers({ limit: 300 }),
        ])
        setCourses(coursesResponse?.data || [])
        setBatches(batchesResponse?.data || [])
        setUsers(usersResponse?.data || [])
      } catch (error) {
        console.error('Failed to load notification targeting data:', error)
      } finally {
        setLoadingData(false)
      }
    }

    fetchData()
  }, [canSendCustomNotification])

  const visibleBatches = useMemo(() => {
    if (!selectedCourseId) return batches
    return batches.filter((batch) => {
      const courseId = batch?.courseId?._id || batch?.courseId?.id || batch?.courseId
      return courseId?.toString() === selectedCourseId
    })
  }, [batches, selectedCourseId])

  if (!canSendCustomNotification) {
    return (
      <div className="p-6">
        <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Notifications</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            You do not have permission to send custom notifications.
          </p>
        </div>
      </div>
    )
  }

  const handleRoleToggle = (roleName: string) => {
    setSelectedRoles((prev) => {
      if (prev.includes(roleName)) {
        return prev.filter((role) => role !== roleName)
      }
      return [...prev, roleName]
    })
  }

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      }
      return [...prev, userId]
    })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setResultMessage('')

    if (!title.trim() || !message.trim()) {
      setResultMessage('Title and message are required.')
      return
    }

    if (targetType === 'ROLES' && selectedRoles.length === 0) {
      setResultMessage('Select at least one role.')
      return
    }

    if (targetType === 'COURSE' && !selectedCourseId) {
      setResultMessage('Select a course.')
      return
    }

    if (targetType === 'BATCH' && !selectedBatchId) {
      setResultMessage('Select a batch.')
      return
    }

    if (targetType === 'USERS' && selectedUserIds.length === 0) {
      setResultMessage('Select at least one user.')
      return
    }

    setSubmitting(true)
    try {
      const response = await api.sendCustomNotification({
        title: title.trim(),
        message: message.trim(),
        priority,
        targetType,
        roleNames: targetType === 'ROLES' ? selectedRoles : [],
        courseId: targetType === 'COURSE' ? selectedCourseId : undefined,
        batchId: targetType === 'BATCH' ? selectedBatchId : undefined,
        userIds: targetType === 'USERS' ? selectedUserIds : [],
        linkUrl: linkUrl.trim() || undefined,
      })

      setResultMessage(response?.message || 'Notification sent successfully.')
      setTitle('')
      setMessage('')
      setLinkUrl('')
      setSelectedUserIds([])
    } catch (error: any) {
      setResultMessage(error?.message || 'Failed to send notification.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Notifications</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Send announcements with an optional click-through link. Managers can send only if granted notification permission.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              placeholder="Announcement title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Priority</label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as 'low' | 'normal' | 'high' | 'urgent')}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Message</label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm min-h-28"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            placeholder="Write your notification message"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Link (optional)</label>
          <input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            placeholder="/dashboard/courses or https://example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Audience</label>
          <select
            value={targetType}
            onChange={(event) => {
              const nextTargetType = event.target.value as TargetType
              setTargetType(nextTargetType)
              if (nextTargetType !== 'BATCH') {
                setSelectedBatchId('')
              }
            }}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <option value="ALL_USERS">All users</option>
            <option value="ROLES">Role-based</option>
            <option value="COURSE">Course enrollments</option>
            <option value="BATCH">Batch enrollments</option>
            <option value="USERS">Specific users</option>
          </select>
        </div>

        {targetType === 'ROLES' && (
          <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
            <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>Select roles</p>
            <div className="flex flex-wrap gap-3">
              {ROLE_OPTIONS.map((roleName) => (
                <label key={roleName} className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(roleName)}
                    onChange={() => handleRoleToggle(roleName)}
                  />
                  {roleName}
                </label>
              ))}
            </div>
          </div>
        )}

        {targetType === 'COURSE' && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Course</label>
            <select
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.id || course._id} value={course.id || course._id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {targetType === 'BATCH' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Filter by course (optional)</label>
              <select
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="">All courses</option>
                {courses.map((course) => (
                  <option key={course.id || course._id} value={course.id || course._id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Batch</label>
              <select
                value={selectedBatchId}
                onChange={(event) => setSelectedBatchId(event.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="">Select batch</option>
                {visibleBatches.map((batch) => (
                  <option key={batch.id || batch._id} value={batch.id || batch._id}>
                    {batch.name} ({batch.batchCode || 'N/A'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {targetType === 'USERS' && (
          <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
            <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>Select users</p>
            <div className="max-h-44 overflow-y-auto space-y-2">
              {users.map((candidateUser) => {
                const candidateId = candidateUser.id || candidateUser._id
                const fullName = `${candidateUser.firstName || ''} ${candidateUser.lastName || ''}`.trim()
                return (
                  <label key={candidateId} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(candidateId)}
                      onChange={() => handleUserToggle(candidateId)}
                    />
                    <span>{fullName || candidateUser.email} ({candidateUser.email})</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || loadingData}
            className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {submitting ? 'Sending...' : 'Send notification'}
          </button>
          {loadingData && (
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading target data...</span>
          )}
          {resultMessage && (
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{resultMessage}</span>
          )}
        </div>
      </form>
    </div>
  )
}


'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { api } from '@/lib/api'
import { LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline'

type EnrollmentWithCourse = {
  id: string
  status: string
  courseId: {
    id?: string
    _id?: string
    title?: string
    thumbnail?: { url?: string }
  }
  certificate?: {
    issued?: boolean
    certificateUrl?: string
    issuedAt?: string
  }
}

export default function CertificationsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([])
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentWithCourse | null>(null)

  const isStudent = user?.role?.name === 'STUDENT'

  useEffect(() => {
    if (!isStudent) {
      setLoading(false)
      return
    }

    const loadEnrollments = async () => {
      setLoading(true)
      try {
        const response = await api.getStudentsMyEnrollments()
        setEnrollments(response?.data || [])
      } catch (error) {
        console.error('Failed to load certifications:', error)
      } finally {
        setLoading(false)
      }
    }

    loadEnrollments()
  }, [isStudent])

  const certificateCards = useMemo(() => {
    return enrollments.map((enrollment) => {
      const isCompleted = enrollment.status === 'COMPLETED'
      const isIssued = Boolean(enrollment.certificate?.issued && enrollment.certificate?.certificateUrl)
      const isLocked = !isCompleted || !isIssued
      return {
        ...enrollment,
        isLocked,
      }
    })
  }, [enrollments])

  if (!isStudent) {
    return (
      <div className="p-6">
        <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Certifications</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            This section is available for students.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Certifications</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Certificates unlock when the course is completed and issued by admin.
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border p-8 text-sm" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          Loading certificates...
        </div>
      ) : certificateCards.length === 0 ? (
        <div className="rounded-lg border p-8 text-sm" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          You are not enrolled in any courses yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {certificateCards.map((enrollment) => {
            const courseTitle = enrollment.courseId?.title || 'Course'
            return (
              <button
                key={enrollment.id}
                type="button"
                onClick={() => setSelectedEnrollment(enrollment)}
                className="group relative rounded-xl border p-5 text-left transition hover:shadow-lg"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                    Certificate
                  </p>
                  {enrollment.isLocked && (
                    <LockClosedIcon className="h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  )}
                </div>
                <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                  {courseTitle}
                </p>
                <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {enrollment.isLocked ? 'Locked until completion and issuance' : 'Ready to view'}
                </p>

                {enrollment.isLocked && (
                  <div className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-xl bg-black/45 text-sm font-medium text-white group-hover:flex">
                    Locked until course completion
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {selectedEnrollment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-3xl rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <button
              type="button"
              onClick={() => setSelectedEnrollment(null)}
              className="absolute right-3 top-3 rounded-md p-1 transition hover:bg-black/10"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
            </button>

            <div className="p-6">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {selectedEnrollment.courseId?.title || 'Certificate preview'}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {selectedEnrollment.certificate?.issued ? 'Certificate issued' : 'Certificate not issued yet'}
              </p>
            </div>

            <div className="px-6 pb-6">
              <div className="relative overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <div className={`min-h-[26rem] bg-gradient-to-br from-sky-100 to-blue-50 p-8 ${selectedEnrollment.status !== 'COMPLETED' || !selectedEnrollment.certificate?.issued ? 'blur-sm select-none' : ''}`}>
                  <div className="mx-auto mt-12 max-w-xl rounded-lg border border-sky-300 bg-white p-8 text-center">
                    <p className="text-sm uppercase tracking-widest text-sky-600">Certificate of Completion</p>
                    <p className="mt-8 text-2xl font-semibold text-slate-900">{user?.firstName} {user?.lastName}</p>
                    <p className="mt-2 text-slate-700">has successfully completed</p>
                    <p className="mt-4 text-xl font-semibold text-slate-900">{selectedEnrollment.courseId?.title}</p>
                  </div>
                </div>

                {(selectedEnrollment.status !== 'COMPLETED' || !selectedEnrollment.certificate?.issued) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <div className="rounded-md bg-black/70 px-4 py-2 text-sm font-medium text-white">
                      Locked until course completion
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


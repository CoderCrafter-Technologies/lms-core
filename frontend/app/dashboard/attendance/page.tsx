'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { api } from '@/lib/api'

type AnalyticsView = 'class' | 'week' | 'month'

type ClassAnalyticsRow = {
  classId: string
  title: string
  status: string
  statusLabel: string
  scheduledStartTime: string
  batch?: {
    id?: string
    name?: string
    courseTitle?: string
  }
  summary: {
    totalStudents: number
    present: number
    leftEarly: number
    absent: number
    lateJoiners: number
    lateJoinersLeftEarly: number
    averageAttendancePercentage: number
  }
}

type PeriodAnalyticsRow = {
  key: string
  totalClasses: number
  totalStudents: number
  present: number
  leftEarly: number
  absent: number
  lateJoiners: number
  lateJoinersLeftEarly: number
  averageAttendancePercentage: number
}

type AttendanceStudent = {
  studentId: string
  studentName: string
  studentEmail: string
  attendanceStatus: 'PRESENT' | 'LEFT_EARLY' | 'ABSENT' | 'UNKNOWN'
  attendancePercentage: number
  attendedMinutes: number
  classDurationMinutes: number
  isLateJoiner: boolean
  isLeftEarly: boolean
  lateByMinutes: number | null
}

type BatchOption = {
  id: string
  label: string
}

const statusOptions = ['ALL', 'PRESENT', 'LEFT_EARLY', 'ABSENT', 'LATE_JOINER', 'LATE_JOINER_LEFT_EARLY'] as const

const getStatusBadgeText = (statusLabel?: string) => {
  if (!statusLabel) return 'UNKNOWN'
  return statusLabel.replace(/_/g, ' ')
}

export default function AttendanceDashboardPage() {
  const { user } = useAuth()

  const [view, setView] = useState<AnalyticsView>('class')
  const [rows, setRows] = useState<Array<ClassAnalyticsRow | PeriodAnalyticsRow>>([])
  const [loading, setLoading] = useState(false)

  const [batches, setBatches] = useState<BatchOption[]>([])
  const [batchSearch, setBatchSearch] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [students, setStudents] = useState<AttendanceStudent[]>([])
  const [classSummary, setClassSummary] = useState<any>(null)
  const [classLoading, setClassLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [minPercent, setMinPercent] = useState<string>('')
  const [maxPercent, setMaxPercent] = useState<string>('')
  const [search, setSearch] = useState('')
  const [rebaselineRunning, setRebaselineRunning] = useState(false)
  const [rebaselineMessage, setRebaselineMessage] = useState('')

  const canAccess = useMemo(() => {
    const role = user?.role?.name
    return role === 'ADMIN' || role === 'INSTRUCTOR' || role === 'MANAGER'
  }, [user?.role?.name])

  const filteredBatches = useMemo(() => {
    const term = batchSearch.trim().toLowerCase()
    const source = term
      ? batches.filter((item) => item.label.toLowerCase().includes(term))
      : batches
    return source.slice(0, 5)
  }, [batches, batchSearch])

  const canRebaseline = useMemo(() => {
    const role = user?.role?.name
    return role === 'ADMIN' || role === 'MANAGER'
  }, [user?.role?.name])

  const selectedClassRow = useMemo(() => {
    return (rows as ClassAnalyticsRow[]).find((row) => row.classId === selectedClassId)
  }, [rows, selectedClassId])

  const loadBatchOptions = async () => {
    try {
      const response = await api.getBatches({ limit: 200, status: 'ACTIVE' })
      const docs = response?.data?.documents || response?.data || []

      const options: BatchOption[] = docs.map((batch: any) => {
        const courseTitle = batch?.courseId?.title || 'Course'
        const batchName = batch?.name || 'Batch'
        return {
          id: batch?.id || batch?._id,
          label: `${courseTitle} - ${batchName}`
        }
      }).filter((item: BatchOption) => Boolean(item.id))

      setBatches(options)
    } catch (error) {
      console.error('Failed to load batch options:', error)
      setBatches([])
    }
  }

  const loadAnalytics = async (nextView: AnalyticsView, batchId: string) => {
    try {
      setLoading(true)
      const response = await api.getLiveClassAttendanceAnalytics({
        view: nextView,
        batchId: batchId || undefined,
        limit: nextView === 'class' ? 150 : 300
      })
      setRows(response?.data?.rows || [])
    } catch (error) {
      console.error('Failed to load attendance analytics:', error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const loadClassReport = async (classId: string) => {
    if (!classId) return

    try {
      setClassLoading(true)
      const response = await api.getLiveClassAttendanceReport(classId, {
        status: statusFilter as any,
        minPercent: minPercent === '' ? undefined : Number(minPercent),
        maxPercent: maxPercent === '' ? undefined : Number(maxPercent),
        search: search || undefined,
        page: 1,
        limit: 500,
      })

      setClassSummary(response?.data?.classSummary || null)
      setStudents(response?.data?.students || [])
    } catch (error) {
      console.error('Failed to load class attendance report:', error)
      setClassSummary(null)
      setStudents([])
    } finally {
      setClassLoading(false)
    }
  }

  useEffect(() => {
    if (!canAccess) return
    loadBatchOptions()
  }, [canAccess])

  useEffect(() => {
    if (!canAccess) return
    loadAnalytics(view, selectedBatchId)
    setDetailsOpen(false)
    setSelectedClassId('')
  }, [canAccess, view, selectedBatchId])

  useEffect(() => {
    if (!detailsOpen || !selectedClassId) return
    loadClassReport(selectedClassId)
  }, [detailsOpen, selectedClassId])

  const openClassDetails = (classId: string) => {
    setSelectedClassId(classId)
    setStatusFilter('ALL')
    setMinPercent('')
    setMaxPercent('')
    setSearch('')
    setDetailsOpen(true)
  }

  const applyFilters = () => {
    if (!selectedClassId) return
    loadClassReport(selectedClassId)
  }

  const runHistoricalRebaseline = async (dryRun: boolean) => {
    try {
      setRebaselineRunning(true)
      setRebaselineMessage('')
      const response = await api.rebaselineHistoricalAttendance({
        batchId: selectedBatchId || undefined,
        dryRun,
        limit: 1000
      })
      const result = response?.data || {}
      setRebaselineMessage(
        `${dryRun ? 'Dry-run' : 'Re-baseline'} completed. Scanned ${result.scannedClasses || 0}, updated ${result.updatedClasses || 0}, generated ${result.generatedRecords || 0}.`
      )
      if (!dryRun) {
        await loadAnalytics(view, selectedBatchId)
      }
    } catch (error: any) {
      setRebaselineMessage(error?.message || 'Failed to re-baseline historical attendance.')
    } finally {
      setRebaselineRunning(false)
    }
  }

  if (!canAccess) {
    return (
      <div className="flex-1 p-6" style={{ backgroundColor: 'var(--color-background)' }}>
        <p style={{ color: 'var(--color-text)' }}>You do not have access to attendance analytics.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-6 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Class Attendance Statistics</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Review attendance by class, week, and month. Open class details only when needed.
        </p>
        {rebaselineMessage && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>{rebaselineMessage}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Search Batch</label>
          <input
            value={batchSearch}
            onChange={(e) => setBatchSearch(e.target.value)}
            placeholder="Web Development - Batch 1"
            className="w-full border rounded px-3 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Select Batch (Top 5)</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
          >
            <option value="">All batches</option>
            {filteredBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>{batch.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <div className="text-xs w-full" style={{ color: 'var(--color-text-secondary)' }}>
            <div>Showing {selectedBatchId ? 'filtered' : 'all'} class stats. Use search to quickly find batch options.</div>
            {canRebaseline && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => runHistoricalRebaseline(true)}
                  disabled={rebaselineRunning}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  {rebaselineRunning ? 'Running...' : 'Dry-run historical re-baseline'}
                </button>
                <button
                  onClick={() => runHistoricalRebaseline(false)}
                  disabled={rebaselineRunning}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  {rebaselineRunning ? 'Running...' : 'Run historical re-baseline'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(['class', 'week', 'month'] as AnalyticsView[]).map((item) => (
          <button
            key={item}
            className="px-3 py-2 rounded border text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: view === item ? 'var(--color-primary)' : 'var(--color-surface)',
              color: view === item ? '#fff' : 'var(--color-text)'
            }}
            onClick={() => setView(item)}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="rounded-lg border mb-6 overflow-x-auto" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>{view === 'class' ? 'Class / Period' : 'Period'}</th>
              {view === 'class' && <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>Class Status</th>}
              <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>Classes</th>
              <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>Students</th>
              <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>Present</th>
              <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>Left Early</th>
              <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>Absent</th>
              <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>Late Joiners</th>
              <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>Avg %</th>
              {view === 'class' && <th className="text-left p-3" style={{ color: 'var(--color-text-secondary)' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={10} style={{ color: 'var(--color-text-secondary)' }}>Loading...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-3" colSpan={10} style={{ color: 'var(--color-text-secondary)' }}>No attendance data found.</td>
              </tr>
            )}
            {!loading && rows.map((row: any) => (
              <tr key={row.classId || row.key} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td className="p-3" style={{ color: 'var(--color-text)' }}>
                  {view === 'class' ? (
                    <div>
                      <p>{row.title}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(row.scheduledStartTime).toLocaleString()} · {row.batch?.courseTitle || 'Course'} - {row.batch?.name || 'Batch'}
                      </p>
                    </div>
                  ) : row.key}
                </td>
                {view === 'class' && (
                  <td className="p-3">
                    <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text)' }}>
                      {getStatusBadgeText(row.statusLabel)}
                    </span>
                  </td>
                )}
                <td className="p-3">{view === 'class' ? 1 : row.totalClasses}</td>
                <td className="p-3">{view === 'class' ? row.summary.totalStudents : row.totalStudents}</td>
                <td className="p-3">{view === 'class' ? row.summary.present : row.present}</td>
                <td className="p-3">{view === 'class' ? row.summary.leftEarly : row.leftEarly}</td>
                <td className="p-3">{view === 'class' ? row.summary.absent : row.absent}</td>
                <td className="p-3">{view === 'class' ? row.summary.lateJoiners : row.lateJoiners}</td>
                <td className="p-3">{view === 'class' ? row.summary.averageAttendancePercentage : row.averageAttendancePercentage}%</td>
                {view === 'class' && (
                  <td className="p-3">
                    <button
                      className="text-sm"
                      style={{ color: 'var(--color-primary)' }}
                      onClick={() => openClassDetails(row.classId)}
                    >
                      View details
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailsOpen(false)} />
          <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {(classSummary?.title || selectedClassRow?.title || 'Class')} - Student Attendance
              </h2>
              <button onClick={() => setDetailsOpen(false)} className="text-sm" style={{ color: 'var(--color-primary)' }}>
                Close
              </button>
            </div>

            {selectedClassRow?.statusLabel !== 'ENDED' && (
              <div className="mb-3 rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}>
                This class has not ended yet. Final attendance status will be available after class completion.
              </div>
            )}

            <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Total: {classSummary?.summary?.totalStudents || 0} | Present: {classSummary?.summary?.present || 0} | Left Early: {classSummary?.summary?.leftEarly || 0} | Absent: {classSummary?.summary?.absent || 0}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <select
                className="border rounded px-2 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <input
                placeholder="Min %"
                type="number"
                min={0}
                max={100}
                value={minPercent}
                onChange={(e) => setMinPercent(e.target.value)}
                className="border rounded px-2 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              />
              <input
                placeholder="Max %"
                type="number"
                min={0}
                max={100}
                value={maxPercent}
                onChange={(e) => setMaxPercent(e.target.value)}
                className="border rounded px-2 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              />
              <input
                placeholder="Search student"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border rounded px-2 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              />
              <button
                onClick={applyFilters}
                className="rounded px-3 py-2 text-sm text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Apply
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left p-2">Student</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Attendance %</th>
                    <th className="text-left p-2">Late Join</th>
                    <th className="text-left p-2">Left Early</th>
                    <th className="text-left p-2">Attended</th>
                  </tr>
                </thead>
                <tbody>
                  {classLoading && (
                    <tr>
                      <td className="p-2" colSpan={6}>Loading student report...</td>
                    </tr>
                  )}
                  {!classLoading && students.length === 0 && (
                    <tr>
                      <td className="p-2" colSpan={6}>No students matched filters.</td>
                    </tr>
                  )}
                  {!classLoading && students.map((student) => (
                    <tr key={student.studentId} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td className="p-2">
                        <p style={{ color: 'var(--color-text)' }}>{student.studentName}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{student.studentEmail}</p>
                      </td>
                      <td className="p-2">{student.attendanceStatus}</td>
                      <td className="p-2">{student.attendancePercentage}%</td>
                      <td className="p-2">{student.isLateJoiner ? `Yes${student.lateByMinutes !== null ? ` (${student.lateByMinutes}m)` : ''}` : 'No'}</td>
                      <td className="p-2">{student.isLeftEarly ? 'Yes' : 'No'}</td>
                      <td className="p-2">{student.attendedMinutes}/{student.classDurationMinutes} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

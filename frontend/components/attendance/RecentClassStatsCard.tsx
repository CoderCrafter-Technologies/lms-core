'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

type ClassStat = {
  classId: string
  title: string
  scheduledStartTime: string
  batch?: { name?: string; courseTitle?: string }
  summary: {
    totalStudents: number
    present: number
    leftEarly: number
    absent: number
    averageAttendancePercentage: number
  }
}

type Props = {
  limit?: number
  title?: string
}

export default function RecentClassStatsCard({ limit = 5, title = 'Recent Class Stats' }: Props) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ClassStat[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const response = await api.getRecentClassAttendanceStats({ limit })
        setRows(response?.data?.rows || [])
      } catch (error) {
        console.error('Failed to load recent class attendance stats:', error)
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [limit])

  return (
    <div className="rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h3>
        <Link href="/dashboard/attendance" className="text-sm" style={{ color: 'var(--color-primary)' }}>
          View all
        </Link>
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>}
      {!loading && rows.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No ended classes found.</p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.classId} className="rounded border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{row.title}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {new Date(row.scheduledStartTime).toLocaleString()} · {row.batch?.name || 'Batch'}
                </p>
              </div>
              <Link href={`/dashboard/attendance?classId=${row.classId}`} className="text-xs" style={{ color: 'var(--color-primary)' }}>
                Details
              </Link>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              P: {row.summary.present} | LE: {row.summary.leftEarly} | A: {row.summary.absent} | Avg: {row.summary.averageAttendancePercentage}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}


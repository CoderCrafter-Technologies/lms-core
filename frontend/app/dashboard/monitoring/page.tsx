'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { api } from '@/lib/api'
import { initSocket, releaseSocket } from '@/lib/services/socket'

type MonitoringCategory = 'LOG' | 'EVENT' | 'ERROR'
type MonitoringMode = 'LIVE' | 'SAVED'

type MonitoringRecord = {
  id: string
  category: MonitoringCategory
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  source: string
  action?: string
  entityType?: string
  entityId?: string
  message: string
  createdAt: string
  isArchived?: boolean
  actorId?: {
    id?: string
    firstName?: string
    lastName?: string
    email?: string
  } | null
  metadata?: Record<string, any>
}

type MonitoringPolicy = {
  retentionDays: number
  archiveWindowDays: number
  exportMaxRecords: number
  alertThresholds: {
    warnPerHour: number
    errorPerHour: number
    criticalPerHour: number
    memoryRssMb: number
  }
}

type MonitoringHealth = {
  timestamp: string
  app: { uptimeSeconds: number }
  database: { healthy: boolean }
  memory: { process: { rss: number } }
  storage: { totalAppStorageBytes: number; monitoringRecordCount: number }
}

type AlertStatus = {
  metrics: {
    warnPerHour: number
    errorPerHour: number
    criticalPerHour: number
    memoryRssMb: number
  }
  thresholds: {
    warnPerHour: number
    errorPerHour: number
    criticalPerHour: number
    memoryRssMb: number
  }
  breaches: string[]
  healthy: boolean
}

const defaultPolicy: MonitoringPolicy = {
  retentionDays: 90,
  archiveWindowDays: 30,
  exportMaxRecords: 5000,
  alertThresholds: {
    warnPerHour: 100,
    errorPerHour: 30,
    criticalPerHour: 10,
    memoryRssMb: 2048,
  },
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`
}

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
    <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>{title}</h2>
    {children}
  </div>
)

export default function MonitoringPage() {
  const { user } = useAuth()
  const [mode, setMode] = useState<MonitoringMode>('LIVE')
  const [records, setRecords] = useState<MonitoringRecord[]>([])
  const [health, setHealth] = useState<MonitoringHealth | null>(null)
  const [policy, setPolicy] = useState<MonitoringPolicy>(defaultPolicy)
  const [alertStatus, setAlertStatus] = useState<AlertStatus | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [filters, setFilters] = useState({
    category: 'ALL',
    level: 'ALL',
    source: '',
    search: '',
    from: '',
    to: '',
    includeArchived: false,
  })

  const recordMatchesFilters = (record: MonitoringRecord) => {
    if (filters.category !== 'ALL' && record.category !== filters.category) return false
    if (filters.level !== 'ALL' && record.level !== filters.level) return false
    if (!filters.includeArchived && record.isArchived) return false

    const sourceTerm = filters.source.trim().toLowerCase()
    if (sourceTerm && !String(record.source || '').toLowerCase().includes(sourceTerm)) return false

    const searchTerm = filters.search.trim().toLowerCase()
    if (searchTerm) {
      const haystack = `${record.message || ''} ${record.action || ''} ${record.entityType || ''} ${record.entityId || ''}`.toLowerCase()
      if (!haystack.includes(searchTerm)) return false
    }

    const createdAtMs = new Date(record.createdAt).getTime()
    if (filters.from) {
      const fromMs = new Date(filters.from).getTime()
      if (Number.isFinite(fromMs) && createdAtMs < fromMs) return false
    }
    if (filters.to) {
      const toMs = new Date(filters.to).getTime()
      if (Number.isFinite(toMs) && createdAtMs > toMs) return false
    }

    return true
  }

  const canAccessMonitoring = useMemo(() => {
    if (!user?.role?.name) return false
    if (user.role.name === 'ADMIN') return true
    if (user.role.name === 'MANAGER') {
      return Array.isArray(user.managerPermissions) && user.managerPermissions.includes('MONITORING_READ')
    }
    return false
  }, [user])

  const setQuickWindow = (days: number) => {
    const toDate = new Date()
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    setFilters((prev) => ({
      ...prev,
      from: fromDate.toISOString().slice(0, 16),
      to: toDate.toISOString().slice(0, 16),
    }))
  }

  const loadHealth = async () => {
    try {
      const response = await api.getMonitoringHealth()
      setHealth(response?.data || null)
    } catch {
      setHealth(null)
    }
  }

  const loadPolicy = async () => {
    try {
      const response = await api.getMonitoringPolicy()
      setPolicy(response?.data || defaultPolicy)
    } catch {
      setPolicy(defaultPolicy)
    }
  }

  const loadAlertStatus = async () => {
    try {
      const response = await api.getMonitoringAlertStatus()
      setAlertStatus(response?.data || null)
    } catch {
      setAlertStatus(null)
    }
  }

  const loadSavedRecords = async () => {
    try {
      const response = await api.getMonitoringRecords({
        page: 1,
        limit: 100,
        ...(filters.category !== 'ALL' ? { category: filters.category as MonitoringCategory } : {}),
        ...(filters.level !== 'ALL' ? { level: filters.level as any } : {}),
        ...(filters.source ? { source: filters.source } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.from ? { from: new Date(filters.from).toISOString() } : {}),
        ...(filters.to ? { to: new Date(filters.to).toISOString() } : {}),
        includeArchived: filters.includeArchived,
      })
      setRecords((response?.data || []) as MonitoringRecord[])
      setErrorMessage('')
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load monitoring records.')
    }
  }

  const loadInitial = async () => {
    if (!canAccessMonitoring) return
    await Promise.all([loadHealth(), loadPolicy(), loadAlertStatus()])
  }

  useEffect(() => {
    loadInitial()
  }, [canAccessMonitoring])

  useEffect(() => {
    if (!canAccessMonitoring) return
    const interval = setInterval(() => {
      loadHealth()
      loadAlertStatus()
    }, 60_000)
    return () => clearInterval(interval)
  }, [canAccessMonitoring])

  useEffect(() => {
    if (!canAccessMonitoring) return
    if (mode === 'SAVED') {
      loadSavedRecords()
      return
    }

    const socket = process.env.NEXT_PUBLIC_SOCKET_URL
      ? initSocket(process.env.NEXT_PUBLIC_SOCKET_URL)
      : initSocket()

    socket.emit('register-user', { userId: user?.id })

    const handleLiveRecord = (record: MonitoringRecord) => {
      if (!recordMatchesFilters(record)) return
      setRecords((prev) => [record, ...prev].slice(0, 100))
    }

    setRecords([])
    socket.on('monitoring:record', handleLiveRecord)
    return () => {
      socket.off('monitoring:record', handleLiveRecord)
      releaseSocket()
    }
  }, [canAccessMonitoring, mode, user?.id, filters.category, filters.level, filters.includeArchived, filters.source, filters.search, filters.from, filters.to])

  const savePolicy = async () => {
    try {
      setBusy(true)
      setInfoMessage('')
      setErrorMessage('')
      await api.updateMonitoringPolicy(policy)
      await Promise.all([loadPolicy(), loadAlertStatus()])
      setInfoMessage('Monitoring policy updated.')
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to update monitoring policy.')
    } finally {
      setBusy(false)
    }
  }

  const runArchiveWindow = async () => {
    try {
      setBusy(true)
      setInfoMessage('')
      const response = await api.runMonitoringArchiveWindow()
      setInfoMessage(`Archive run complete. Archived ${response?.data?.archivedCount || 0} records.`)
      if (mode === 'SAVED') await loadSavedRecords()
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to run archive window.')
    } finally {
      setBusy(false)
    }
  }

  const runRetentionCleanup = async () => {
    try {
      setBusy(true)
      setInfoMessage('')
      const response = await api.runMonitoringRetentionCleanup()
      setInfoMessage(`Retention cleanup complete. Deleted ${response?.data?.deletedCount || 0} records.`)
      if (mode === 'SAVED') await loadSavedRecords()
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to run retention cleanup.')
    } finally {
      setBusy(false)
    }
  }

  const downloadExport = async (format: 'json' | 'csv') => {
    try {
      setBusy(true)
      setInfoMessage('')
      const result = await api.exportMonitoringBundle({
        format,
        ...(filters.category !== 'ALL' ? { category: filters.category as MonitoringCategory } : {}),
        ...(filters.level !== 'ALL' ? { level: filters.level as any } : {}),
        ...(filters.source ? { source: filters.source } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.from ? { from: new Date(filters.from).toISOString() } : {}),
        ...(filters.to ? { to: new Date(filters.to).toISOString() } : {}),
        includeArchived: filters.includeArchived,
      })
      const url = window.URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      a.click()
      window.URL.revokeObjectURL(url)
      setInfoMessage(`Exported monitoring bundle as ${result.filename}`)
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to export monitoring bundle.')
    } finally {
      setBusy(false)
    }
  }

  if (!canAccessMonitoring) {
    return (
      <div className="p-6">
        <Panel title="Monitoring">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            You do not have permission to access monitoring.
          </p>
        </Panel>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <Panel title="Monitoring Console">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Retention policy, archive windows, export bundles, and threshold alerts in one place.
        </p>
      </Panel>

      {(errorMessage || infoMessage) && (
        <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: errorMessage ? 'var(--color-error)' : 'var(--color-border)', color: errorMessage ? 'var(--color-error)' : 'var(--color-text)' }}>
          {errorMessage || infoMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Database">
          <p className="text-lg font-semibold" style={{ color: health?.database?.healthy ? '#22c55e' : '#ef4444' }}>
            {health?.database?.healthy ? 'Healthy' : 'Unhealthy'}
          </p>
        </Panel>
        <Panel title="Uptime">
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {health ? `${Math.floor(health.app.uptimeSeconds / 3600)}h ${Math.floor((health.app.uptimeSeconds % 3600) / 60)}m` : '--'}
          </p>
        </Panel>
        <Panel title="Storage">
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {health ? formatBytes(health.storage.totalAppStorageBytes) : '--'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Records: {health?.storage.monitoringRecordCount ?? '--'}
          </p>
        </Panel>
        <Panel title="Memory RSS">
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {health ? formatBytes(health.memory.process.rss) : '--'}
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Policy Controls">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label style={{ color: 'var(--color-text)' }}>
              Retention Days
              <input type="number" min={1} max={3650} value={policy.retentionDays} onChange={(e) => setPolicy((p) => ({ ...p, retentionDays: Number(e.target.value || 1) }))} className="mt-1 w-full rounded border px-2 py-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
            </label>
            <label style={{ color: 'var(--color-text)' }}>
              Archive Window Days
              <input type="number" min={1} max={365} value={policy.archiveWindowDays} onChange={(e) => setPolicy((p) => ({ ...p, archiveWindowDays: Number(e.target.value || 1) }))} className="mt-1 w-full rounded border px-2 py-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
            </label>
            <label style={{ color: 'var(--color-text)' }}>
              Export Max Records
              <input type="number" min={100} max={100000} value={policy.exportMaxRecords} onChange={(e) => setPolicy((p) => ({ ...p, exportMaxRecords: Number(e.target.value || 100) }))} className="mt-1 w-full rounded border px-2 py-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={savePolicy} disabled={busy} className="rounded px-3 py-2 text-sm text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Save Policy</button>
            <button onClick={runArchiveWindow} disabled={busy} className="rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Run Archive Window</button>
            <button onClick={runRetentionCleanup} disabled={busy} className="rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Run Retention Cleanup</button>
          </div>
        </Panel>

        <Panel title="Alert Thresholds">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label style={{ color: 'var(--color-text)' }}>
              Warn / Hour
              <input type="number" min={1} value={policy.alertThresholds.warnPerHour} onChange={(e) => setPolicy((p) => ({ ...p, alertThresholds: { ...p.alertThresholds, warnPerHour: Number(e.target.value || 1) } }))} className="mt-1 w-full rounded border px-2 py-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
            </label>
            <label style={{ color: 'var(--color-text)' }}>
              Error / Hour
              <input type="number" min={1} value={policy.alertThresholds.errorPerHour} onChange={(e) => setPolicy((p) => ({ ...p, alertThresholds: { ...p.alertThresholds, errorPerHour: Number(e.target.value || 1) } }))} className="mt-1 w-full rounded border px-2 py-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
            </label>
            <label style={{ color: 'var(--color-text)' }}>
              Critical / Hour
              <input type="number" min={1} value={policy.alertThresholds.criticalPerHour} onChange={(e) => setPolicy((p) => ({ ...p, alertThresholds: { ...p.alertThresholds, criticalPerHour: Number(e.target.value || 1) } }))} className="mt-1 w-full rounded border px-2 py-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
            </label>
            <label style={{ color: 'var(--color-text)' }}>
              Memory RSS (MB)
              <input type="number" min={128} value={policy.alertThresholds.memoryRssMb} onChange={(e) => setPolicy((p) => ({ ...p, alertThresholds: { ...p.alertThresholds, memoryRssMb: Number(e.target.value || 128) } }))} className="mt-1 w-full rounded border px-2 py-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
            </label>
          </div>
          <div className="mt-3 text-sm" style={{ color: 'var(--color-text)' }}>
            <p>Status: <strong style={{ color: alertStatus?.healthy ? '#22c55e' : '#ef4444' }}>{alertStatus?.healthy ? 'Healthy' : 'Threshold Breach'}</strong></p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Current hour: warn {alertStatus?.metrics.warnPerHour ?? 0}, error {alertStatus?.metrics.errorPerHour ?? 0}, critical {alertStatus?.metrics.criticalPerHour ?? 0}, rss {alertStatus?.metrics.memoryRssMb ?? 0} MB
            </p>
            {alertStatus?.breaches?.length ? (
              <p className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>Breaches: {alertStatus.breaches.join(', ')}</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Records and Export">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex rounded-md border p-1" style={{ borderColor: 'var(--color-border)' }}>
            <button className="rounded px-3 py-1 text-sm" style={{ backgroundColor: mode === 'LIVE' ? 'var(--color-primary)' : 'transparent', color: mode === 'LIVE' ? '#fff' : 'var(--color-text)' }} onClick={() => setMode('LIVE')}>Live</button>
            <button className="rounded px-3 py-1 text-sm" style={{ backgroundColor: mode === 'SAVED' ? 'var(--color-primary)' : 'transparent', color: mode === 'SAVED' ? '#fff' : 'var(--color-text)' }} onClick={() => setMode('SAVED')}>Saved</button>
          </div>
          <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="rounded border px-2 py-1 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <option value="ALL">All categories</option>
            <option value="LOG">LOG</option>
            <option value="EVENT">EVENT</option>
            <option value="ERROR">ERROR</option>
          </select>
          <select value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))} className="rounded border px-2 py-1 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <option value="ALL">All levels</option>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
            <option value="critical">critical</option>
          </select>
          <input placeholder="Source" value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))} className="rounded border px-2 py-1 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
          <input placeholder="Search message/action" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} className="rounded border px-2 py-1 text-sm min-w-[200px]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input type="datetime-local" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="rounded border px-2 py-1 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
          <input type="datetime-local" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="rounded border px-2 py-1 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
          <button onClick={() => setQuickWindow(1)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>24h</button>
          <button onClick={() => setQuickWindow(7)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>7d</button>
          <button onClick={() => setQuickWindow(30)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>30d</button>
          <label className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text)' }}>
            <input type="checkbox" checked={filters.includeArchived} onChange={(e) => setFilters((f) => ({ ...f, includeArchived: e.target.checked }))} />
            Include archived
          </label>
          {mode === 'SAVED' && <button onClick={loadSavedRecords} className="rounded border px-3 py-1 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Apply filters</button>}
          <button onClick={() => downloadExport('json')} disabled={busy} className="rounded border px-3 py-1 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Export JSON</button>
          <button onClick={() => downloadExport('csv')} disabled={busy} className="rounded border px-3 py-1 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Export CSV</button>
        </div>

        <div className="max-h-[36rem] overflow-auto rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
          {records.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {mode === 'LIVE' ? 'Waiting for live records...' : 'No saved records found.'}
            </div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="border-b p-3 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border px-2 py-0.5 text-[11px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>{record.category}</span>
                  <span className="rounded px-2 py-0.5 text-[11px]" style={{ backgroundColor: ['error', 'critical'].includes(record.level) ? 'rgba(239,68,68,0.15)' : record.level === 'warn' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)', color: ['error', 'critical'].includes(record.level) ? '#ef4444' : record.level === 'warn' ? '#f59e0b' : '#22c55e' }}>{record.level}</span>
                  {record.isArchived ? <span className="rounded border px-2 py-0.5 text-[11px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>ARCHIVED</span> : null}
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{new Date(record.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 font-medium" style={{ color: 'var(--color-text)' }}>{record.message}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {record.source}
                  {record.action ? ` · ${record.action}` : ''}
                  {record.entityType ? ` · ${record.entityType}` : ''}
                  {record.entityId ? ` (${record.entityId})` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  )
}


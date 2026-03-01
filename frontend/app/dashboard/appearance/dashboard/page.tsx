'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { api } from '@/lib/api'
import { Palette, Save } from 'lucide-react'

type DashboardTheme = {
  fontFamily: string
  baseFontSize: number
  headingFontSize: number
  textColor: string
  backgroundColor: string
  surfaceColor: string
  cardBackground: string
  cardBorder: string
  sidebarColor: string
  sidebarTextColor: string
  primaryColor: string
  accentColor: string
  modalBackground: string
  modalTextColor: string
  toastBackground: string
  toastTextColor: string
  cardRadius: number
  buttonRadius: number
  updatedAt?: string | null
}

const defaultTheme: DashboardTheme = {
  fontFamily: 'Inter, system-ui, sans-serif',
  baseFontSize: 14,
  headingFontSize: 18,
  textColor: '',
  backgroundColor: '',
  surfaceColor: '',
  cardBackground: '',
  cardBorder: '',
  sidebarColor: '',
  sidebarTextColor: '',
  primaryColor: '',
  accentColor: '',
  modalBackground: '',
  modalTextColor: '',
  toastBackground: '',
  toastTextColor: '',
  cardRadius: 12,
  buttonRadius: 10,
  updatedAt: null
}

export default function DashboardAppearancePage() {
  const [theme, setTheme] = useState<DashboardTheme>(defaultTheme)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const response = await api.getDashboardTheme()
        const settings = response?.settings || response?.data || {}
        if (!mounted) return
        setTheme({ ...defaultTheme, ...settings })
      } catch (error: any) {
        if (mounted) {
          setStatus({ type: 'error', message: error?.message || 'Failed to load dashboard theme.' })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const updateField = (key: keyof DashboardTheme, value: any) => {
    setTheme((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement.style
    const applyVar = (name: string, value?: string | null) => {
      const resolved = String(value || '').trim()
      if (resolved) {
        root.setProperty(name, resolved)
      } else {
        root.removeProperty(name)
      }
    }
    applyVar('--color-background', theme.backgroundColor)
    applyVar('--color-surface', theme.surfaceColor)
    applyVar('--color-card', theme.cardBackground)
    applyVar('--color-card-border', theme.cardBorder)
    applyVar('--color-sidebar', theme.sidebarColor)
    applyVar('--color-sidebar-text', theme.sidebarTextColor)
    applyVar('--color-text', theme.textColor)
    applyVar('--color-primary', theme.primaryColor)
    applyVar('--color-accent', theme.accentColor)
    applyVar('--color-modal', theme.modalBackground)
    applyVar('--color-modal-text', theme.modalTextColor)
    applyVar('--color-toast', theme.toastBackground)
    applyVar('--color-toast-text', theme.toastTextColor)
    applyVar('--font-family-base', theme.fontFamily)
    if (theme.baseFontSize) {
      root.setProperty('--font-size-base', `${theme.baseFontSize}px`)
    }
    if (theme.headingFontSize) {
      root.setProperty('--font-size-3xl', `${theme.headingFontSize}px`)
    }
  }, [theme])

  const previewStyles = useMemo(() => ({
    '--preview-font-family': theme.fontFamily,
    '--preview-base-font': `${theme.baseFontSize}px`,
    '--preview-heading-font': `${theme.headingFontSize}px`,
    '--preview-text': theme.textColor || 'var(--color-text)',
    '--preview-bg': theme.backgroundColor || 'var(--color-background)',
    '--preview-surface': theme.surfaceColor || 'var(--color-surface)',
    '--preview-card': theme.cardBackground || 'var(--color-surface)',
    '--preview-card-border': theme.cardBorder || 'var(--color-border)',
    '--preview-sidebar': theme.sidebarColor || 'var(--color-sidebar)',
    '--preview-sidebar-text': theme.sidebarTextColor || 'var(--color-text)',
    '--preview-primary': theme.primaryColor || 'var(--color-primary)',
    '--preview-accent': theme.accentColor || 'var(--color-accent)',
    '--preview-modal': theme.modalBackground || 'var(--color-surface)',
    '--preview-modal-text': theme.modalTextColor || 'var(--color-text)',
    '--preview-toast': theme.toastBackground || 'var(--color-surface)',
    '--preview-toast-text': theme.toastTextColor || 'var(--color-text)',
    '--preview-card-radius': `${theme.cardRadius}px`,
    '--preview-button-radius': `${theme.buttonRadius}px`
  }) as CSSProperties, [theme])

  const saveTheme = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const payload = { ...theme, updatedAt: new Date().toISOString() }
      const response = await api.updateDashboardTheme(payload)
      const saved = response?.settings || response?.data || payload
      setTheme({ ...defaultTheme, ...saved })
      if (typeof document !== 'undefined') {
        const root = document.documentElement.style
        if (saved.backgroundColor) root.setProperty('--color-background', saved.backgroundColor)
        if (saved.surfaceColor) root.setProperty('--color-surface', saved.surfaceColor)
        if (saved.cardBackground) root.setProperty('--color-card', saved.cardBackground)
        if (saved.cardBorder) root.setProperty('--color-card-border', saved.cardBorder)
        if (saved.sidebarColor) root.setProperty('--color-sidebar', saved.sidebarColor)
        if (saved.sidebarTextColor) root.setProperty('--color-sidebar-text', saved.sidebarTextColor)
        if (saved.textColor) root.setProperty('--color-text', saved.textColor)
        if (saved.primaryColor) root.setProperty('--color-primary', saved.primaryColor)
        if (saved.accentColor) root.setProperty('--color-accent', saved.accentColor)
        if (saved.modalBackground) root.setProperty('--color-modal', saved.modalBackground)
        if (saved.modalTextColor) root.setProperty('--color-modal-text', saved.modalTextColor)
        if (saved.toastBackground) root.setProperty('--color-toast', saved.toastBackground)
        if (saved.toastTextColor) root.setProperty('--color-toast-text', saved.toastTextColor)
      }
      setStatus({ type: 'success', message: 'Dashboard theme updated.' })
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.message || 'Failed to update dashboard theme.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading dashboard theme...</div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] h-[calc(100vh-4rem)]">
      <aside className="border-r p-6 overflow-y-auto" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
            <Palette className="h-4 w-4" style={{ color: 'rgb(16, 185, 129)' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Dashboard Styling</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Colors, fonts, and sizes.</p>
          </div>
        </div>

        {status && (
          <div
            className="mt-4 rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: status.type === 'error' ? '#FCA5A5' : 'var(--color-border)',
              backgroundColor: status.type === 'error' ? 'rgba(248, 113, 113, 0.12)' : 'var(--color-background)',
              color: status.type === 'error' ? '#991B1B' : 'var(--color-text)'
            }}
          >
            {status.message}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Font Family
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
              value={theme.fontFamily}
              onChange={(event) => updateField('fontFamily', event.target.value)}
            />
          </label>

          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Base Font Size
              <input
                type="number"
                min={12}
                max={20}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                value={theme.baseFontSize}
                onChange={(event) => updateField('baseFontSize', Number(event.target.value))}
              />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Heading Size
              <input
                type="number"
                min={16}
                max={28}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                value={theme.headingFontSize}
                onChange={(event) => updateField('headingFontSize', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Primary Color
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.primaryColor || '#2563eb'} onChange={(event) => updateField('primaryColor', event.target.value)} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Accent Color
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.accentColor || '#0ea5e9'} onChange={(event) => updateField('accentColor', event.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Background
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.backgroundColor || '#f8fafc'} onChange={(event) => updateField('backgroundColor', event.target.value)} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Surface
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.surfaceColor || '#ffffff'} onChange={(event) => updateField('surfaceColor', event.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Card Background
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.cardBackground || '#ffffff'} onChange={(event) => updateField('cardBackground', event.target.value)} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Card Border
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.cardBorder || '#e2e8f0'} onChange={(event) => updateField('cardBorder', event.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Sidebar Background
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.sidebarColor || '#0f172a'} onChange={(event) => updateField('sidebarColor', event.target.value)} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Sidebar Text
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.sidebarTextColor || '#f8fafc'} onChange={(event) => updateField('sidebarTextColor', event.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Modal Background
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.modalBackground || '#ffffff'} onChange={(event) => updateField('modalBackground', event.target.value)} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Modal Text
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.modalTextColor || '#0f172a'} onChange={(event) => updateField('modalTextColor', event.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Toast Background
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.toastBackground || '#111827'} onChange={(event) => updateField('toastBackground', event.target.value)} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Toast Text
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.toastTextColor || '#f9fafb'} onChange={(event) => updateField('toastTextColor', event.target.value)} />
            </label>
          </div>

          <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Body Text Color
            <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={theme.textColor || '#0f172a'} onChange={(event) => updateField('textColor', event.target.value)} />
          </label>

          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Card Radius
              <input type="number" min={0} max={24} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }} value={theme.cardRadius} onChange={(event) => updateField('cardRadius', Number(event.target.value))} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Button Radius
              <input type="number" min={0} max={24} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }} value={theme.buttonRadius} onChange={(event) => updateField('buttonRadius', Number(event.target.value))} />
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={saveTheme}
          disabled={saving}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Dashboard'}
        </button>
      </aside>

      <main className="p-6 overflow-y-auto" style={previewStyles}>
        <div
          className="grid gap-6 lg:grid-cols-[220px_1fr] h-full rounded-2xl border"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--preview-bg)',
            fontFamily: 'var(--preview-font-family)',
            fontSize: 'var(--preview-base-font)',
            color: 'var(--preview-text)'
          }}
        >
          <div className="p-4 rounded-xl m-4" style={{ backgroundColor: 'var(--preview-sidebar)', color: 'var(--preview-sidebar-text)' }}>
            <div className="text-sm font-semibold mb-4">Sidebar</div>
            <div className="space-y-2 text-xs">
              {['Dashboard', 'Courses', 'Students', 'Settings'].map((item) => (
                <div key={item} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h2 style={{ fontSize: 'var(--preview-heading-font)', fontWeight: 600 }}>Dashboard Preview</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                See your colors and typography updates in context.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {['Active Students', 'Live Classes', 'Revenue'].map((card) => (
                <div
                  key={card}
                  className="p-4 border"
                  style={{
                    borderColor: 'var(--preview-card-border)',
                    backgroundColor: 'var(--preview-card)',
                    borderRadius: 'var(--preview-card-radius)'
                  }}
                >
                  <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{card}</div>
                  <div className="text-xl font-semibold" style={{ color: 'var(--preview-primary)' }}>128</div>
                </div>
              ))}
            </div>
            <button
              className="px-4 py-2 text-sm font-semibold text-white"
              style={{
                backgroundColor: 'var(--preview-primary)',
                borderRadius: 'var(--preview-button-radius)'
              }}
            >
              Primary Action
            </button>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--preview-card-border)', backgroundColor: 'var(--preview-card)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--preview-text)' }}>Modal Preview</div>
                <div className="mt-3 rounded-lg p-4" style={{ backgroundColor: 'var(--preview-modal)', color: 'var(--preview-modal-text)' }}>
                  <div className="font-semibold">Update Successful</div>
                  <p className="text-xs opacity-80 mt-1">Your changes were saved.</p>
                </div>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--preview-card-border)', backgroundColor: 'var(--preview-card)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--preview-text)' }}>Toast Preview</div>
                <div className="mt-3 rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--preview-toast)', color: 'var(--preview-toast-text)' }}>
                  Toast notification example
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

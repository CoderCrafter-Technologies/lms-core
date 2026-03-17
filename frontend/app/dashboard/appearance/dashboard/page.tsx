'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { api } from '@/lib/api'
import { Palette, Save } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { useSetup } from '@/components/providers/SetupProvider'
import logo from '@/assets/logo_blue.png'

type DashboardTheme = {
  fontFamily: string
  baseFontSize: number
  headingFontSize: number
  textColor: string
  secondaryTextColor: string
  backgroundColor: string
  surfaceColor: string
  surfaceHoverColor: string
  borderColor: string
  cardBackground: string
  cardBorder: string
  sidebarColor: string
  sidebarTextColor: string
  sidebarBorderColor: string
  sidebarHoverColor: string
  sidebarActiveColor: string
  sidebarActiveBackground: string
  primaryColor: string
  primaryHoverColor: string
  primaryLightColor: string
  accentColor: string
  buttonTextColor: string
  secondaryColor: string
  secondaryHoverColor: string
  secondaryActiveColor: string
  borderHoverColor: string
  textTertiaryColor: string
  textMutedColor: string
  focusRingColor: string
  successColor: string
  successLightColor: string
  warningColor: string
  warningLightColor: string
  errorColor: string
  errorLightColor: string
  infoColor: string
  infoLightColor: string
  badgeBlueBg: string
  badgeBlueText: string
  badgeGreenBg: string
  badgeGreenText: string
  badgePurpleBg: string
  badgePurpleText: string
  badgeYellowBg: string
  badgeYellowText: string
  badgeRedBg: string
  badgeRedText: string
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
  secondaryTextColor: '',
  backgroundColor: '',
  surfaceColor: '',
  surfaceHoverColor: '',
  borderColor: '',
  cardBackground: '',
  cardBorder: '',
  sidebarColor: '',
  sidebarTextColor: '',
  sidebarBorderColor: '',
  sidebarHoverColor: '',
  sidebarActiveColor: '',
  sidebarActiveBackground: '',
  primaryColor: '',
  primaryHoverColor: '',
  primaryLightColor: '',
  accentColor: '',
  buttonTextColor: '',
  secondaryColor: '',
  secondaryHoverColor: '',
  secondaryActiveColor: '',
  borderHoverColor: '',
  textTertiaryColor: '',
  textMutedColor: '',
  focusRingColor: '',
  successColor: '',
  successLightColor: '',
  warningColor: '',
  warningLightColor: '',
  errorColor: '',
  errorLightColor: '',
  infoColor: '',
  infoLightColor: '',
  badgeBlueBg: '',
  badgeBlueText: '',
  badgeGreenBg: '',
  badgeGreenText: '',
  badgePurpleBg: '',
  badgePurpleText: '',
  badgeYellowBg: '',
  badgeYellowText: '',
  badgeRedBg: '',
  badgeRedText: '',
  modalBackground: '',
  modalTextColor: '',
  toastBackground: '',
  toastTextColor: '',
  cardRadius: 12,
  buttonRadius: 10,
  updatedAt: null
}

type ThemeField = keyof DashboardTheme

const colorFieldFallbacks: Partial<Record<ThemeField, string>> = {
  primaryColor: '#2563EB',
  primaryHoverColor: '#1D4ED8',
  primaryLightColor: 'rgba(37, 99, 235, 0.16)',
  accentColor: '#0EA5E9',
  buttonTextColor: '#FFFFFF',
  secondaryColor: 'rgba(15, 23, 42, 0.05)',
  secondaryHoverColor: 'rgba(15, 23, 42, 0.08)',
  secondaryActiveColor: 'rgba(15, 23, 42, 0.12)',
  borderHoverColor: '#CBD5E1',
  textTertiaryColor: '#64748B',
  textMutedColor: '#94A3B8',
  focusRingColor: 'rgba(37, 99, 235, 0.4)',
  successColor: '#16A34A',
  successLightColor: 'rgba(22, 163, 74, 0.15)',
  warningColor: '#D97706',
  warningLightColor: 'rgba(217, 119, 6, 0.15)',
  errorColor: '#DC2626',
  errorLightColor: 'rgba(220, 38, 38, 0.15)',
  infoColor: '#475569',
  infoLightColor: 'rgba(71, 85, 105, 0.15)',
  badgeBlueBg: 'rgba(37, 99, 235, 0.12)',
  badgeBlueText: '#1E40AF',
  badgeGreenBg: 'rgba(22, 163, 74, 0.12)',
  badgeGreenText: '#166534',
  badgePurpleBg: 'rgba(168, 85, 247, 0.12)',
  badgePurpleText: '#7E22CE',
  badgeYellowBg: 'rgba(217, 119, 6, 0.12)',
  badgeYellowText: '#92400E',
  badgeRedBg: 'rgba(220, 38, 38, 0.12)',
  badgeRedText: '#991B1B',
  backgroundColor: '#F8FAFC',
  surfaceColor: '#FFFFFF',
  surfaceHoverColor: '#F1F5F9',
  borderColor: '#E2E8F0',
  textColor: '#0F172A',
  secondaryTextColor: '#475569',
  cardBackground: '#FFFFFF',
  cardBorder: '#E2E8F0',
  sidebarColor: '#0F172A',
  sidebarTextColor: '#F8FAFC',
  sidebarBorderColor: '#1F2937',
  sidebarHoverColor: '#1E293B',
  sidebarActiveColor: '#60A5FA',
  sidebarActiveBackground: 'rgba(37, 99, 235, 0.18)',
  modalBackground: '#FFFFFF',
  modalTextColor: '#0F172A',
  toastBackground: '#111827',
  toastTextColor: '#F9FAFB'
}

export default function DashboardAppearancePage() {
  const [theme, setTheme] = useState<DashboardTheme>(defaultTheme)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [brandLogoFailed, setBrandLogoFailed] = useState(false)
  const { theme: activeTheme } = useTheme()
  const { branding, updateSetupSettings } = useSetup()

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

  const updateField = <T extends ThemeField>(key: T, value: DashboardTheme[T]) => {
    setTheme((prev) => ({ ...prev, [key]: value }))
  }

  const applyThemeToRoot = (nextTheme: DashboardTheme, mode: string) => {
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

    if (mode === 'system') {
      applyVar('--color-background', nextTheme.backgroundColor)
      applyVar('--color-surface', nextTheme.surfaceColor)
      applyVar('--color-surface-hover', nextTheme.surfaceHoverColor)
      applyVar('--color-border', nextTheme.borderColor)
      applyVar('--color-card', nextTheme.cardBackground)
      applyVar('--color-card-border', nextTheme.cardBorder)
      applyVar('--color-sidebar', nextTheme.sidebarColor)
      applyVar('--color-sidebar-text', nextTheme.sidebarTextColor)
      applyVar('--color-sidebar-border', nextTheme.sidebarBorderColor)
      applyVar('--color-sidebar-hover', nextTheme.sidebarHoverColor)
      applyVar('--color-sidebar-active', nextTheme.sidebarActiveColor)
      applyVar('--color-sidebar-active-bg', nextTheme.sidebarActiveBackground)
      applyVar('--color-text', nextTheme.textColor)
      applyVar('--color-text-secondary', nextTheme.secondaryTextColor)
      applyVar('--color-text-tertiary', nextTheme.textTertiaryColor)
      applyVar('--color-text-muted', nextTheme.textMutedColor)
      applyVar('--color-primary', nextTheme.primaryColor)
      applyVar('--color-primary-hover', nextTheme.primaryHoverColor)
      applyVar('--color-primary-light', nextTheme.primaryLightColor)
      applyVar('--color-accent', nextTheme.accentColor)
      applyVar('--color-btn-primary-text', nextTheme.buttonTextColor)
      applyVar('--color-secondary', nextTheme.secondaryColor)
      applyVar('--color-secondary-hover', nextTheme.secondaryHoverColor)
      applyVar('--color-secondary-active', nextTheme.secondaryActiveColor)
      applyVar('--color-border-hover', nextTheme.borderHoverColor)
      applyVar('--color-focus-ring', nextTheme.focusRingColor)
      applyVar('--color-success', nextTheme.successColor)
      applyVar('--color-success-light', nextTheme.successLightColor)
      applyVar('--color-warning', nextTheme.warningColor)
      applyVar('--color-warning-light', nextTheme.warningLightColor)
      applyVar('--color-error', nextTheme.errorColor)
      applyVar('--color-error-light', nextTheme.errorLightColor)
      applyVar('--color-info', nextTheme.infoColor)
      applyVar('--color-info-light', nextTheme.infoLightColor)
      applyVar('--color-badge-blue-bg', nextTheme.badgeBlueBg)
      applyVar('--color-badge-blue-text', nextTheme.badgeBlueText)
      applyVar('--color-badge-green-bg', nextTheme.badgeGreenBg)
      applyVar('--color-badge-green-text', nextTheme.badgeGreenText)
      applyVar('--color-badge-purple-bg', nextTheme.badgePurpleBg)
      applyVar('--color-badge-purple-text', nextTheme.badgePurpleText)
      applyVar('--color-badge-yellow-bg', nextTheme.badgeYellowBg)
      applyVar('--color-badge-yellow-text', nextTheme.badgeYellowText)
      applyVar('--color-badge-red-bg', nextTheme.badgeRedBg)
      applyVar('--color-badge-red-text', nextTheme.badgeRedText)
      applyVar('--color-modal', nextTheme.modalBackground)
      applyVar('--color-modal-text', nextTheme.modalTextColor)
      applyVar('--color-toast', nextTheme.toastBackground)
      applyVar('--color-toast-text', nextTheme.toastTextColor)
      applyVar('--font-family-base', nextTheme.fontFamily)
      if (nextTheme.baseFontSize) root.setProperty('--font-size-base', `${nextTheme.baseFontSize}px`)
      if (nextTheme.headingFontSize) root.setProperty('--font-size-3xl', `${nextTheme.headingFontSize}px`)
      return
    }

    ;[
      '--color-background',
      '--color-surface',
      '--color-surface-hover',
      '--color-border',
      '--color-card',
      '--color-card-border',
      '--color-sidebar',
      '--color-sidebar-text',
      '--color-sidebar-border',
      '--color-sidebar-hover',
      '--color-sidebar-active',
      '--color-sidebar-active-bg',
      '--color-text',
      '--color-text-secondary',
      '--color-text-tertiary',
      '--color-text-muted',
      '--color-primary',
      '--color-primary-hover',
      '--color-primary-light',
      '--color-accent',
      '--color-btn-primary-text',
      '--color-secondary',
      '--color-secondary-hover',
      '--color-secondary-active',
      '--color-border-hover',
      '--color-focus-ring',
      '--color-success',
      '--color-success-light',
      '--color-warning',
      '--color-warning-light',
      '--color-error',
      '--color-error-light',
      '--color-info',
      '--color-info-light',
      '--color-badge-blue-bg',
      '--color-badge-blue-text',
      '--color-badge-green-bg',
      '--color-badge-green-text',
      '--color-badge-purple-bg',
      '--color-badge-purple-text',
      '--color-badge-yellow-bg',
      '--color-badge-yellow-text',
      '--color-badge-red-bg',
      '--color-badge-red-text',
      '--color-modal',
      '--color-modal-text',
      '--color-toast',
      '--color-toast-text',
      '--font-family-base'
    ].forEach((token) => root.removeProperty(token))
    root.removeProperty('--font-size-base')
    root.removeProperty('--font-size-3xl')
  }

  useEffect(() => {
    applyThemeToRoot(theme, activeTheme)
  }, [theme, activeTheme])

  const previewStyles = useMemo(() => ({
    '--preview-font-family': theme.fontFamily,
    '--preview-base-font': `${theme.baseFontSize}px`,
    '--preview-heading-font': `${theme.headingFontSize}px`,
    '--preview-text': theme.textColor || 'var(--color-text)',
    '--preview-secondary': theme.secondaryTextColor || 'var(--color-text-secondary)',
    '--preview-bg': theme.backgroundColor || 'var(--color-background)',
    '--preview-surface': theme.surfaceColor || 'var(--color-surface)',
    '--preview-surface-hover': theme.surfaceHoverColor || 'var(--color-surface-hover)',
    '--preview-border': theme.borderColor || 'var(--color-border)',
    '--preview-card': theme.cardBackground || 'var(--color-surface)',
    '--preview-card-border': theme.cardBorder || 'var(--color-border)',
    '--preview-sidebar': theme.sidebarColor || 'var(--color-sidebar)',
    '--preview-sidebar-text': theme.sidebarTextColor || 'var(--color-text)',
    '--preview-sidebar-border': theme.sidebarBorderColor || 'var(--color-border)',
    '--preview-sidebar-hover': theme.sidebarHoverColor || 'var(--color-surface-hover)',
    '--preview-sidebar-active': theme.sidebarActiveColor || 'var(--color-primary)',
    '--preview-sidebar-active-bg': theme.sidebarActiveBackground || 'var(--color-primary-light)',
    '--preview-primary': theme.primaryColor || 'var(--color-primary)',
    '--preview-primary-hover': theme.primaryHoverColor || 'var(--color-primary-hover)',
    '--preview-primary-light': theme.primaryLightColor || 'var(--color-primary-light)',
    '--preview-accent': theme.accentColor || 'var(--color-accent)',
    '--preview-button-text': theme.buttonTextColor || 'var(--color-btn-primary-text)',
    '--preview-secondary-bg': theme.secondaryColor || 'var(--color-secondary)',
    '--preview-secondary-hover': theme.secondaryHoverColor || 'var(--color-secondary-hover)',
    '--preview-secondary-active': theme.secondaryActiveColor || 'var(--color-secondary-active)',
    '--preview-border-hover': theme.borderHoverColor || 'var(--color-border-hover)',
    '--preview-focus-ring': theme.focusRingColor || 'var(--color-focus-ring)',
    '--preview-text-tertiary': theme.textTertiaryColor || 'var(--color-text-tertiary)',
    '--preview-text-muted': theme.textMutedColor || 'var(--color-text-muted)',
    '--preview-modal': theme.modalBackground || 'var(--color-surface)',
    '--preview-modal-text': theme.modalTextColor || 'var(--color-text)',
    '--preview-toast': theme.toastBackground || 'var(--color-surface)',
    '--preview-toast-text': theme.toastTextColor || 'var(--color-text)',
    '--preview-card-radius': `${theme.cardRadius}px`,
    '--preview-button-radius': `${theme.buttonRadius}px`
  }) as CSSProperties, [theme])

  const saveTheme = async (payloadOverride?: DashboardTheme) => {
    setSaving(true)
    setStatus(null)
    try {
      const payload = { ...(payloadOverride || theme), updatedAt: new Date().toISOString() }
      const response = await api.updateDashboardTheme(payload)
      const saved = response?.settings || response?.data || payload
      const mergedTheme = { ...defaultTheme, ...saved }
      setTheme(mergedTheme)
      updateSetupSettings({
        dashboardTheme: mergedTheme
      })
      applyThemeToRoot(mergedTheme, activeTheme)
      setStatus({ type: 'success', message: 'Dashboard theme updated.' })
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.message || 'Failed to update dashboard theme.' })
    } finally {
      setSaving(false)
    }
  }

  const appName = branding?.appName || 'Institute LMS'
  const brandLogo = branding?.logoUrl || logo.src
  const resolvedBrandLogo = brandLogoFailed ? logo.src : brandLogo

  useEffect(() => {
    setBrandLogoFailed(false)
  }, [brandLogo])

  const ColorInput = ({ label, field }: { label: string; field: ThemeField }) => (
    <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
      {label}
      <div className="mt-1 flex gap-2">
        <input
          type="color"
          className="h-9 w-12 rounded-lg border"
          value={(() => {
            const raw = String(theme[field] || colorFieldFallbacks[field] || '#000000').trim()
            return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : '#000000'
          })()}
          onChange={(event) => updateField(field, event.target.value as DashboardTheme[typeof field])}
        />
        <input
          type="text"
          className="h-9 flex-1 rounded-lg border px-2 text-xs"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
          value={String(theme[field] || '')}
          placeholder={String(colorFieldFallbacks[field] || '#000000')}
          onChange={(event) => updateField(field, event.target.value as DashboardTheme[typeof field])}
        />
      </div>
    </label>
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading dashboard theme...</div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[390px_1fr] h-[calc(100vh-4rem)]">
      <aside className="border-r p-6 overflow-y-auto" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
            <Palette className="h-4 w-4" style={{ color: 'rgb(16, 185, 129)' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Dashboard Appearance</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Edit all major dashboard UI tokens, including hover states.</p>
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

        <div className="mt-6 space-y-5">
          <section className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Typography</h2>
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
                Base Font
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
                Heading Font
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
          </section>

          <section className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Surfaces & Text</h2>
            <div className="grid gap-3 grid-cols-2">
              <ColorInput label="Background" field="backgroundColor" />
              <ColorInput label="Surface" field="surfaceColor" />
              <ColorInput label="Surface Hover" field="surfaceHoverColor" />
              <ColorInput label="Border" field="borderColor" />
              <ColorInput label="Primary Text" field="textColor" />
              <ColorInput label="Secondary Text" field="secondaryTextColor" />
            </div>
          </section>

          <section className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Sidebar States</h2>
            <div className="grid gap-3 grid-cols-2">
              <ColorInput label="Sidebar BG" field="sidebarColor" />
              <ColorInput label="Sidebar Text" field="sidebarTextColor" />
              <ColorInput label="Sidebar Border" field="sidebarBorderColor" />
              <ColorInput label="Sidebar Hover" field="sidebarHoverColor" />
              <ColorInput label="Active Text" field="sidebarActiveColor" />
              <ColorInput label="Active BG" field="sidebarActiveBackground" />
            </div>
          </section>

          <section className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Cards & Buttons</h2>
            <div className="grid gap-3 grid-cols-2">
              <ColorInput label="Card BG" field="cardBackground" />
              <ColorInput label="Card Border" field="cardBorder" />
              <ColorInput label="Primary" field="primaryColor" />
              <ColorInput label="Primary Hover" field="primaryHoverColor" />
              <ColorInput label="Primary Soft" field="primaryLightColor" />
              <ColorInput label="Accent" field="accentColor" />
              <ColorInput label="Button Text" field="buttonTextColor" />
              <ColorInput label="Secondary BG" field="secondaryColor" />
              <ColorInput label="Secondary Hover" field="secondaryHoverColor" />
              <ColorInput label="Secondary Active" field="secondaryActiveColor" />
              <ColorInput label="Border Hover" field="borderHoverColor" />
              <ColorInput label="Focus Ring" field="focusRingColor" />
            </div>
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
          </section>

          <section className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Status & Badges</h2>
            <div className="grid gap-3 grid-cols-2">
              <ColorInput label="Success" field="successColor" />
              <ColorInput label="Success Light" field="successLightColor" />
              <ColorInput label="Warning" field="warningColor" />
              <ColorInput label="Warning Light" field="warningLightColor" />
              <ColorInput label="Error" field="errorColor" />
              <ColorInput label="Error Light" field="errorLightColor" />
              <ColorInput label="Info" field="infoColor" />
              <ColorInput label="Info Light" field="infoLightColor" />
              <ColorInput label="Text Tertiary" field="textTertiaryColor" />
              <ColorInput label="Text Muted" field="textMutedColor" />
              <ColorInput label="Badge Blue BG" field="badgeBlueBg" />
              <ColorInput label="Badge Blue Text" field="badgeBlueText" />
              <ColorInput label="Badge Green BG" field="badgeGreenBg" />
              <ColorInput label="Badge Green Text" field="badgeGreenText" />
              <ColorInput label="Badge Purple BG" field="badgePurpleBg" />
              <ColorInput label="Badge Purple Text" field="badgePurpleText" />
              <ColorInput label="Badge Yellow BG" field="badgeYellowBg" />
              <ColorInput label="Badge Yellow Text" field="badgeYellowText" />
              <ColorInput label="Badge Red BG" field="badgeRedBg" />
              <ColorInput label="Badge Red Text" field="badgeRedText" />
            </div>
          </section>

          <section className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Overlays</h2>
            <div className="grid gap-3 grid-cols-2">
              <ColorInput label="Modal BG" field="modalBackground" />
              <ColorInput label="Modal Text" field="modalTextColor" />
              <ColorInput label="Toast BG" field="toastBackground" />
              <ColorInput label="Toast Text" field="toastTextColor" />
            </div>
          </section>
        </div>

        <button
          type="button"
          onClick={() => void saveTheme()}
          disabled={saving}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-70"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-btn-primary-text, #fff)' }}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Dashboard'}
        </button>

        <button
          type="button"
          onClick={() => {
            setTheme(defaultTheme)
            void saveTheme(defaultTheme)
          }}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        >
          Reset to Default
        </button>
      </aside>

      <main className="p-6 overflow-y-auto" style={previewStyles}>
        <div
          className="grid gap-6 lg:grid-cols-[240px_1fr] h-full rounded-2xl border"
          style={{
            borderColor: 'var(--preview-border)',
            backgroundColor: 'var(--preview-bg)',
            fontFamily: 'var(--preview-font-family)',
            fontSize: 'var(--preview-base-font)',
            color: 'var(--preview-text)'
          }}
        >
          <div className="p-4 rounded-xl m-4 border" style={{ backgroundColor: 'var(--preview-sidebar)', color: 'var(--preview-sidebar-text)', borderColor: 'var(--preview-sidebar-border)' }}>
            <div className="mb-4 flex items-center gap-2 min-w-0">
              {resolvedBrandLogo && (
                <img
                  src={resolvedBrandLogo}
                  alt={`${appName} Logo`}
                  className="h-7 w-auto max-w-[6rem] object-contain shrink-0"
                  onError={() => setBrandLogoFailed(true)}
                />
              )}
              <div className="text-sm font-semibold truncate">{appName}</div>
            </div>
            <div className="space-y-2 text-xs">
              {['Dashboard', 'Courses', 'Students', 'Settings'].map((item, index) => (
                <div
                  key={item}
                  className="rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: index === 0 ? 'var(--preview-sidebar-active-bg)' : 'var(--preview-sidebar-hover)',
                    color: index === 0 ? 'var(--preview-sidebar-active)' : 'var(--preview-sidebar-text)'
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h2 style={{ fontSize: 'var(--preview-heading-font)', fontWeight: 600 }}>Dashboard Preview</h2>
              <p className="text-sm" style={{ color: 'var(--preview-secondary)' }}>
                Hover states and structural colors in one place.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {['Active Students', 'Live Classes', 'Revenue'].map((card) => (
                <div
                  key={card}
                  className="p-4 border transition-colors"
                  style={{
                    borderColor: 'var(--preview-card-border)',
                    backgroundColor: 'var(--preview-card)',
                    borderRadius: 'var(--preview-card-radius)'
                  }}
                >
                  <div className="text-xs" style={{ color: 'var(--preview-secondary)' }}>{card}</div>
                  <div className="text-xl font-semibold" style={{ color: 'var(--preview-primary)' }}>128</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: 'var(--preview-primary)',
                  color: 'var(--preview-button-text)',
                  borderRadius: 'var(--preview-button-radius)'
                }}
              >
                Primary Action
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: 'var(--preview-primary-hover)',
                  color: 'var(--preview-button-text)',
                  borderRadius: 'var(--preview-button-radius)'
                }}
              >
                Hover State
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: 'var(--preview-primary-light)',
                  color: 'var(--preview-primary)',
                  borderRadius: 'var(--preview-button-radius)'
                }}
              >
                Primary Light
              </button>
              <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: 'var(--preview-accent)', color: '#fff' }}>
                Accent Token
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium rounded-lg border" style={{ backgroundColor: 'var(--preview-secondary-bg)', borderColor: 'var(--preview-border)' }}>
                Secondary
              </button>
              <button className="px-4 py-2 text-sm font-medium rounded-lg border" style={{ backgroundColor: 'var(--preview-secondary-hover)', borderColor: 'var(--preview-border-hover)' }}>
                Secondary Hover
              </button>
              <button className="px-4 py-2 text-sm font-medium rounded-lg border" style={{ backgroundColor: 'var(--preview-secondary-active)', borderColor: 'var(--preview-border-hover)' }}>
                Secondary Active
              </button>
            </div>

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

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>Success</div>
              <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>Warning</div>
              <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)' }}>Error</div>
              <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)' }}>Info</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--color-badge-blue-bg)', color: 'var(--color-badge-blue-text)' }}>Blue</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--color-badge-green-bg)', color: 'var(--color-badge-green-text)' }}>Green</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--color-badge-purple-bg)', color: 'var(--color-badge-purple-text)' }}>Purple</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--color-badge-yellow-bg)', color: 'var(--color-badge-yellow-text)' }}>Yellow</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--color-badge-red-bg)', color: 'var(--color-badge-red-text)' }}>Red</span>
            </div>

            <div className="rounded-xl border p-3 text-xs space-y-2" style={{ borderColor: 'var(--preview-border)', backgroundColor: 'var(--preview-surface-hover)', color: 'var(--preview-secondary)' }}>
              <div>Surface hover preview block.</div>
              <div className="text-xs" style={{ color: 'var(--preview-text-tertiary)' }}>Tertiary text preview</div>
              <div className="text-xs" style={{ color: 'var(--preview-text-muted)' }}>Muted text preview</div>
              <input
                className="w-full rounded-lg border px-2 py-1 text-xs"
                style={{
                  borderColor: 'var(--preview-border-hover)',
                  boxShadow: '0 0 0 3px var(--preview-focus-ring)',
                  backgroundColor: 'var(--preview-surface)',
                  color: 'var(--preview-text)'
                }}
                value="Focus ring + border hover preview"
                readOnly
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { useTheme } from '@/components/providers/ThemeProvider'

type BrandingConfig = {
  appName: string
  logoUrl: string
  faviconUrl: string
  primaryColor: string
  accentColor: string
  whiteLabelEnabled: boolean
  showCoderCrafterWatermark?: boolean
}

type SetupContextType = {
  completed: boolean
  loading: boolean
  settings: any | null
  branding: BrandingConfig
  updateBranding: (next: Partial<BrandingConfig>) => void
}

const SetupContext = createContext<SetupContextType | undefined>(undefined)

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(true)
  const [settings, setSettings] = useState<any | null>(null)
  const { theme } = useTheme()
  const apiOrigin = useMemo(
    () => (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, ''),
    []
  )

  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      try {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('lms-public-settings')
          if (cached && !settings) {
            try {
              setSettings(JSON.parse(cached))
            } catch {
              // ignore cache parse errors
            }
          }
        }
        const [statusRes, settingsRes] = await Promise.all([
          api.getSetupStatus(),
          api.getPublicSetupSettings()
        ])
        if (!mounted) return

        const isCompleted = Boolean(statusRes?.data?.completed)
        setCompleted(isCompleted)
        const nextSettings = settingsRes?.data || null
        setSettings(nextSettings)
        if (typeof window !== 'undefined' && nextSettings) {
          localStorage.setItem('lms-public-settings', JSON.stringify(nextSettings))
        }

        const branding = settingsRes?.data?.branding || {}
        const dashboardTheme = settingsRes?.data?.dashboardTheme || {}
        if (typeof document !== 'undefined') {
          const root = document.documentElement.style
          const applyVar = (name: string, value?: string | null) => {
            const resolved = String(value || '').trim()
            if (resolved) {
              root.setProperty(name, resolved)
            } else {
              root.removeProperty(name)
            }
          }

          if (theme === 'system') {
            if (branding?.primaryColor) {
              root.setProperty('--color-primary', branding.primaryColor)
            }
            if (branding?.accentColor) {
              root.setProperty('--color-accent', branding.accentColor)
            }
            applyVar('--color-background', dashboardTheme?.backgroundColor)
            applyVar('--color-surface', dashboardTheme?.surfaceColor)
            applyVar('--color-card', dashboardTheme?.cardBackground)
            applyVar('--color-card-border', dashboardTheme?.cardBorder)
            applyVar('--color-sidebar', dashboardTheme?.sidebarColor)
            applyVar('--color-sidebar-text', dashboardTheme?.sidebarTextColor)
            applyVar('--color-sidebar-active', dashboardTheme?.sidebarActiveColor)
            applyVar('--color-text', dashboardTheme?.textColor)
            applyVar('--color-primary', dashboardTheme?.primaryColor || branding?.primaryColor)
            applyVar('--color-accent', dashboardTheme?.accentColor || branding?.accentColor)
            applyVar('--color-modal', dashboardTheme?.modalBackground)
            applyVar('--color-modal-text', dashboardTheme?.modalTextColor)
            applyVar('--color-toast', dashboardTheme?.toastBackground)
            applyVar('--color-toast-text', dashboardTheme?.toastTextColor)
          } else {
            // Clear all dashboard/theme overrides for light/dark modes
            applyVar('--color-background', null)
            applyVar('--color-surface', null)
            applyVar('--color-card', null)
            applyVar('--color-card-border', null)
            applyVar('--color-sidebar', null)
            applyVar('--color-sidebar-text', null)
            applyVar('--color-sidebar-active', null)
            applyVar('--color-text', null)
            applyVar('--color-primary', null)
            applyVar('--color-accent', null)
            applyVar('--color-modal', null)
            applyVar('--color-modal-text', null)
            applyVar('--color-toast', null)
            applyVar('--color-toast-text', null)
          }
        }

        if (!isCompleted && pathname !== '/setup') {
          router.replace('/setup')
        } else if (isCompleted && pathname === '/setup') {
          router.replace('/auth/login')
        }
      } catch {
        if (!mounted) return
        // Fail-open: do not force users into setup wizard on transient API errors.
        // Keep previous setup state so authenticated app remains reachable.
      } finally {
        if (mounted) setLoading(false)
      }
    }

    bootstrap()
    return () => {
      mounted = false
    }
  }, [pathname, router])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const branding = settings?.branding || {}
    const dashboardTheme = settings?.dashboardTheme || {}
    const root = document.documentElement.style
    const applyVar = (name: string, value?: string | null) => {
      const resolved = String(value || '').trim()
      if (resolved) {
        root.setProperty(name, resolved)
      } else {
        root.removeProperty(name)
      }
    }

    if (theme === 'system') {
      if (branding?.primaryColor) {
        root.setProperty('--color-primary', branding.primaryColor)
      }
      if (branding?.accentColor) {
        root.setProperty('--color-accent', branding.accentColor)
      }
      applyVar('--color-background', dashboardTheme?.backgroundColor)
      applyVar('--color-surface', dashboardTheme?.surfaceColor)
      applyVar('--color-card', dashboardTheme?.cardBackground)
      applyVar('--color-card-border', dashboardTheme?.cardBorder)
      applyVar('--color-sidebar', dashboardTheme?.sidebarColor)
      applyVar('--color-sidebar-text', dashboardTheme?.sidebarTextColor)
      applyVar('--color-sidebar-active', dashboardTheme?.sidebarActiveColor)
      applyVar('--color-text', dashboardTheme?.textColor)
      applyVar('--color-primary', dashboardTheme?.primaryColor || branding?.primaryColor)
      applyVar('--color-accent', dashboardTheme?.accentColor || branding?.accentColor)
      applyVar('--color-modal', dashboardTheme?.modalBackground)
      applyVar('--color-modal-text', dashboardTheme?.modalTextColor)
      applyVar('--color-toast', dashboardTheme?.toastBackground)
      applyVar('--color-toast-text', dashboardTheme?.toastTextColor)
    } else {
      applyVar('--color-background', null)
      applyVar('--color-surface', null)
      applyVar('--color-card', null)
      applyVar('--color-card-border', null)
      applyVar('--color-sidebar', null)
      applyVar('--color-sidebar-text', null)
      applyVar('--color-sidebar-active', null)
      applyVar('--color-text', null)
      applyVar('--color-primary', null)
      applyVar('--color-accent', null)
      applyVar('--color-modal', null)
      applyVar('--color-modal-text', null)
      applyVar('--color-toast', null)
      applyVar('--color-toast-text', null)
    }
  }, [theme, settings])

  const branding = useMemo<BrandingConfig>(() => {
    const raw = settings?.branding || {}
    const resolveAssetUrl = (value?: string) => {
      const str = String(value || '').trim()
      if (!str) return ''
      if (str.startsWith('/uploads/')) {
        // Keep uploads same-origin so frontend rewrite can proxy to backend.
        return str
      }
      if (
        str.startsWith('http://') ||
        str.startsWith('https://') ||
        str.startsWith('blob:') ||
        str.startsWith('data:')
      ) {
        return str
      }
      return apiOrigin ? `${apiOrigin}${str}` : str
    }

    const logoUrl = resolveAssetUrl(raw.logoUrl)
    const faviconUrl = resolveAssetUrl(raw.faviconUrl || raw.logoUrl)

    return {
      appName: String(raw.appName || 'Institute LMS').trim(),
      logoUrl,
      faviconUrl,
      primaryColor: String(raw.primaryColor || '#2563EB').trim(),
      accentColor: String(raw.accentColor || '#0EA5E9').trim(),
      whiteLabelEnabled: Boolean(raw.whiteLabelEnabled),
      showCoderCrafterWatermark: typeof raw.showCoderCrafterWatermark === 'boolean'
        ? raw.showCoderCrafterWatermark
        : undefined
    }
  }, [apiOrigin, settings])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (branding.appName) {
      document.title = branding.appName
    }
    if (branding.faviconUrl) {
      let iconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
      if (!iconLink) {
        iconLink = document.createElement('link')
        iconLink.setAttribute('rel', 'icon')
        document.head.appendChild(iconLink)
      }
      iconLink.href = branding.faviconUrl
    }
  }, [branding])

  const value = useMemo(
    () => ({
      completed,
      loading,
      settings,
      branding,
      updateBranding: (next: Partial<BrandingConfig>) => {
        setSettings((prev: any) => ({
          ...(prev || {}),
          branding: {
            ...(prev?.branding || {}),
            ...next
          }
        }))
      }
    }),
    [completed, loading, settings, branding]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>
}

export function useSetup() {
  const context = useContext(SetupContext)
  if (!context) {
    throw new Error('useSetup must be used within SetupProvider')
  }
  return context
}

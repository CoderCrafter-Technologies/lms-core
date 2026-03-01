'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'

type BrandingConfig = {
  appName: string
  logoUrl: string
  faviconUrl: string
  primaryColor: string
  accentColor: string
  whiteLabelEnabled: boolean
}

type SetupContextType = {
  completed: boolean
  loading: boolean
  settings: any | null
  branding: BrandingConfig
}

const SetupContext = createContext<SetupContextType | undefined>(undefined)

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(true)
  const [settings, setSettings] = useState<any | null>(null)
  const apiOrigin = useMemo(
    () => (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, ''),
    []
  )

  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      try {
        const [statusRes, settingsRes] = await Promise.all([
          api.getSetupStatus(),
          api.getPublicSetupSettings()
        ])
        if (!mounted) return

        const isCompleted = Boolean(statusRes?.data?.completed)
        setCompleted(isCompleted)
        setSettings(settingsRes?.data || null)

        const branding = settingsRes?.data?.branding || {}
        const dashboardTheme = settingsRes?.data?.dashboardTheme || {}
        if (typeof document !== 'undefined') {
          if (branding?.primaryColor) {
            document.documentElement.style.setProperty('--color-primary', branding.primaryColor)
          }
          if (branding?.accentColor) {
            document.documentElement.style.setProperty('--color-accent', branding.accentColor)
          }
          if (dashboardTheme?.backgroundColor) {
            document.documentElement.style.setProperty('--color-background', dashboardTheme.backgroundColor)
          }
          if (dashboardTheme?.surfaceColor) {
            document.documentElement.style.setProperty('--color-surface', dashboardTheme.surfaceColor)
          }
          if (dashboardTheme?.cardBackground) {
            document.documentElement.style.setProperty('--color-card', dashboardTheme.cardBackground)
          }
          if (dashboardTheme?.cardBorder) {
            document.documentElement.style.setProperty('--color-card-border', dashboardTheme.cardBorder)
          }
          if (dashboardTheme?.sidebarColor) {
            document.documentElement.style.setProperty('--color-sidebar', dashboardTheme.sidebarColor)
          }
          if (dashboardTheme?.sidebarTextColor) {
            document.documentElement.style.setProperty('--color-sidebar-text', dashboardTheme.sidebarTextColor)
          }
          if (dashboardTheme?.textColor) {
            document.documentElement.style.setProperty('--color-text', dashboardTheme.textColor)
          }
          if (dashboardTheme?.primaryColor) {
            document.documentElement.style.setProperty('--color-primary', dashboardTheme.primaryColor)
          }
          if (dashboardTheme?.accentColor) {
            document.documentElement.style.setProperty('--color-accent', dashboardTheme.accentColor)
          }
          if (dashboardTheme?.modalBackground) {
            document.documentElement.style.setProperty('--color-modal', dashboardTheme.modalBackground)
          }
          if (dashboardTheme?.modalTextColor) {
            document.documentElement.style.setProperty('--color-modal-text', dashboardTheme.modalTextColor)
          }
          if (dashboardTheme?.toastBackground) {
            document.documentElement.style.setProperty('--color-toast', dashboardTheme.toastBackground)
          }
          if (dashboardTheme?.toastTextColor) {
            document.documentElement.style.setProperty('--color-toast-text', dashboardTheme.toastTextColor)
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
      whiteLabelEnabled: Boolean(raw.whiteLabelEnabled)
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
    () => ({ completed, loading, settings, branding }),
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

'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  refreshSettings: () => Promise<void>
  updateSetupSettings: (next: Record<string, any>) => void
  updateBranding: (next: Partial<BrandingConfig>) => void
}

const SetupContext = createContext<SetupContextType | undefined>(undefined)
const SETTINGS_CACHE_KEY = 'lms-public-settings'

const isPlainObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const deepMerge = (target: Record<string, any>, source: Record<string, any>): Record<string, any> => {
  const output: Record<string, any> = { ...target }
  Object.keys(source || {}).forEach((key) => {
    const sourceValue = source[key]
    const targetValue = output[key]
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      output[key] = deepMerge(targetValue, sourceValue)
      return
    }
    output[key] = sourceValue
  })
  return output
}

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(true)
  const [settings, setSettings] = useState<any | null>(null)
  const { theme } = useTheme()
  const bootstrappedRef = useRef(false)
  const apiOrigin = useMemo(
    () => (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, ''),
    []
  )

  const persistSettingsCache = useCallback((nextSettings: any | null) => {
    if (typeof window === 'undefined') return
    if (!nextSettings) {
      localStorage.removeItem(SETTINGS_CACHE_KEY)
      return
    }
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(nextSettings))
  }, [])

  const applyThemeVars = useCallback((nextSettings: any | null, nextTheme: string) => {
    if (typeof document === 'undefined') return
    const branding = nextSettings?.branding || {}
    const dashboardTheme = nextSettings?.dashboardTheme || {}
    const root = document.documentElement.style
    const applyVar = (name: string, value?: string | null) => {
      const resolved = String(value || '').trim()
      if (resolved) {
        root.setProperty(name, resolved)
      } else {
        root.removeProperty(name)
      }
    }

    if (nextTheme === 'system') {
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
      return
    }

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
  }, [])

  const refreshSettings = useCallback(async () => {
    try {
      const [statusRes, settingsRes] = await Promise.all([
        api.getSetupStatus(),
        api.getPublicSetupSettings()
      ])
      const isCompleted = Boolean(statusRes?.data?.completed)
      const nextSettings = settingsRes?.data || null
      setCompleted(isCompleted)
      setSettings(nextSettings)
      persistSettingsCache(nextSettings)
    } catch {
      // Keep existing state when refresh fails.
    }
  }, [persistSettingsCache])

  useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    let mounted = true
    const bootstrap = async () => {
      try {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem(SETTINGS_CACHE_KEY)
          if (cached) {
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
        persistSettingsCache(nextSettings)
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
  }, [persistSettingsCache])

  useEffect(() => {
    applyThemeVars(settings, theme)
  }, [applyThemeVars, settings, theme])

  useEffect(() => {
    if (loading) return
    if (!completed && pathname !== '/setup') {
      router.replace('/setup')
    } else if (completed && pathname === '/setup') {
      router.replace('/auth/login')
    }
  }, [completed, loading, pathname, router])

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
      refreshSettings,
      updateSetupSettings: (next: Record<string, any>) => {
        setSettings((prev: any) => {
          const merged = deepMerge(prev || {}, next || {})
          persistSettingsCache(merged)
          return merged
        })
      },
      updateBranding: (next: Partial<BrandingConfig>) => {
        setSettings((prev: any) => {
          const merged = {
            ...(prev || {}),
            branding: {
              ...(prev?.branding || {}),
              ...next
            }
          }
          persistSettingsCache(merged)
          return merged
        })
      }
    }),
    [branding, completed, loading, persistSettingsCache, refreshSettings, settings]
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

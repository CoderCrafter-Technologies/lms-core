'use client'

import { useAuth } from '../../components/providers/AuthProvider'
import { useSetup } from '../../components/providers/SetupProvider'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import UrgentNotification from '../../components/UrgentNotification'
import { NotificationCenterInner } from '@/components/NotificationCenter'
import logo from "@/assets/logo_blue.png"
import { Activity, Bell, BriefcaseBusiness, FileMinus, GraduationCap, LayoutGrid, LogOut, Menu, MessageCircleQuestionMark, Paintbrush, ScanLine, Settings, ShieldCheck, SquareKanban, TvMinimalPlay, Users, X } from 'lucide-react'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { useTheme } from '@/components/providers/ThemeProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, logout } = useAuth()
  const { branding, settings } = useSetup()
  const { theme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [brandLogoFailed, setBrandLogoFailed] = useState(false)
  const [useFallbackLogo, setUseFallbackLogo] = useState(false)
  const appName = branding?.appName || 'Institute LMS'
  const brandLogo = branding?.logoUrl || logo.src
  const resolvedBrandLogo = useFallbackLogo ? logo.src : brandLogo
  const dashboardTheme = settings?.dashboardTheme || {}
  const dashboardStyles = theme === 'system' ? {
    ...(dashboardTheme?.fontFamily ? { fontFamily: dashboardTheme.fontFamily } : {}),
    ...(dashboardTheme?.baseFontSize ? { fontSize: `${dashboardTheme.baseFontSize}px` } : {}),
    ...(dashboardTheme?.backgroundColor ? { ['--color-background' as any]: dashboardTheme.backgroundColor } : {}),
    ...(dashboardTheme?.surfaceColor ? { ['--color-surface' as any]: dashboardTheme.surfaceColor } : {}),
    ...(dashboardTheme?.surfaceHoverColor ? { ['--color-surface-hover' as any]: dashboardTheme.surfaceHoverColor } : {}),
    ...(dashboardTheme?.borderColor ? { ['--color-border' as any]: dashboardTheme.borderColor } : {}),
    ...(dashboardTheme?.cardBackground ? { ['--color-card' as any]: dashboardTheme.cardBackground } : {}),
    ...(dashboardTheme?.cardBorder ? { ['--color-card-border' as any]: dashboardTheme.cardBorder } : {}),
    ...(dashboardTheme?.sidebarColor ? { ['--color-sidebar' as any]: dashboardTheme.sidebarColor } : {}),
    ...(dashboardTheme?.sidebarTextColor ? { ['--color-sidebar-text' as any]: dashboardTheme.sidebarTextColor } : {}),
    ...(dashboardTheme?.sidebarBorderColor ? { ['--color-sidebar-border' as any]: dashboardTheme.sidebarBorderColor } : {}),
    ...(dashboardTheme?.sidebarHoverColor ? { ['--color-sidebar-hover' as any]: dashboardTheme.sidebarHoverColor } : {}),
    ...(dashboardTheme?.sidebarActiveBackground ? { ['--color-sidebar-active-bg' as any]: dashboardTheme.sidebarActiveBackground } : {}),
    ...(dashboardTheme?.textColor ? { ['--color-text' as any]: dashboardTheme.textColor } : {}),
    ...(dashboardTheme?.secondaryTextColor ? { ['--color-text-secondary' as any]: dashboardTheme.secondaryTextColor } : {}),
    ...(dashboardTheme?.textTertiaryColor ? { ['--color-text-tertiary' as any]: dashboardTheme.textTertiaryColor } : {}),
    ...(dashboardTheme?.textMutedColor ? { ['--color-text-muted' as any]: dashboardTheme.textMutedColor } : {}),
    ...(dashboardTheme?.primaryColor ? { ['--color-primary' as any]: dashboardTheme.primaryColor } : {}),
    ...(dashboardTheme?.primaryHoverColor ? { ['--color-primary-hover' as any]: dashboardTheme.primaryHoverColor } : {}),
    ...(dashboardTheme?.primaryLightColor ? { ['--color-primary-light' as any]: dashboardTheme.primaryLightColor } : {}),
    ...(dashboardTheme?.accentColor ? { ['--color-accent' as any]: dashboardTheme.accentColor } : {}),
    ...(dashboardTheme?.buttonTextColor ? { ['--color-btn-primary-text' as any]: dashboardTheme.buttonTextColor } : {}),
    ...(dashboardTheme?.secondaryColor ? { ['--color-secondary' as any]: dashboardTheme.secondaryColor } : {}),
    ...(dashboardTheme?.secondaryHoverColor ? { ['--color-secondary-hover' as any]: dashboardTheme.secondaryHoverColor } : {}),
    ...(dashboardTheme?.secondaryActiveColor ? { ['--color-secondary-active' as any]: dashboardTheme.secondaryActiveColor } : {}),
    ...(dashboardTheme?.borderHoverColor ? { ['--color-border-hover' as any]: dashboardTheme.borderHoverColor } : {}),
    ...(dashboardTheme?.focusRingColor ? { ['--color-focus-ring' as any]: dashboardTheme.focusRingColor } : {}),
    ...(dashboardTheme?.successColor ? { ['--color-success' as any]: dashboardTheme.successColor } : {}),
    ...(dashboardTheme?.successLightColor ? { ['--color-success-light' as any]: dashboardTheme.successLightColor } : {}),
    ...(dashboardTheme?.warningColor ? { ['--color-warning' as any]: dashboardTheme.warningColor } : {}),
    ...(dashboardTheme?.warningLightColor ? { ['--color-warning-light' as any]: dashboardTheme.warningLightColor } : {}),
    ...(dashboardTheme?.errorColor ? { ['--color-error' as any]: dashboardTheme.errorColor } : {}),
    ...(dashboardTheme?.errorLightColor ? { ['--color-error-light' as any]: dashboardTheme.errorLightColor } : {}),
    ...(dashboardTheme?.infoColor ? { ['--color-info' as any]: dashboardTheme.infoColor } : {}),
    ...(dashboardTheme?.infoLightColor ? { ['--color-info-light' as any]: dashboardTheme.infoLightColor } : {}),
    ...(dashboardTheme?.badgeBlueBg ? { ['--color-badge-blue-bg' as any]: dashboardTheme.badgeBlueBg } : {}),
    ...(dashboardTheme?.badgeBlueText ? { ['--color-badge-blue-text' as any]: dashboardTheme.badgeBlueText } : {}),
    ...(dashboardTheme?.badgeGreenBg ? { ['--color-badge-green-bg' as any]: dashboardTheme.badgeGreenBg } : {}),
    ...(dashboardTheme?.badgeGreenText ? { ['--color-badge-green-text' as any]: dashboardTheme.badgeGreenText } : {}),
    ...(dashboardTheme?.badgePurpleBg ? { ['--color-badge-purple-bg' as any]: dashboardTheme.badgePurpleBg } : {}),
    ...(dashboardTheme?.badgePurpleText ? { ['--color-badge-purple-text' as any]: dashboardTheme.badgePurpleText } : {}),
    ...(dashboardTheme?.badgeYellowBg ? { ['--color-badge-yellow-bg' as any]: dashboardTheme.badgeYellowBg } : {}),
    ...(dashboardTheme?.badgeYellowText ? { ['--color-badge-yellow-text' as any]: dashboardTheme.badgeYellowText } : {}),
    ...(dashboardTheme?.badgeRedBg ? { ['--color-badge-red-bg' as any]: dashboardTheme.badgeRedBg } : {}),
    ...(dashboardTheme?.badgeRedText ? { ['--color-badge-red-text' as any]: dashboardTheme.badgeRedText } : {}),
    ...(dashboardTheme?.modalBackground ? { ['--color-modal' as any]: dashboardTheme.modalBackground } : {}),
    ...(dashboardTheme?.modalTextColor ? { ['--color-modal-text' as any]: dashboardTheme.modalTextColor } : {}),
    ...(dashboardTheme?.toastBackground ? { ['--color-toast' as any]: dashboardTheme.toastBackground } : {}),
    ...(dashboardTheme?.toastTextColor ? { ['--color-toast-text' as any]: dashboardTheme.toastTextColor } : {}),
  } : {}

  const isActiveRoute = (href: string) => {
    if (!pathname) return false
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    setUseFallbackLogo(false)
    setBrandLogoFailed(false)
  }, [brandLogo])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const canAccessNotificationConsole =
    user.role.name === 'ADMIN' ||
    (user.role.name === 'MANAGER' &&
      Array.isArray(user.managerPermissions) &&
      user.managerPermissions.includes('NOTIFICATION_MANAGEMENT_SEND'))

  const canAccessMonitoring =
    user.role.name === 'ADMIN' ||
    (user.role.name === 'MANAGER' &&
      Array.isArray(user.managerPermissions) &&
      user.managerPermissions.includes('MONITORING_READ'))

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: <LayoutGrid className="w-5 h-5" /> },
    { name: 'Courses', href: '/dashboard/courses', icon: <ScanLine className="w-5 h-5" /> },
    { name: 'Live Classes', href: '/dashboard/live-classes', icon: <TvMinimalPlay className="w-5 h-5" /> },
    ...(user.role.name === 'ADMIN' || user.role.name === 'INSTRUCTOR' || user.role.name === 'MANAGER'
      ? [{ name: 'Attendance Stats', href: '/dashboard/attendance', icon: <Activity className="w-5 h-5" /> }]
      : []
    ),
    { name: 'Assessments', href: '/dashboard/assessments', icon: <FileMinus className="w-5 h-5" /> },
    ...(user.role.name === 'ADMIN' 
      ? [{ name: 'Students', href: '/dashboard/students', icon: <GraduationCap className="w-5 h-5" /> }]
      : []
    ),
    ...(user.role.name === 'ADMIN' 
      ? [{ name: 'Instructors', href: '/dashboard/instructors', icon: <BriefcaseBusiness className="w-5 h-5" /> }]
      : []
    ),
    ...(user.role.name === 'ADMIN' || user.role.name === 'MANAGER' 
      ? [{ name: 'Users', href: '/dashboard/users', icon: <Users className="w-5 h-5" /> }]
      : []
    ),
    { name: 'Support', href: '/dashboard/support', icon: <MessageCircleQuestionMark className="w-5 h-5" /> },
    ...(user.role.name === 'ADMIN' || user.role.name === 'MANAGER'
      ? [{ name: 'All Tickets', href: '/dashboard/admin/support', icon: <SquareKanban className="w-5 h-5" /> }]
      : []
    ),
    ...(canAccessNotificationConsole
      ? [{ name: 'Notifications', href: '/dashboard/notifications', icon: <Bell className="w-5 h-5" /> }]
      : []
    ),
    ...(canAccessMonitoring
      ? [{ name: 'Monitoring', href: '/dashboard/monitoring', icon: <Activity className="w-5 h-5" /> }]
      : []
    ),
    ...(user.role.name === 'STUDENT'
      ? [{ name: 'Certifications', href: '/dashboard/certifications', icon: <ShieldCheck className="w-5 h-5" /> }]
      : []
    ),
       ...(user.role.name === 'ADMIN'
      ? [{ name: 'Appearance', href: '/dashboard/appearance', icon: <Paintbrush className="w-5 h-5" /> }]
      : []
    ),
    { name: 'Settings', href: '/dashboard/settings', icon: <Settings className="w-5 h-5" /> },
 
  ]

  return (
    <div className="h-[100dvh] flex" style={{ backgroundColor: 'var(--color-background)', ...dashboardStyles }}>
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50" 
            onClick={() => setSidebarOpen(false)} 
          />
          <div 
            className="relative flex flex-col w-64 max-w-xs h-full shadow-xl"
            style={{
              backgroundColor: 'var(--color-sidebar)',
              paddingTop: 'var(--safe-area-inset-top)',
              paddingRight: 'max(0.75rem, var(--safe-area-inset-right))',
              paddingBottom: 'var(--safe-area-inset-bottom)',
              paddingLeft: 'max(0.75rem, var(--safe-area-inset-left))',
            }}
          >
            <div className="flex items-center justify-between h-16 px-4 border-b" style={{ borderColor: 'var(--color-sidebar-border)', color: 'var(--color-sidebar-text, var(--color-text))' }}>
              <Link href="/" prefetch={false} className="flex items-center gap-2 min-w-0 max-w-[11rem]">
                {!brandLogoFailed && (
                  <img
                    src={resolvedBrandLogo}
                    alt={`${appName} Logo`}
                    className="h-8 w-auto max-w-[7rem] object-contain shrink-0"
                    onError={() => {
                      if (!useFallbackLogo) {
                        setUseFallbackLogo(true)
                      } else {
                        setBrandLogoFailed(true)
                      }
                    }}
                  />
                )}
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-sidebar-text, var(--color-text))' }}>{appName}</span>
              </Link>
              <button onClick={() => setSidebarOpen(false)} style={{ color: 'var(--color-sidebar-text, var(--color-text-secondary))' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
              {navigation.map((item) => (
                (() => {
                  const isActive = isActiveRoute(item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      prefetch={false}
                      className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors"
                      style={{
                        color: isActive ? 'var(--color-sidebar-active, var(--color-primary))' : 'var(--color-sidebar-text, var(--color-text))',
                        backgroundColor: isActive ? 'var(--color-sidebar-active-bg, var(--color-primary-light))' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--color-sidebar-active, var(--color-primary))' : '3px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'var(--color-sidebar-hover, var(--color-surface-hover))'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }
                      }}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span
                        className="mr-3"
                        style={{ color: isActive ? 'var(--color-sidebar-active, var(--color-primary))' : 'var(--color-sidebar-text, var(--color-text-secondary))' }}
                      >
                        {item.icon}
                      </span>
                      {item.name}
                    </Link>
                  )
                })()
              ))}
            </nav>
            <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-sidebar-border)', color: 'var(--color-sidebar-text, var(--color-text))' }}>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm rounded-md transition-colors"
                style={{ color: 'var(--color-sidebar-text, var(--color-text))' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-sidebar-hover, var(--color-surface-hover))'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div 
          className="flex flex-col w-64 border-r"
          style={{ 
            backgroundColor: 'var(--color-sidebar)',
            borderColor: 'var(--color-sidebar-border)'
          }}
        >
          <div className="flex items-center justify-between h-20 px-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-sidebar-border)', color: 'var(--color-sidebar-text, var(--color-text))' }}>
            <Link href="/" prefetch={false} className="flex items-center gap-3 min-w-0 pr-2">
              {!brandLogoFailed && (
                <img
                  src={resolvedBrandLogo}
                  alt={`${appName} Logo`}
                  className="h-12 w-auto max-w-[8.5rem] object-contain shrink-0"
                  onError={() => {
                    if (!useFallbackLogo) {
                      setUseFallbackLogo(true)
                    } else {
                      setBrandLogoFailed(true)
                    }
                  }}
                />
              )}
              <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-sidebar-text, var(--color-text))' }}>
                {appName}
              </span>
            </Link>
            <ThemeSwitcher />
          </div>
          
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => (
              (() => {
                const isActive = isActiveRoute(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch={false}
                  className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors"
                  style={{
                    color: isActive ? 'var(--color-sidebar-active, var(--color-primary))' : 'var(--color-sidebar-text, var(--color-text))',
                    backgroundColor: isActive ? 'var(--color-sidebar-active-bg, var(--color-primary-light))' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--color-sidebar-active, var(--color-primary))' : '3px solid transparent'
                  }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'var(--color-sidebar-hover, var(--color-surface-hover))'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <span
                      className="mr-3"
                      style={{ color: isActive ? 'var(--color-sidebar-active, var(--color-primary))' : 'var(--color-sidebar-text, var(--color-text-secondary))' }}
                    >
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                )
              })()
            ))}
          </nav>
          
          <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-sidebar-border)', color: 'var(--color-sidebar-text, var(--color-text))' }}>
            <div className="flex items-center space-x-3 mb-3">
              <div className="flex-shrink-0">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-sidebar-text, var(--color-text))' }}>
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--color-sidebar-text, var(--color-text-secondary))' }}>
                  {user.role.displayName}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex gap-2 items-center text-left px-3 py-2 text-sm rounded-md transition-colors"
              style={{ color: 'var(--color-sidebar-text, var(--color-text))' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-sidebar-hover, var(--color-surface-hover))'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <div 
          className="lg:hidden flex items-center justify-between px-4 border-b flex-shrink-0"
          style={{ 
            backgroundColor: 'var(--color-sidebar)',
            borderColor: 'var(--color-sidebar-border)',
            minHeight: 'calc(4rem + var(--safe-area-inset-top))',
            paddingTop: 'var(--safe-area-inset-top)',
            paddingRight: 'max(1rem, var(--safe-area-inset-right))',
            paddingLeft: 'max(1rem, var(--safe-area-inset-left))',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto scrollbar-hidden"
          style={{
            backgroundColor: 'var(--color-background)',
            paddingBottom: 'var(--safe-area-inset-bottom)',
          }}
        >
          {children}
        </main>
      </div>
      
      <NotificationCenterInner mode="fixed" />
      {/* Urgent Notifications */}
      <UrgentNotification />
    </div>
  )
}

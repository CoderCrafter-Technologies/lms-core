'use client'

import { useAuth } from '../../components/providers/AuthProvider'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDashboardRouteForRole } from '@/lib/role-routing'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace(getDashboardRouteForRole(user.role || user))
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="p-6" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="animate-pulse">
          <div 
            className="h-8 rounded w-1/4 mb-4" 
            style={{ backgroundColor: 'var(--color-surface-hover)' }}
          ></div>
          <div 
            className="h-4 rounded w-1/2" 
            style={{ backgroundColor: 'var(--color-surface-hover)' }}
          ></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Quick stats data
  const stats = [
    { label: 'Courses', value: '0', icon: '📚', bgColor: 'var(--color-primary)' },
    { label: 'Live Classes', value: '0', icon: '🎥', bgColor: 'var(--color-success)' },
    { label: 'Students', value: '1', icon: '👥', bgColor: 'var(--color-purple-500)' },
    { label: 'Progress', value: '0%', icon: '📊', bgColor: 'var(--color-warning)' },
  ]

  // Quick actions based on role
  const getQuickActions = () => {
    switch (user.role.name) {
      case 'ADMIN':
        return [
          { icon: '👤', title: 'Manage Users', description: 'Add, edit, or remove users' },
          { icon: '⚙️', title: 'System Settings', description: 'Configure system preferences' },
          { icon: '📊', title: 'Analytics', description: 'View platform analytics' },
        ]
      case 'MANAGER':
      case 'INSTRUCTOR':
        return [
          { icon: '📚', title: 'Create Course', description: 'Start a new course' },
          { icon: '🎥', title: 'Schedule Live Class', description: 'Set up a live session' },
          { icon: '📝', title: 'Create Assessment', description: 'Design quizzes and tests' },
        ]
      case 'STUDENT':
        return [
          { icon: '🔍', title: 'Browse Courses', description: 'Find courses to enroll in' },
          { icon: '📖', title: 'My Learning', description: 'Continue your studies' },
          { icon: '📅', title: 'Upcoming Classes', description: 'View your schedule' },
        ]
      default:
        return []
    }
  }

  const quickActions = getQuickActions()

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
          Welcome back, {user.firstName}! 👋
        </h1>
        <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          You're logged in as {user.role.displayName}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className="p-6 rounded-lg shadow-sm"
            style={{ 
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-card-border)'
            }}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: stat.bgColor }}
                >
                  <span className="text-lg">{stat.icon}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {stat.label}
                </p>
                <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div 
          className="rounded-lg shadow-sm"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-card-border)'
          }}
        >
          <div 
            className="p-6 border-b"
            style={{ borderColor: 'var(--color-card-border-inner)' }}
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Recent Activity
            </h2>
          </div>
          <div className="p-6">
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📋</div>
              <p style={{ color: 'var(--color-text-secondary)' }}>No recent activity</p>
              <p className="text-sm mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                Your recent activities will appear here
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div 
          className="rounded-lg shadow-sm"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-card-border)'
          }}
        >
          <div 
            className="p-6 border-b"
            style={{ borderColor: 'var(--color-card-border-inner)' }}
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Quick Actions
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {quickActions.map((action, index) => (
                <button 
                  key={index}
                  className="w-full text-left p-4 rounded-lg border transition-colors"
                  style={{ 
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                    e.currentTarget.style.borderColor = 'var(--color-border-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                  }}
                >
                  <div className="flex items-center">
                    <span className="mr-3 text-xl">{action.icon}</span>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {action.title}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {action.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {/* If no quick actions, show placeholder */}
              {quickActions.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">⚡</div>
                  <p style={{ color: 'var(--color-text-secondary)' }}>No quick actions available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional role-specific content can be added here */}
      {user.role.name === 'ADMIN' && (
        <div className="mt-8">
          <div 
            className="p-6 rounded-lg shadow-sm"
            style={{ 
              backgroundColor: 'var(--color-surface-muted)',
              border: '1px solid var(--color-card-border)'
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              System Overview
            </h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Welcome to the admin dashboard. Use the navigation menu to manage users, courses, and system settings.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

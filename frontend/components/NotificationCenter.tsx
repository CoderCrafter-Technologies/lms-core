'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BellIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth } from './providers/AuthProvider'
import { api } from '@/lib/api'
import { initSocket, releaseSocket } from '@/lib/services/socket'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const MAX_BAR_NOTIFICATIONS = 5
const BROWSER_NOTIFICATION_PROMPT_KEY = 'lms_browser_notification_prompted_v1'

type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  data?: Record<string, any>
  readAt: string | null
  createdAt: string
}

const getPriorityClass = (priority: NotificationItem['priority']) => {
  if (priority === 'urgent') return 'border-red-500/40 bg-red-500/10'
  if (priority === 'high') return 'border-amber-500/40 bg-amber-500/10'
  return 'border-[var(--color-border)] bg-[var(--color-surface)]'
}

export default function NotificationCenter() {
  return <NotificationCenterInner />
}

type NotificationCenterProps = {
  mode?: 'fixed' | 'inline'
}

export function NotificationCenterInner({ mode = 'fixed' }: NotificationCenterProps = {}) {
  const { user } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationPrefs, setNotificationPrefs] = useState<{ browserPushEnabled?: boolean }>({})
  const panelRef = useRef<HTMLDivElement>(null)

  const userId = useMemo(() => user?.id, [user])

  const refreshNotifications = async () => {
    if (!userId) return
    try {
      const [listResponse, countResponse] = await Promise.all([
        api.getNotifications({ page: 1, limit: MAX_BAR_NOTIFICATIONS }),
        api.getUnreadNotificationCount(),
      ])
      setNotifications(((listResponse?.data || []) as NotificationItem[]).slice(0, MAX_BAR_NOTIFICATIONS))
      setUnreadCount(Number(countResponse?.data?.unreadCount || 0))
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  const refreshPreferences = async () => {
    if (!userId) return
    try {
      const response = await api.getNotificationPreferences()
      setNotificationPrefs(response?.data || {})
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
    }
  }

  useEffect(() => {
    if (!userId) return
    refreshNotifications()
    refreshPreferences()
    return () => {}
  }, [userId])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (!userId) return
    if (window.Notification.permission !== 'default') return
    if (notificationPrefs.browserPushEnabled === false) return

    const alreadyPrompted = window.localStorage.getItem(BROWSER_NOTIFICATION_PROMPT_KEY) === 'true'
    if (alreadyPrompted) return

    window.localStorage.setItem(BROWSER_NOTIFICATION_PROMPT_KEY, 'true')
    window.Notification.requestPermission().catch((error) => {
      console.error('Browser notification permission request failed:', error)
    })
  }, [userId, notificationPrefs.browserPushEnabled])

  useEffect(() => {
    if (!userId) return
    const socket = process.env.NEXT_PUBLIC_SOCKET_URL
      ? initSocket(process.env.NEXT_PUBLIC_SOCKET_URL)
      : initSocket()

    socket.on('connect', () => {
      refreshNotifications()
    })

    socket.emit('register-user', { userId })

    const showSystemNotification = (notification: NotificationItem) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return
      if (window.Notification.permission !== 'granted') return
      if (notificationPrefs.browserPushEnabled === false) return

      const browserNotification = new window.Notification(notification.title, {
        body: notification.message,
        tag: `lms-${notification.id}`,
      })

      browserNotification.onclick = () => {
        window.focus()
        const linkUrl = notification?.data?.linkUrl
        if (typeof linkUrl === 'string' && linkUrl.trim()) {
          const target = linkUrl.trim()
          if (target.startsWith('http://') || target.startsWith('https://')) {
            window.open(target, '_blank', 'noopener,noreferrer')
          } else {
            router.push(target)
          }
        }
      }
    }

    const handleNewNotification = (notification: NotificationItem) => {
      setNotifications((prev) => [notification, ...prev].slice(0, MAX_BAR_NOTIFICATIONS))
      setUnreadCount((prev) => prev + 1)

      toast(`${notification.title}: ${notification.message}`, {
        duration: notification.priority === 'urgent' ? 7000 : 4000,
      })
      showSystemNotification(notification)
    }

    socket.on('notification:new', handleNewNotification)

    return () => {
      socket.off('connect')
      socket.off('notification:new', handleNewNotification)
      releaseSocket()
    }
  }, [userId, router, notificationPrefs.browserPushEnabled])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (!userId) return null

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id)
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.readAt) {
      await handleMarkRead(item.id)
    }

    const linkUrl = item?.data?.linkUrl
    if (typeof linkUrl === 'string' && linkUrl.trim()) {
      const target = linkUrl.trim()
      if (target.startsWith('http://') || target.startsWith('https://')) {
        window.open(target, '_blank', 'noopener,noreferrer')
      } else {
        router.push(target)
      }
      setOpen(false)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await api.archiveNotification(id)
      const archived = notifications.find((item) => item.id === id)
      setNotifications((prev) => prev.filter((item) => item.id !== id))
      if (archived && !archived.readAt) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      refreshNotifications()
    } catch (error) {
      console.error('Failed to archive notification:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      const now = new Date().toISOString()
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || now })))
      setUnreadCount(0)
      refreshNotifications()
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  return (
    <div className={mode === 'fixed' ? 'fixed right-4 top-4 z-[70]' : 'relative z-30'} ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next) {
              refreshNotifications()
            }
            return next
          })
        }}
        className="relative h-10 w-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--color-surface-muted)]"
        aria-label="Open notifications"
      >
        <BellIcon className="mx-auto h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">Notifications</p>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-sky-400 transition hover:text-sky-300"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                No notifications yet
              </div>
            )}

            {notifications.map((item) => (
              <div
                key={item.id}
                className={`border-b px-3 py-3 transition ${getPriorityClass(item.priority)} ${item.readAt ? 'opacity-80' : ''} ${item?.data?.linkUrl ? 'cursor-pointer hover:bg-[var(--color-surface-muted)]' : ''}`}
                onClick={() => handleNotificationClick(item)}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{item.message}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!item.readAt && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleMarkRead(item.id)
                        }}
                        className="rounded p-1 text-emerald-400 transition hover:bg-emerald-500/15"
                        title="Mark as read"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleArchive(item.id)
                      }}
                      className="rounded p-1 text-red-400 transition hover:bg-red-500/15"
                      title="Archive"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from './providers/AuthProvider'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface UrgentTicket {
  _id: string
  type: 'ticket' | 'leave'
  title: string
  priority: string
  createdBy: {
    firstName: string
    lastName: string
  }
  courseId?: {
    title: string
  }
  batchId?: {
    name: string
  }
  ageInHours: number
}

export default function UrgentNotification() {
  const { user } = useAuth()
  const [urgentTickets, setUrgentTickets] = useState<UrgentTicket[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])
  const roleName =
    typeof (user as any)?.roleId === 'object'
      ? (user as any)?.roleId?.name
      : (user as any)?.role?.name

  // Only show for admins and managers
  if (!user || !['ADMIN', 'MANAGER'].includes(roleName || '')) {
    return null
  }

  useEffect(() => {
    fetchUrgentTickets()
    
    // Poll for urgent tickets every 5 minutes
    const interval = setInterval(fetchUrgentTickets, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchUrgentTickets = async () => {
    try {
      const data = await api.getAllSupportTickets({ urgent: 'true', status: 'pending' })
      setUrgentTickets(data.data || [])
    } catch (error) {
      console.error('Error fetching urgent tickets:', error)
    }
  }

  const dismissNotification = (ticketId: string) => {
    setDismissed(prev => [...prev, ticketId])
  }

  const visibleTickets = urgentTickets.filter(ticket => !dismissed.includes(ticket._id))

  if (visibleTickets.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {visibleTickets.map(ticket => (
        <div
          key={ticket._id}
          className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg animate-pulse"
        >
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">
                Urgent {ticket.type === 'leave' ? 'Leave Request' : 'Support Ticket'}
              </p>
              <p className="text-sm text-red-700 truncate">
                {ticket.title}
              </p>
              <p className="text-xs text-red-600 mt-1">
                From: {ticket.createdBy.firstName} {ticket.createdBy.lastName}
                {ticket.courseId && ` • ${ticket.courseId.title}`}
                {ticket.batchId && ` • ${ticket.batchId.name}`}
              </p>
              <p className="text-xs text-red-500 mt-1">
                {ticket.ageInHours}h ago
              </p>
            </div>
            <button
              onClick={() => dismissNotification(ticket._id)}
              className="text-red-400 hover:text-red-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex space-x-2">
            <Link href="/dashboard/admin/support">
              <button className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">
                View Details
              </button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}


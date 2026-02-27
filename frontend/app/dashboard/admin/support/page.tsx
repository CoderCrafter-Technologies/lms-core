'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '../../../../components/providers/AuthProvider'
import { Button } from '../../../../components/ui/button'
import { Label } from '../../../../components/ui/label'
import { Textarea } from '../../../../components/ui/textarea'
import { Card, CardContent } from '../../../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/dialog'
import { Badge } from '../../../../components/ui/badge'
import { 
  TicketIcon, 
  CalendarIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  DocumentTextIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'

interface Ticket {
  _id: string
  type: 'ticket' | 'leave'
  title: string
  description: string
  status: 'pending' | 'in-progress' | 'resolved' | 'approved' | 'rejected'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  createdBy: {
    _id: string
    firstName: string
    lastName: string
    email: string
  }
  courseId?: {
    _id: string
    title: string
  }
  batchId?: {
    _id: string
    name: string
    batchCode: string
  }
  liveClassIds?: Array<{
    _id: string
    name: string
    scheduledAt: string
  }>
  createdAt: string
  updatedAt: string
  ageInHours: number
  isUrgent: boolean
  replies?: Array<{
    _id: string
    message: string
    attachments?: Array<{
      filename: string
      path?: string
      mimetype?: string
      size?: number
    }>
    from: {
      email?: string
      firstName: string
      lastName: string
      roleId: { name: string }
    }
    createdAt: string
  }>
}

interface DashboardStats {
  pendingTickets: number
  inProgressTickets: number
  pendingLeaveRequests: number
  urgentTickets: number
  ticketsNeedingAttention: number
  recentTickets: Ticket[]
}

interface PendingAttachment {
  file: File
  previewUrl: string
  isImage: boolean
}

export default function AdminSupportPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [threadOpen, setThreadOpen] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadSending, setThreadSending] = useState(false)
  const [threadMessage, setThreadMessage] = useState('')
  const [threadAttachments, setThreadAttachments] = useState<PendingAttachment[]>([])
  const [threadFileInputKey, setThreadFileInputKey] = useState(0)
  const [previewModal, setPreviewModal] = useState<{open: boolean; url: string; name: string; isImage: boolean}>({
    open: false,
    url: '',
    name: '',
    isImage: false
  })
  const [filter, setFilter] = useState({
    status: 'all',
    type: 'all',
    priority: 'all',
    urgent: false
  })

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '')
  const isImageName = (name = '') => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name)
  const getAttachmentUrl = (attachment: { path?: string; filename: string }) => {
    if (attachment.path?.startsWith('http')) return attachment.path
    const filename = attachment.path
      ? attachment.path.split(/[\\/]/).pop()
      : attachment.filename
    return `${apiBase}/uploads/tickets/${filename}`
  }

  const clearThreadAttachments = () => {
    threadAttachments.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    })
    setThreadAttachments([])
    setThreadFileInputKey((prev) => prev + 1)
  }

  const setThreadFiles = (files: FileList | null) => {
    clearThreadAttachments()
    const mapped = Array.from(files || []).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      isImage: file.type.startsWith('image/')
    }))
    setThreadAttachments(mapped)
  }

  // Check access
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role.name)) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card>
          <CardContent className="text-center py-12">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">You need admin or manager privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  useEffect(() => {
    fetchStats()
    fetchTickets()
  }, [filter])

  const fetchStats = async () => {
    try {
      const data = await api.getSupportDashboardStats()
      setStats(data.data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      
      if (filter.status !== 'all') params.status = filter.status
      if (filter.type !== 'all') params.type = filter.type
      if (filter.priority !== 'all') params.priority = filter.priority
      if (filter.urgent) params.urgent = 'true'

      const data = await api.getAllSupportTickets(params)
      setTickets(data.data || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      await api.updateSupportTicket(ticketId, { status })

      fetchTickets()
      fetchStats()
      toast.success('Ticket updated successfully.')
    } catch (error) {
      console.error('Error updating ticket:', error)
      toast.error('Failed to update ticket.')
    }
  }

  const openTicketThread = async (ticketId: string) => {
    try {
      setThreadLoading(true)
      setThreadOpen(true)
      setThreadMessage('')
      clearThreadAttachments()
      const data = await api.getSupportTicket(ticketId)
      setSelectedTicket(data.data)
    } catch (error) {
      console.error('Error fetching ticket thread:', error)
      toast.error('Failed to fetch ticket thread.')
      setThreadOpen(false)
    } finally {
      setThreadLoading(false)
    }
  }

  const sendThreadMessage = async () => {
    if (!selectedTicket || (!threadMessage.trim() && threadAttachments.length === 0)) return

    try {
      setThreadSending(true)
      const formData = new FormData()
      formData.append('message', threadMessage.trim() || 'Attachment')
      threadAttachments.forEach((attachment) => {
        formData.append('attachments', attachment.file)
      })

      const data = await api.addSupportTicketMessage(selectedTicket._id, formData)
      const updatedTicket = data.data as Ticket

      setSelectedTicket(updatedTicket)
      setThreadMessage('')
      clearThreadAttachments()
      setTickets(prev => prev.map(ticket => (ticket._id === updatedTicket._id ? updatedTicket : ticket)))
      fetchStats()
    } catch (error) {
      console.error('Error sending thread message:', error)
      toast.error('Failed to send message.')
    } finally {
      setThreadSending(false)
    }
  }

  const approveLeaveRequest = async (ticketId: string, message?: string) => {
    try {
      await api.approveSupportLeave(ticketId, message)

      fetchTickets()
      fetchStats()
      toast.success('Leave request approved successfully.')
    } catch (error) {
      console.error('Error approving leave request:', error)
      toast.error('Failed to approve leave request.')
    }
  }

  const rejectLeaveRequest = async (ticketId: string, reason: string) => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for rejection.')
      return
    }

    try {
      await api.rejectSupportLeave(ticketId, reason.trim())

      fetchTickets()
      fetchStats()
      toast.success('Leave request rejected successfully.')
    } catch (error) {
      console.error('Error rejecting leave request:', error)
      toast.error('Failed to reject leave request.')
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in-progress': return 'bg-blue-100 text-blue-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  useEffect(() => {
    return () => {
      threadAttachments.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
      })
    }
  }, [threadAttachments])

  return (
    <div className="px-4 md:px-6 lg:px-10 mx-auto space-y-6">
      {/* Header */}
      <div className="flex py-2 md:py-7 border-b border-gray-200 items-center justify-between">
        <div className=''>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Support Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage tickets and leave requests
          </p>
        </div>
      </div>

      {/* Dashboard Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="flex items-center space-x-3 px-4 pt-4">
              <ClockIcon className="h-8 w-8 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-lg">{stats.pendingTickets}</h3>
                <p className="text-sm text-gray-600">Pending Tickets</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center space-x-3 px-4 pt-4">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-semibold text-lg">{stats.inProgressTickets}</h3>
                <p className="text-sm text-gray-600">In Progress</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center space-x-3 px-4 pt-4">
              <CalendarIcon className="h-8 w-8 text-purple-600" />
              <div>
                <h3 className="font-semibold text-lg">{stats.pendingLeaveRequests}</h3>
                <p className="text-sm text-gray-600">Leave Requests</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center space-x-3 px-4 pt-4">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
              <div>
                <h3 className="font-semibold text-lg">{stats.urgentTickets}</h3>
                <p className="text-sm text-gray-600">Urgent</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center space-x-3 px-4 pt-4">
              <ExclamationTriangleIcon className="h-8 w-8 text-orange-600" />
              <div>
                <h3 className="font-semibold text-lg">{stats.ticketsNeedingAttention}</h3>
                <p className="text-sm text-gray-600">Need Attention</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="px-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={filter.status} 
                onValueChange={(value) => setFilter({...filter, status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select 
                value={filter.type} 
                onValueChange={(value) => setFilter({...filter, type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ticket">Support Tickets</SelectItem>
                  <SelectItem value="leave">Leave Requests</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select 
                value={filter.priority} 
                onValueChange={(value) => setFilter({...filter, priority: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filter.urgent}
                  onChange={(e) => setFilter({...filter, urgent: e.target.checked})}
                  className="h-4 w-4 text-red-600"
                />
                <span className="text-sm">Urgent Only</span>
              </label>
            </div>

            <div className="flex items-end">
              <Button onClick={fetchTickets} variant="outline" className="w-full">
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="text-center py-12">
              <p>Loading tickets...</p>
            </CardContent>
          </Card>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <TicketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tickets found</h3>
              <p className="text-gray-600">No tickets match your current filters.</p>
            </CardContent>
          </Card>
        ) : (
          tickets.map(ticket => (
            <Card
  key={ticket._id}
  className={`${ticket.isUrgent ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : ''}`}
>
  <CardContent className="px-4 sm:px-6 pt-6">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      {/* Left Section */}
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h3 className="font-semibold text-lg">{ticket.title}</h3>
          <Badge className={getStatusBadgeColor(ticket.status)}>
            {ticket.status.replace('-', ' ')}
          </Badge>
          <Badge className={getPriorityBadgeColor(ticket.priority)}>
            {ticket.priority}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {ticket.type === 'leave' ? 'Leave Request' : 'Support Ticket'}
          </Badge>
          {ticket.isUrgent && (
            <Badge className="bg-red-100 text-red-800">
              <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
              Urgent
            </Badge>
          )}
        </div>

        <p className="text-gray-600 mb-3">{ticket.description}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 mb-3">
          <span>From: {ticket.createdBy.firstName} {ticket.createdBy.lastName}</span>
          <span>Age: {ticket.ageInHours}h</span>
          {ticket.courseId && <span>Course: {ticket.courseId.title}</span>}
          {ticket.batchId && <span>Batch: {ticket.batchId.name}</span>}
        </div>

        {/* Leave Request Details */}
        {ticket.type === 'leave' && ticket.liveClassIds?.length > 0 && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-medium mb-2">Classes for Leave:</h4>
            <div className="space-y-1">
              {ticket.liveClassIds.map(liveClass => (
                <div key={liveClass._id} className="text-sm">
                  <span className="font-medium">{liveClass.name}</span>
                  <span className="text-gray-500 ml-2">
                    {new Date(liveClass.scheduledAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Replies */}
        {ticket.replies?.length > 0 && (
          <div className="mb-3">
            <h4 className="font-medium mb-2">Latest Reply:</h4>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <p className="text-sm">{ticket.replies[ticket.replies.length - 1].message}</p>
              <p className="text-xs text-gray-500 mt-1">
                By {ticket.replies[ticket.replies.length - 1].from.firstName}{' '}
                {ticket.replies[ticket.replies.length - 1].from.lastName} -{' '}
                {new Date(ticket.replies[ticket.replies.length - 1].createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Section - Action Buttons */}
      <div className="flex flex-row md:flex-col flex-wrap gap-2 min-w-[120px]">
        {ticket.status === 'pending' && (
          <>
            <Button
              size="sm"
              onClick={() => updateTicketStatus(ticket._id, 'in-progress')}
              className="text-xs"
            >
              Start Working
            </Button>
            {ticket.type === 'leave' && (
              <>
                <Button
                  size="sm"
                  onClick={() => approveLeaveRequest(ticket._id)}
                  className="text-xs bg-green-600 hover:bg-green-700"
                >
                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    const reason = prompt('Please provide a reason for rejection:');
                    if (reason) rejectLeaveRequest(ticket._id, reason);
                  }}
                  className="text-xs"
                >
                  <XCircleIcon className="h-3 w-3 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </>
        )}

        {ticket.status === 'in-progress' && (
          <Button
            size="sm"
            onClick={() => updateTicketStatus(ticket._id, 'resolved')}
            className="text-xs bg-green-600 hover:bg-green-700"
          >
            Mark Resolved
          </Button>
        )}

        {/* Thread Button */}
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => openTicketThread(ticket._id)}
        >
          <ChatBubbleLeftRightIcon className="h-3 w-3 mr-1" />
          Open Thread
        </Button>
      </div>
    </div>
  </CardContent>
</Card>

          ))
        )}
      </div>

      <Dialog open={threadOpen} onOpenChange={setThreadOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket ? `Ticket Thread: ${selectedTicket.title}` : 'Ticket Thread'}
            </DialogTitle>
          </DialogHeader>

          {threadLoading ? (
            <p className="text-sm text-gray-500">Loading thread...</p>
          ) : !selectedTicket ? (
            <p className="text-sm text-gray-500">No ticket selected.</p>
          ) : (
            <div className="space-y-4">
              <div className="max-h-80 overflow-y-auto border rounded-md p-3 space-y-3">
                {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
                  selectedTicket.replies.map((reply) => (
                    <div key={reply._id} className="rounded-md border p-3 bg-gray-50">
                      <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                      {reply.attachments && reply.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {reply.attachments.map((attachment, idx) => {
                            const url = getAttachmentUrl(attachment)
                            const isImage = isImageName(attachment.filename)
                            return (
                              <button
                                key={`${reply._id}-${idx}`}
                                type="button"
                                className="w-14 h-14 rounded border overflow-hidden flex items-center justify-center bg-black/10"
                                onClick={() => setPreviewModal({ open: true, url, name: attachment.filename, isImage })}
                                title={attachment.filename}
                              >
                                {isImage ? (
                                  <img src={url} alt={attachment.filename} className="w-full h-full object-cover" />
                                ) : (
                                  <DocumentTextIcon className="w-5 h-5" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {reply.from.firstName} {reply.from.lastName}
                        {reply.from.roleId?.name ? ` (${reply.from.roleId.name})` : ''} ·{' '}
                        {new Date(reply.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No messages yet.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="thread-message">Add Message</Label>
                <Textarea
                  id="thread-message"
                  value={threadMessage}
                  onChange={(e) => setThreadMessage(e.target.value)}
                  placeholder="Write a message for this ticket thread..."
                  rows={4}
                />
                <label
                  className="h-10 w-10 rounded-md border inline-flex items-center justify-center cursor-pointer"
                  title="Add attachment"
                >
                  <PaperClipIcon className="h-4 w-4" />
                  <input
                    key={`admin-thread-files-${threadFileInputKey}`}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => setThreadFiles(e.target.files)}
                    className="hidden"
                  />
                </label>
                {threadAttachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {threadAttachments.map((attachment, idx) => (
                      <button
                        key={`admin-pending-${idx}`}
                        type="button"
                        className="relative w-14 h-14 rounded border overflow-hidden flex items-center justify-center bg-black/10"
                        onClick={() =>
                          setPreviewModal({
                            open: true,
                            url: attachment.previewUrl,
                            name: attachment.file.name,
                            isImage: attachment.isImage
                          })
                        }
                        title={attachment.file.name}
                      >
                        {attachment.isImage ? (
                          <img src={attachment.previewUrl} alt={attachment.file.name} className="w-full h-full object-cover" />
                        ) : (
                          <DocumentTextIcon className="w-5 h-5" />
                        )}
                        <span
                          className="absolute -top-1 -right-1 bg-black/75 text-white rounded-full p-0.5"
                          onClick={(e) => {
                            e.stopPropagation()
                            const next = [...threadAttachments]
                            const [removed] = next.splice(idx, 1)
                            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
                            setThreadAttachments(next)
                          }}
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={sendThreadMessage}
                  disabled={threadSending || (!threadMessage.trim() && threadAttachments.length === 0)}
                >
                  {threadSending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewModal.open}
        onOpenChange={(open) => setPreviewModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewModal.name || 'Attachment Preview'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {previewModal.isImage ? (
              <img
                src={previewModal.url}
                alt={previewModal.name}
                className="max-h-[70vh] w-full object-contain rounded border"
              />
            ) : (
              <div className="p-6 border rounded-md text-sm">
                Preview is available for images only. Click Open File to view this attachment.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPreviewModal({ open: false, url: '', name: '', isImage: false })}
              >
                Close
              </Button>
              <Button onClick={() => window.open(previewModal.url, '_blank', 'noopener,noreferrer')}>
                Open File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

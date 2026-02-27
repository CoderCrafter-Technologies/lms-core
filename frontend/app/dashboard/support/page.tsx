'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '../../../components/providers/AuthProvider'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Badge } from '../../../components/ui/badge'
import {
  Ticket,
  Calendar,
  Mail,
  Phone,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Paperclip,
  Send,
  X,
  HelpCircle,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Batch {
  _id: string
  id?: string
  name: string
  batchCode: string
  courseId: {
    _id: string
    title: string
  }
}

interface LiveClass {
  _id: string
  id?: string
  name: string
  title?: string
  scheduledStartTime: string
  scheduledEndTime: string
  batchId: string
}

interface Ticket {
  _id: string
  type: 'ticket' | 'leave'
  title: string
  description: string
  status: 'pending' | 'in-progress' | 'resolved' | 'approved' | 'rejected'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  courseId?: string
  batchId?: string
  liveClassIds?: string[]
  createdAt: string
  updatedAt: string
  replies?: Array<{
    _id?: string
    message: string
    attachments?: Array<{
      filename: string
      path?: string
      mimetype?: string
      size?: number
    }>
    from: any
    createdAt: string
  }>
}

interface PendingAttachment {
  file: File
  previewUrl: string
  isImage: boolean
}

interface CalendarDay {
  date: Date
  isToday: boolean
  isSelected: boolean
  hasClass: boolean
  isCurrentMonth: boolean
  classes: LiveClass[]
}

export default function SupportPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'create' | 'my-tickets'>('create')
  const [ticketType, setTicketType] = useState<'ticket' | 'leave'>('ticket')
  const [batches, setBatches] = useState<Batch[]>([])
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({start: null, end: null})
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    batchId: '',
    liveClassIds: [] as string[]
  })
  const [attachments, setAttachments] = useState<File[]>([])
  const [replyAttachments, setReplyAttachments] = useState<Record<string, PendingAttachment[]>>({})
  const [replyMessages, setReplyMessages] = useState<Record<string, string>>({})
  const [replyFileInputKeys, setReplyFileInputKeys] = useState<Record<string, number>>({})
  const [previewModal, setPreviewModal] = useState<{open: boolean; url: string; name: string; isImage: boolean}>({
    open: false,
    url: '',
    name: '',
    isImage: false
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

  const clearReplyAttachments = (ticketId: string) => {
    const existing = replyAttachments[ticketId] || []
    existing.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    })
    setReplyAttachments((prev) => ({ ...prev, [ticketId]: [] }))
    setReplyFileInputKeys((prev) => ({ ...prev, [ticketId]: (prev[ticketId] || 0) + 1 }))
  }

  const setTicketReplyFiles = (ticketId: string, files: FileList | null) => {
    clearReplyAttachments(ticketId)
    const selectedFiles = Array.from(files || [])
    const mapped = selectedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      isImage: file.type.startsWith('image/')
    }))
    setReplyAttachments((prev) => ({ ...prev, [ticketId]: mapped }))
  }

  useEffect(() => {
    fetchBatches()
    fetchMyTickets()
  }, [])

  useEffect(() => {
    if (formData.batchId) {
      fetchLiveClasses(formData.batchId)
    } else {
      setLiveClasses([])
    }
  }, [formData.batchId])

  useEffect(() => {
    if (formData.batchId && liveClasses.length > 0) {
      generateCalendar()
    }
  }, [formData.batchId, liveClasses, currentMonth])

  const fetchBatches = async () => {
    try {
      if (user?.role?.name === 'STUDENT') {
        const data = await api.getMyEnrollments()
        // Extract batches from enrollments
        const userBatches = (data?.data || []).map((enrollment: any) => enrollment.batchId).filter(Boolean)
        setBatches(userBatches)
      } else if (user?.role?.name === 'INSTRUCTOR') {
        const data = await api.getInstructorMyBatches()
        setBatches(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching batches:', error)
    }
  }

  const fetchLiveClasses = async (batchId: string) => {
    try {
      const data = await api.getLiveClassesByBatch(batchId)
      setLiveClasses(data.data || [])
    } catch (error) {
      console.error('Error fetching live classes:', error)
    }
  }

  const generateCalendar = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    // Get first day of month and last day of month
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const days: CalendarDay[] = []
    
    // Add days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    const firstDayOfWeek = firstDay.getDay()
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i)
      days.push({
        date,
        isToday: false,
        isSelected: false,
        hasClass: false,
        isCurrentMonth: false,
        classes: []
      })
    }
    
    // Add current month days
    const today = new Date()
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day)
      const classDateStr = date.toISOString().split('T')[0]
      
      // Find classes for this date
      const dayClasses = liveClasses.filter(liveClass => {
        const classDate = new Date(liveClass.scheduledStartTime).toISOString().split('T')[0]
        return classDate === classDateStr
      })
      
      days.push({
        date,
        isToday: date.toDateString() === today.toDateString(),
        isSelected: formData.liveClassIds.some(id => 
          dayClasses.some(cls => (cls._id || cls.id) === id)
        ),
        hasClass: dayClasses.length > 0,
        isCurrentMonth: true,
        classes: dayClasses
      })
    }
    
    // Add days from next month to complete the grid
    const totalCells = 42 // 6 weeks * 7 days
    const nextMonthDays = totalCells - days.length
    for (let day = 1; day <= nextMonthDays; day++) {
      const date = new Date(year, month + 1, day)
      days.push({
        date,
        isToday: false,
        isSelected: false,
        hasClass: false,
        isCurrentMonth: false,
        classes: []
      })
    }
    
    setCalendarDays(days)
  }

  const handleMonthChange = (months: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + months)
      return newDate
    })
  }

  const handleDayClick = (day: CalendarDay) => {
    if (!day.hasClass) return
    
    // If we're in range selection mode
    if (dateRange.start && !dateRange.end) {
      // Complete the range selection
      const newEnd = day.date > dateRange.start ? day.date : dateRange.start
      const newStart = day.date > dateRange.start ? dateRange.start : day.date
      
      setDateRange({start: newStart, end: newEnd})
      
      // Select all classes in the date range
      const newLiveClassIds = [...formData.liveClassIds]
      const classesInRange = liveClasses.filter(cls => {
        const classDate = new Date(cls.scheduledStartTime)
        return classDate >= newStart && classDate <= newEnd
      })
      
      classesInRange.forEach(cls => {
        const clsId = cls._id || cls.id
        if (clsId && !newLiveClassIds.includes(clsId)) {
          newLiveClassIds.push(clsId)
        }
      })
      
      setFormData(prev => ({
        ...prev,
        liveClassIds: newLiveClassIds
      }))
    } else {
      // Start new range selection or toggle single date
      setDateRange({start: day.date, end: null})
      
      const classIds = day.classes.map(cls => cls._id || cls.id).filter(Boolean) as string[]
      const newLiveClassIds = [...formData.liveClassIds]
      
      // Toggle selection for single date
      const allSelected = classIds.every(id => newLiveClassIds.includes(id))
      
      classIds.forEach(classId => {
        const index = newLiveClassIds.indexOf(classId)
        if (allSelected) {
          // Deselect all if all are selected
          if (index > -1) {
            newLiveClassIds.splice(index, 1)
          }
        } else {
          // Select all if not all are selected
          if (index === -1) {
            newLiveClassIds.push(classId)
          }
        }
      })
      
      setFormData(prev => ({
        ...prev,
        liveClassIds: newLiveClassIds
      }))
    }
  }

  const clearDateSelection = () => {
    setDateRange({start: null, end: null})
    setFormData(prev => ({
      ...prev,
      liveClassIds: []
    }))
  }

  const fetchMyTickets = async () => {
    try {
      const data = await api.getMySupportTickets()
      setTickets(data.data || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields.')
      return
    }

    if (ticketType === 'leave' && (!formData.batchId || formData.liveClassIds.length === 0)) {
      toast.error('Please select a batch and at least one class for the leave request.')
      return
    }

    setLoading(true)
    try {
      if (attachments.length > 0) {
        const formDataToSend = new FormData();
        formDataToSend.append('type', ticketType);
        formDataToSend.append('title', formData.title);
        formDataToSend.append('description', formData.description);
        formDataToSend.append('priority', formData.priority);
        
        if (formData.batchId) formDataToSend.append('batchId', formData.batchId);
        if (formData.liveClassIds.length > 0) {
          formData.liveClassIds.forEach(id => formDataToSend.append('liveClassIds[]', id));
        }
        
        attachments.forEach(file => {
          formDataToSend.append('attachments', file);
        });
        await api.createSupportTicket(formDataToSend);
      } else {
        await api.createSupportTicket({
          ...formData,
          type: ticketType
        });
      }

      toast.success(`${ticketType === 'leave' ? 'Leave request' : 'Ticket'} submitted successfully.`)
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        batchId: '',
        liveClassIds: []
      })
      setAttachments([])
      setDateRange({start: null, end: null})
      fetchMyTickets()
    } catch (error) {
      console.error('Error submitting ticket:', error)
      toast.error('Failed to submit ticket. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddReply = async (ticketId: string, message: string) => {
    try {
      const files = replyAttachments[ticketId] || []
      if (!message.trim() && files.length === 0) {
        toast.error('Please enter a message or attach at least one file.')
        return
      }

      const formData = new FormData()
      formData.append('message', message.trim() || 'Attachment')
      files.forEach((attachment) => formData.append('attachments', attachment.file))
      await api.addSupportTicketMessage(ticketId, formData)

      setReplyMessages((prev) => ({ ...prev, [ticketId]: '' }))
      clearReplyAttachments(ticketId)
      fetchMyTickets()
      toast.success('Reply sent successfully.')
    } catch (error) {
      console.error('Error adding reply:', error)
      toast.error('Failed to send reply. Please try again.')
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'warning'
      case 'in-progress': return 'info'
      case 'resolved': return 'success'
      case 'approved': return 'success'
      case 'rejected': return 'destructive'
      default: return 'secondary'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'var(--color-error)'
      case 'high': return 'var(--color-warning)'
      case 'medium': return 'var(--color-primary)'
      case 'low': return 'var(--color-success)'
      default: return 'var(--color-text-secondary)'
    }
  }

  useEffect(() => {
    return () => {
      Object.keys(replyAttachments).forEach((ticketId) => {
        (replyAttachments[ticketId] || []).forEach((attachment) => {
          if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
        })
      })
    }
  }, [replyAttachments])

  const quickActions = [
    {
      icon: Ticket,
      title: 'Raise Ticket',
      description: 'Report issues',
      color: 'var(--color-primary)',
      bgColor: 'var(--color-primary-light)'
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'support@lms.com',
      color: 'var(--color-purple-500)',
      bgColor: 'rgba(168, 85, 247, 0.15)'
    },
    {
      icon: Phone,
      title: 'Call Support',
      description: '+1 (555) 123-4567',
      color: 'var(--color-error)',
      bgColor: 'var(--color-error-light)'
    }
  ]

  return (
    <div className="flex-1 p-4 sm:p-6 space-y-6" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <div className="flex items-center border-b py-2 md:py-7 justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            Support Center
          </h1>
          <p className="text-sm sm:text-base mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Get help with tickets, leave requests, and more
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {quickActions.map((action, index) => {
          const Icon = action.icon
          return (
            <Card 
              key={index} 
              className="cursor-pointer hover:shadow-md transition-shadow"
            >
              <CardContent className="flex items-center space-x-3 p-4 sm:p-6">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: action.bgColor }}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: action.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm sm:text-base truncate" style={{ color: 'var(--color-text)' }}>
                    {action.title}
                  </h3>
                  <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    {action.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tab Navigation */}
      <div className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === 'create' ? 'border-primary' : 'border-transparent hover:border-gray-300'
            )}
            style={{
              color: activeTab === 'create' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: activeTab === 'create' ? 'var(--color-primary)' : 'transparent'
            }}
          >
            Create Request
          </button>
          <button
            onClick={() => setActiveTab('my-tickets')}
            className={cn(
              "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === 'my-tickets' ? 'border-primary' : 'border-transparent hover:border-gray-300'
            )}
            style={{
              color: activeTab === 'my-tickets' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: activeTab === 'my-tickets' ? 'var(--color-primary)' : 'transparent'
            }}
          >
            My Requests ({tickets.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Request Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Request Type</Label>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        value="ticket"
                        checked={ticketType === 'ticket'}
                        onChange={(e) => setTicketType(e.target.value as 'ticket' | 'leave')}
                        className="h-4 w-4 rounded focus:ring-2 focus:ring-opacity-50"
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--color-text)' }}>Support Ticket</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(value) => setFormData({...formData, priority: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Basic Fields */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  {ticketType === 'leave' ? 'Leave Reason' : 'Subject'} *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder={ticketType === 'leave' ? 'Reason for leave' : 'Brief description of your issue'}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  {ticketType === 'leave' ? 'Additional Details' : 'Description'} *
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder={
                    ticketType === 'leave' 
                      ? 'Provide additional details about your leave request'
                      : 'Please provide detailed information about your issue'
                  }
                  rows={4}
                  required
                />
              </div>

              {/* Batch Selection for Leave Requests */}
              {ticketType === 'leave' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="batch">Select Batch *</Label>
                    <Select 
                      value={formData.batchId} 
                      onValueChange={(value) => {
                        setFormData({...formData, batchId: value, liveClassIds: []})
                        setDateRange({start: null, end: null})
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map(batch => (
                          <SelectItem key={batch._id || batch.id} value={batch._id || batch.id}>
                            {batch.name} ({batch.batchCode}) - {batch.courseId?.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Calendar for Class Selection */}
                  {formData.batchId && calendarDays.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label>Select Class Dates for Leave *</Label>
                        {formData.liveClassIds.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearDateSelection}
                          >
                            Clear Selection
                          </Button>
                        )}
                      </div>
                      
                      {/* Calendar Container */}
                      <div 
                        className="border rounded-lg p-4 max-w-md mx-auto"
                        style={{ 
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)'
                        }}
                      >
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between mb-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMonthChange(-1)}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <h3 className="text-base sm:text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </h3>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMonthChange(1)}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1 mb-2 text-xs">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                            <div key={day} className="text-center font-medium p-1" style={{ color: 'var(--color-text-secondary)' }}>
                              {day}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-sm">
                          {calendarDays.map((day, index) => {
                            const isInRange = dateRange.start && dateRange.end && 
                              day.date >= dateRange.start && day.date <= dateRange.end
                            const isRangeStart = dateRange.start && day.date.getTime() === dateRange.start.getTime()
                            const isRangeEnd = dateRange.end && day.date.getTime() === dateRange.end.getTime()
                            
                            return (
                              <button
                                key={index}
                                onClick={() => handleDayClick(day)}
                                disabled={!day.hasClass}
                                className={cn(
                                  "h-8 w-8 p-0 text-center rounded transition-all relative",
                                  !day.isCurrentMonth && "opacity-50",
                                  day.isToday && "border-2",
                                  day.isSelected && "text-white",
                                  isInRange && !day.isSelected && "bg-primary-light text-primary",
                                  day.hasClass && !day.isSelected && !isInRange && "bg-success-light text-success hover:bg-success-light/80",
                                  !day.hasClass && "cursor-not-allowed opacity-50 bg-surface-muted text-text-secondary",
                                  isRangeStart && "rounded-r-none",
                                  isRangeEnd && "rounded-l-none",
                                  isInRange && !isRangeStart && !isRangeEnd && "rounded-none"
                                )}
                                style={{
                                  backgroundColor: day.isSelected ? 'var(--color-primary)' : 
                                                  isInRange ? 'var(--color-primary-light)' :
                                                  day.hasClass ? 'var(--color-success-light)' : 
                                                  'var(--color-surface-muted)',
                                  color: day.isSelected ? 'white' :
                                         isInRange ? 'var(--color-primary)' :
                                         day.hasClass ? 'var(--color-success)' : 
                                         'var(--color-text-secondary)',
                                  borderColor: day.isToday ? 'var(--color-primary)' : 'transparent'
                                }}
                                title={day.hasClass ? 
                                  `Classes: ${day.classes.map(c => c.name || c.title).join(', ')}` : 
                                  'No classes scheduled'
                                }
                              >
                                {day.date.getDate()}
                              </button>
                            )
                          })}
                        </div>

                        {/* Selection Instructions */}
                        <div className="mt-3 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                          {dateRange.start && !dateRange.end ? 
                            "Click another date to complete range selection" : 
                            "Click to select individual dates or click two dates for range selection"}
                        </div>
                      </div>

                      {/* Selected Classes Info */}
                      {formData.liveClassIds.length > 0 && (
                        <div 
                          className="mt-4 p-4 rounded-lg"
                          style={{ 
                            backgroundColor: 'var(--color-primary-light)',
                            color: 'var(--color-primary)'
                          }}
                        >
                          <h4 className="font-medium mb-2">
                            Selected Classes ({formData.liveClassIds.length})
                          </h4>
                          <div className="space-y-2 text-sm">
                            {liveClasses
                              .filter(cls => formData.liveClassIds.includes(cls._id || cls.id))
                              .map(cls => (
                                <div key={cls._id || cls.id} className="flex flex-wrap justify-between items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium truncate block">{cls.name || cls.title}</span>
                                    <span className="text-xs">
                                      {new Date(cls.scheduledStartTime).toLocaleDateString()} 
                                      {' '}
                                      {new Date(cls.scheduledStartTime).toLocaleTimeString([], { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                      })}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        liveClassIds: prev.liveClassIds.filter(id => id !== (cls._id || cls.id))
                                      }))
                                    }}
                                    className="h-6 w-6 p-0"
                                    style={{ color: 'var(--color-error)' }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* File Attachments */}
              <div className="space-y-2">
                <Label htmlFor="attachments">Attachments (optional)</Label>
                <div className="flex items-center gap-2">
                  <label 
                    className="px-4 py-2 text-sm rounded-md cursor-pointer transition-colors inline-flex items-center gap-2"
                    style={{ 
                      backgroundColor: 'var(--color-primary-light)',
                      color: 'var(--color-primary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary)'
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary-light)'
                      e.currentTarget.style.color = 'var(--color-primary)'
                    }}
                  >
                    <Paperclip className="h-4 w-4" />
                    Choose Files
                    <input
                      id="attachments"
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setAttachments(files);
                      }}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                    />
                  </label>
                  {attachments.length > 0 && (
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {attachments.length} file(s) selected
                    </span>
                  )}
                </div>
                {attachments.length > 0 && (
                  <div className="text-sm p-2 rounded space-y-1" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                    {attachments.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span style={{ color: 'var(--color-text)' }}>{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-xs hover:opacity-80 px-2 py-1 rounded"
                          style={{ color: 'var(--color-error)' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Submitting...' : `Submit ${ticketType === 'leave' ? 'Leave Request' : 'Ticket'}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* My Tickets Tab */}
      {activeTab === 'my-tickets' && (
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <HelpCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  No requests found
                </h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  You haven't submitted any tickets or leave requests yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            tickets.map(ticket => (
              <Card key={ticket._id}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-semibold text-base sm:text-lg truncate" style={{ color: 'var(--color-text)' }}>
                          {ticket.title}
                        </h3>
                        <Badge variant={getStatusBadgeVariant(ticket.status)}>
                          {ticket.status.replace('-', ' ')}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {ticket.type === 'leave' ? 'Leave Request' : 'Support Ticket'}
                        </Badge>
                      </div>
                      <p className="text-sm sm:text-base mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                        {ticket.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                        <span className="flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                          <Calendar className="w-3 h-3" />
                          Created: {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                          <Clock className="w-3 h-3" />
                          Updated: {new Date(ticket.updatedAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1" style={{ color: getPriorityColor(ticket.priority) }}>
                          Priority: <span className="capitalize">{ticket.priority}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Full Conversation Thread */}
                  {ticket.replies && ticket.replies.length > 0 && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <h4 className="font-medium mb-3" style={{ color: 'var(--color-text)' }}>
                        Conversation ({ticket.replies.length} replies):
                      </h4>
                          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {ticket.replies.map((reply, index) => {
                          const isOwn = reply.from._id === user?.id
                          return (
                            <div 
                              key={index} 
                              className={cn(
                                "p-3 rounded-lg",
                                isOwn ? "ml-4 sm:ml-8" : "mr-4 sm:mr-8"
                              )}
                              style={{ 
                                backgroundColor: isOwn ? 'var(--color-primary-light)' : 'var(--color-surface-muted)'
                              }}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                  {isOwn ? 'You' : `${reply.from.firstName} ${reply.from.lastName}`}
                                  {reply.from.roleId?.name && (
                                    <span className="ml-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                      ({reply.from.roleId.name})
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                  {new Date(reply.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm" style={{ color: 'var(--color-text)' }}>
                                {reply.message}
                              </p>
                              {reply.attachments && reply.attachments.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {reply.attachments.map((attachment, attIndex) => {
                                    const url = getAttachmentUrl(attachment)
                                    const image = isImageName(attachment.filename)
                                    return (
                                      <button
                                        key={`${reply._id || index}-${attIndex}`}
                                        type="button"
                                        className="w-14 h-14 rounded border overflow-hidden flex items-center justify-center bg-black/10"
                                        style={{ borderColor: 'var(--color-border)' }}
                                        onClick={() =>
                                          setPreviewModal({
                                            open: true,
                                            url,
                                            name: attachment.filename,
                                            isImage: image
                                          })
                                        }
                                        title={attachment.filename}
                                      >
                                        {image ? (
                                          <img src={url} alt={attachment.filename} className="w-full h-full object-cover" />
                                        ) : (
                                          <FileText className="w-5 h-5" />
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* Reply Form */}
                      {ticket.status !== 'resolved' && ticket.status !== 'rejected' && (
                        <div 
                          className="mt-4 p-4 rounded-lg"
                          style={{ backgroundColor: 'var(--color-surface-muted)' }}
                        >
                          <h5 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                            Add Reply:
                          </h5>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              placeholder="Type your reply..."
                              value={replyMessages[ticket._id] || ''}
                              onChange={(e) => {
                                const value = e.target.value
                                setReplyMessages((prev) => ({
                                  ...prev,
                                  [ticket._id]: value
                                }))
                              }}
                              className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-opacity-50"
                              style={{ 
                                backgroundColor: 'var(--color-surface)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text)'
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const message = (replyMessages[ticket._id] || '').trim()
                                  const hasFiles = (replyAttachments[ticket._id] || []).length > 0
                                  if (message || hasFiles) {
                                    handleAddReply(ticket._id, message)
                                  }
                                }
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-primary)'
                                e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-border)'
                                e.currentTarget.style.boxShadow = 'none'
                              }}
                            />
                            <label
                              className="h-10 w-10 shrink-0 rounded-md border inline-flex items-center justify-center cursor-pointer"
                              style={{ borderColor: 'var(--color-border)' }}
                              title="Add attachment"
                            >
                              <Paperclip className="h-4 w-4" />
                              <input
                                key={`reply-files-${ticket._id}-${replyFileInputKeys[ticket._id] || 0}`}
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                                className="hidden"
                                onChange={(e) => setTicketReplyFiles(ticket._id, e.target.files)}
                              />
                            </label>
                            <button
                              onClick={() => {
                                const message = (replyMessages[ticket._id] || '').trim()
                                const hasFiles = (replyAttachments[ticket._id] || []).length > 0
                                if (message || hasFiles) {
                                  handleAddReply(ticket._id, message);
                                }
                              }}
                              className="px-4 py-2 text-sm text-white rounded-md transition-colors flex items-center justify-center gap-2"
                              style={{ backgroundColor: 'var(--color-primary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
                              }}
                            >
                              <Send className="h-4 w-4" />
                              Send
                            </button>
                          </div>
                          {(replyAttachments[ticket._id]?.length || 0) > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(replyAttachments[ticket._id] || []).map((attachment, idx) => (
                                <button
                                  key={`${ticket._id}-pending-${idx}`}
                                  type="button"
                                  className="relative w-14 h-14 rounded border overflow-hidden flex items-center justify-center bg-black/10"
                                  style={{ borderColor: 'var(--color-border)' }}
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
                                    <FileText className="w-5 h-5" />
                                  )}
                                  <span
                                    className="absolute -top-1 -right-1 bg-black/75 text-white rounded-full p-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const next = [...(replyAttachments[ticket._id] || [])]
                                      const [removed] = next.splice(idx, 1)
                                      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
                                      setReplyAttachments((prev) => ({ ...prev, [ticket._id]: next }))
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
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
                style={{ borderColor: 'var(--color-border)' }}
              />
            ) : (
              <div className="p-6 border rounded-md text-sm" style={{ borderColor: 'var(--color-border)' }}>
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


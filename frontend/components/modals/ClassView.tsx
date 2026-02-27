'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Modal } from '../ui/Modal'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { useAuth } from '../providers/AuthProvider'
import { Textarea } from '../ui/textarea'
import { 
  Calendar, 
  Clock, 
  User, 
  Settings, 
  Video, 
  Download, 
  AlertCircle,
  Users,
  MessageSquare,
  FileText,
  X,
  Loader2,
  Info
} from 'lucide-react'

interface ClassInfoModalProps {
  isOpen: boolean
  onClose: () => void
  classId: string
}

export function ClassInfoModal({ 
  isOpen, 
  onClose, 
  classId 
}: ClassInfoModalProps) {
  const { user } = useAuth()
  const [classData, setClassData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaveReason, setLeaveReason] = useState('')
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false)
  const [showLeaveRequest, setShowLeaveRequest] = useState(false)

  // Check user roles
  const isAdmin = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'
  const isStudent = user?.role.name === 'STUDENT'
  const isInstructor = user?.role.name === 'INSTRUCTOR'

  const fetchClassData = async () => {
    if (!classId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const data = await api.getLiveClassById(classId)
      setClassData(data.data)
    } catch (err) {
      console.error('Error fetching class data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load class details')
      toast.error('Failed to load class details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && classId) {
      fetchClassData()
      setShowLeaveRequest(false)
      setLeaveReason('')
    }
  }, [isOpen, classId])

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'secondary'
      case 'LIVE':
        return 'success'
      case 'ENDED':
        return 'outline'
      case 'CANCELLED':
        return 'destructive'
      default:
        return 'default'
    }
  }

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const durationMs = endDate.getTime() - startDate.getTime()
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  // Check if class is upcoming or ongoing
  const isUpcomingOrOngoing = () => {
    if (!classData) return false
    const now = new Date()
    const scheduledStart = new Date(classData.scheduledStartTime)
    const scheduledEnd = new Date(classData.scheduledEndTime)
    
    return (classData.status === 'SCHEDULED' && now < scheduledEnd) || 
           (classData.status === 'LIVE' && now < scheduledEnd)
  }

  const handleLeaveRequest = async () => {
    if (!leaveReason.trim()) {
      toast.error('Please provide a reason for your leave request')
      return
    }

    setIsSubmittingLeave(true)
    try {
      await api.createLeaveRequest({
        classId: classData.id || classData._id,
        reason: leaveReason.trim(),
        type: isStudent ? 'STUDENT_LEAVE' : 'INSTRUCTOR_LEAVE',
        requestedBy: user?.id,
        status: 'PENDING'
      })

      toast.success('Leave request submitted successfully')
      setShowLeaveRequest(false)
      setLeaveReason('')
    } catch (err) {
      console.error('Error submitting leave request:', err)
      toast.error('Failed to submit leave request')
    } finally {
      setIsSubmittingLeave(false)
    }
  }

  // Render different content based on user role
  const renderContent = () => {
    if (!classData) return null

    const statsCards = [
      { 
        label: 'Total Participants', 
        value: classData.stats?.totalParticipants || 0, 
        color: 'var(--color-primary)',
        bg: 'var(--color-primary-light)'
      },
      { 
        label: 'Peak Participants', 
        value: classData.stats?.peakParticipants || 0, 
        color: 'var(--color-success)',
        bg: 'var(--color-success-light)'
      },
      { 
        label: 'Average Participants', 
        value: classData.stats?.averageParticipants || 0, 
        color: 'var(--color-purple-500)',
        bg: 'rgba(168, 85, 247, 0.15)'
      },
      { 
        label: 'Chat Messages', 
        value: classData.stats?.totalChatMessages || 0, 
        color: 'var(--color-warning)',
        bg: 'var(--color-warning-light)'
      },
    ]

    return (
      <>
        {/* Header Section - Visible to all roles */}
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                {classData.title}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={getStatusBadgeVariant(classData.status)}>
                  {classData.status}
                </Badge>
                {isAdmin && (
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Room: {classData.roomId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {classData.description && (
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {classData.description}
            </p>
          )}
        </div>

        {/* Leave Request Section for Students and Instructors */}
        {(isStudent || isInstructor) && isUpcomingOrOngoing() && !showLeaveRequest && (
          <div 
            className="p-4 rounded-lg border"
            style={{ 
              backgroundColor: 'var(--color-primary-light)',
              borderColor: 'var(--color-primary)'
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                  Can't attend this class?
                </h4>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {isStudent 
                    ? 'Request leave if you cannot attend this class' 
                    : 'Request leave if you cannot conduct this class'
                  }
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLeaveRequest(true)}
                style={{
                  borderColor: 'var(--color-primary)',
                  color: 'var(--color-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-light)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                Request Leave
              </Button>
            </div>
          </div>
        )}

        {/* Leave Request Form */}
        {(isStudent || isInstructor) && showLeaveRequest && (
          <div 
            className="p-4 rounded-lg border"
            style={{ 
              backgroundColor: 'var(--color-warning-light)',
              borderColor: 'var(--color-warning)'
            }}
          >
            <h4 className="font-semibold mb-3" style={{ color: 'var(--color-warning)' }}>
              Request Leave
            </h4>
            <Textarea
              placeholder={`Please explain why you need to ${
                isStudent ? 'be absent from' : 'cancel'
              } this class...`}
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              className="mb-3"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowLeaveRequest(false)
                  setLeaveReason('')
                }}
                disabled={isSubmittingLeave}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleLeaveRequest}
                disabled={isSubmittingLeave || !leaveReason.trim()}
                style={{ backgroundColor: 'var(--color-warning)' }}
                onMouseEnter={(e) => {
                  if (!isSubmittingLeave) {
                    e.currentTarget.style.backgroundColor = 'var(--color-warning-hover)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmittingLeave) {
                    e.currentTarget.style.backgroundColor = 'var(--color-warning)'
                  }
                }}
              >
                {isSubmittingLeave ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        )}

        {/* Schedule Information - Visible to all roles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              <Calendar className="h-5 w-5 inline mr-2" />
              Schedule
            </h3>
            <div className="space-y-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Scheduled Start:</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {format(new Date(classData.scheduledStartTime), 'PPP p')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Scheduled End:</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {format(new Date(classData.scheduledEndTime), 'PPP p')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Duration:</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {formatDuration(classData.scheduledStartTime, classData.scheduledEndTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Actual Timing - Only show to Admin and Instructor */}
          {(isAdmin || isInstructor) && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                <Clock className="h-5 w-5 inline mr-2" />
                Actual Timing
              </h3>
              <div className="space-y-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Actual Start:</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {classData.actualStartTime 
                      ? format(new Date(classData.actualStartTime), 'PPP p')
                      : 'Not started'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Actual End:</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {classData.actualEndTime 
                      ? format(new Date(classData.actualEndTime), 'PPP p')
                      : 'Not ended'
                    }
                  </span>
                </div>
                {classData.actualStartTime && classData.actualEndTime && (
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Actual Duration:</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {formatDuration(classData.actualStartTime, classData.actualEndTime)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instructor Information - Visible to all roles */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <User className="h-5 w-5 inline mr-2" />
            Instructor
          </h3>
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
            <div 
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {classData.instructorId?.firstName?.charAt(0)}{classData.instructorId?.lastName?.charAt(0)}
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                {classData.instructorId?.firstName} {classData.instructorId?.lastName}
              </p>
              {isAdmin && (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {classData.instructorId?.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Class Settings - Only show to Admin and Instructor */}
        {(isAdmin || isInstructor) && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              <Settings className="h-5 w-5 inline mr-2" />
              Class Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
              {Object.entries(classData.settings || {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm capitalize" style={{ color: 'var(--color-text)' }}>
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                  <Badge variant={value ? 'success' : 'destructive'}>
                    {value ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistics - Only show to Admin and Instructor */}
        {(isAdmin || isInstructor) && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              <Users className="h-5 w-5 inline mr-2" />
              Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statsCards.map((stat, index) => (
                <div 
                  key={index}
                  className="text-center p-3 rounded-lg"
                  style={{ backgroundColor: stat.bg }}
                >
                  <p className="text-2xl font-bold" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recording Information - Visible to all roles */}
        {classData.recording && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              <Video className="h-5 w-5 inline mr-2" />
              Recording
            </h3>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Recording Status:</span>
                <Badge variant={classData.recording.isRecorded ? 'success' : 'secondary'}>
                  {classData.recording.isRecorded ? 'Available' : 'Not Recorded'}
                </Badge>
              </div>
              
              {classData.recording.isRecorded && (
                <div className="space-y-2">
                  {/* Show duration and size only to Admin and Instructor */}
                  {(isAdmin || isInstructor) && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Duration:</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {Math.floor(classData.recording.recordingDuration / 60)} minutes
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Size:</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {(classData.recording.recordingSize / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </>
                  )}
                  {classData.recording.recordingUrl && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(classData.recording.recordingUrl, '_blank')}
                      className="w-full mt-2"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      View Recording
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Materials - Visible to all roles */}
        {classData.materials && classData.materials.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              <FileText className="h-5 w-5 inline mr-2" />
              Materials
            </h3>
            <div className="space-y-2">
              {classData.materials.map((material: any, index: number) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2 rounded"
                  style={{ backgroundColor: 'var(--color-surface-muted)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--color-text)' }}>{material.name}</span>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancellation Info - Visible to all roles */}
        {classData.status === 'CANCELLED' && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-error)' }}>
              <AlertCircle className="h-5 w-5 inline mr-2" />
              Cancellation Details
            </h3>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-error-light)' }}>
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>
                <strong>Reason:</strong> {classData.cancellationReason || 'No reason provided'}
              </p>
              {classData.cancelledAt && (
                <p className="text-sm mt-1" style={{ color: 'var(--color-error)' }}>
                  <strong>Cancelled at:</strong> {format(new Date(classData.cancelledAt), 'PPP p')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Additional Admin-only Information */}
        {isAdmin && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              <Info className="h-5 w-5 inline mr-2" />
              System Information
            </h3>
            <div className="p-3 rounded-lg space-y-2" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Created At:</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {format(new Date(classData.createdAt), 'PPP p')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Last Updated:</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {format(new Date(classData.updatedAt), 'PPP p')}
                </span>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  if (!isOpen) return null

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Class Information"
      size="xl"
    >
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-error)' }} />
            <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
            <Button 
              onClick={fetchClassData} 
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        ) : (
          renderContent()
        )}
      </div>

      {/* Footer */}
      <div 
        className="sticky bottom-0 border-t p-4 flex justify-end"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}
      >
        <Button
          onClick={onClose}
          variant="outline"
        >
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>
    </Modal>
  )
}


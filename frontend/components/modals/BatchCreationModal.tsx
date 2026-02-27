'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Modal } from '../ui/Modal'
import { toast } from 'sonner'
import { useSetup } from '@/components/providers/SetupProvider'
import { 
  Calendar, 
  Clock, 
  User, 
  Settings, 
  Users, 
  BookOpen,
  ChevronRight,
  AlertCircle,
  Loader2,
  Check,
  X
} from 'lucide-react'

interface Instructor {
  id: string
  _id?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
}

interface BatchCreationModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseName: string
  onBatchCreated: (batch: any) => void
  editingBatch?: any
}

export function BatchCreationModal({ 
  isOpen, 
  onClose, 
  courseId, 
  courseName, 
  onBatchCreated,
  editingBatch
}: BatchCreationModalProps) {
  const { settings } = useSetup()
  const setupTimezone = settings?.defaults?.timezone
  const detectedTimezone = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
  const defaultTimezone = setupTimezone || detectedTimezone || 'UTC'

  const [batchData, setBatchData] = useState({
    name: '',
    description: '',
    instructorId: '',
    startDate: '',
    endDate: '',
    maxStudents: 50,
    scheduleClasses: true,
    schedule: {
      days: [] as string[],
      startTime: '09:00',
      endTime: '17:00',
      timezone: defaultTimezone
    },
    settings: {
      allowLateJoin: false,
      autoEnrollment: false,
      recordClasses: true,
      allowStudentChat: true
    },
    status: 'UPCOMING'
  })

  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [isLoadingInstructors, setIsLoadingInstructors] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weekDays = [
    'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
  ]

  // Load instructors when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInstructors()
      
      // Populate form when editing
      if (editingBatch) {
        setBatchData({
          name: editingBatch.name || '',
          description: editingBatch.description || '',
          instructorId: editingBatch.instructorId?._id || editingBatch.instructorId || '',
          startDate: editingBatch.startDate ? new Date(editingBatch.startDate).toISOString().split('T')[0] : '',
          endDate: editingBatch.endDate ? new Date(editingBatch.endDate).toISOString().split('T')[0] : '',
          maxStudents: editingBatch.maxStudents || 50,
          scheduleClasses: true,
          schedule: {
            days: editingBatch.schedule?.days || [],
            startTime: editingBatch.schedule?.startTime || '09:00',
            endTime: editingBatch.schedule?.endTime || '17:00',
            timezone: editingBatch.schedule?.timezone || defaultTimezone
          },
          settings: {
            allowLateJoin: editingBatch.settings?.allowLateJoin || false,
            autoEnrollment: editingBatch.settings?.autoEnrollment || false,
            recordClasses: editingBatch.settings?.recordClasses || true,
            allowStudentChat: editingBatch.settings?.allowStudentChat || true
          },
          status: editingBatch.status || 'UPCOMING'
        })
      } else {
        // Reset form for creating new batch
        setBatchData({
          name: '', description: '', instructorId: '', startDate: '', endDate: '', maxStudents: 50, scheduleClasses: true,
          schedule: { days: [], startTime: '09:00', endTime: '17:00', timezone: defaultTimezone },
          settings: { allowLateJoin: false, autoEnrollment: false, recordClasses: true, allowStudentChat: true },
          status: 'UPCOMING'
        })
      }
    }
  }, [isOpen, editingBatch, defaultTimezone])

  const loadInstructors = async () => {
    setIsLoadingInstructors(true)
    try {
      const data = await api.getInstructors()
      setInstructors(data.data || [])
    } catch (error) {
      console.error('Error loading instructors:', error)
      setError('Failed to load instructors. Please try again.')
    } finally {
      setIsLoadingInstructors(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setBatchData(prev => ({ ...prev, [field]: value }))
  }

  const handleScheduleChange = (field: string, value: any) => {
    setBatchData(prev => ({
      ...prev,
      schedule: { ...prev.schedule, [field]: value }
    }))
  }

  const handleSettingsChange = (field: string, value: any) => {
    setBatchData(prev => ({
      ...prev,
      settings: { ...prev.settings, [field]: value }
    }))
  }

  const toggleDay = (day: string) => {
    setBatchData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        days: prev.schedule.days.includes(day)
          ? prev.schedule.days.filter(d => d !== day)
          : [...prev.schedule.days, day]
      }
    }))
  }

  const handleSubmit = async () => {
    setIsCreating(true)
    setError(null)

    try {
      // Validate required fields
      if (!batchData.name || !batchData.instructorId || !batchData.startDate || !batchData.endDate || batchData.schedule.days.length === 0) {
        throw new Error('Please fill all required fields including instructor selection and select at least one class day')
      }

      // Generate batch code for new batches only
      let batchCode = editingBatch?.batchCode
      if (!editingBatch) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const random = Math.random().toString(36).substr(2, 4).toUpperCase()
        batchCode = `BATCH-${date}-${random}`
      }

      let batch

      const payload = editingBatch ? {
        ...batchData
      } : {
        courseId,
        batchCode,
        ...batchData,
        currentEnrollment: 0,
        status: 'UPCOMING'
      }

      if (editingBatch) {
        // Update existing batch
        const batchDataResponse = await api.updateBatch(editingBatch.id || editingBatch._id, payload)
        batch = batchDataResponse.data
        
        toast.success('Batch updated successfully!')
      } else {
        // Create new batch
        const batchDataResponse = await api.createBatch(payload)
        batch = batchDataResponse.data
        
        toast.success('Batch created successfully!')
      }

      onBatchCreated(batch)
      onClose()

      // Reset form
      setBatchData({
        name: '', description: '', instructorId: '', startDate: '', endDate: '', maxStudents: 50, scheduleClasses: true,
        schedule: { days: [], startTime: '09:00', endTime: '17:00', timezone: defaultTimezone },
        settings: { allowLateJoin: false, autoEnrollment: false, recordClasses: true, allowStudentChat: true },
        status: 'UPCOMING'
      })

    } catch (error) {
      console.error('Failed to create batch:', error)
      setError(error instanceof Error ? error.message : 'Failed to create batch')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingBatch ? `Edit Batch "${editingBatch.name}"` : `Create Batch for "${courseName}"`} size="lg">
      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div 
            className="p-4 rounded-lg flex items-center gap-3"
            style={{ 
              backgroundColor: 'var(--color-error-light)',
              color: 'var(--color-error)'
            }}
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <BookOpen className="h-5 w-5 inline mr-2" />
            Basic Information
          </h4>
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Batch Name *
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="e.g., Morning Batch 2024"
              value={batchData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Description
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                resize: 'vertical'
              }}
              placeholder="Describe this batch..."
              value={batchData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Calendar className="h-4 w-4 inline mr-1" />
                Start Date *
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={batchData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Calendar className="h-4 w-4 inline mr-1" />
                End Date *
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={batchData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                min={batchData.startDate || new Date().toISOString().split('T')[0]}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              <User className="h-4 w-4 inline mr-1" />
              Assign Instructor *
            </label>
            {isLoadingInstructors ? (
              <div 
                className="w-full px-3 py-2 border rounded-md flex items-center gap-2"
                style={{ 
                  backgroundColor: 'var(--color-surface-muted)',
                  borderColor: 'var(--color-border)'
                }}
              >
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-primary)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading instructors...</span>
              </div>
            ) : (
              <select
                required
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={batchData.instructorId}
                onChange={(e) => handleInputChange('instructorId', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <option value="">Select an instructor</option>
                {instructors.map(instructor => (
                  <option key={instructor.id || instructor._id} value={instructor.id || instructor._id}>
                    {instructor.firstName} {instructor.lastName} ({instructor.email})
                  </option>
                ))}
              </select>
            )}
            {instructors.length === 0 && !isLoadingInstructors && (
              <p className="text-sm mt-1" style={{ color: 'var(--color-warning)' }}>
                No instructors available. Please create instructors first.
              </p>
            )}
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Users className="h-4 w-4 inline mr-1" />
                Maximum Students
              </label>
              <input
                type="number"
                min="1"
                max="500"
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={batchData.maxStudents}
                onChange={(e) => handleInputChange('maxStudents', parseInt(e.target.value) || 50)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Settings className="h-4 w-4 inline mr-1" />
                Status
              </label>
              <select
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={batchData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <option value="UPCOMING">UPCOMING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <h4 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <Clock className="h-5 w-5 inline mr-2" />
            Schedule
          </h4>
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Class Days *
            </label>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(day => {
                const isSelected = batchData.schedule.days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className="p-2 text-xs rounded-lg border transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-surface-muted)',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      color: isSelected ? 'white' : 'var(--color-text)'
                    }}
                  >
                    {day.substr(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Start Time *
              </label>
              <input
                type="time"
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={batchData.schedule.startTime}
                onChange={(e) => handleScheduleChange('startTime', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                End Time *
              </label>
              <input
                type="time"
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={batchData.schedule.endTime}
                onChange={(e) => handleScheduleChange('endTime', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Timezone
            </label>
            <select
              className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              value={batchData.schedule.timezone}
              onChange={(e) => handleScheduleChange('timezone', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <option value="UTC">UTC</option>
              <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
              <option value="America/New_York">US Eastern (America/New_York)</option>
              <option value="America/Chicago">US Central (America/Chicago)</option>
              <option value="America/Denver">US Mountain (America/Denver)</option>
              <option value="America/Los_Angeles">US Pacific (America/Los_Angeles)</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
            </select>
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <h4 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <Settings className="h-5 w-5 inline mr-2" />
            Settings
          </h4>
          
          <div className="space-y-3">
            {[
              { key: 'allowLateJoin', label: 'Allow late joining', description: 'Students can join after batch has started' },
              { key: 'autoEnrollment', label: 'Auto enrollment', description: 'Automatically enroll eligible students' },
              { key: 'recordClasses', label: 'Record classes', description: 'Automatically record live sessions' },
              { key: 'allowStudentChat', label: 'Student chat', description: 'Allow students to chat during classes' }
            ].map(setting => (
              <div 
                key={setting.key} 
                className="flex items-center justify-between p-3 border rounded-lg"
                style={{ 
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface)'
                }}
              >
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{setting.label}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{setting.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={batchData.settings[setting.key as keyof typeof batchData.settings]}
                    onChange={(e) => handleSettingsChange(setting.key, e.target.checked)}
                  />
                  <div 
                    className="w-11 h-6 rounded-full peer transition-colors"
                    style={{
                      backgroundColor: batchData.settings[setting.key as keyof typeof batchData.settings] 
                        ? 'var(--color-primary)' 
                        : 'var(--color-border)'
                    }}
                  >
                    <div 
                      className="absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform"
                      style={{
                        transform: batchData.settings[setting.key as keyof typeof batchData.settings] 
                          ? 'translateX(20px)' 
                          : 'translateX(0)'
                      }}
                    />
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium border rounded-md transition-colors disabled:opacity-50"
            style={{ 
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!isCreating) {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreating) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isCreating || !batchData.name || !batchData.instructorId || !batchData.startDate || !batchData.endDate || batchData.schedule.days.length === 0}
            className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => {
              if (!isCreating) {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreating) {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }
            }}
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {editingBatch ? 'Updating...' : 'Creating...'}
              </span>
            ) : (
              editingBatch ? 'Update Batch' : 'Create Batch'
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}


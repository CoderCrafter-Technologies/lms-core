'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Modal } from '../ui/Modal'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Calendar, Clock, User, Settings, FileText, Plus, X, Video, Mic, Monitor, MessageSquare, Users, Shield } from 'lucide-react'

interface ClassCreationModalProps {
  isOpen: boolean
  onClose: () => void
  batchId: string
  batchName: string
  onClassCreated: (classData: any) => void
}

export function ClassCreationModal({ 
  isOpen, 
  onClose, 
  batchId, 
  batchName, 
  onClassCreated 
}: ClassCreationModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    agenda: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
    instructorId: '',
    settings: {
      maxParticipants: 100,
      allowRecording: true,
      allowScreenShare: true,
      allowWhiteboard: true,
      allowChat: true,
      allowStudentMic: false,
      allowStudentCamera: false,
      requireApproval: false
    },
    materials: [] as Array<{ name: string; type: string; url: string }>
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [instructors, setInstructors] = useState<any[]>([])

  useEffect(() => {
    // Fetch instructors when modal opens
    if (isOpen) {
      fetchInstructors()
    }
  }, [isOpen])

  const fetchInstructors = async () => {
    try {
      const data = await api.getInstructors()
      setInstructors(data.data || [])
    } catch (error) {
      console.error('Error fetching instructors:', error)
      toast.error('Failed to load instructors')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSettingsChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings, [field]: value }
    }))
  }

  const handleMaterialAdd = () => {
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, { name: '', type: 'document', url: '' }]
    }))
  }

  const handleMaterialChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const newMaterials = [...prev.materials]
      newMaterials[index] = { ...newMaterials[index], [field]: value }
      return { ...prev, materials: newMaterials }
    })
  }

  const handleMaterialRemove = (index: number) => {
    setFormData(prev => {
      const newMaterials = [...prev.materials]
      newMaterials.splice(index, 1)
      return { ...prev, materials: newMaterials }
    })
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.scheduledStartTime || !formData.scheduledEndTime || !formData.instructorId) {
      toast.error('Please fill all required fields')
      return
    }

    setIsSubmitting(true)
    
    try {
      const newClass = await api.createLiveClass({
        ...formData,
        batchId,
        status: 'SCHEDULED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      onClassCreated(newClass.data)
      toast.success('Class scheduled successfully')
      onClose()
    } catch (error) {
      console.error('Failed to schedule class:', error)
      toast.error('Failed to schedule class')
    } finally {
      setIsSubmitting(false)
    }
  }

  const settingsList = [
    { key: 'allowRecording', label: 'Allow Recording', icon: Video },
    { key: 'allowScreenShare', label: 'Allow Screen Share', icon: Monitor },
    { key: 'allowWhiteboard', label: 'Allow Whiteboard', icon: FileText },
    { key: 'allowChat', label: 'Allow Chat', icon: MessageSquare },
    { key: 'allowStudentMic', label: 'Allow Student Microphone', icon: Mic },
    { key: 'allowStudentCamera', label: 'Allow Student Camera', icon: Video },
    { key: 'requireApproval', label: 'Require Approval to Join', icon: Shield }
  ]

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Schedule New Class for ${batchName}`}
      size="xl"
    >
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <FileText className="h-5 w-5 inline mr-2" />
            Class Details
          </h3>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Title *
            </label>
            <input
              type="text"
              name="title"
              required
              className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="Class title"
              value={formData.title}
              onChange={handleInputChange}
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
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                resize: 'vertical'
              }}
              placeholder="Class description"
              value={formData.description}
              onChange={handleInputChange}
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
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Agenda
            </label>
            <textarea
              name="agenda"
              rows={4}
              className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                resize: 'vertical'
              }}
              placeholder="Detailed agenda"
              value={formData.agenda}
              onChange={handleInputChange}
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
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              <User className="h-3 w-3 inline mr-1" />
              Instructor *
            </label>
            <select
              name="instructorId"
              className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              value={formData.instructorId}
              onChange={handleInputChange}
              required
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <option value="">Select Instructor</option>
              {instructors.map(instructor => (
                <option key={instructor.id || instructor._id} value={instructor.id || instructor._id}>
                  {instructor.firstName} {instructor.lastName} ({instructor.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scheduling */}
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <Calendar className="h-5 w-5 inline mr-2" />
            Schedule
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                <Clock className="h-3 w-3 inline mr-1" />
                Start Time *
              </label>
              <input
                type="datetime-local"
                name="scheduledStartTime"
                required
                className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={formData.scheduledStartTime}
                onChange={handleInputChange}
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
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                <Clock className="h-3 w-3 inline mr-1" />
                End Time *
              </label>
              <input
                type="datetime-local"
                name="scheduledEndTime"
                required
                className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={formData.scheduledEndTime}
                onChange={handleInputChange}
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
        </div>

        {/* Class Settings */}
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <Settings className="h-5 w-5 inline mr-2" />
            Class Settings
          </h3>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              <Users className="h-3 w-3 inline mr-1" />
              Max Participants
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              value={formData.settings.maxParticipants}
              onChange={(e) => handleSettingsChange('maxParticipants', parseInt(e.target.value) || 100)}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settingsList.map(setting => {
              const Icon = setting.icon
              return (
                <div key={setting.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={setting.key}
                    checked={formData.settings[setting.key as keyof typeof formData.settings] as boolean}
                    onChange={(e) => handleSettingsChange(setting.key, e.target.checked)}
                    className="h-4 w-4 rounded focus:ring-2 focus:ring-opacity-50"
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <Icon className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                  <label htmlFor={setting.key} className="text-sm" style={{ color: 'var(--color-text)' }}>
                    {setting.label}
                  </label>
                </div>
              )
            })}
          </div>
        </div>

        {/* Materials */}
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              <FileText className="h-5 w-5 inline mr-2" />
              Class Materials
            </h3>
            <button
              type="button"
              onClick={handleMaterialAdd}
              className="text-sm flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
              style={{ 
                color: 'var(--color-primary)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-light)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Plus className="h-4 w-4" />
              Add Material
            </button>
          </div>
          
          {formData.materials.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No materials added yet
            </p>
          ) : (
            <div className="space-y-3">
              {formData.materials.map((material, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Material name"
                      className="w-full p-2 border rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                      style={{ 
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                      value={material.name}
                      onChange={(e) => handleMaterialChange(index, 'name', e.target.value)}
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
                  <div className="col-span-3">
                    <select
                      className="w-full p-2 border rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                      style={{ 
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                      value={material.type}
                      onChange={(e) => handleMaterialChange(index, 'type', e.target.value)}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-primary)'
                        e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <option value="document">Document</option>
                      <option value="video">Video</option>
                      <option value="link">Link</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="URL"
                      className="w-full p-2 border rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                      style={{ 
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                      value={material.url}
                      onChange={(e) => handleMaterialChange(index, 'url', e.target.value)}
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
                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={() => handleMaterialRemove(index)}
                      className="p-1 rounded-md transition-colors"
                      style={{ color: 'var(--color-error)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-error-light)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer with action buttons */}
      <div 
        className="sticky bottom-0 border-t p-4 flex justify-end gap-3"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm border rounded-md transition-colors"
          style={{ 
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !formData.title || !formData.scheduledStartTime || !formData.scheduledEndTime || !formData.instructorId}
          className="px-4 py-2 text-sm text-white rounded-md transition-colors disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }
          }}
        >
          {isSubmitting ? 'Scheduling...' : 'Schedule Class'}
        </button>
      </div>
    </Modal>
  )
}


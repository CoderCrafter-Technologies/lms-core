'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Modal } from '../ui/Modal'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { User, Mail, Phone, Lock, Briefcase, BookOpen, Calendar, Award, X, Plus, Trash2 } from 'lucide-react'

interface InstructorModalProps {
  isOpen: boolean
  onClose: () => void
  instructor?: any // Existing instructor data for edit mode
  courses: any[] // List of available courses
  onSuccess: (instructorData: any) => void
}

export function InstructorModal({ 
  isOpen, 
  onClose, 
  instructor, 
  courses,
  onSuccess 
}: InstructorModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    bio: '',
    expertise: '',
    isActive: true,
    assignedCourses: [] as Array<{ 
      courseId: string; 
      batchId: string;
      courseName: string;
      batchName: string;
      assignedAt: string 
    }>
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [availableCourses, setAvailableCourses] = useState<any[]>([])
  const [availableBatches, setAvailableBatches] = useState<any[]>([])
  const [isLoadingBatches, setIsLoadingBatches] = useState(false)
  const [newAssignment, setNewAssignment] = useState({
    courseId: '',
    batchId: ''
  })

  useEffect(() => {
    if (isOpen) {
      // Initialize form if we're editing an existing instructor
      if (instructor) {
        setIsEditing(true)
        setFormData({
          firstName: instructor.firstName || '',
          lastName: instructor.lastName || '',
          email: instructor.email || '',
          phone: instructor.phone || '',
          password: '',
          bio: instructor.bio || '',
          expertise: instructor.expertise || '',
          isActive: instructor.isActive ?? true,
          assignedCourses: instructor.assignedCourses || []
        })
      } else {
        setIsEditing(false)
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: '',
          bio: '',
          expertise: '',
          isActive: true,
          assignedCourses: []
        })
      }
      
      // Filter courses to only show ones not already assigned
      const assignedCourseIds = instructor?.assignedCourses?.map((a: any) => a.courseId) || []
      setAvailableCourses(courses.filter(course => !assignedCourseIds.includes(course._id)))
    }
  }, [isOpen, instructor, courses])

  const fetchBatchesForCourse = async (courseId: string) => {
    if (!courseId) {
      setAvailableBatches([])
      setNewAssignment(prev => ({ ...prev, batchId: '' }))
      return
    }

    setIsLoadingBatches(true)
    try {
      const data = await api.getCourseBatches(courseId)
      setAvailableBatches(data.data.batches || [])
    } catch (error) {
      console.error('Error fetching batches:', error)
      toast.error('Failed to load batches for this course')
    } finally {
      setIsLoadingBatches(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleAssignmentChange = async (field: string, value: string) => {
    if (field === 'courseId') {
      setNewAssignment(prev => ({ ...prev, courseId: value, batchId: '' }))
      await fetchBatchesForCourse(value)
    } else {
      setNewAssignment(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleAddAssignment = async (instructorId: string) => {
    if (!newAssignment.courseId) {
      toast.error('Please select a course')
      return
    }

    if (!newAssignment.batchId) {
      toast.error('Please select a batch')
      return
    }

    const course = courses.find(c => (c.id || c._id) === newAssignment.courseId)
    const batch = availableBatches.find(b => (b.id || b._id) === newAssignment.batchId)

    if (!course || !batch) return

    try {
      const result = await api.assignInstructor(instructorId, {
        courseId: newAssignment.courseId,
        batchId: newAssignment.batchId
      })
      
      // Update local state
      const newAssignmentData = {
        courseId: newAssignment.courseId,
        batchId: newAssignment.batchId,
        courseName: course.title,
        batchName: batch.name,
        assignedAt: new Date().toISOString()
      }

      setFormData(prev => ({
        ...prev,
        assignedCourses: [...prev.assignedCourses, newAssignmentData]
      }))

      setAvailableCourses(prev => prev.filter(c => (c.id || c._id) !== newAssignment.courseId))
      setNewAssignment({ 
        courseId: '', 
        batchId: ''
      })
      setAvailableBatches([]);

      toast.success('Course assigned successfully')
      return result.data
    } catch (error) {
      console.error("Error in handling assignment", error)
      toast.error('Failed to assign course')
      throw error
    }
  }

  const handleRemoveAssignment = (index: number) => {
    const removed = formData.assignedCourses[index]
    setFormData(prev => {
      const newAssignments = [...prev.assignedCourses]
      newAssignments.splice(index, 1)
      return { ...prev, assignedCourses: newAssignments }
    })

    const course = courses.find(c => (c._id || c.id) === removed.courseId)
    if (course) {
      setAvailableCourses(prev => [...prev, course])
    }
  }

  const handleSubmit = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error('Please fill all required fields')
      return
    }

    if (!isEditing && !formData.password) {
      toast.error('Password is required for new instructors')
      return
    }

    setIsSubmitting(true)
    
    try {
      // First handle instructor creation/update
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        bio: formData.bio,
        expertise: formData.expertise,
        isActive: formData.isActive
      }

      if (formData.password) {
        payload.password = formData.password
      }

      const result = isEditing
        ? await api.updateInstructorById(instructor.id, payload)
        : await api.createAdminInstructor(payload)
      const instructorId = result.data.id || result.data._id || instructor?.id

      if (!isEditing) {
        const emailStatus = result?.emailStatus
        const temporaryPassword = result?.temporaryPassword
        if (emailStatus?.skipped) {
          toast.warning('Instructor created, but email was skipped (SMTP disabled).')
        } else if (emailStatus && emailStatus.success === false) {
          toast.warning('Instructor created, but email delivery failed.')
        }
        if (temporaryPassword) {
          toast.info(`Temporary password: ${temporaryPassword}`)
        }
      }

      // Only attempt to add assignment if we have a new assignment selected
      if (newAssignment.courseId && newAssignment.batchId && instructorId) {
        await handleAddAssignment(instructorId)
      }

      // Refresh instructor data
      const updatedData = await api.getInstructorById(instructorId)
      onSuccess(updatedData.data)
      toast.success(isEditing ? 'Instructor updated successfully' : 'Instructor created successfully')
      onClose()
    } catch (error) {
      console.error('Operation failed:', error)
      toast.error(error instanceof Error ? error.message : 'Operation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isEditing ? `Edit Instructor: ${instructor?.firstName} ${instructor?.lastName}` : 'Add New Instructor'}
      size="xl"
    >
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6 space-y-6">
        {/* Instructor Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <User className="h-5 w-5 inline mr-2" />
            Instructor Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                required
                className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                placeholder="First name"
                value={formData.firstName}
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
                Last Name *
              </label>
              <input
                type="text"
                name="lastName"
                required
                className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                placeholder="Last name"
                value={formData.lastName}
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
                <Mail className="h-3 w-3 inline mr-1" />
                Email *
              </label>
              <input
                type="email"
                name="email"
                required
                className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: isEditing ? 'var(--color-surface-muted)' : 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                placeholder="Email address"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isEditing}
                onFocus={(e) => {
                  if (!isEditing) {
                    e.currentTarget.style.borderColor = 'var(--color-primary)'
                    e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                  }
                }}
                onBlur={(e) => {
                  if (!isEditing) {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                <Phone className="h-3 w-3 inline mr-1" />
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                placeholder="Phone number"
                value={formData.phone}
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

            {!isEditing && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <Lock className="h-3 w-3 inline mr-1" />
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{ 
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  placeholder="Set password"
                  value={formData.password}
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
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleInputChange}
                className="h-4 w-4 rounded focus:ring-2 focus:ring-opacity-50"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <label htmlFor="isActive" className="text-sm" style={{ color: 'var(--color-text)' }}>
                Active Account
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              <Award className="h-3 w-3 inline mr-1" />
              Expertise
            </label>
            <input
              type="text"
              name="expertise"
              className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="Areas of expertise (comma separated)"
              value={formData.expertise}
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
              <Briefcase className="h-3 w-3 inline mr-1" />
              Bio
            </label>
            <textarea
              name="bio"
              rows={3}
              className="w-full p-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                resize: 'vertical'
              }}
              placeholder="Brief bio about the instructor"
              value={formData.bio}
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

        {/* Course Assignments */}
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <BookOpen className="h-5 w-5 inline mr-2" />
            Course Assignments
          </h3>
          
          {formData.assignedCourses.length > 0 ? (
            <div className="space-y-3">
              {formData.assignedCourses.map((assignment, index) => {
                const course = courses.find(c => (c._id || c.id) === assignment.courseId)
                const batch = availableBatches.find(b => (b._id || b.id) === assignment.batchId) || 
                  { name: assignment.batchName }
                
                return (
                  <div 
                    key={index} 
                    className="grid grid-cols-12 gap-2 items-center pb-3"
                    style={{ borderBottom: `1px solid var(--color-border)` }}
                  >
                    <div className="col-span-9">
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {course?.title || assignment.courseName}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Batch: {batch?.name || 'N/A'}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Assigned on: {format(new Date(assignment.assignedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignment(index)}
                        className="text-sm flex items-center gap-1 px-2 py-1 rounded transition-colors"
                        style={{ color: 'var(--color-error)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-error-light)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No course assignments yet
            </p>
          )}

          {/* Add New Assignment */}
          {availableCourses.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Plus className="h-4 w-4" />
                Assign New Course
              </h4>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Course *
                    </label>
                    <select
                      className="w-full p-2 border rounded-md text-sm"
                      style={{ 
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                      value={newAssignment.courseId}
                      onChange={(e) => handleAssignmentChange('courseId', e.target.value)}
                    >
                      <option value="">Select Course</option>
                      {availableCourses.map(course => (
                        <option key={course.id || course._id} value={course.id || course._id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {newAssignment.courseId && (
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Batch *
                      </label>
                      <select
                        className="w-full p-2 border rounded-md text-sm"
                        style={{ 
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text)'
                        }}
                        value={newAssignment.batchId}
                        onChange={(e) => handleAssignmentChange('batchId', e.target.value)}
                        disabled={isLoadingBatches}
                      >
                        <option value="">Select Batch</option>
                        {isLoadingBatches ? (
                          <option disabled>Loading batches...</option>
                        ) : (
                          availableBatches.map(batch => (
                            <option key={batch.id || batch._id} value={batch.id || batch._id}>
                              {batch.name} ({format(new Date(batch.startDate), 'MMM d, yyyy')} - {format(new Date(batch.endDate), 'MMM d, yyyy')})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                </div>
              </div>
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
          disabled={isSubmitting || !formData.firstName || !formData.lastName || !formData.email || (!isEditing && !formData.password)}
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
          {isSubmitting 
            ? (isEditing ? 'Saving...' : 'Creating...') 
            : (isEditing ? 'Save Changes' : 'Add Instructor')}
        </button>
      </div>
    </Modal>
  )
}


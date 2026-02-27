'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Modal } from '../ui/Modal'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { User, Mail, Phone, Lock, CheckCircle, XCircle, BookOpen, Calendar, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StudentModalProps {
  isOpen: boolean
  onClose: () => void
  student?: any // Existing student data for edit mode
  courses: any[] // List of available courses
  onSuccess: (studentData: any) => void
}

export function StudentModal({ 
  isOpen, 
  onClose, 
  student, 
  courses,
  onSuccess 
}: StudentModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    isActive: true,
    enrollments: [] as Array<{ 
      courseId: string; 
      batchId: string;
      courseName: string;
      batchName: string;
      status: string; 
      enrollmentDate: string 
    }>
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [availableCourses, setAvailableCourses] = useState<any[]>([])
  const [availableBatches, setAvailableBatches] = useState<any[]>([])
  const [isLoadingBatches, setIsLoadingBatches] = useState(false)
  const [newEnrollment, setNewEnrollment] = useState({
    courseId: '',
    batchId: '',
    status: 'ENROLLED'
  })

  useEffect(() => {
    if (isOpen) {
      // Initialize form if we're editing an existing student
      if (student) {
        setIsEditing(true)
        setFormData({
          firstName: student.firstName || '',
          lastName: student.lastName || '',
          email: student.email || '',
          phone: student.phone || '',
          password: '',
          isActive: student.isActive ?? true,
          enrollments: student.enrollments || []
        })
      } else {
        setIsEditing(false)
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: '',
          isActive: true,
          enrollments: []
        })
      }
      
      // Filter courses to only show ones not already enrolled
      const enrolledCourseIds = student?.enrollments?.map((e: any) => e.courseId) || []
      setAvailableCourses(courses.filter(course => !enrolledCourseIds.includes(course._id)))
    }
  }, [isOpen, student, courses])

  const fetchBatchesForCourse = async (courseId: string) => {
    if (!courseId) {
      setAvailableBatches([])
      setNewEnrollment(prev => ({ ...prev, batchId: '' }))
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleEnrollmentChange = async (field: string, value: string) => {
    if (field === 'courseId') {
      setNewEnrollment(prev => ({ ...prev, courseId: value, batchId: '' }))
      await fetchBatchesForCourse(value)
    } else {
      setNewEnrollment(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleAddEnrollment = async (studentId: string) => {
    console.log("Triggered Handle Add Enrollment")
    if (!newEnrollment.courseId) {
      toast.error('Please select a course');
      return
    }

    if (!newEnrollment.batchId) {
      toast.error('Please select a batch')
      return
    }

    if (!studentId) {
      toast.error('Not a valid student')
      return
    }

    const course = courses.find(c => (c.id || c._id) === newEnrollment.courseId)
    const batch = availableBatches.find(b => (b.id || b._id) === newEnrollment.batchId)

    if (!course || !batch) {
      console.log("Batch or Course Not Available");
      return;
    }

    try {
      const result = await api.createEnrollment({
        courseId: newEnrollment.courseId,
        batchId: newEnrollment.batchId,
        studentId: studentId,
        status: newEnrollment.status
      })
      
      // Update local state with new enrollment
      const newEnrollmentData = {
        courseId: newEnrollment.courseId,
        batchId: newEnrollment.batchId,
        courseName: course.title,
        batchName: batch.name,
        status: newEnrollment.status,
        enrollmentDate: new Date().toISOString()
      }

      setFormData(prev => ({
        ...prev,
        enrollments: [...prev.enrollments, newEnrollmentData]
      }))

      // Update available courses
      setAvailableCourses(prev => prev.filter(c => (c.id || c._id) !== newEnrollment.courseId))
      
      // Reset form
      setNewEnrollment({ 
        courseId: '', 
        batchId: '',
        status: 'ENROLLED' 
      })
      setAvailableBatches([]);

      toast.success('Enrolled successfully')
      return result.data
    } catch (error) {
      console.error("Error in handling enrollment", error)
      toast.error('Failed to create enrollment')
      throw error
    }
  }

  const handleRemoveEnrollment = (index: number) => {
    const removed = formData.enrollments[index]
    setFormData(prev => {
      const newEnrollments = [...prev.enrollments]
      newEnrollments.splice(index, 1)
      return { ...prev, enrollments: newEnrollments }
    })

    const course = courses.find(c => c._id === removed.courseId)
    if (course) {
      setAvailableCourses(prev => [...prev, course])
    }
  }

  const handleStatusChange = (index: number, newStatus: string) => {
    setFormData(prev => {
      const newEnrollments = [...prev.enrollments]
      newEnrollments[index].status = newStatus
      return { ...prev, enrollments: newEnrollments }
    })
  }

  const handleSubmit = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error('Please fill all required fields')
      return
    }

    if (!isEditing && !formData.password) {
      toast.error('Password is required for new students')
      return
    }

    setIsSubmitting(true)
    
    try {
      // First handle student creation/update
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        isActive: formData.isActive
      }

      if (formData.password) {
        payload.password = formData.password
      }

      const result = isEditing
        ? await api.updateStudentById(student.id, payload)
        : await api.createStudent(payload)
      const studentId = result.data.id || result.data._id || student?.id

      // Only attempt to add enrollment if we have a new enrollment selected
      if (newEnrollment.courseId && newEnrollment.batchId && studentId) {
        await handleAddEnrollment(studentId)
      }

      // Refresh student data
      const updatedData = await api.getStudentById(studentId)
      onSuccess(updatedData.data)
      toast.success(isEditing ? 'Student updated successfully' : 'Student created successfully')
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
      title={isEditing ? `Edit Student: ${student?.firstName} ${student?.lastName}` : 'Create New Student'}
      size="xl"
    >
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6 space-y-6">
        {/* Student Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <User className="h-5 w-5 inline mr-2" />
            Student Information
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
        </div>

        {/* Course Enrollments */}
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            <BookOpen className="h-5 w-5 inline mr-2" />
            Course Enrollments
          </h3>
          
          {formData.enrollments.length > 0 ? (
            <div className="space-y-3">
              {formData.enrollments.map((enrollment, index) => {
                const course = courses.find(c => c._id === enrollment.courseId)
                const batch = availableBatches.find(b => b._id === enrollment.batchId) || 
                  { name: enrollment.batchName }
                
                return (
                  <div 
                    key={index} 
                    className="grid grid-cols-12 gap-2 items-center pb-3"
                    style={{ borderBottom: `1px solid var(--color-border)` }}
                  >
                    <div className="col-span-5">
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {course?.title || enrollment.courseName}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Batch: {batch?.name || 'N/A'}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Enrolled on: {format(new Date(enrollment.enrollmentDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="col-span-4">
                      <select
                        className="w-full p-2 border rounded-md text-sm"
                        style={{ 
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text)'
                        }}
                        value={enrollment.status}
                        onChange={(e) => handleStatusChange(index, e.target.value)}
                      >
                        <option value="ENROLLED">Enrolled</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="DROPPED">Dropped</option>
                        <option value="SUSPENDED">Suspended</option>
                      </select>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveEnrollment(index)}
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
              No course enrollments yet
            </p>
          )}

          {/* Add New Enrollment */}
          {availableCourses.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Plus className="h-4 w-4" />
                Add New Enrollment
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
                      value={newEnrollment.courseId}
                      onChange={(e) => handleEnrollmentChange('courseId', e.target.value)}
                    >
                      <option value="">Select Course</option>
                      {availableCourses.map(course => (
                        <option key={course.id || course._id} value={course.id || course._id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {newEnrollment.courseId && (
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
                        value={newEnrollment.batchId}
                        onChange={(e) => handleEnrollmentChange('batchId', e.target.value)}
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

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Status *
                    </label>
                    <select
                      className="w-full p-2 border rounded-md text-sm"
                      style={{ 
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                      value={newEnrollment.status}
                      onChange={(e) => handleEnrollmentChange('status', e.target.value)}
                    >
                      <option value="ENROLLED">Enrolled</option>
                      <option value="PENDING">Pending</option>
                    </select>
                  </div>
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
            : (isEditing ? 'Save Changes' : 'Create Student')}
        </button>
      </div>
    </Modal>
  )
}


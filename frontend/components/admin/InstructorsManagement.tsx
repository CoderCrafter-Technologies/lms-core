'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  EyeIcon,
  KeyIcon,
  UsersIcon,
  AcademicCapIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'

interface Instructor {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  avatar?: any
  isActive: boolean
  createdAt: string
  stats: {
    totalBatches: number
    totalClasses: number
  }
}

interface InstructorProfileModalProps {
  instructor: Instructor | null
  isOpen: boolean
  onClose: () => void
}

interface CreateInstructorModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

function InstructorProfileModal({ instructor, isOpen, onClose }: InstructorProfileModalProps) {
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && instructor) {
      loadInstructorProfile()
    }
  }, [isOpen, instructor])

  const loadInstructorProfile = async () => {
    if (!instructor) return

    setLoading(true)
    try {
      const data = await api.getAdminInstructorById(instructor.id)
      setProfileData(data.data)
    } catch (error) {
      console.error('Error loading instructor profile:', error)
      toast.error('Failed to load instructor profile')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !instructor) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Instructor Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : profileData ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UsersIcon className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <p className="text-sm text-gray-900">
                        {profileData.instructor.firstName} {profileData.instructor.lastName}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <p className="text-sm text-gray-900">{profileData.instructor.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <p className="text-sm text-gray-900">{profileData.instructor.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <Badge className={profileData.instructor.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {profileData.instructor.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Joined</label>
                      <p className="text-sm text-gray-900">
                        {new Date(profileData.instructor.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Login</label>
                      <p className="text-sm text-gray-900">
                        {profileData.instructor.lastLogin ? 
                          new Date(profileData.instructor.lastLogin).toLocaleDateString() : 
                          'Never'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AcademicCapIcon className="h-5 w-5" />
                    Performance Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{profileData.performanceStats.totalBatches}</p>
                      <p className="text-sm text-gray-600">Total Batches</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{profileData.performanceStats.activeBatches}</p>
                      <p className="text-sm text-gray-600">Active Batches</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{profileData.performanceStats.totalStudents}</p>
                      <p className="text-sm text-gray-600">Total Students</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{profileData.performanceStats.completionRate}%</p>
                      <p className="text-sm text-gray-600">Completion Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Batches */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Current Batches ({profileData.batches.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profileData.batches.length > 0 ? (
                    <div className="space-y-4">
                      {profileData.batches.map((batch: any) => (
                        <div key={batch.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{batch.name}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Course: {batch.courseId.title} • Category: {batch.courseId.category}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                <span>{batch.studentCount} students</span>
                                <span>{batch.completedClasses}/{batch.totalClasses} classes completed</span>
                                <span>{batch.completionRate}% completion rate</span>
                              </div>
                            </div>
                            <Badge className={
                              batch.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                              batch.status === 'UPCOMING' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {batch.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No batches assigned yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Failed to load instructor profile</p>
          )}
        </div>
      </div>
    </div>
  )
}

function CreateInstructorModal({ isOpen, onClose, onCreated }: CreateInstructorModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    sendEmail: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await api.createAdminInstructor(formData)
      toast.success('Instructor created successfully!')
      onCreated()
      onClose()
      setFormData({ firstName: '', lastName: '', email: '', phone: '', sendEmail: true })
    } catch (error) {
      console.error('Error creating instructor:', error)
      toast.error('Failed to create instructor')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Create New Instructor</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <Input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <Input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <Input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john.doe@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1234567890"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="sendEmail"
                checked={formData.sendEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, sendEmail: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="sendEmail" className="ml-2 text-sm text-gray-700">
                Send welcome email with login credentials
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Instructor'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function InstructorsManagement() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [filteredInstructors, setFilteredInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [resettingInstructorId, setResettingInstructorId] = useState<string | null>(null)

  useEffect(() => {
    loadInstructors()
  }, [])

  useEffect(() => {
    filterInstructors()
  }, [searchTerm, instructors])

  const loadInstructors = async () => {
    setLoading(true)
    try {
      const data = await api.getAdminInstructors()
      setInstructors(data.data || [])
    } catch (error) {
      console.error('Error loading instructors:', error)
      toast.error('Failed to load instructors')
    } finally {
      setLoading(false)
    }
  }

  const filterInstructors = () => {
    if (!searchTerm) {
      setFilteredInstructors(instructors)
    } else {
      const filtered = instructors.filter(instructor =>
        `${instructor.firstName} ${instructor.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instructor.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredInstructors(filtered)
    }
  }

  const handleViewProfile = (instructor: Instructor) => {
    setSelectedInstructor(instructor)
    setShowProfileModal(true)
  }

  const toggleInstructorStatus = async (instructorId: string, currentStatus: boolean) => {
    try {
      await api.toggleInstructorStatus(instructorId)
      toast.success(`Instructor ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
      loadInstructors()
    } catch (error) {
      console.error('Error updating instructor status:', error)
      toast.error('Failed to update instructor status')
    }
  }

  const resetInstructorPassword = async (instructor: Instructor) => {
    const instructorId = instructor.id
    const fullName = `${instructor.firstName} ${instructor.lastName}`.trim()
    const confirmed = window.confirm(`Reset password for ${fullName}?`)
    if (!confirmed) return

    try {
      setResettingInstructorId(instructorId)
      const response = await api.resetInstructorPassword(instructorId)
      const tempPassword = response?.data?.newPassword || response?.temporaryPassword
      toast.success(
        tempPassword
          ? `Password reset. Temporary password: ${tempPassword}`
          : 'Instructor password reset successfully'
      )
    } catch (error) {
      console.error('Error resetting instructor password:', error)
      toast.error('Failed to reset instructor password')
    } finally {
      setResettingInstructorId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Instructors Management
            </CardTitle>
            <Button onClick={() => setShowCreateModal(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Instructor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search instructors by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Instructors List */}
          {filteredInstructors.length > 0 ? (
            <div className="space-y-4">
              {filteredInstructors.map((instructor) => (
                <div key={instructor.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-lg">
                          {instructor.firstName.charAt(0)}{instructor.lastName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {instructor.firstName} {instructor.lastName}
                          </h3>
                          <Badge className={instructor.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {instructor.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{instructor.email}</p>
                        {instructor.phone && (
                          <p className="text-sm text-gray-500">{instructor.phone}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <AcademicCapIcon className="h-4 w-4" />
                            {instructor.stats.totalBatches} batches
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {instructor.stats.totalClasses} classes
                          </span>
                          <span>Joined {new Date(instructor.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewProfile(instructor)}
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleInstructorStatus(instructor.id, instructor.isActive)}
                        className={instructor.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                      >
                        {instructor.isActive ? (
                          <>
                            <XCircleIcon className="h-4 w-4 mr-1" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            Activate
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resettingInstructorId === instructor.id}
                        onClick={() => resetInstructorPassword(instructor)}
                      >
                        <KeyIcon className="h-4 w-4 mr-1" />
                        {resettingInstructorId === instructor.id ? 'Resetting...' : 'Reset Password'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No instructors found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try a different search term' : 'Get started by creating your first instructor.'}
              </p>
              {!searchTerm && (
                <div className="mt-6">
                  <Button onClick={() => setShowCreateModal(true)}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Instructor
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateInstructorModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadInstructors}
      />

      <InstructorProfileModal
        instructor={selectedInstructor}
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false)
          setSelectedInstructor(null)
        }}
      />
    </div>
  )
}


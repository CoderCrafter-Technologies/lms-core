'use client'

import { useAuth } from '../../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { StudentModal } from '@/components/modals/studentModalProps'
import { PasswordResetModal } from '@/components/modals/PasswordResetModal'
import { toast } from 'sonner'
import { DeactivateModal } from '@/components/modals/AccountDeactivationModal'
import { ArrowLeft, Edit, AlertCircle, Lock, Calendar, Mail, Phone, User, CheckCircle, XCircle, Clock, BookOpen, Users, Shield, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function StudentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth()
  const router = useRouter()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null)
  const [availableCourses, setAvailableCourses] = useState([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [enrollments, setEnrollments] = useState([])
  const [activeTab, setActiveTab] = useState('courses')
  const [isRemoving, setIsRemoving] = useState(false)

  const fetchStudent = async () => {
    try {
      setLoading(true)
      const data = await api.getStudentById(id as string)
      setStudent(data.data)
    } catch (err) {
      setError(err.message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  };

  const fetchEnrollments = async () => {
    try {
      const data = await api.getStudentEnrollments(id as string)
      setEnrollments(data.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchCourses = async () => {
    try {
      let jsonData = await api.getCourses();
      setAvailableCourses(jsonData.data)
    } catch(err) {
      console.log(err);
    }
  }

  const handleRemoveEnrollment = async (enrollment) => {
    try {
      setIsRemoving(true)
      await api.deleteEnrollment(enrollment.id || enrollment.id)
      
      toast.success('Enrollment removed successfully')
      fetchEnrollments() // Refresh the list
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsRemoving(false)
    }
  }

  useEffect(() => {
    fetchStudent();
    fetchCourses();
    fetchEnrollments();
  }, [id])

  if (!user || (user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER' && user.role.name !== 'INSTRUCTOR')) {
    return (
      <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        <div 
          className="border rounded-lg p-6 text-center"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)'
          }}
        >
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            Access Restricted
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            You don't have permission to view student details.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="flex justify-center items-center h-64">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
            style={{ borderColor: 'var(--color-primary)' }}
          ></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        <div 
          className="border rounded-lg p-6 text-center"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-error)'
          }}
        >
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            Error Loading Student
          </h2>
          <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {error}
          </p>
          <button 
            onClick={() => router.push('/dashboard/students')}
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }}
          >
            Back to Students
          </button>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        <div 
          className="border rounded-lg p-6 text-center"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)'
          }}
        >
          <div className="text-4xl mb-4">👤</div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            Student Not Found
          </h2>
          <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            The requested student could not be found.
          </p>
          <button 
            onClick={() => router.push('/dashboard/students')}
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }}
          >
            Back to Students
          </button>
        </div>
      </div>
    )
  }

  // Group enrollments by course
  const courseEnrollments = enrollments.reduce((acc, enrollment) => {
    const courseId = enrollment.courseId._id
    if (!acc[courseId]) {
      acc[courseId] = {
        course: enrollment.courseId,
        batches: []
      }
    }
    acc[courseId].batches.push(enrollment.batchId)
    return acc
  }, {})

  const getStatusBadge = (isActive) => {
    return isActive ? 'badge-green' : 'badge-red'
  }

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              Student Details
            </h1>
            <div className="flex items-center mt-2">
              <Link 
                href="/dashboard/students" 
                className="inline-flex items-center gap-1 text-sm transition-colors hover:opacity-80"
                style={{ color: 'var(--color-primary)' }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Students
              </Link>
            </div>
          </div>
          {user?.role.name === 'ADMIN' && (
            <button 
              onClick={() => {
                setShowStudentModal(true)
                setCurrentStudent(student);
              }} 
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }}
            >
              <Edit className="h-4 w-4" />
              Edit Student
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Profile Card */}
        <div className="lg:col-span-1">
          <div 
            className="rounded-lg shadow-sm overflow-hidden"
            style={{ 
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-card-border)'
            }}
          >
            <div className="p-6">
              <div className="flex flex-col items-center">
                <div 
                  className="h-32 w-32 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'var(--color-primary-light)' }}
                >
                  {student.avatar?.url ? (
                    <img 
                      src={student.avatar.url} 
                      alt={`${student.firstName} ${student.lastName}`}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl" style={{ color: 'var(--color-primary)' }}>
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {student.firstName} {student.lastName}
                </h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>{student.email}</p>
                
                <span 
                  className={`mt-4 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(student.isActive)}`}
                >
                  {student.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div 
              className="border-t px-6 py-4"
              style={{ borderColor: 'var(--color-card-border-inner)' }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Role</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{student.roleId.name}</p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Email Verified</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {student.isEmailVerified ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Last Login</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {student.lastLogin ? format(new Date(student.lastLogin), 'MMM d, yyyy HH:mm') : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Member Since</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {format(new Date(student.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Student Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div 
            className="rounded-lg shadow-sm overflow-hidden"
            style={{ 
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-card-border)'
            }}
          >
            <div 
              className="p-6 border-b"
              style={{ borderColor: 'var(--color-card-border-inner)' }}
            >
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                Personal Information
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <User className="h-3 w-3 inline mr-1" />
                    First Name
                  </p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{student.firstName}</p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <User className="h-3 w-3 inline mr-1" />
                    Last Name
                  </p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{student.lastName}</p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Mail className="h-3 w-3 inline mr-1" />
                    Email
                  </p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{student.email}</p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Phone className="h-3 w-3 inline mr-1" />
                    Phone
                  </p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {student.phone || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Activity className="h-3 w-3 inline mr-1" />
                    Account Status
                  </p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {student.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <CheckCircle className="h-3 w-3 inline mr-1" />
                    Email Verification
                  </p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {student.isEmailVerified ? 'Verified' : 'Pending'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Enrollment Management Section */}
          <div 
            className="rounded-lg shadow-sm overflow-hidden"
            style={{ 
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-card-border)'
            }}
          >
            <div 
              className="border-b"
              style={{ borderColor: 'var(--color-card-border-inner)' }}
            >
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('courses')}
                  className={cn(
                    "py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors",
                    activeTab === 'courses' ? 'border-primary' : 'border-transparent'
                  )}
                  style={{
                    color: activeTab === 'courses' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    borderColor: activeTab === 'courses' ? 'var(--color-primary)' : 'transparent'
                  }}
                >
                  Enrolled Courses
                </button>
                <button
                  onClick={() => setActiveTab('batches')}
                  className={cn(
                    "py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors",
                    activeTab === 'batches' ? 'border-primary' : 'border-transparent'
                  )}
                  style={{
                    color: activeTab === 'batches' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    borderColor: activeTab === 'batches' ? 'var(--color-primary)' : 'transparent'
                  }}
                >
                  Enrolled Batches
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'courses' ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                    <BookOpen className="h-5 w-5 inline mr-2" />
                    Courses
                  </h3>
                  {Object.keys(courseEnrollments).length > 0 ? (
                    <div className="space-y-4">
                      {Object.values(courseEnrollments).map(({course, batches}) => (
                        <div 
                          key={course._id} 
                          className="border rounded-lg p-4"
                          style={{ 
                            borderColor: 'var(--color-border)',
                            backgroundColor: 'var(--color-surface)'
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>{course.title}</h4>
                              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                Enrolled in {batches.length} batch{batches.length !== 1 ? 'es' : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveEnrollment(
                                enrollments.find(e => e.courseId._id === course._id)
                              )}
                              disabled={isRemoving}
                              className="px-3 py-1 text-sm rounded transition-colors"
                              style={{ 
                                backgroundColor: 'var(--color-error-light)',
                                color: 'var(--color-error)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-error)'
                                e.currentTarget.style.color = 'white'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-error-light)'
                                e.currentTarget.style.color = 'var(--color-error)'
                              }}
                            >
                              {isRemoving ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                      <p>No course enrollments found</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                    <Users className="h-5 w-5 inline mr-2" />
                    Batches
                  </h3>
                  {enrollments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y" style={{ borderColor: 'var(--color-border)' }}>
                        <thead style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Course</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Batch</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Schedule</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                          {enrollments.map((enrollment) => (
                            <tr key={enrollment._id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                  {enrollment.courseId.title}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm" style={{ color: 'var(--color-text)' }}>
                                  {enrollment.batchId.name}
                                </div>
                                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                  {enrollment.batchId.batchCode}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm" style={{ color: 'var(--color-text)' }}>
                                  {format(new Date(enrollment.batchId.startDate), 'MMM d, yyyy')} - {format(new Date(enrollment.batchId.endDate), 'MMM d, yyyy')}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleRemoveEnrollment(enrollment )}
                                  disabled={isRemoving}
                                  className="transition-colors hover:opacity-80"
                                  style={{ color: 'var(--color-error)' }}
                                >
                                  {isRemoving ? 'Removing...' : 'Remove'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                      <p>No batch enrollments found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Account Security */}
          <div 
            className="rounded-lg shadow-sm overflow-hidden"
            style={{ 
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-card-border)'
            }}
          >
            <div 
              className="p-6 border-b"
              style={{ borderColor: 'var(--color-card-border-inner)' }}
            >
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                <Shield className="h-5 w-5 inline mr-2" />
                Account Security
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Password Last Changed
                  </p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {student.updatedAt ? format(new Date(student.updatedAt), 'MMM d, yyyy') : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Activity className="h-3 w-3 inline mr-1" />
                    Login Attempts
                  </p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {student.loginAttempts || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Lock className="h-3 w-3 inline mr-1" />
                    Account Locked
                  </p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {student.lockUntil ? 'Yes' : 'No'}
                  </p>
                </div>
                {student.lockUntil && (
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      <Clock className="h-3 w-3 inline mr-1" />
                      Locked Until
                    </p>
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                      {format(new Date(student.lockUntil), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Actions */}
          {user?.role.name === 'ADMIN' && (
            <div className="flex justify-end space-x-4">
              <button 
                onClick={() => {
                  setCurrentStudent(student);
                  setShowResetModal(true);
                }} 
                className="px-4 py-2 text-white rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-warning)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-warning-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-warning)'
                }}
              >
                Reset Password
              </button>
              <button 
                onClick={() => {
                  setCurrentStudent(student);
                  setShowDeactivateModal(true);
                }} 
                className="px-4 py-2 text-white rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-error)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error)'
                }}
              >
                {student.isActive ? 'Deactivate Account' : 'Activate Account'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <StudentModal
        isOpen={showStudentModal}
        onClose={() => setShowStudentModal(false)}
        student={currentStudent}
        courses={availableCourses}
        onSuccess={(updatedStudent) => {
          setStudent(updatedStudent)
          setShowStudentModal(false)
        }}
      />

      {showResetModal && (
        <PasswordResetModal
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          student={currentStudent}
          onPasswordReset={(newPassword) => {
            toast.info(`New password: ${newPassword}`, { duration: 10000 })
          }}
        />
      )}

      {showDeactivateModal && (
        <DeactivateModal
          isOpen={showDeactivateModal}
          onClose={() => setShowDeactivateModal(false)}
          student={currentStudent}
          onDeactivate={() => {
            fetchStudent() // Refresh student data
          }}
        />
      )}
    </div>
  )
}


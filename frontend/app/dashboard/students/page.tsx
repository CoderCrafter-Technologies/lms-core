'use client'

import { useAuth } from '../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { StudentModal } from '@/components/modals/studentModalProps'
import { Plus, Users, CheckCircle, Clock, BookOpen, Search, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Enrollment {
  id: string
  courseId: string
  studentId: string
  status: string
  createdAt: string
  updatedAt: string
}

interface Student {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  isActive: boolean
  status: 'active' | 'pending' | 'inactive'
  createdAt: string
  avatar?: string | { url?: string }
}

interface Course {
  id: string
  title: string
  description: string
  status: string
}

export default function StudentsPage() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [enrollmentsLoading, setEnrollmentsLoading] = useState<Record<string, boolean>>({})
  const [studentEnrollments, setStudentEnrollments] = useState<Record<string, Enrollment[]>>({})
  const router = useRouter()
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null)
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [failedAvatarIds, setFailedAvatarIds] = useState<Record<string, boolean>>({})
  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '')

  const getStudentAvatarUrl = (student: Student): string => {
    const rawAvatar = typeof student.avatar === 'string' ? student.avatar : student.avatar?.url
    if (!rawAvatar || typeof rawAvatar !== 'string') return ''

    if (/^https?:\/\//i.test(rawAvatar) || rawAvatar.startsWith('data:')) {
      return rawAvatar
    }

    if (rawAvatar.startsWith('/uploads/')) {
      return rawAvatar
    }

    if (rawAvatar.startsWith('uploads/')) {
      return `/${rawAvatar}`
    }

    if (rawAvatar.startsWith('/')) {
      return apiOrigin ? `${apiOrigin}${rawAvatar}` : rawAvatar
    }

    return apiOrigin ? `${apiOrigin}/${rawAvatar}` : rawAvatar
  }

  // Check permissions
  const canManageStudents = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER' || user?.role.name === 'INSTRUCTOR'

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const jsonData = await api.getStudents()
      setStudents(jsonData.data || [])
      setFilteredStudents(jsonData.data || [])
    } catch (err) {
      console.error('Error fetching students:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchEnrollmentsForStudent = async (studentId: string) => {
    try {
      setEnrollmentsLoading(prev => ({ ...prev, [studentId]: true }))
      const data = await api.getStudentEnrollments(studentId)
      setStudentEnrollments(prev => ({
        ...prev,
        [studentId]: data.data || []
      }))
    } catch (err) {
      console.error(`Error fetching enrollments for student ${studentId}:`, err)
      setStudentEnrollments(prev => ({
        ...prev,
        [studentId]: []
      }))
    } finally {
      setEnrollmentsLoading(prev => ({ ...prev, [studentId]: false }))
    }
  }

  // Apply filters and search
  useEffect(() => {
    let result = students
    
    // Apply status filter
    if (filter !== 'all') {
      result = result.filter(student => student.status === filter)
    }
    
    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(student => 
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        (student.phone?.toLowerCase() || '').includes(term)
      )
    }
    
    setFilteredStudents(result)
  }, [students, filter, searchTerm])

  const fetchCourses = async () => {
    try {
      const jsonData = await api.getCourses()
      setAvailableCourses(jsonData.data || [])
    } catch (err) {
      console.error('Error fetching courses:', err)
    }
  }

  useEffect(() => {
    fetchStudents()
    fetchCourses()
  }, [])

  // Fetch enrollments when students are loaded
  useEffect(() => {
    if (students.length > 0 && !loading) {
      students.forEach(student => {
        if (!studentEnrollments[student.id]) {
          fetchEnrollmentsForStudent(student.id)
        }
      })
    }
  }, [students, loading, studentEnrollments])

  // Calculate enrolled students count based on enrollments data
  const enrolledStudentsCount = Object.values(studentEnrollments).filter(
    (enrollments): enrollments is Enrollment[] => Array.isArray(enrollments) && enrollments.length > 0
  ).length

  const stats = [
    { 
      label: 'Total Students', 
      value: students.length, 
      icon: Users, 
      borderColor: 'var(--color-primary)',
      iconBg: 'var(--color-primary-light)'
    },
    { 
      label: 'Active Students', 
      value: students.filter(s => s.isActive).length, 
      icon: CheckCircle, 
      borderColor: 'var(--color-success)',
      iconBg: 'var(--color-success-light)'
    },
    { 
      label: 'Pending Approval', 
      value: students.filter(s => s.status === 'pending').length, 
      icon: Clock, 
      borderColor: 'var(--color-warning)',
      iconBg: 'var(--color-warning-light)'
    },
    { 
      label: 'Enrolled', 
      value: enrolledStudentsCount, 
      icon: BookOpen, 
      borderColor: 'var(--color-purple-500)',
      iconBg: 'rgba(168, 85, 247, 0.15)'
    },
  ]

  if (!canManageStudents) {
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
            You don't have permission to access student management.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-8 py-2 md:py-7 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              Students 
            </h1>
            <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              Manage student enrollments and progress
            </p>
          </div>
          {user?.role.name === 'ADMIN' && (
            <button 
              onClick={() => {  
                setCurrentStudent(null)
                setShowStudentModal(true)
              }} 
              className="px-4 flex items-center gap-2 py-2 text-white rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }}
            >
              <Plus className='w-4 h-4' />
              Add Student
            </button>
          )}
        </div>
      </div>

      {/* Student Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div 
              key={index}
              className="p-6 rounded-lg shadow-sm border-l-4"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderLeftColor: stat.borderColor,
                borderTop: '1px solid var(--color-card-border)',
                borderRight: '1px solid var(--color-card-border)',
                borderBottom: '1px solid var(--color-card-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {stat.value}
                  </p>
                </div>
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: stat.iconBg }}
                >
                  <Icon className="w-6 h-6" style={{ color: stat.borderColor }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter and Search */}
      <div 
        className="rounded-lg border mb-6 p-6"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
            <input
              type="text"
              placeholder="Search students..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
            <select
              className="px-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <option value="all">All Students</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div 
        className="rounded-lg border overflow-hidden"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}
      >
        {loading ? (
          <div className="p-12 text-center">
            <div 
              className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mx-auto"
              style={{ borderColor: 'var(--color-primary)' }}
            ></div>
            <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>Loading students...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">😕</div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              No students found
            </h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {searchTerm ? 'Try a different search term' : 'No students match the current filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y" style={{ borderColor: 'var(--color-border)' }}>
              <thead style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                <tr>
                  {['Name', 'Email', 'Phone', 'Status', 'Enrollments', 'Joined', 'Actions'].map((header) => (
                    <th 
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {filteredStudents.map((student) => (
                  <tr 
                    key={student.id} 
                    className="transition-colors hover:bg-surface-hover"
                    style={{ backgroundColor: 'var(--color-surface)' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const avatarUrl = getStudentAvatarUrl(student)
                        const hasAvatar = !!avatarUrl && !failedAvatarIds[student.id]
                        return (
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                          {hasAvatar ? (
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={avatarUrl}
                              alt={`${student.firstName} ${student.lastName}`}
                              onError={() => setFailedAvatarIds((prev) => ({ ...prev, [student.id]: true }))}
                            />
                          ) : (
                            <span style={{ color: 'var(--color-primary)' }}>
                              {student.firstName?.charAt(0).toUpperCase()}
                              {student.lastName?.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {student.email}
                          </div>
                        </div>
                      </div>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {student.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {student.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          student.isActive ? 'badge-green' :
                          student.status === 'pending' ? 'badge-yellow' :
                          'badge-red'
                        }`}
                      >
                        {student.isActive ? 'active' : student.status || 'inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {enrollmentsLoading[student.id] ? (
                        <span style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span>
                      ) : studentEnrollments[student.id]?.length > 0 ? (
                        <span style={{ color: 'var(--color-success)' }}>
                          {studentEnrollments[student.id].length} courses
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-tertiary)' }}>Not enrolled</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {format(new Date(student.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => router.push(`/dashboard/students/${student.id}`)} 
                        className="mr-4 transition-colors hover:opacity-80"
                        style={{ color: 'var(--color-primary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none'
                        }}
                      >
                        View
                      </button>
                      {user?.role.name === 'ADMIN' && (
                        <button 
                          onClick={() => {
                            setShowStudentModal(true)
                            setCurrentStudent(student)
                          }} 
                          className="transition-colors hover:opacity-80"
                          style={{ color: 'var(--color-warning)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none'
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentModal
        isOpen={showStudentModal}
        onClose={() => setShowStudentModal(false)}
        student={currentStudent}
        courses={availableCourses}
        onSuccess={(updatedStudent) => {
          if (currentStudent) {
            // Update existing student
            setStudents(prev => prev.map(s => 
              s.id === updatedStudent.id ? updatedStudent : s
            ))
            // Refresh enrollments if student was updated
            fetchEnrollmentsForStudent(updatedStudent.id)
          } else {
            // Add new student
            setStudents(prev => [...prev, updatedStudent])
          }
          setShowStudentModal(false)
        }}
      />
    </div>
  )
}


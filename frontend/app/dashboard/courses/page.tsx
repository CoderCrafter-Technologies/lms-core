'use client'

import { useAuth } from '../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'
import { CourseCreationWizard } from '../../../components/modals/CourseCreationWizard'
import { BatchCreationModal } from '../../../components/modals/BatchCreationModal'
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CircleCheckBig, FolderKanban, Plus, SquarePen, Users } from 'lucide-react'

export default function CoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateWizard, setShowCreateWizard] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<any>(null)
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const router = useRouter()

  const isAdmin = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'
  const isStudent = user?.role.name === 'STUDENT'
  const isInstructor = user?.role.name === 'INSTRUCTOR'
  const canCreateCourse = isAdmin

  const normalizeProgress = (enrollment: any) => {
    const progress = enrollment?.progress
    if (typeof progress === 'number') {
      return {
        completionPercentage: progress,
        completedClasses: enrollment?.completedClasses || 0,
        totalClasses: enrollment?.totalClasses || 0
      }
    }

    return {
      completionPercentage: progress?.completionPercentage || 0,
      completedClasses: progress?.completedClasses || 0,
      totalClasses: progress?.totalClasses || 0
    }
  }

  const fetchCourses = async () => {
    if(!isAdmin) return;
    try {
      setLoading(true)
      const response = await api.getCourses()
      setCourses(response?.data || [])
    } catch (err) {
      console.error('Error fetching courses:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchEnrolledCourses = async () => {
    if (!isStudent && !isInstructor) return;
    
    try {
      setEnrollmentsLoading(true);
      const response = isStudent
        ? await api.getStudentEnrollments(user.id)
        : await api.getInstructorMyCourses()
      setEnrolledCourses(response?.data || []);
      
    } catch (err) {
      console.error('Error fetching enrolled courses:', err);
    } finally {
      setEnrollmentsLoading(false);
    }
  }

  const handleCourseCreated = async (newCourse: any) => {
    setCourses(prev => [newCourse, ...prev]);
    setShowCreateWizard(false);
  }

  const handleCreateBatch = (course: any) => {
    setSelectedCourse(course)
    setShowBatchModal(true)
  }

  const handleBatchCreated = (newBatch: any) => {
    setBatches(prev => [...prev, newBatch])
    setShowBatchModal(false)
    setSelectedCourse(null)
  }

  useEffect(() => {
    fetchCourses()
    if (isStudent || isInstructor) {
      fetchEnrolledCourses()
    }
  }, [user?.id])

  // Normalize data for different roles
  const getDisplayCourses = () => {
    if (isStudent) {
      // For students, use enrolled courses and extract course info
      return enrolledCourses.map(enrollment => ({
        ...enrollment.courseId,
        enrollment: enrollment,
        batch: enrollment.batchId
      }))
    } else if (isInstructor) {
      // For instructors, use their batches and extract course info
      return enrolledCourses.map(batch => ({
        ...batch.courseId,
        batch: batch
      }))
    } else {
      // For admin, filter the courses based on filters
      return courses.filter(course => {
        if (filter === 'all') return true
        if (filter === 'published') return course.status === 'PUBLISHED'
        if (filter === 'draft') return course.status === 'DRAFT'
        if (filter === 'my-courses') return course.instructorId === user?.id
        return true
      }).filter(course => {
        if (!searchTerm) return true
        const term = searchTerm.toLowerCase()
        return (
          course.title?.toLowerCase().includes(term) ||
          course.description?.toLowerCase().includes(term) ||
          course.category?.toLowerCase().includes(term)
        )
      })
    }
  }

  const displayCourses = getDisplayCourses()

  // Get stats based on role
  const getTotalEnrolledCount = () => {
    if (isStudent || isInstructor) {
      return enrolledCourses.length
    }
    return courses.reduce((sum, course) => sum + (course.enrollmentCount || 0), 0)
  }

  const getInProgressCount = () => {
    if (isStudent) {
      return enrolledCourses.filter((e: any) => e.status === 'ENROLLED' || e.status === 'IN_PROGRESS').length
    }
    return 0
  }

  const getCompletedCount = () => {
    if (isStudent) {
      return enrolledCourses.filter((e: any) => e.status === 'COMPLETED').length
    }
    return 0
  }

  // Helper function to get status badge styles
  const getStatusBadgeStyles = (status: string, type: string = 'default') => {
    const baseStyles = "px-2 py-1 text-xs font-semibold rounded-full";
    
    const styles = {
      'ENROLLED': {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: 'rgb(34, 197, 94)'
      },
      'active': {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: 'rgb(34, 197, 94)'
      },
      'completed': {
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        color: 'rgb(168, 85, 247)'
      },
      'COMPLETED': {
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        color: 'rgb(168, 85, 247)'
      },
      'ACTIVE': {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: 'rgb(34, 197, 94)'
      },
      'PUBLISHED': {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: 'rgb(34, 197, 94)'
      },
      'DRAFT': {
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        color: 'rgb(234, 179, 8)'
      },
      'default': {
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        color: 'rgb(234, 179, 8)'
      }
    };

    return { ...styles[status as keyof typeof styles] || styles.default, className: baseStyles };
  }

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-8 border-b py-2 md:py-7" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {isStudent ? 'My Courses' : isInstructor ? 'My Batches' : 'Courses'} 
            </h1>
            <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              {isStudent 
                ? 'Track your learning progress and access course materials'
                : isInstructor
                ? 'Manage your teaching batches and courses'
                : 'Manage and create courses'
              }
            </p>
          </div>
          {canCreateCourse && (
            <button 
              onClick={() => setShowCreateWizard(true)}
              className="px-1 md:px-4 py-2 flex items-center gap-0 md:gap-1 text-sm text-white rounded-md transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Plus className='w-4 h-4' /> Create Course
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-6 rounded-lg shadow border-l-4 border-blue-500" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total Courses</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{courses.length}</p>
              </div>
              <div className="text-blue-500 text-2xl"><FolderKanban /></div>
            </div>
          </div>

          <div className="p-6 rounded-lg shadow border-l-4 border-green-500" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Published</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {courses.filter(c => c.status === 'PUBLISHED').length}
                </p>
              </div>
              <div className="text-green-500 text-2xl"><CircleCheckBig /></div>
            </div>
          </div>

          <div className="p-6 rounded-lg shadow border-l-4 border-yellow-500" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Draft</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {courses.filter(c => c.status === 'DRAFT').length}
                </p>
              </div>
              <div className="text-yellow-500 text-2xl"><SquarePen /></div>
            </div>
          </div>

          <div className="p-6 rounded-lg shadow border-l-4 border-purple-500" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Enrolled Students</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {getTotalEnrolledCount()}
                </p>
              </div>
              <div className="text-purple-500 text-2xl"><Users /></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 rounded-lg shadow border-l-4 border-blue-500" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {isInstructor ? 'Total Batches' : 'Total Enrolled'}
                </p>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {getTotalEnrolledCount()}
                </p>
              </div>
              <div className="text-blue-500 text-2xl">📚</div>
            </div>
          </div>

          {isStudent && (
            <div className="p-6 rounded-lg shadow border-l-4 border-green-500" style={{ backgroundColor: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>In Progress</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {getInProgressCount()}
                  </p>
                </div>
                <div className="text-green-500 text-2xl">⏳</div>
              </div>
            </div>
          )}

          {isStudent && (
            <div className="p-6 rounded-lg shadow border-l-4 border-purple-500" style={{ backgroundColor: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Completed</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {getCompletedCount()}
                  </p>
                </div>
                <div className="text-purple-500 text-2xl">✅</div>
              </div>
            </div>
          )}

          {isInstructor && (
            <div className="p-6 rounded-lg shadow border-l-4 border-green-500" style={{ backgroundColor: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Active Students</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {enrolledCourses.reduce((sum, batch) => sum + (batch.currentEnrollment || 0), 0)}
                  </p>
                </div>
                <div className="text-green-500 text-2xl">👥</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters and Search - Only show for admin */}
      {isAdmin && (
        <div className="rounded-lg border p-6 mb-8" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search courses..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="px-6 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All Courses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="my-courses">My Courses</option>
              </select>
              <select 
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
              >
                <option value="all">All Categories</option>
                {[...new Set(courses.map(c => c.category))].map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Courses List */}
      <div className="rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {isStudent ? 'My Learning Dashboard' : 
             isInstructor ? 'My Teaching Batches' :
             filter === 'all' ? 'All Courses' : 
             filter === 'published' ? 'Published Courses' :
             filter === 'draft' ? 'Draft Courses' : 'My Courses'}
          </h2>
        </div>
        
        {loading || ((isStudent || isInstructor) && enrollmentsLoading) ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mx-auto" style={{ borderColor: 'var(--color-primary)' }}></div>
            <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>
              {isStudent ? 'Loading your courses...' : 
               isInstructor ? 'Loading your batches...' : 
               'Loading courses...'}
            </p>
          </div>
        ) : displayCourses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              {isStudent 
                ? "You're not enrolled in any courses yet"
                : isInstructor
                ? "You don't have any teaching batches yet"
                : "No courses found"}
            </h3>
            <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              {isStudent
                ? "Browse our course catalog to find something interesting!"
                : isInstructor
                ? "Contact admin to get assigned to courses"
                : canCreateCourse 
                  ? "Get started by creating your first course"
                  : "No courses are available yet. Check back later!"}
            </p>
            {isStudent ? (
              <Link 
                href="/courses"
                className="px-6 py-3 text-white rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Browse Courses
              </Link>
            ) : canCreateCourse && (
              <button 
                onClick={() => setShowCreateWizard(true)}
                className="px-6 py-3 text-white rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Create First Course
              </button>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayCourses.map((course) => {
                const enrollment = isStudent ? course.enrollment : null
                const batch = isInstructor ? course.batch : (isStudent ? course.batch : null)

                // Calculate progress percentage safely
                const progressData = normalizeProgress(enrollment)
                const progressPercentage = progressData.completionPercentage
                const completedClasses = progressData.completedClasses
                const totalClasses = progressData.totalClasses

                // Determine status for badges
                let statusText = '';
                let statusType = 'default';
                
                if (isStudent && enrollment) {
                  statusText = enrollment.status;
                  statusType = enrollment.status === 'COMPLETED' ? 'COMPLETED' : 'ENROLLED';
                } else if (isInstructor && batch) {
                  statusText = batch.status;
                  statusType = batch.status === 'ACTIVE' ? 'ACTIVE' : 'default';
                } else {
                  statusText = course.status;
                  statusType = course.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
                }

                const categoryStyles = getStatusBadgeStyles(course.category, 'category');
                const statusStyles = getStatusBadgeStyles(statusType);

                return (
                  <div 
                    key={course.id} 
                    className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
                    style={{ 
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface)'
                    }}
                  >
                    {/* Course Image */}
                    {course.thumbnail && (
                      <img
                        src={course.thumbnail.url || course.thumbnail}
                        alt={course.title}
                        className="w-full h-32 object-cover rounded-lg mb-4"
                      />
                    )}
                    
                    <div className="flex items-center justify-between mb-4">
                      <span 
                        className="px-2 py-1 text-xs font-semibold rounded-full"
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          color: 'rgb(59, 130, 246)'
                        }}
                      >
                        {course.category?.replace('_', ' ')}
                      </span>
                      <span 
                        className="px-2 py-1 text-xs font-semibold rounded-full"
                        style={statusStyles}
                      >
                        {statusText}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                      {course.title}
                    </h3>
                    
                    {isInstructor && batch && (
                      <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Batch: {batch.name} ({batch.batchCode})
                      </p>
                    )}
                    
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                      {course.shortDescription || course.description?.substring(0, 100) + '...'}
                    </p>
                    
                    {/* Progress bar for students */}
                    {isStudent && enrollment && (
                      <>
                        <div className="w-full rounded-full h-2.5 mb-4" style={{ backgroundColor: 'var(--color-secondary)' }}>
                          <div 
                            className="h-2.5 rounded-full transition-all"
                            style={{ 
                              width: `${progressPercentage}%`,
                              backgroundColor: 'var(--color-primary)'
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                          <span>{progressPercentage}% Complete</span>
                          <span>{completedClasses}/{totalClasses} Classes</span>
                        </div>
                      </>
                    )}
                    
                    {/* Batch info for instructors */}
                    {isInstructor && batch && (
                      <div className="flex items-center justify-between text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                        <span>👥 {batch.currentEnrollment || 0} students</span>
                        <span>📅 {new Date(batch.startDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {/* Admin stats */}
                    {isAdmin && (
                      <div className="flex items-center justify-between text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                        <span>👥 {course.enrollmentCount || 0} students</span>
                        <span>📦 {course.batches?.length || 0} batches</span>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        {isStudent || isInstructor ? (
                          <button 
                            onClick={() => isStudent ? router.push(`/dashboard/courses/track/${enrollment.id || enrollment._id}`) : router.push(`/dashboard/courses/${course.id}`)}
                            className="flex-1 px-3 py-2 text-white text-sm rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                          >
                            {progressPercentage > 0 ? 'Continue' : 'Start'}
                          </button>
                        )  : (
                          <>
                            <button 
                              onClick={() => handleCreateBatch(course)}
                              className="flex-1 px-3 py-2 text-white text-sm rounded-lg transition-colors"
                              style={{ backgroundColor: 'var(--color-success)' }}
                            >
                              + Batch
                            </button>
                            <button 
                              onClick={() => router.push(`/dashboard/courses/${course.id || course._id}`)}
                              className="flex-1 px-3 py-2 text-white text-sm rounded-lg transition-colors"
                              style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                              Manage
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Course Creation Wizard */}
      <CourseCreationWizard
        isOpen={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onCourseCreated={handleCourseCreated}
      />

      {/* Batch Creation Modal */}
      {selectedCourse && (
        <BatchCreationModal
          isOpen={showBatchModal}
          onClose={() => {
            setShowBatchModal(false)
            setSelectedCourse(null)
          }}
          courseId={selectedCourse.id}
          courseName={selectedCourse.title}
          onBatchCreated={handleBatchCreated}
        />
      )}
    </div>
  )
}


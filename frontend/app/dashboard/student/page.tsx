'use client'

import { useAuth } from '../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Play,
  BookOpen,
  Clock,
  Users,
  Trophy,
  Calendar,
  BarChart,
  Video,
  User,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

// Dynamically import LiveClassRoom to avoid SSR issues
const LiveClassRoom = dynamic(() => import('../../../components/LiveClassRoom'), { ssr: false })

interface Enrollment {
  id: string
  courseId: {
    id: string
    title: string
    level: string
  }
  batchId: {
    id: string
    name: string
    currentEnrollment: number
  }
  progress: {
    completionPercentage: number
  }
  status: string
  enrollmentDate: string
}

interface LiveClass {
  id: string
  title: string
  batchId: {
    id: string
    name: string
  }
  instructorId: {
    id: string
    firstName: string
    lastName: string
  }
  scheduledStartTime: string
  scheduledEndTime: string
  status: string
  roomId: string
  description?: string
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
  const [upcomingClasses, setUpcomingClasses] = useState<LiveClass[]>([])
  const [ongoingClasses, setOngoingClasses] = useState<LiveClass[]>([])
  const [stats, setStats] = useState({
    enrolledCourses: 0,
    completedCourses: 0,
    upcomingClasses: 0,
    assignmentsDue: 0,
    totalHours: 0,
    averageGrade: 0
  })
  const [selectedClass, setSelectedClass] = useState<LiveClass | null>(null)
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadStudentData()
  }, [])

  const loadStudentData = async () => {
    try {
      // Load enrollments
      const enrollmentsResponse = await api.getStudentsMyEnrollments()
      let enrollmentsData: Enrollment[] = enrollmentsResponse?.data || []
      setEnrollments(enrollmentsData)

      // Load live classes using the correct API
      const liveClassesResponse = await api.getStudentLiveClasses()
      let liveClassesData: LiveClass[] = liveClassesResponse?.data || []
      setLiveClasses(liveClassesData)

      // Load upcoming live classes
      const upcomingClassesResponse = await api.getStudentUpcomingClasses()
      let upcomingClassesData: LiveClass[] = upcomingClassesResponse?.data || []
      setUpcomingClasses(upcomingClassesData)

      // Filter ongoing classes from live classes
      const now = new Date()
      const ongoing = liveClassesData.filter((cls) => {
        const startTime = new Date(cls.scheduledStartTime)
        const endTime = new Date(cls.scheduledEndTime)
        return startTime <= now && endTime >= now && cls.status !== 'ENDED' && cls.status !== 'CANCELLED'
      })
      setOngoingClasses(ongoing)

      // Calculate stats using the fetched data
      calculateStats(enrollmentsData, upcomingClassesData)

    } catch (error) {
      console.error('Error loading student data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (enrollments: Enrollment[], classes: LiveClass[]) => {
    const now = new Date()
    const upcomingCount = classes.filter((cls) => 
      new Date(cls.scheduledStartTime) > now && cls.status === 'SCHEDULED'
    ).length

    const completedCourses = enrollments.filter((e) => e.status === 'COMPLETED').length

    setStats({
      enrolledCourses: enrollments.length,
      completedCourses,
      upcomingClasses: upcomingCount,
      assignmentsDue: 0,
      totalHours: 0,
      averageGrade: 0
    })
  }

  const joinLiveClass = async (liveClass: LiveClass) => {
    const now = new Date()
    const classStart = new Date(liveClass.scheduledStartTime)
    const classEnd = new Date(liveClass.scheduledEndTime)
    const joinAllowedFrom = new Date(classStart.getTime() - 10 * 60 * 1000)

    if (now < joinAllowedFrom) {
      toast.error('Class has not started yet. You can join 10 minutes before the scheduled time.')
      return
    }

    if (now > classEnd) {
      toast.error('This class has already ended.')
      return
    }

    setSelectedClass(liveClass)
  }

  const canJoinClass = (liveClass: LiveClass) => {
    const now = new Date()
    const classStart = new Date(liveClass.scheduledStartTime)
    const classEnd = new Date(liveClass.scheduledEndTime)
    const joinAllowedFrom = new Date(classStart.getTime() - 10 * 60 * 1000)
    return now >= joinAllowedFrom && now <= classEnd && liveClass.status !== 'CANCELLED'
  }

  const leaveLiveClass = () => {
    setSelectedClass(null)
  }

  if (selectedClass) {
    return (
      <LiveClassRoom
        classData={selectedClass}
        user={user}
        enrollmentId=""
        onLeave={leaveLiveClass}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    )
  }

  const statsCards = [
    {
      label: 'Enrolled Courses',
      value: stats.enrolledCourses,
      subtext: 'Active learning',
      icon: BookOpen,
      color: 'var(--color-primary)',
      bgColor: 'var(--color-primary-light)'
    },
    {
      label: 'Completed',
      value: stats.completedCourses,
      subtext: 'Courses finished',
      icon: Trophy,
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-light)'
    },
    {
      label: 'Upcoming Classes',
      value: stats.upcomingClasses,
      subtext: 'This week',
      icon: Clock,
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-light)'
    }
  ]

  return (
    <div className="flex-1 p-4 sm:p-6 w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-6 sm:mb-8 border-b py-2 sm:py-4 md:py-7" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold" style={{ color: 'var(--color-text)' }}>
          Dashboard 
        </h1>
        <p className="text-sm sm:text-base mt-1 sm:mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          Track your learning progress and upcoming classes
        </p>
      </div>

      {/* Student Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardContent className="flex items-center justify-between p-4 sm:p-6">
                <div className='space-y-1'>
                  <p className="text-xs sm:text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {stat.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {stat.value}
                  </p>
                  <p className="text-xs" style={{ color: stat.color }}>
                    {stat.subtext}
                  </p>
                </div>
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: stat.bgColor }}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: stat.color }} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Ongoing Classes */}
      {ongoingClasses.length > 0 && (
        <Card 
          className="mb-6 sm:mb-8 border"
          style={{ 
            borderColor: 'var(--color-error)',
            backgroundColor: 'var(--color-error-light)'
          }}
        >
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex flex-wrap items-center gap-2" style={{ color: 'var(--color-error)' }}>
              <div className="flex gap-1 items-center">
                <Video className="h-5 w-5 animate-pulse" />
                Live Classes - Join Now!
              </div>
              <Badge
                variant="destructive"
                className="ml-auto text-xs sm:text-sm"
              >
                {ongoingClasses.length} Active
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {ongoingClasses.map((liveClass) => (
                <div
                  key={liveClass.id}
                  className="rounded-lg p-3 sm:p-4 border"
                  style={{ 
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-error)'
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left Section */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                        {liveClass.title}
                      </h4>
                      <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {liveClass.batchId?.name || "Unknown Batch"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                        <span className="flex items-center gap-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                          <User className="w-3 h-3 flex-shrink-0" />
                          {liveClass.instructorId?.firstName}{" "}
                          {liveClass.instructorId?.lastName}
                        </span>
                        <span className="font-medium" style={{ color: 'var(--color-error)' }}>
                          🔴 LIVE NOW
                        </span>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>
                          Ends:{" "}
                          {new Date(liveClass.scheduledEndTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Right Section - Button */}
                    <div className="flex sm:justify-end">
                      <Button
                        onClick={() =>
                          router.push(`/classroom/${liveClass.roomId}`)
                        }
                        className="w-full sm:w-auto justify-center gap-2"
                        style={{ 
                          backgroundColor: 'var(--color-error)',
                          color: 'white'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-error-hover)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-error)'
                        }}
                      >
                        <Play className="w-4 h-4" />
                        Join Now
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Video className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              Live Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {liveClasses.length > 0 ? (
              <div className="space-y-4">
                {liveClasses.slice(0, 5).map((liveClass) => {
                  const isLive = liveClass.status === 'LIVE'
                  const isJoinable = canJoinClass(liveClass)
                  return (
                    <div
                      key={liveClass.id}
                      className="border rounded-lg p-4"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        {/* Left side content */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                            {liveClass.title}
                          </h4>
                          <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                            {liveClass.batchId?.name} • {liveClass.instructorId?.firstName}{" "}
                            {liveClass.instructorId?.lastName}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                            {new Date(liveClass.scheduledStartTime).toLocaleString()} -{" "}
                            {new Date(liveClass.scheduledEndTime).toLocaleTimeString()}
                          </p>
                        </div>

                        {/* Badge */}
                        <div className="flex sm:justify-end">
                          <Badge
                            variant={isLive ? "destructive" : (isJoinable ? "default" : "outline")}
                          >
                            {isLive ? 'LIVE' : (isJoinable ? 'JOIN OPEN' : liveClass.status)}
                          </Badge>
                        </div>
                      </div>

                      {/* Button */}
                      <div className="flex mt-3">
                        <Button
                          size="sm"
                          onClick={() => joinLiveClass(liveClass)}
                          disabled={!isJoinable}
                          className="flex items-center gap-1 w-full sm:w-auto justify-center"
                        >
                          <Play className="h-4 w-4" />
                          Join Class
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Video className="mx-auto h-12 w-12" style={{ color: 'var(--color-text-tertiary)' }} />
                <h3 className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  No live classes
                </h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Enroll in courses to see scheduled live classes
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Calendar className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              Upcoming Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingClasses.length > 0 ? (
              <div className="space-y-4">
                {upcomingClasses.slice(0, 6).map((classItem) => (
                  <div 
                    key={classItem.id} 
                    className="flex items-center p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--color-primary-light)' }}
                  >
                    <div className="flex-shrink-0 w-2 h-2 rounded-full mr-3" style={{ backgroundColor: 'var(--color-primary)' }}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {classItem.title}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(classItem.scheduledStartTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No classes scheduled
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                  Enroll in courses to see your schedule
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Courses & Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <BookOpen className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              My Courses ({enrollments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {enrollments.length > 0 ? (
              <div className="space-y-4">
                {enrollments.map((enrollment) => (
                  <div 
                    key={enrollment.id} 
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                          {enrollment.courseId?.title}
                        </h3>
                        <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                          Batch: {enrollment.batchId?.name}
                        </p>
                      </div>
                      <Badge variant={enrollment.status === 'COMPLETED' ? 'success' : 'secondary'}>
                        {enrollment.status}
                      </Badge>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs sm:text-sm" style={{ color: 'var(--color-text-secondary)' }}>Progress</span>
                        <span className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                          {enrollment.progress.completionPercentage || 0}%
                        </span>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                        <div 
                          className="h-2 rounded-full transition-all"
                          style={{ 
                            width: `${enrollment.progress.completionPercentage || 0}%`,
                            backgroundColor: 'var(--color-primary)'
                          }}
                        ></div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      View Course
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="mx-auto h-12 w-12" style={{ color: 'var(--color-text-tertiary)' }} />
                <h3 className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  No enrolled courses
                </h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Start your learning journey by enrolling in a course
                </p>
                <Button className="mt-4">
                  Explore Courses
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <BarChart className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              Learning Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {enrollments.length > 0 ? (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Overall Progress</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                      {Math.round(
                        enrollments.reduce((sum, e) => sum + (e.progress.completionPercentage || 0), 0) / 
                        enrollments.length
                      )}%
                    </span>
                  </div>
                  <div className="w-full rounded-full h-3" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                    <div 
                      className="h-3 rounded-full transition-all"
                      style={{ 
                        width: `${enrollments.reduce((sum, e) => sum + (e.progress.completionPercentage || 0), 0) / enrollments.length}%`,
                        background: 'linear-gradient(to right, var(--color-primary), var(--color-primary-hover))'
                      }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Course Breakdown
                  </h4>
                  {enrollments.map((enrollment) => (
                    <div key={enrollment.id} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 mr-4" style={{ color: 'var(--color-text-secondary)' }}>
                        {enrollment.courseId?.title}
                      </span>
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {enrollment.progress.completionPercentage || 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart className="mx-auto h-12 w-12" style={{ color: 'var(--color-text-tertiary)' }} />
                <h3 className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  No progress data
                </h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Your learning progress will appear here after enrolling in courses
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


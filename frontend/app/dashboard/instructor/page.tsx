'use client'

import { useAuth } from '../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import {
  PlayIcon,
  BookOpenIcon,
  ClockIcon,
  UserGroupIcon,
  VideoCameraIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import dynamic from 'next/dynamic'
import RecentClassStatsCard from '@/components/attendance/RecentClassStatsCard'

const LiveClassRoom = dynamic(() => import('../../../components/LiveClassRoom'), { ssr: false })

type Batch = {
  id: string
  name: string
  courseId: any
  startDate: string
  endDate: string
  currentEnrollment: number
  maxStudents: number
  status: string
}

type LiveClass = {
  id: string
  title: string
  batchId: any
  scheduledStartTime: string
  scheduledEndTime: string
  status: string
  roomId: string
  description?: string
}

export default function InstructorDashboard() {
  const { user } = useAuth()
  const router = useRouter()

  const [myBatches, setMyBatches] = useState<Batch[]>([])
  const [todayClasses, setTodayClasses] = useState<LiveClass[]>([])
  const [upcomingClasses, setUpcomingClasses] = useState<LiveClass[]>([])
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
  const [selectedClass, setSelectedClass] = useState<LiveClass | null>(null)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    myCourses: 0,
    myBatches: 0,
    totalStudents: 0,
    liveNow: 0,
    classesToday: 0,
    upcomingClasses: 0,
    completedClasses: 0,
  })

  useEffect(() => {
    loadInstructorData()
  }, [])

  const loadInstructorData = async () => {
    try {
      const response = await api.getInstructorDashboard()
      const dashboardData = response?.data || {}
      const batchesData: Batch[] = dashboardData.batches || []
      const allClasses: LiveClass[] = dashboardData.classes || []
      const dashboardStats = dashboardData.stats || null

      setMyBatches(batchesData)

      const now = new Date()
      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date(now)
      endOfToday.setHours(23, 59, 59, 999)

      const classesToday = allClasses.filter((cls) => {
        const start = new Date(cls.scheduledStartTime)
        return start >= startOfToday && start <= endOfToday
      })
      setTodayClasses(classesToday)

      const liveOrReady = allClasses.filter((cls) => {
        const start = new Date(cls.scheduledStartTime)
        const end = new Date(cls.scheduledEndTime)
        return start <= now && end >= now && ['LIVE', 'SCHEDULED'].includes(cls.status)
      })
      setLiveClasses(liveOrReady)

      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const upcoming = allClasses.filter((cls) => {
        const start = new Date(cls.scheduledStartTime)
        return start > now && start <= nextWeek && cls.status === 'SCHEDULED'
      })
      setUpcomingClasses(upcoming)

      if (dashboardStats) {
        setStats({
          myCourses: dashboardStats.totalCourses || 0,
          myBatches: dashboardStats.totalBatches || batchesData.length,
          totalStudents: dashboardStats.totalStudents || 0,
          liveNow: liveOrReady.length,
          classesToday: classesToday.length,
          upcomingClasses: dashboardStats.upcomingClasses || upcoming.length,
          completedClasses: dashboardStats.completedClasses || 0,
        })
      } else {
        setStats({
          myCourses: new Set(batchesData.map((batch) => batch.courseId?.id || batch.courseId?._id)).size,
          myBatches: batchesData.length,
          totalStudents: batchesData.reduce((sum, batch) => sum + (batch.currentEnrollment || 0), 0),
          liveNow: liveOrReady.length,
          classesToday: classesToday.length,
          upcomingClasses: upcoming.length,
          completedClasses: allClasses.filter((cls) => cls.status === 'ENDED').length,
        })
      }
    } catch (error) {
      console.error('Error loading instructor data:', error)
      toast.error('Failed to load dashboard data')
      setMyBatches([])
      setTodayClasses([])
      setUpcomingClasses([])
      setLiveClasses([])
    } finally {
      setLoading(false)
    }
  }

  const startLiveClass = (liveClass: LiveClass) => {
    setSelectedClass(liveClass)
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 max-w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Instructor Dashboard</h1>
        <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          Overview of your classes, students, and teaching schedule.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">My Courses</p>
              <p className="text-3xl font-bold">{stats.myCourses}</p>
              <p className="text-xs text-blue-600 mt-1">Assigned courses</p>
            </div>
            <BookOpenIcon className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">My Batches</p>
              <p className="text-3xl font-bold">{stats.myBatches}</p>
              <p className="text-xs text-green-600 mt-1">Total assigned</p>
            </div>
            <UserGroupIcon className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">My Students</p>
              <p className="text-3xl font-bold">{stats.totalStudents}</p>
              <p className="text-xs text-purple-600 mt-1">Across all batches</p>
            </div>
            <UserGroupIcon className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Live / Ready</p>
              <p className="text-3xl font-bold">{stats.liveNow}</p>
              <p className="text-xs text-red-600 mt-1">Class window active now</p>
            </div>
            <VideoCameraIcon className="h-8 w-8 text-red-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Classes Today</p>
              <p className="text-3xl font-bold">{stats.classesToday}</p>
              <p className="text-xs text-indigo-600 mt-1">Today&apos;s schedule</p>
            </div>
            <CalendarDaysIcon className="h-8 w-8 text-indigo-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Upcoming (7 Days)</p>
              <p className="text-3xl font-bold">{stats.upcomingClasses}</p>
              <p className="text-xs text-orange-600 mt-1">Next week</p>
            </div>
            <ClockIcon className="h-8 w-8 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <RecentClassStatsCard limit={5} title="Last 5 Classes Attendance Snapshot" />
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Weekly Focus</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <p className="text-sm text-muted-foreground">Next Class</p>
            <p className="font-semibold mt-1">
              {upcomingClasses.length > 0
                ? new Date(upcomingClasses[0].scheduledStartTime).toLocaleString()
                : 'No upcoming class'}
            </p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <p className="text-sm text-muted-foreground">Completion (Classes)</p>
            <p className="font-semibold mt-1">
              {stats.completedClasses} / {stats.completedClasses + stats.upcomingClasses}
            </p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <p className="text-sm text-muted-foreground">Batches with Students</p>
            <p className="font-semibold mt-1">
              {myBatches.filter((batch) => (batch.currentEnrollment || 0) > 0).length} / {myBatches.length}
            </p>
          </div>
        </CardContent>
      </Card>

      {liveClasses.length > 0 && (
        <Card className="mb-8" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
                <VideoCameraIcon className="h-5 w-5" />
                Live / Ready Classes
              </div>
              <Badge variant="destructive" className="ml-auto">
                {liveClasses.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {liveClasses.map((liveClass) => {
                const classStart = new Date(liveClass.scheduledStartTime)
                const classEnd = new Date(liveClass.scheduledEndTime)
                const now = new Date()
                const isLiveNow = classStart <= now && classEnd >= now

                return (
                  <div
                    key={liveClass.id}
                    className="rounded-lg p-4 border"
                    style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>{liveClass.title}</h4>
                        <p className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>{liveClass.batchId?.name || 'Batch'}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          <span>
                            {isLiveNow ? 'LIVE NOW' : classStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>Ends {classEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className={isLiveNow ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700'}
                        onClick={() => window.open(`/classroom/${liveClass.roomId}`, '_blank')}
                      >
                        <PlayIcon className="w-4 h-4 mr-1" />
                        {isLiveNow ? 'Join Now' : 'Start Class'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="rounded-lg shadow border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Quick Actions</h2>
          </div>
          <div className="p-6 space-y-4">
            <button
              className="w-full text-left p-4 rounded-lg border-2 transition-colors hover:opacity-90"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              onClick={() => (upcomingClasses.length > 0 ? startLiveClass(upcomingClasses[0]) : router.push('/dashboard/live-classes'))}
            >
              <div className="flex items-center">
                <PlayIcon className="w-6 h-6 mr-4 text-blue-600" />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Start Next Class</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Launch classroom for your next session</p>
                </div>
              </div>
            </button>

            <button
              className="w-full text-left p-4 rounded-lg border-2 transition-colors hover:opacity-90"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              onClick={() => router.push('/dashboard/live-classes')}
            >
              <div className="flex items-center">
                <VideoCameraIcon className="w-6 h-6 mr-4 text-green-600" />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Manage Live Classes</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>View schedule and class lifecycle</p>
                </div>
              </div>
            </button>

            <button
              className="w-full text-left p-4 rounded-lg border-2 transition-colors hover:opacity-90"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              onClick={() => router.push('/dashboard/courses')}
            >
              <div className="flex items-center">
                <BookOpenIcon className="w-6 h-6 mr-4 text-purple-600" />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Course Content</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Manage modules and resources</p>
                </div>
              </div>
            </button>

            <button
              className="w-full text-left p-4 rounded-lg border-2 transition-colors hover:opacity-90"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              onClick={() => router.push('/dashboard/assessments')}
            >
              <div className="flex items-center">
                <DocumentTextIcon className="w-6 h-6 mr-4 text-orange-600" />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Assessments</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Create and track evaluations</p>
                </div>
              </div>
            </button>

            <button
              className="w-full text-left p-4 rounded-lg border-2 transition-colors hover:opacity-90"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              onClick={() => router.push('/dashboard/attendance')}
            >
              <div className="flex items-center">
                <AcademicCapIcon className="w-6 h-6 mr-4 text-teal-600" />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Student Progress</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Track learner status and outcomes</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="rounded-lg shadow border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Today&apos;s Schedule</h2>
          </div>
          <div className="p-6">
            {todayClasses.length > 0 ? (
              <div className="space-y-4">
                {todayClasses.map((classItem, index) => (
                  <div
                    key={index}
                    className="flex items-center p-3 rounded-lg border"
                    style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex-shrink-0 w-3 h-3 bg-blue-500 rounded-full mr-3" />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{classItem.title}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(classItem.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {classItem.batchId?.name || 'Batch'}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => startLiveClass(classItem)}>Start</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p style={{ color: 'var(--color-text-secondary)' }}>No classes scheduled today</p>
                <Button className="mt-4" onClick={() => router.push('/dashboard/live-classes')}>
                  Go to Live Classes
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg shadow border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Upcoming This Week</h2>
        </div>
        <div className="p-6">
          {upcomingClasses.length > 0 ? (
            <div className="space-y-3">
              {upcomingClasses.slice(0, 6).map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{cls.title}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {cls.batchId?.name || 'Batch'} - {new Date(cls.scheduledStartTime).toLocaleString()}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startLiveClass(cls)}>
                    Start
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No upcoming classes in the next 7 days.</p>
          )}
        </div>
      </div>
    </div>
  )
}

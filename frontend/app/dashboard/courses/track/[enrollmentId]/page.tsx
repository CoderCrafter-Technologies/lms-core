'use client'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../../../components/providers/AuthProvider'
import { Badge } from '../../../../../components/ui/badge'
import { Button } from '../../../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../../components/ui/table'
import { Skeleton } from '../../../../../components/ui/skeleton'
import { format, addMinutes, isAfter, isBefore } from 'date-fns'
import ClassDetailsDialog from '../../../../../components/dialogs/ClassDetailsDialog'
import { ErrorBoundary } from 'react-error-boundary'
import { FilePreviewModal } from '@/components/modals/FilePreviewModal'
import { 
  ChevronRight, 
  Download, 
  Eye, 
  FileText, 
  Video, 
  LinkIcon, 
  BookOpen, 
  Calendar, 
  Users, 
  Clock, 
  Award, 
  FileIcon, 
  File, 
  SaveAll, 
  AwardIcon, 
  ClipboardMinus,
  Image,
  Headphones,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { ClassInfoModal } from '@/components/modals/ClassView'
import { cn } from '@/lib/utils'

function ErrorFallback({ error, resetErrorBoundary }: { error: any, resetErrorBoundary: () => void }) {
  return (
    <div className="flex-1 p-4 md:p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div 
        className="border rounded-lg p-6 text-center"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-error)'
        }}
      >
        <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-error)' }} />
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
          Something went wrong
        </h2>
        <pre className="text-sm mt-2 p-2 rounded" style={{ 
          backgroundColor: 'var(--color-surface-muted)',
          color: 'var(--color-text)'
        }}>{error.message}</pre>
        <Button 
          onClick={resetErrorBoundary}
          className="mt-4"
          variant="outline"
        >
          Try again
        </Button>
      </div>
    </div>
  )
}

interface Resource {
  _id: string;
  title: string;
  description: string;
  fileName: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  resourceLevel: string;
  courseId: any;
  batchId: any;
  liveClassId: any;
  accessLevel: string;
  downloadCount: number;
  viewCount: number;
  tags: string[];
  uploadedBy: any;
  status: string;
  expiresAt: string | null;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export default function StudentCourseTrackPage() {
  const { enrollmentId } = useParams()
  const { user } = useAuth()
  const router = useRouter()
  const [course, setCourse] = useState<any>(null)
  const [enrollment, setEnrollment] = useState<any>(null)
  const [batch, setBatch] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedClass, setSelectedClass] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [resources, setResources] = useState<any[]>([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const fetchCourseData = async () => {
    try {
      setLoading(true)
      
      const enrollmentData = await api.getEnrollmentById(enrollmentId as string)
      setEnrollment(enrollmentData.data)

      const courseId = enrollmentData.data.courseId?.id || enrollmentData.data.courseId?._id
      const courseData = await api.getCourse(courseId)
      setCourse(courseData.data)

      const batchId = enrollmentData.data.batchId?.id || enrollmentData.data.batchId?._id
      const batchData = await api.getBatch(batchId)
      setBatch(batchData.data)

      const classesData = await api.getBatchLiveClasses(batchId)
      setClasses(classesData.data)

    } catch (err) {
      console.error('Error fetching course data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchResources = async () => {
    try {
      const data = await api.getCourseResources(course.id)
      setResources(data.data)
    } catch (err) {
      console.error('Error fetching resources:', err)
    }
  }

  useEffect(() => {
    if (!course) return
    fetchResources()
  }, [course])

  useEffect(() => {
    if (!user?.id) return
    fetchCourseData()
  }, [user?.id])

  const handleViewDetails = (classItem: any) => {
    setSelectedClass(classItem)
    setIsDialogOpen(true)
  }

  const handleJoinClass = (classItem: any) => {
    router.push(`/dashboard/courses/track/${enrollmentId}/live-class/${classItem.id}`)
  }

  const isClassActive = (classItem: any) => {
    if (!classItem?.scheduledStartTime || !classItem?.scheduledEndTime) return false
    const now = new Date()
    const startTime = new Date(classItem.scheduledStartTime)
    const endTime = new Date(classItem.scheduledEndTime)
    return now >= startTime && now <= endTime && classItem.status === 'SCHEDULED'
  }

  const isClassStartingSoon = (classItem: any) => {
    if (!classItem?.scheduledStartTime) return false
    const now = new Date()
    const startTime = new Date(classItem.scheduledStartTime)
    const tenMinutesFromNow = addMinutes(now, 10)
    return isBefore(now, startTime) && isAfter(tenMinutesFromNow, startTime)
  }

  const isClassPassed = (classItem: any) => {
    if (!classItem?.scheduledStartTime) return false
    const now = new Date()
    const startTime = new Date(classItem.scheduledStartTime)
    return now > startTime
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setSelectedClass(null)
  }

  const getResourceIcon = (fileType: string) => {
    switch (fileType?.toUpperCase()) {
      case 'PDF':
        return <FileText className="h-5 w-5" style={{ color: 'var(--color-error)' }} />;
      case 'VIDEO':
        return <Video className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />;
      case 'IMAGE':
        return <Image className="h-5 w-5" style={{ color: 'var(--color-success)' }} />;
      case 'AUDIO':
        return <Headphones className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />;
      default:
        return <File className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />;
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'resources', label: 'Resources', icon: Download },
    { id: 'grades', label: 'Grades', icon: Award }
  ]

  const getAttendanceBadgeVariant = (attendanceStatus: string) => {
    if (attendanceStatus === 'PRESENT') return 'success'
    if (attendanceStatus === 'LEFT_EARLY') return 'secondary'
    if (attendanceStatus === 'ABSENT') return 'destructive'
    return 'outline'
  }

  const scheduleSummary = useMemo(() => {
    if (classes.length > 0) {
      const weekDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
      const uniqueDays = Array.from(
        new Set(classes.map((classItem: any) => format(new Date(classItem.scheduledStartTime), 'EEEE').toUpperCase()))
      )
        .filter(Boolean)
        .sort((a, b) => weekDays.indexOf(a) - weekDays.indexOf(b))

      if (uniqueDays.length === 7) return 'DAILY'
      if (uniqueDays.length > 0) return uniqueDays.join(', ')
    }

    const configuredDays = batch?.schedule?.days || []
    if (configuredDays.length === 7) return 'DAILY'
    if (configuredDays.length > 0) return configuredDays.join(', ')

    return 'N/A'
  }, [classes, batch])

  const statsCards = [
    {
      title: 'Course Progress',
      value: `${enrollment?.progress?.completionPercentage || 0}%`,
      subtext: 'Overall completion',
      color: 'var(--color-primary)',
      bgColor: 'var(--color-primary-light)',
      icon: BookOpen
    },
    {
      title: 'Attendance',
      value: `${enrollment?.attendance?.attendancePercentage || 0}%`,
      subtext: `${enrollment?.attendance?.attendedClasses || 0}/${enrollment?.attendance?.totalClasses || 0} present`,
      color: 'var(--color-info, var(--color-primary))',
      bgColor: 'var(--color-primary-light)',
      icon: Users
    },
    {
      title: 'Batch Status',
      value: batch?.status?.toLowerCase() || 'N/A',
      subtext: batch ? `${format(new Date(batch.startDate), 'MMM dd')} - ${format(new Date(batch.endDate), 'MMM dd, yyyy')}` : '',
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-light)',
      icon: Calendar
    },
    {
      title: 'Classes',
      value: classes.length,
      subtext: `${classes.filter((c: any) => c.status === 'ENDED').length} completed`,
      color: 'var(--color-purple-500)',
      bgColor: 'rgba(168, 85, 247, 0.15)',
      icon: Video
    },
    {
      title: 'Schedule',
      value: scheduleSummary,
      subtext: batch ? `${batch?.schedule?.startTime} - ${batch?.schedule?.endTime}` : '',
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-light)',
      icon: Clock
    }
  ]

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 md:w-64" />
              <Skeleton className="h-4 w-64 md:w-96" />
            </div>
            <Skeleton className="h-10 w-20 md:w-24" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-6 w-16 mb-2" />
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {tabs.map((_, i) => (
                <Skeleton key={i} className="h-10 w-20 md:w-24" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!course || !enrollment) {
    return (
      <div className="flex-1 p-4 md:p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Course Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">[COURSE]</div>
            <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              The course you're looking for doesn't exist or you're not enrolled.
            </p>
            <Button onClick={() => router.push('/courses')}>
              Browse Courses
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div className="flex-1 p-4 md:p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        {/* Course Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-shrink-0 mx-auto lg:mx-0">
              <img
                src={course.thumbnail?.url || '/default-course-thumbnail.jpg'}
                alt={course.title}
                className="w-full md:w-64 h-48 object-cover rounded-lg border"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {course.title}
                  </h1>
                  <p className="mt-2 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {course.description?.substring(0, 120)}...
                  </p>
                </div>
                <Badge variant={
                  enrollment.status === 'ENROLLED' ? 'success' :
                  enrollment.status === 'COMPLETED' ? 'default' :
                  'destructive'
                } className="w-fit">
                  {enrollment.status}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 md:gap-4 text-sm">
                <div className="flex items-center" style={{ color: 'var(--color-text-secondary)' }}>
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>Enrolled {format(new Date(enrollment.enrollmentDate), 'PP')}</span>
                </div>
                <div className="flex items-center" style={{ color: 'var(--color-text-secondary)' }}>
                  <BookOpen className="h-4 w-4 mr-1" />
                  <span>{course.level}</span>
                </div>
                <div className="flex items-center" style={{ color: 'var(--color-text-secondary)' }}>
                  <Users className="h-4 w-4 mr-1" />
                  <span>Instructor: {course.createdBy?.firstName} {course.createdBy?.lastName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {stat.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: stat.color }}>
                    {stat.value}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    {stat.subtext}
                  </p>
                  {stat.title === 'Course Progress' && (
                    <div className="w-full rounded-full h-2 mt-2" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                      <div 
                        className="h-2 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${enrollment.progress?.completionPercentage || 0}%`,
                          backgroundColor: stat.color
                        }}
                      ></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 md:gap-4">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>About This Course</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <p className="text-sm md:text-md leading-relaxed" style={{ color: 'var(--color-text)' }}>
                      {course.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Batch Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-secondary)' }}>Batch Name</h3>
                      <p className="text-sm" style={{ color: 'var(--color-text)' }}>{batch?.name}</p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-secondary)' }}>Batch Code</h3>
                      <p className="text-sm" style={{ color: 'var(--color-text)' }}>{batch?.batchCode}</p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-secondary)' }}>Schedule</h3>
                      <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                        {batch?.schedule?.days?.join(', ')}<br />
                        {batch?.schedule?.startTime}-{batch?.schedule?.endTime} ({batch?.schedule?.timezone})
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-secondary)' }}>Duration</h3>
                      <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                        {format(new Date(batch?.startDate), 'MMM dd, yyyy')} - {format(new Date(batch?.endDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-secondary)' }}>Enrollment</h3>
                      <p className="text-sm" style={{ color: 'var(--color-text)' }}>{batch?.currentEnrollment} of {batch?.maxStudents} students</p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-secondary)' }}>Settings</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant={batch?.settings?.recordClasses ? 'success' : 'outline'} className="text-xs">
                          {batch?.settings?.recordClasses ? 'Recordings Enabled' : 'No Recordings'}
                        </Badge>
                        <Badge variant={batch?.settings?.allowStudentChat ? 'success' : 'outline'} className="text-xs">
                          {batch?.settings?.allowStudentChat ? 'Chat Enabled' : 'No Chat'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'content' && (
            <Card>
              <CardHeader>
                <CardTitle>Course Content</CardTitle>
              </CardHeader>
              <CardContent>
                {course.modules?.length > 0 ? (
                  <div className="space-y-4">
                    {course.modules.map((module: any, index: number) => (
                      <Card key={module.id || index} className="border-2" style={{ borderColor: 'var(--color-border)' }}>
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                          <CardTitle className="text-lg md:text-xl">
                            <div className="flex items-center gap-3">
                              <div 
                                className="h-8 w-8 rounded-full flex items-center justify-center font-bold"
                                style={{ 
                                  backgroundColor: 'var(--color-primary-light)',
                                  color: 'var(--color-primary)'
                                }}
                              >
                                {index + 1}
                              </div>
                              <span style={{ color: 'var(--color-text)' }}>{module.title || 'Untitled Module'}</span>
                            </div>
                          </CardTitle>
                          <Badge variant="outline">
                            {module.lessons?.length || 0} lessons
                          </Badge>
                        </CardHeader>
                        {module.lessons?.length > 0 && (
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              {module.lessons.map((lesson: any, lessonIndex: number) => (
                                <div 
                                  key={lesson.id || lessonIndex}
                                  className="flex items-center p-4 rounded-lg cursor-pointer transition-colors border"
                                  style={{ 
                                    borderColor: 'var(--color-border)',
                                    backgroundColor: 'transparent'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                  }}
                                  onClick={() => router.push(`/courses/track/${enrollmentId}/lesson/${lesson.id}`)}
                                >
                                  <div className="mr-4">
                                    {enrollment.completedLessons?.includes(lesson.id) ? (
                                      <Badge variant="success" className="h-6 w-6 p-0 flex items-center justify-center">
                                        DONE
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="h-6 w-6 p-0 flex items-center justify-center">
                                        {lessonIndex + 1}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                      {lesson.title || 'Untitled Lesson'}
                                    </h4>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                      {lesson.duration} min - {lesson.lessonType || 'Lesson'}
                                    </p>
                                  </div>
                                  <div style={{ color: 'var(--color-text-tertiary)' }}>
                                    <ChevronRight className="h-4 w-4" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <File className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                      No Content Available
                    </h3>
                    <p className="text-sm md:text-md" style={{ color: 'var(--color-text-secondary)' }}>
                      The instructor hasn't added any course content yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'schedule' && (
            <Card>
              <CardHeader>
                <CardTitle>Class Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                {classes.length > 0 ? (
                  <div className="overflow-x-auto w-full">
                    <Table className="min-w-[600px] md:min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Your Attendance</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classes.map((classItem: any) => {
                          const isActive = isClassActive(classItem)
                          const isStartingSoon = isClassStartingSoon(classItem)

                          return (
                            <TableRow
                              key={classItem.id}
                              style={{ 
                                backgroundColor: isActive ? 'var(--color-success-light)' : 'transparent'
                              }}
                            >
                              <TableCell className="font-medium min-w-[120px]">
                                <div className="flex items-center gap-1 truncate">
                                  {isActive && (
                                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-success)' }}></span>
                                  )}
                                  <span className="truncate" style={{ color: 'var(--color-text)' }}>{classItem.title}</span>
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[140px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                {format(new Date(classItem.scheduledStartTime), 'MMM dd, yyyy h:mm a')}
                              </TableCell>
                              <TableCell className="min-w-[80px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                {classItem.scheduledStartTime && classItem.scheduledEndTime ? (
                                  `${Math.round(
                                    (new Date(classItem.scheduledEndTime).getTime() - 
                                    new Date(classItem.scheduledStartTime).getTime()) / (1000 * 60 * 60)
                                  )}h`
                                ) : 'N/A'}
                              </TableCell>
                              <TableCell className="min-w-[100px] truncate">
                                <Badge variant={
                                  classItem.status === 'ENDED' ? 'default' :
                                  isActive ? 'success' :
                                  classItem.status === 'SCHEDULED' ? 'secondary' :
                                  'destructive'
                                }>
                                  {isActive ? 'LIVE' : classItem.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="min-w-[140px] truncate">
                                <Badge variant={getAttendanceBadgeVariant(classItem.attendanceStatus)}>
                                  {classItem.attendanceStatus || (isClassPassed(classItem) ? 'ABSENT' : '-')}
                                </Badge>
                                {typeof classItem.attendancePercentage === 'number' && (
                                  <span className="ml-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                    {classItem.attendancePercentage}%
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="min-w-[140px]">
                                <div className="flex flex-wrap gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleViewDetails(classItem)}
                                    className="flex-1 sm:flex-none"
                                  >
                                    Details
                                  </Button>
                                  {(isActive || isStartingSoon) && (
                                    <Button 
                                      variant="default" 
                                      size="sm"
                                      onClick={() => handleJoinClass(classItem)}
                                      className="flex-1 sm:flex-none"
                                    >
                                      Join
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ClipboardMinus className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                      No Classes Scheduled
                    </h3>
                    <p className="text-sm md:text-md" style={{ color: 'var(--color-text-secondary)' }}>
                      The instructor hasn't scheduled any classes yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'resources' && (
            <Card>
              <CardHeader>
                <CardTitle>Course Resources</CardTitle>
              </CardHeader>
              <CardContent>
                {resources?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {resources.map((resource: any, index: number) => (
                      <Card 
                        key={index} 
                        className="cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-hidden"
                        onClick={() => { setSelectedResource(resource); setPreviewModalOpen(true); }}
                      >
                        <CardHeader className="flex flex-row items-start space-x-3 p-4">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                            {getResourceIcon(resource.fileType)}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <CardTitle className="text-base truncate text-ellipsis overflow-hidden" style={{ color: 'var(--color-text)' }}>
                              {resource.title}
                            </CardTitle>
                            <p className="text-sm truncate text-ellipsis overflow-hidden mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                              {resource.description || 'No description'}
                            </p>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate max-w-[50%]" style={{ color: 'var(--color-text-tertiary)' }}>{resource.fileType}</span>
                            <span className="flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>{Math.round(resource.fileSize / 1024)} KB</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <SaveAll className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                      No Resources Available
                    </h3>
                    <p className="text-sm md:text-md" style={{ color: 'var(--color-text-secondary)' }}>
                      The instructor hasn't added any resources yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'grades' && (
            <Card>
              <CardHeader>
                <CardTitle>Your Grades</CardTitle>
              </CardHeader>
              <CardContent>
                {enrollment.grades?.assignments?.length > 0 ? (
                  <div className="space-y-6">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Assignment</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Submitted</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enrollment.grades.assignments.map((assignment: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium" style={{ color: 'var(--color-text)' }}>
                                {assignment.title || `Assignment ${index + 1}`}
                              </TableCell>
                              <TableCell style={{ color: 'var(--color-text)' }}>
                                {assignment.score !== null ? `${assignment.score}/${assignment.maxScore}` : 'Not graded'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  assignment.status === 'graded' ? 'success' :
                                  assignment.status === 'submitted' ? 'secondary' :
                                  'outline'
                                }>
                                  {assignment.status || 'pending'}
                                </Badge>
                              </TableCell>
                              <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                                {assignment.submittedAt 
                                  ? format(new Date(assignment.submittedAt), 'MMM dd, yyyy') 
                                  : 'Not submitted'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {enrollment.grades.finalGrade && (
                      <Card 
                        className="border"
                        style={{ 
                          backgroundColor: 'var(--color-success-light)',
                          borderColor: 'var(--color-success)'
                        }}
                      >
                        <CardHeader>
                          <CardTitle style={{ color: 'var(--color-success)' }}>
                            Final Grade
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
                                {enrollment.grades.finalGrade}
                              </h3>
                              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                                Final Score: {enrollment.grades.finalScore}
                              </p>
                            </div>
                            <Badge variant="success" className="text-sm">
                              Course Completed
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AwardIcon className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                      No Grades Yet
                    </h3>
                    <p className="text-sm md:text-md" style={{ color: 'var(--color-text-secondary)' }}>
                      Your assignments haven't been graded yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Class Details Dialog */}
        <ClassInfoModal
          isOpen={isDialogOpen} 
          onClose={closeDialog} 
          classId={selectedClass?.id}
        />
        
        {/* File Preview Modal */}
        {selectedResource && (
          <FilePreviewModal
            isOpen={previewModalOpen}
            onClose={() => {setPreviewModalOpen(false); setSelectedResource(null);}}
            resource={selectedResource}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}


'use client'

import { useAuth } from '../../../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Badge } from '../../../../../components/ui/badge'
import { Button } from '../../../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../../components/ui/table'
import { Skeleton } from '../../../../../components/ui/skeleton'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { 
  UserGroupIcon,
  AcademicCapIcon,
  ClockIcon,
  CalendarDaysIcon,
  BookOpenIcon,
  VideoCameraIcon,
  ChartBarIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  PlayIcon,
  UserIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'

interface Student {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  enrollmentDate: string
  progress: {
    completionPercentage: number
    completedClasses: number
    totalClasses: number
  }
  attendance: {
    attendancePercentage: number
    attendedClasses: number
    totalClasses: number
  }
  status: string
  isActive: boolean
  lastActivity?: string
}

interface Instructor {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  bio?: string
  specialization?: string[]
  experience?: number
  totalBatches?: number
  totalStudents?: number
  rating?: number
  joinedDate: string
  isActive: boolean
}

interface LiveClass {
  _id: string
  title: string
  scheduledStartTime: string
  scheduledEndTime: string
  actualStartTime?: string
  actualEndTime?: string
  status: string
  roomId: string
  description: string
  stats: {
    totalParticipants: number
    peakParticipants: number
  }
}

interface BatchDetails {
  _id: string
  name: string
  batchCode: string
  startDate: string
  endDate: string
  status: string
  maxStudents: number
  currentEnrollment: number
  schedule: {
    days: string[]
    startTime: string
    endTime: string
    timezone: string
  }
  course: {
    _id: string
    title: string
    description: string
    category: string
    level: string
  }
  instructor: Instructor
  settings: {
    allowLateJoin: boolean
    recordClasses: boolean
    allowStudentChat: boolean
  }
  description: string
}

export default function AdminBatchDetailPage() {
  const { user } = useAuth()
  const { id: batchId } = useParams()
  const router = useRouter()
  
  const [batch, setBatch] = useState<BatchDetails | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const canManageBatches = user?.role?.name === 'ADMIN'

  useEffect(() => {
    if (canManageBatches && batchId) {
      fetchBatchDetails()
    }
  }, [batchId, canManageBatches])

  const fetchBatchDetails = async () => {
    setLoading(true)
    try {
      const detailsData = await api.getAdminBatchDetails(batchId as string)
      const payload = detailsData?.data || {}

      const mappedBatch = payload.batch
        ? {
            ...payload.batch,
            course: payload.batch.courseId,
            instructor: payload.batch.instructorId,
          }
        : null

      setBatch(mappedBatch)
      setStudents(payload.enrolledStudents || [])
      setLiveClasses(payload.scheduledClasses || [])

    } catch (error) {
      console.error('Error fetching batch details:', error)
      toast.error('Failed to load batch details')
    } finally {
      setLoading(false)
    }
  }

  if (!canManageBatches) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to view this batch.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🎓</div>
            <h2 className="text-2xl font-bold mb-2">Batch Not Found</h2>
            <p className="text-gray-600">The requested batch could not be found.</p>
            <Button className="mt-4" onClick={() => router.push('/dashboard/admin/batches')}>
              Back to Batches
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => router.push('/dashboard/admin/batches')}
            className="mb-4"
          >
            ← Back to Batches
          </Button>
          <h1 className="text-3xl font-bold">{batch.name}</h1>
          <p className="text-gray-600">
            {batch.course.title} • Code: {batch.batchCode}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => router.push(`/dashboard/admin/batches/${batchId}/edit`)}
            className="flex items-center gap-2"
          >
            <PencilIcon className="w-4 h-4" />
            Edit Batch
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <UserGroupIcon className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold">{batch.currentEnrollment}</div>
            <div className="text-sm text-gray-600">Enrolled Students</div>
            <div className="text-xs text-gray-500">of {batch.maxStudents} max</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <VideoCameraIcon className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">{liveClasses.length}</div>
            <div className="text-sm text-gray-600">Total Classes</div>
            <div className="text-xs text-gray-500">
              {liveClasses.filter(c => c.status === 'LIVE').length} live now
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <ChartBarIcon className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <div className="text-2xl font-bold">
              {students.length > 0 
                ? Math.round(students.reduce((sum, s) => sum + s.attendance.attendancePercentage, 0) / students.length)
                : 0}%
            </div>
            <div className="text-sm text-gray-600">Avg Attendance</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <AcademicCapIcon className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
            <div className="text-2xl font-bold">
              {students.length > 0 
                ? Math.round(students.reduce((sum, s) => sum + s.progress.completionPercentage, 0) / students.length)
                : 0}%
            </div>
            <div className="text-sm text-gray-600">Avg Progress</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </Button>
        <Button
          variant={activeTab === 'students' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('students')}
        >
          Students ({students.length})
        </Button>
        <Button
          variant={activeTab === 'instructor' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('instructor')}
        >
          Instructor
        </Button>
        <Button
          variant={activeTab === 'classes' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('classes')}
        >
          Classes ({liveClasses.length})
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenIcon className="w-5 h-5" />
                Batch Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Course Information</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Title:</span> {batch.course.title}</div>
                  <div><span className="font-medium">Category:</span> {batch.course.category}</div>
                  <div><span className="font-medium">Level:</span> {batch.course.level}</div>
                  <div><span className="font-medium">Description:</span> {batch.course.description}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Schedule</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Days:</span> {batch.schedule.days.join(', ')}</div>
                  <div><span className="font-medium">Time:</span> {batch.schedule.startTime} - {batch.schedule.endTime}</div>
                  <div><span className="font-medium">Timezone:</span> {batch.schedule.timezone}</div>
                  <div><span className="font-medium">Duration:</span> {format(new Date(batch.startDate), 'PP')} - {format(new Date(batch.endDate), 'PP')}</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Settings</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={batch.settings.allowLateJoin ? "default" : "secondary"}>
                      {batch.settings.allowLateJoin ? "✅" : "❌"} Late Join
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={batch.settings.recordClasses ? "default" : "secondary"}>
                      {batch.settings.recordClasses ? "✅" : "❌"} Record Classes
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={batch.settings.allowStudentChat ? "default" : "secondary"}>
                      {batch.settings.allowStudentChat ? "✅" : "❌"} Student Chat
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Enrollment Rate</span>
                    <span className="text-sm font-bold">
                      {Math.round((batch.currentEnrollment / batch.maxStudents) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full" 
                      style={{ width: `${Math.min((batch.currentEnrollment / batch.maxStudents) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Average Attendance</span>
                    <span className="text-sm font-bold">
                      {students.length > 0 
                        ? Math.round(students.reduce((sum, s) => sum + s.attendance.attendancePercentage, 0) / students.length)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-600 h-3 rounded-full" 
                      style={{ 
                        width: `${students.length > 0 
                          ? students.reduce((sum, s) => sum + s.attendance.attendancePercentage, 0) / students.length
                          : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Average Progress</span>
                    <span className="text-sm font-bold">
                      {students.length > 0 
                        ? Math.round(students.reduce((sum, s) => sum + s.progress.completionPercentage, 0) / students.length)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-purple-600 h-3 rounded-full" 
                      style={{ 
                        width: `${students.length > 0 
                          ? students.reduce((sum, s) => sum + s.progress.completionPercentage, 0) / students.length
                          : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">Quick Stats</h4>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{students.filter(s => s.isActive).length}</div>
                      <div className="text-xs text-blue-600">Active Students</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{liveClasses.filter(c => c.status === 'ENDED').length}</div>
                      <div className="text-xs text-green-600">Completed Classes</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'students' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5" />
              Enrolled Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-300">
                            {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                          </div>
                          <div>
                            <div>{student.firstName} {student.lastName}</div>
                            <div className="text-xs text-gray-500">{student.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{student.email}</div>
                          {student.phone && <div className="text-gray-500">{student.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(student.enrollmentDate), 'PP')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${student.progress.completionPercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm">{student.progress.completionPercentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${student.attendance.attendancePercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm">{student.attendance.attendancePercentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.isActive ? "default" : "secondary"}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {student.lastActivity ? format(new Date(student.lastActivity), 'PP') : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">👥</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Students Enrolled
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Students will appear here once they enroll in this batch.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'instructor' && batch.instructor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5" />
              Assigned Instructor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xl font-medium text-blue-600 dark:text-blue-300">
                    {batch.instructor.firstName.charAt(0)}{batch.instructor.lastName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {batch.instructor.firstName} {batch.instructor.lastName}
                    </h3>
                    <p className="text-gray-600">{batch.instructor.email}</p>
                    {batch.instructor.phone && (
                      <p className="text-gray-500">{batch.instructor.phone}</p>
                    )}
                    <Badge variant={batch.instructor.isActive ? "default" : "secondary"} className="mt-1">
                      {batch.instructor.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                {batch.instructor.bio && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Bio</h4>
                    <p className="text-sm text-gray-600">{batch.instructor.bio}</p>
                  </div>
                )}

                {batch.instructor.specialization && batch.instructor.specialization.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Specializations</h4>
                    <div className="flex flex-wrap gap-2">
                      {batch.instructor.specialization.map((spec, index) => (
                        <Badge key={index} variant="outline">{spec}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-4">Performance Stats</h4>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {batch.instructor.experience || 0}
                    </div>
                    <div className="text-sm text-blue-600">Years Experience</div>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {batch.instructor.totalBatches || 0}
                    </div>
                    <div className="text-sm text-green-600">Total Batches</div>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {batch.instructor.totalStudents || 0}
                    </div>
                    <div className="text-sm text-purple-600">Students Taught</div>
                  </div>

                  {batch.instructor.rating && (
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {batch.instructor.rating.toFixed(1)} ⭐
                      </div>
                      <div className="text-sm text-yellow-600">Average Rating</div>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <p className="text-sm text-gray-500">
                    Joined: {format(new Date(batch.instructor.joinedDate), 'PP')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'classes' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <VideoCameraIcon className="w-5 h-5" />
              Live Classes ({liveClasses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {liveClasses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class Title</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveClasses.map((liveClass) => (
                    <TableRow key={liveClass._id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{liveClass.title}</div>
                          {liveClass.description && (
                            <div className="text-xs text-gray-500">{liveClass.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(liveClass.scheduledStartTime), 'PP')}</div>
                          <div className="text-gray-500">{format(new Date(liveClass.scheduledStartTime), 'p')}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {Math.floor((new Date(liveClass.scheduledEndTime).getTime() - new Date(liveClass.scheduledStartTime).getTime()) / (1000 * 60))} min
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          liveClass.status === 'LIVE' ? 'default' :
                          liveClass.status === 'SCHEDULED' ? 'secondary' :
                          liveClass.status === 'ENDED' ? 'outline' :
                          'destructive'
                        }>
                          {liveClass.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{liveClass.stats.totalParticipants} total</div>
                          <div className="text-gray-500">peak: {liveClass.stats.peakParticipants}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {(liveClass.status === 'LIVE' || liveClass.status === 'SCHEDULED') && (
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`/classroom/${liveClass.roomId}`, '_blank')}
                            >
                              <PlayIcon className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => router.push(`/dashboard/live-classes/${liveClass._id}`)}
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📹</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Classes Scheduled
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Classes will appear here once they are scheduled for this batch.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}



'use client'

import { useAuth } from '../../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Badge } from '../../../../components/ui/badge'
import { Button } from '../../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Skeleton } from '../../../../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { 
  User, 
  Mail, 
  Phone, 
  Calendar,
  GraduationCap,
  Clock,
  Users,
  BookOpen,
  Trophy,
  Lock,
  ArrowLeft,
  Star,
  Award,
  Briefcase
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/seperator'
import { PasswordResetModal } from '@/components/modals/PasswordResetModal'

interface Instructor {
  _id: string
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone?: string
  status: string
  isActive: boolean
  isEmailVerified: boolean
  createdAt: string
  lastLoginAt?: string
  role: {
    name: string
    displayName: string
  }
  profile?: {
    bio?: string
    specialization?: string[]
    experience?: number
    qualification?: string
  }
  stats?: {
    totalClasses: number
    totalStudents: number
    averageRating: number
    completedClasses: number
  }
}

interface Batch {
  _id: string
  name: string
  courseTitle: string
  startDate: string
  endDate: string
  status: string
  currentEnrollment: number
  maxStudents: number
}

interface LiveClass {
  _id: string
  title: string
  batchName: string
  scheduledStartTime: string
  status: string
  actualStartTime?: string
  actualEndTime?: string
}

export default function InstructorProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const instructorId = params.id as string

  const [instructor, setInstructor] = useState<Instructor | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
  const [loading, setLoading] = useState(true)
  const [showResetModal, setShowResetModal] = useState(false)

  // Check permissions
  const canViewInstructor = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'
  const canEditInstructor = user?.role.name === 'ADMIN'

  useEffect(() => {
    if (canViewInstructor && instructorId) {
      fetchInstructorDetails()
    }
  }, [instructorId])

  const fetchInstructorDetails = async () => {
    setLoading(true)
    try {
      // Fetch instructor details
      const instructorData = await api.getInstructorById(instructorId as string)
      setInstructor(instructorData?.data || null)

      // Fetch instructor's batches
      const batchesData = await api.getBatches({ instructorId: instructorId as string })
      setBatches(batchesData?.data || [])

      // Fetch instructor's live classes
      const classesData = await api.getLiveClasses({ instructorId: instructorId as string })
      setLiveClasses(classesData?.data || [])

    } catch (error) {
      console.error('Error fetching instructor details:', error)
      toast.error('Failed to load instructor details')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!instructor || !canEditInstructor) return
    setShowResetModal(true)
  }

  const toggleInstructorStatus = async () => {
    if (!instructor || !canEditInstructor) return

    try {
      const response = await api.toggleInstructorStatus(instructor._id || instructor.id)
      const updated = response?.data
      setInstructor(prev => prev ? { ...prev, isActive: updated?.isActive ?? !prev.isActive, status: updated?.isActive ? 'ACTIVE' : 'INACTIVE' } : null)
      toast.success(`Instructor ${instructor.isActive ? 'deactivated' : 'activated'} successfully`)
    } catch (error) {
      console.error('Error updating instructor status:', error)
      toast.error('Failed to update instructor status')
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'ACTIVE':
        return 'success'
      case 'UPCOMING':
        return 'warning'
      case 'LIVE':
        return 'success'
      case 'SCHEDULED':
        return 'secondary'
      case 'ENDED':
        return 'outline'
      case 'CANCELLED':
        return 'destructive'
      default:
        return 'default'
    }
  }

  if (!canViewInstructor) {
    return (
      <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Access Denied</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>You don't have permission to view instructor profiles.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 max-w-full space-y-6" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!instructor) {
    return (
      <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">👨‍🏫</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Instructor Not Found</h2>
            <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>The requested instructor could not be found.</p>
            <Button onClick={() => router.push('/dashboard/instructors')}>
              Back to Instructors
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = [
    { 
      label: 'Assigned Batches', 
      value: batches.length, 
      icon: BookOpen,
      color: 'var(--color-primary)'
    },
    { 
      label: 'Total Students', 
      value: batches.reduce((sum, batch) => sum + batch.currentEnrollment, 0), 
      icon: Users,
      color: 'var(--color-success)'
    },
    { 
      label: 'Live Classes', 
      value: liveClasses.length, 
      icon: Clock,
      color: 'var(--color-warning)'
    },
    { 
      label: 'Avg Rating', 
      value: instructor.stats?.averageRating?.toFixed(1) || 'N/A', 
      icon: Trophy,
      color: 'var(--color-purple-500)'
    },
  ]

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => router.push('/dashboard/instructors')}
            className="mb-4 gap-2"
            style={{ color: 'var(--color-primary)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Instructors
          </Button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            {instructor.firstName} {instructor.lastName}
          </h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>Instructor Profile</p>
        </div>
        <div className="flex gap-3">
          {canEditInstructor && (
            <>
              <Button
                variant="outline"
                onClick={handleResetPassword}
                className="flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Reset Password
              </Button>
              
              <Button
                variant={instructor.isActive ? "destructive" : "default"}
                onClick={toggleInstructorStatus}
                className="flex items-center gap-2"
              >
                {instructor.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              
              <Button 
                onClick={() => router.push(`/dashboard/instructors/${instructor._id || instructor.id}/edit`)}
                className="flex items-center gap-2"
              >
                Edit Profile
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Profile Info */}
        <div className="space-y-6">
          {/* Basic Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center mb-6">
                <div 
                  className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
                  style={{ 
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary)'
                  }}
                >
                  {instructor.firstName?.charAt(0)}{instructor.lastName?.charAt(0)}
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                  <span style={{ color: 'var(--color-text)' }} className="font-medium">
                    {instructor.firstName} {instructor.lastName}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                  <span style={{ color: 'var(--color-text)' }}>{instructor.email}</span>
                </div>
                
                {instructor.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span style={{ color: 'var(--color-text)' }}>{instructor.phone}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                  <span style={{ color: 'var(--color-text)' }}>Joined {format(new Date(instructor.createdAt), 'PP')}</span>
                </div>
                
                {instructor.lastLoginAt && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span style={{ color: 'var(--color-text)' }}>Last login {format(new Date(instructor.lastLoginAt), 'PP')}</span>
                  </div>
                )}
              </div>

              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status:</span>
                <Badge variant={instructor.isActive ? "success" : "destructive"}>
                  {instructor.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Email Verified:</span>
                <Badge variant={instructor.isEmailVerified ? "success" : "warning"}>
                  {instructor.isEmailVerified ? 'Verified' : 'Pending'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Professional Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Professional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Role</label>
                <p className="mt-1" style={{ color: 'var(--color-text)' }}>{instructor.role.displayName}</p>
              </div>
              
              {instructor.profile?.qualification && (
                <div>
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Qualification</label>
                  <p className="mt-1" style={{ color: 'var(--color-text)' }}>{instructor.profile.qualification}</p>
                </div>
              )}
              
              {instructor.profile?.experience && (
                <div>
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Experience</label>
                  <p className="mt-1" style={{ color: 'var(--color-text)' }}>{instructor.profile.experience} years</p>
                </div>
              )}
              
              {instructor.profile?.specialization && instructor.profile.specialization.length > 0 && (
                <div>
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Specialization</label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {instructor.profile.specialization.map((spec, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {instructor.profile?.bio && (
                <div>
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bio</label>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-text)' }}>{instructor.profile.bio}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Activity & Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <Card key={index}>
                  <CardContent className="p-4 text-center">
                    <div className="flex justify-center mb-2">
                      <Icon className="w-8 h-8" style={{ color: stat.color }} />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                      {stat.value}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {stat.label}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Assigned Batches */}
          <Card>
            <CardHeader>
              <CardTitle>Assigned Batches</CardTitle>
            </CardHeader>
            <CardContent>
              {batches.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch Name</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch._id} hover>
                        <TableCell className="font-medium" style={{ color: 'var(--color-text)' }}>{batch.name}</TableCell>
                        <TableCell style={{ color: 'var(--color-text-secondary)' }}>{batch.courseTitle}</TableCell>
                        <TableCell style={{ color: 'var(--color-text)' }}>{batch.currentEnrollment}/{batch.maxStudents}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(batch.status)}>
                            {batch.status}
                          </Badge>
                        </TableCell>
                        <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                          {format(new Date(batch.startDate), 'MMM dd')} - {format(new Date(batch.endDate), 'MMM dd, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📚</div>
                  <p style={{ color: 'var(--color-text-secondary)' }}>No batches assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Live Classes */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Live Classes</CardTitle>
            </CardHeader>
            <CardContent>
              {liveClasses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Scheduled Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveClasses.slice(0, 10).map((liveClass) => (
                      <TableRow key={liveClass._id} hover>
                        <TableCell className="font-medium" style={{ color: 'var(--color-text)' }}>{liveClass.title}</TableCell>
                        <TableCell style={{ color: 'var(--color-text-secondary)' }}>{liveClass.batchName}</TableCell>
                        <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                          {format(new Date(liveClass.scheduledStartTime), 'PP p')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(liveClass.status)}>
                            {liveClass.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📹</div>
                  <p style={{ color: 'var(--color-text-secondary)' }}>No live classes scheduled yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showResetModal && instructor && (
        <PasswordResetModal
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          account={{ id: instructor._id || instructor.id, email: instructor.email }}
          entityLabel="instructor"
          onSubmitReset={(id, payload) => api.resetInstructorPassword(id, payload)}
          onPasswordReset={(newPassword) => {
            toast.info(`New password: ${newPassword}`, { duration: 10000 })
          }}
        />
      )}
    </div>
  )
}


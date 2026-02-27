'use client'
import React from 'react'
import { api } from '@/lib/api'
import { useAuth } from '../../../../../components/providers/AuthProvider'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Badge } from '../../../../../components/ui/badge'
import { Button } from '../../../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card'
import { Input } from '../../../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select'
import { Skeleton } from '../../../../../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../../components/ui/table'
import { toast } from 'sonner'
import { ClassCreationModal } from '../../../../../components/modals/ClassCreationModal'
import { ClassEditingModal } from '@/components/modals/ClassEditingModal'
import { ClassInfoModal } from '@/components/modals/ClassView'
import Link from 'next/link'
import BackButton from '@/components/ui/TabsBackButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../../components/ui/dialog"
import { AlertCircle, XCircle, CheckCircle, Ban, ChevronDown, ChevronUp, Eye, Edit, Trash2, Calendar, Clock, User, Video, Plus, BookOpen, Activity, Users } from 'lucide-react'
import { cn } from "../../../../../lib/utils"
import { motion, AnimatePresence } from 'framer-motion'

export default function ScheduledClassesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams() as { batchId: string; courseId?: string }
  const batchId = params.batchId
  const courseId = params.courseId

  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [showClassModal, setShowClassModal] = useState(false)
  const [batch, setBatch] = useState<any>(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('classes');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [showClassInfo, setShowClassInfo] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const [showClassEditingModal, setShowClassEditingModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  
  // Delete dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [classToDelete, setClassToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status update states
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [classToUpdate, setClassToUpdate] = useState<any>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const canManageClasses = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'
  const canManageStudents = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'

  const fetchBatchOverview = async () => {
    setLoading(true)
    setStudentsLoading(true)
    try {
      // Admin optimized path: one populated endpoint instead of 3 separate requests.
      if (user?.role?.name === 'ADMIN') {
        const data = await api.getAdminBatchDetails(batchId as string)
        const payload = data?.data || {}
        setBatch(payload.batch || null)
        setClasses(payload.scheduledClasses || [])
        setStudents(payload.enrolledStudents || [])
        return
      }

      // Fallback for non-admin roles that still access this screen.
      const [batchResponse, classesResponse, studentsResponse] = await Promise.all([
        api.getBatch(batchId as string),
        api.getBatchLiveClasses(batchId as string),
        api.getStudentsByBatch(batchId as string),
      ])

      setBatch(batchResponse?.data || null)
      setClasses(classesResponse?.data || [])
      setStudents(studentsResponse?.data || [])
    } catch (error) {
      console.error('Error fetching batch overview:', error)
      toast.error('Failed to load batch details')
    } finally {
      setLoading(false)
      setStudentsLoading(false)
    }
  }

  const handleClassCreated = (newClass: any) => {
    setClasses(prev => [...prev, newClass])
    toast.success('Class scheduled successfully')
  }

  const handleDeleteClick = (scheduledClass: any) => {
    setClassToDelete(scheduledClass);
    setShowDeleteDialog(true);
  }

  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    
    setIsDeleting(true);
    try {
      await api.deleteLiveClass(classToDelete._id || classToDelete.id);

      toast.success('Class deleted successfully');
      setShowDeleteDialog(false);
      setClassToDelete(null);
      fetchBatchOverview(); // Refresh the list
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error('Failed to delete class');
    } finally {
      setIsDeleting(false);
    }
  }

  const handleStatusClick = (scheduledClass: any) => {
    setClassToUpdate(scheduledClass);
    setShowStatusDialog(true);
  }

  const handleStatusUpdate = async () => {
    if (!classToUpdate) return;
    
    setIsUpdatingStatus(true);
    const newStatus = classToUpdate.status === 'CANCELLED' ? 'SCHEDULED' : 'CANCELLED';
    
    try {
      await api.patchLiveClass(classToUpdate._id || classToUpdate.id, { status: newStatus });

      toast.success(`Class ${newStatus === 'CANCELLED' ? 'cancelled' : 'rescheduled'} successfully`);
      setShowStatusDialog(false);
      setClassToUpdate(null);
      fetchBatchOverview(); // Refresh the list
    } catch (error) {
      console.error('Error updating class status:', error);
      toast.error('Failed to update class status');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const handleRowClick = (classId: string) => {
    setExpandedRow(expandedRow === classId ? null : classId);
  }

  const filteredClasses = classes.filter(scheduledClass => {
    if (filter !== 'all') {
      const now = new Date()
      const startDate = new Date(scheduledClass.scheduledStartTime)
      const endDate = new Date(scheduledClass.scheduledEndTime)
      
      if (filter === 'upcoming' && startDate < now) return false
      if (filter === 'completed' && endDate > now) return false
      if (filter === 'ongoing' && (startDate > now || endDate < now)) return false
      if (filter === 'cancelled' && scheduledClass.status !== 'CANCELLED') return false
    }
    
    if (searchTerm && !scheduledClass.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    
    return true
  })

  const filteredStudents = students.filter(student => {
    if (studentSearchTerm) {
      const searchLower = studentSearchTerm.toLowerCase()
      const studentName = `${student.firstName} ${student.lastName}`.toLowerCase()
      const email = student.email.toLowerCase()
      
      if (!studentName.includes(searchLower) && !email.includes(searchLower)) {
        return false
      }
    }
    return true
  })

  useEffect(() => {
    if (batchId) {
      fetchBatchOverview()
    } else {
      router.push('/dashboard/batches')
    }
  }, [batchId, router, user?.role?.name])

  if (!batchId) return null

  const getStatusBadgeVariant = (status: string, isOngoing?: boolean, isUpcoming?: boolean, isCompleted?: boolean, isCancelled?: boolean) => {
    if (isCancelled) return 'destructive'
    if (isOngoing) return 'success'
    if (isUpcoming) return 'secondary'
    if (isCompleted) return 'outline'
    return 'default'
  }

  const getStatusText = (isOngoing?: boolean, isUpcoming?: boolean, isCompleted?: boolean, isCancelled?: boolean) => {
    if (isCancelled) return 'Cancelled'
    if (isOngoing) return 'Ongoing'
    if (isUpcoming) return 'Upcoming'
    if (isCompleted) return 'Completed'
    return 'Scheduled'
  }

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {batch?.name || 'Batch'} Management
            </h1>
            <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              {canManageClasses 
                ? 'Manage classes and students for this batch' 
                : 'View batch details'
              }
            </p>
             <div className="flex items-center mt-2">
              <BackButton />
            </div>
          </div>
            
          {canManageClasses && activeTab === 'classes' && (
            <Button 
              onClick={() => setShowClassModal(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Schedule Class
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Total Classes
            </CardTitle>
            <BookOpen className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {loading ? <Skeleton className="h-8 w-12" /> : classes.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Upcoming Classes
            </CardTitle>
            <Calendar className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {loading ? <Skeleton className="h-8 w-12" /> : 
                classes.filter(c => new Date(c.scheduledStartTime) > new Date() && c.status !== 'CANCELLED').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Total Students
            </CardTitle>
            <Users className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {studentsLoading ? <Skeleton className="h-8 w-12" /> : students.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Batch Status
            </CardTitle>
            <Activity className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {batch?.status || 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Tabs Implementation */}
      <div className="mb-6">
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setActiveTab('classes')}
            className={cn(
              "py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors",
              activeTab === 'classes' 
                ? 'border-primary' 
                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
            )}
            style={{
              color: activeTab === 'classes' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: activeTab === 'classes' ? 'var(--color-primary)' : 'transparent'
            }}
          >
            Classes
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={cn(
              "py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors",
              activeTab === 'students' 
                ? 'border-primary' 
                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
            )}
            style={{
              color: activeTab === 'students' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: activeTab === 'students' ? 'var(--color-primary)' : 'transparent'
            }}
          >
            Students
          </button>
        </div>
      </div>

      {/* Classes Content */}
      {activeTab === 'classes' && (
        <div>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search classes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Classes Table */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Classes</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredClasses.length > 0 ? (
                <div className="rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Instructor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClasses.map((scheduledClass) => {
                        const startTime = scheduledClass.scheduledStartTime ? new Date(scheduledClass.scheduledStartTime) : null;
                        const endTime = scheduledClass.scheduledEndTime ? new Date(scheduledClass.scheduledEndTime) : null;
                        const now = new Date()
                        const isUpcoming = startTime > now
                        const isCompleted = endTime < now
                        const isOngoing = startTime <= now && endTime >= now
                        const isCancelled = scheduledClass.status === 'CANCELLED'
                        const isExpanded = expandedRow === (scheduledClass._id || scheduledClass.id)

                        const statusVariant = getStatusBadgeVariant(scheduledClass.status, isOngoing, isUpcoming, isCompleted, isCancelled)
                        const statusText = getStatusText(isOngoing, isUpcoming, isCompleted, isCancelled)

                        return (
                          <React.Fragment key={scheduledClass._id || scheduledClass.id}>
                            <TableRow 
                              className={cn(
                                "cursor-pointer transition-all duration-200 group",
                                isCancelled && "opacity-75",
                                isExpanded && "bg-surface-hover"
                              )}
                              style={{
                                backgroundColor: isExpanded ? 'var(--color-surface-hover)' : undefined
                              }}
                              onClick={() => handleRowClick(scheduledClass._id || scheduledClass.id)}
                            >
                              <TableCell className="w-8">
                                <div className="relative">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 transition-colors group-hover:text-primary" style={{ color: 'var(--color-text-secondary)' }} />
                                  )}
                                  
                                  {/* Hover tooltip */}
                                  <div className="absolute left-0 top-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                    <div 
                                      className="text-white text-xs rounded py-1 px-2 whitespace-nowrap"
                                      style={{ backgroundColor: 'var(--color-background)' }}
                                    >
                                      Click to {isExpanded ? 'hide' : 'show'} options
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {isCancelled && <Ban className="h-4 w-4" style={{ color: 'var(--color-error)' }} />}
                                  <span style={{ color: 'var(--color-text)' }}>{scheduledClass.title}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant}>{statusText}</Badge>
                              </TableCell>
                              <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                                {startTime && format(startTime, 'PP')}
                              </TableCell>
                              <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                                {startTime && endTime && `${format(startTime, 'p')} - ${format(endTime, 'p')}`}
                              </TableCell>
                              <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                                {startTime && endTime && (
                                  Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)) < 24
                                    ? `${Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60))}h`
                                    : `${Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24))}d`
                                )}
                              </TableCell>
                              <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                                {scheduledClass.instructorId?.firstName || scheduledClass.instructor?.name || 'Not assigned'}
                              </TableCell>
                            </TableRow>
                            
                            {/* Expanded Row Content - Actions Drawer */}
                            <AnimatePresence>
                              {isExpanded && (
                                <TableRow>
                                  <TableCell colSpan={7} className="p-0 border-t-0">
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div 
                                        className="p-4 border-t"
                                        style={{ 
                                          backgroundColor: 'var(--color-surface-hover)',
                                          borderColor: 'var(--color-border)'
                                        }}
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                          {/* Quick Info */}
                                          <div className="flex flex-wrap items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                                              <Calendar className="h-4 w-4" />
                                              <span>{startTime && format(startTime, 'PPPP')}</span>
                                            </div>
                                            <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                                              <Clock className="h-4 w-4" />
                                              <span>{startTime && format(startTime, 'p')} - {endTime && format(endTime, 'p')}</span>
                                            </div>
                                            <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                                              <User className="h-4 w-4" />
                                              <span>{scheduledClass.instructorId?.firstName || scheduledClass.instructor?.name || 'Not assigned'}</span>
                                            </div>
                                          </div>

                                          {/* Action Buttons */}
                                          <div className="flex flex-wrap gap-2">
                                            {/* Join Now Button (only for ongoing) */}
                                            {isOngoing && !isCancelled && (
                                              <Button
                                                size="sm"
                                                variant="success"
                                                className="gap-2"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  router.push(`/classroom/${scheduledClass.roomId}`);
                                                }}
                                              >
                                                <Video className="h-4 w-4" />
                                                Join Now
                                              </Button>
                                            )}

                                            {/* View Button */}
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="gap-2"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedClassId(scheduledClass._id || scheduledClass.id);
                                                setShowClassInfo(true);
                                              }}
                                            >
                                              <Eye className="h-4 w-4" />
                                              View
                                            </Button>

                                            {/* Admin/Manager Actions */}
                                            {canManageClasses && (
                                              <>
                                                {/* Status Toggle Button */}
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStatusClick(scheduledClass);
                                                  }}
                                                  className="gap-2"
                                                  style={{
                                                    borderColor: isCancelled ? 'var(--color-success)' : 'var(--color-warning)',
                                                    color: isCancelled ? 'var(--color-success)' : 'var(--color-warning)'
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = isCancelled 
                                                      ? 'var(--color-success-light)' 
                                                      : 'var(--color-warning-light)'
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent'
                                                  }}
                                                >
                                                  {isCancelled ? (
                                                    <>
                                                      <CheckCircle className="h-4 w-4" />
                                                      Reschedule
                                                    </>
                                                  ) : (
                                                    <>
                                                      <XCircle className="h-4 w-4" />
                                                      Cancel
                                                    </>
                                                  )}
                                                </Button>

                                                {/* Edit Button */}
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="gap-2"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedClass(scheduledClass);
                                                    setShowClassEditingModal(true);
                                                  }}
                                                >
                                                  <Edit className="h-4 w-4" />
                                                  Edit
                                                </Button>

                                                {/* Delete Button */}
                                                <Button
                                                  variant="destructive"
                                                  size="sm"
                                                  className="gap-2"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteClick(scheduledClass);
                                                  }}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                  Delete
                                                </Button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📅</div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    No classes scheduled
                  </h3>
                  <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                    {canManageClasses 
                      ? "Get started by scheduling your first class"
                      : "No classes are scheduled yet. Check back later!"
                    }
                  </p>
                  {canManageClasses && (
                    <Button 
                      onClick={() => setShowClassModal(true)}
                    >
                      Schedule First Class
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Students Content */}
      {activeTab === 'students' && (
        <div>
          {/* Student Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search students by name or email..."
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
          </div>

          {/* Students Table */}
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Students</CardTitle>
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredStudents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enrollment Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student._id} hover>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {student.avatar?.url ? (
                              <img 
                                src={student.avatar.url} 
                                alt={`${student.studentId.firstName} ${student.studentId.lastName}`}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div 
                                className="h-8 w-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: 'var(--color-primary-light)' }}
                              >
                                <span className="text-xs" style={{ color: 'var(--color-primary)' }}>
                                  {student.studentId.firstName.charAt(0)}{student.studentId.lastName.charAt(0)}
                                </span>
                              </div>
                            )}
                            <span style={{ color: 'var(--color-text)' }}>
                              {student.studentId.firstName} {student.studentId.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell style={{ color: 'var(--color-text-secondary)' }}>{student.studentId.email}</TableCell>
                        <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                          {student.enrollmentDate ? format(new Date(student.enrollmentDate), 'PP') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.isActive ? 'success' : 'destructive'}>
                            {student.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👤</div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    No students enrolled
                  </h3>
                  <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                    {canManageStudents 
                      ? "Students will appear here once enrolled"
                      : "No students are enrolled yet"
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedClassId && (
        <ClassInfoModal
          isOpen={showClassInfo} 
          onClose={() => setShowClassInfo(false)} 
          classId={selectedClassId}
        />
      )}

      {/* Class Creation Modal */}
      {batch && (
        <ClassCreationModal
          isOpen={showClassModal}
          onClose={() => setShowClassModal(false)}
          batchId={batch.id}
          batchName={batch.name}
          onClassCreated={handleClassCreated}
        />
      )}

      {selectedClass && (
        <ClassEditingModal
          isOpen={showClassEditingModal}
          onClose={() => setShowClassEditingModal(false)}
          classData={selectedClass}
          onClassUpdated={() => {
            setShowClassEditingModal(false); 
            setSelectedClass(null); 
            fetchBatchOverview();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
              <span style={{ color: 'var(--color-text)' }}>Confirm Deletion</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{classToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClass}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Confirmation Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {classToUpdate?.status === 'CANCELLED' ? (
                <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
              ) : (
                <XCircle className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />
              )}
              <span style={{ color: 'var(--color-text)' }}>
                {classToUpdate?.status === 'CANCELLED' ? 'Reschedule Class' : 'Cancel Class'}
              </span>
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-3">
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Are you sure you want to {classToUpdate?.status === 'CANCELLED' ? 'reschedule' : 'cancel'} 
                {' "'}{classToUpdate?.title}{'"'}?
              </p>
              
              {/* Attractive Status Preview */}
              <div 
                className="rounded-lg p-4 border"
                style={{ 
                  backgroundColor: 'var(--color-surface-muted)',
                  borderColor: 'var(--color-border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Current Status:</span>
                  <Badge 
                    variant={classToUpdate?.status === 'CANCELLED' ? 'destructive' : 'secondary'}
                  >
                    {classToUpdate?.status || 'SCHEDULED'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>New Status:</span>
                  <Badge 
                    variant={classToUpdate?.status !== 'CANCELLED' ? 'destructive' : 'secondary'}
                  >
                    {classToUpdate?.status === 'CANCELLED' ? 'SCHEDULED' : 'CANCELLED'}
                  </Badge>
                </div>

                {/* Arrow indicator */}
                <div className="flex justify-center my-2">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-border)' }}
                  >
                    <svg className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>

                {/* Class details preview */}
                <div className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>📅 {classToUpdate?.scheduledStartTime && format(new Date(classToUpdate.scheduledStartTime), 'PPPP')}</p>
                  <p>⏰ {classToUpdate?.scheduledStartTime && format(new Date(classToUpdate.scheduledStartTime), 'p')} - {classToUpdate?.scheduledEndTime && format(new Date(classToUpdate.scheduledEndTime), 'p')}</p>
                </div>
              </div>

              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {classToUpdate?.status === 'CANCELLED' 
                  ? "Students will be notified that this class has been rescheduled."
                  : "Students will be notified that this class has been cancelled."}
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(false)}
              disabled={isUpdatingStatus}
            >
              Keep as {classToUpdate?.status || 'SCHEDULED'}
            </Button>
            <Button
              variant={classToUpdate?.status === 'CANCELLED' ? "success" : "destructive"}
              onClick={handleStatusUpdate}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                'Updating...'
              ) : classToUpdate?.status === 'CANCELLED' ? (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Confirm Reschedule
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Confirm Cancellation
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



'use client'

import { useAuth } from '../../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BatchCreationModal } from '../../../../components/modals/BatchCreationModal'
import { format } from 'date-fns'
import { Badge } from '../../../../components/ui/badge'
import { Button } from '../../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Input } from '../../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select'
import { Skeleton } from '../../../../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table'
import { toast } from 'sonner'
import { ResourceUploadModal } from '@/components/modals/ResourceUploadModal'
import { FilePreviewModal } from '@/components/modals/FilePreviewModal'
import { FileIcon } from '@/components/ui/FileIcon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, Download, Eye, Trash2, X, Plus, BookOpen, Activity, Calendar, Users, FileText } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import BackButton from '@/components/ui/TabsBackButton'

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

export default function CourseDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useParams()
  const courseId = searchParams.courseId
  
  const [batches, setBatches] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [course, setCourse] = useState<any>(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [resourcesLoading, setResourcesLoading] = useState(true)
  const [resourceSearchTerm, setResourceSearchTerm] = useState('')
  const [isRemoving, setIsRemoving] = useState(false)
  const [activeTab, setActiveTab] = useState('batches');
  const [showResourcesModal, setShowResourcesModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showDeleteCourseDialog, setShowDeleteCourseDialog] = useState(false);
  const [showDeleteBatchDialog, setShowDeleteBatchDialog] = useState(false); 
  const [deleteClassesFlag, setDeleteClassesFlag] = useState(false);

  const canManageBatches = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'
  const canUploadResources = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER' || user?.role.name === 'INSTRUCTOR'
  const canManageEnrollments = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'
  const canManageResources = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER' || user?.role.name === 'INSTRUCTOR'

  const fetchCourse = async () => {
    try {
      const data = await api.getCourse(courseId as string)
      setCourse(data.data)
    } catch (error) {
      console.error('Error fetching course:', error)
      toast.error('Failed to load course details')
    }
  }

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const data = await api.getBatches({ courseId: courseId as string })
      setBatches(data.data)
    } catch (error) {
      console.error('Error fetching batches:', error)
      toast.error('Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  const publichCourse = async (courseId) => {
    if(!courseId) return;
    try{
      setIsPublishing(true)
      await api.updateCourse(courseId, { status: 'PUBLISHED' })
      toast.success('Course published successfully');
      setIsPublishing(false);
    }catch(err){ 
      toast.error('Failed to publish course');
      setIsPublishing(false);
    }
  };

  const deleteCourse = async () => {
    if(!courseId) return;
    try{
      await api.deleteCourse(courseId as string)
      toast.success('Course deleted successfully');
      router.push('/dashboard/courses');
    }catch(err){
      toast.error('Failed to delete course');
    }
  }

  const handleDeleteBatch = async ()=>{
    setIsDeleting(true);
    try{
      await api.deleteBatchWithOptions(selectedBatch.id, { deleteClasses: deleteClassesFlag })
      toast.success("Batch Deleted!");
      setIsDeleting(false);
      setShowDeleteBatchDialog(false);
      fetchBatches();
    }catch(err){
      toast.error("Failed Deleting Batch!");
      setIsDeleting(false);
      setShowDeleteBatchDialog(false);
    }
  }

  const fetchEnrollments = async () => {
    setStudentsLoading(true)
    try {
      const data = await api.getEnrollmentsByCourse(courseId as string)
      setEnrollments(data.data)
    } catch (error) {
      console.error('Error fetching enrollments:', error)
      toast.error('Failed to load student enrollments')
    } finally {
      setStudentsLoading(false)
    }
  }

  const fetchResources = async () =>{
    setResourcesLoading(true)
    try{
      const data = await api.getCourseResources(courseId as string)
      setResources(data.data);
      setResourcesLoading(false)
    }catch(err){
      console.error('Error fetching resources:', err)
      toast.error('Failed to load course resources');
      setResourcesLoading(false)
    }
  }

  const handleBatchCreated = (newBatch: any) => {
    setBatches(prev => [...prev, newBatch])
    toast.success('Batch created successfully')
  }

  const handleRemoveEnrollment = async (enrollment:any) => {
    try {
      setIsRemoving(true)
      await api.deleteEnrollment(enrollment.id || enrollment._id)
      
      toast.success('Student enrollment removed successfully')
      fetchEnrollments()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsRemoving(false)
    }
  }

  const handleResourceCreated = (newResource: Resource) => {
    setResources(prev => [...prev, newResource])
    toast.success('Resource uploaded successfully')
  }

  const handleResourceUpdated = (updatedResource: Resource) => {
    setResources(prev => prev.map(res => 
      res._id === updatedResource._id ? updatedResource : res
    ))
    toast.success('Resource updated successfully')
  }

  const handleResourceDeleted = (resourceId: string) => {
    setResources(prev => prev.filter(res => res._id !== resourceId))
    toast.success('Resource deleted successfully')
  }

  const handleViewResource = (resource: Resource) => {
    setSelectedResource(resource)
    setShowPreviewModal(true)
  }

  const handleDownloadResource = async (resource: Resource) => {
    try {
      const response = await api.downloadResource(resource._id)
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = resource.originalName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Download started')
    } catch (error) {
      console.error('Error downloading resource:', error)
      toast.error('Failed to download resource')
    }
  }

  const handleDeleteResource = async () => {
    if (!selectedResource) return
    
    try {
      setIsDeleting(true)
      await api.deleteResource(selectedResource._id)
      
      handleResourceDeleted(selectedResource._id)
      setShowDeleteDialog(false)
      setSelectedResource(null)
    } catch (error) {
      console.error('Error deleting resource:', error)
      toast.error('Failed to delete resource')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const filteredBatches = batches.filter(batch => {
    if (filter !== 'all' && batch.status !== filter) return false
    if (searchTerm && !batch.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    return true
  })

  const filteredEnrollments = enrollments.filter(enrollment => {
    if (studentSearchTerm) {
      const searchLower = studentSearchTerm.toLowerCase()
      const studentName = `${enrollment.studentId.firstName} ${enrollment.studentId.lastName}`.toLowerCase()
      const email = enrollment.studentId.email.toLowerCase()
      const batchName = enrollment.batchId?.name?.toLowerCase() || ''
      
      if (!studentName.includes(searchLower) && !email.includes(searchLower) && !batchName.includes(searchLower)) {
        return false
      }
    }
    return true
  })

  const filteredResources = resources.filter(resource => {
    if (resourceSearchTerm) {
      const searchLower = resourceSearchTerm.toLowerCase()
      const title = resource.title.toLowerCase()
      const description = resource.description?.toLowerCase() || ''
      
      if (!title.includes(searchLower) && !description.includes(searchLower)) {
        return false
      }
    }
    return true
  })

  useEffect(() => {
    if (courseId) {
      fetchCourse()
      fetchBatches()
      fetchEnrollments()
      fetchResources()
    } else {
      router.push('/dashboard/courses')
    }
  }, [courseId])

  if (!courseId) return null

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'ACTIVE':
        return 'success'
      case 'UPCOMING':
        return 'secondary'
      case 'COMPLETED':
        return 'outline'
      default:
        return 'default'
    }
  }

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {course?.title || 'Course'} Management
            </h1>
            <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              {canManageBatches 
                ? 'Manage batches and students for this course' 
                : 'View course details and batches'
              }
            </p>
            <div className="flex items-center mt-2">
              <BackButton text="All Courses" />
            </div>
          </div>
          <div>
          </div>
          {canManageBatches && activeTab === 'batches' && (
            <>
            <div className='flex gap-2' >
               <Button 
                variant='destructive'
                onClick={() => setShowDeleteCourseDialog(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                { isDeleting ? "Deleting" : "Delete Course"}
              </Button>
               <Button 
                variant='success'
                onClick={() => publichCourse(courseId)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                { isPublishing ? "Publishing" : "Publish Course"}
              </Button>
             <Button 
                onClick={() => setShowBatchModal(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Batch
              </Button>
            </div>
            </>
            
          )}
          {canUploadResources && activeTab === 'resources' && (
            <Button 
              onClick={() => setShowResourcesModal(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Upload Resource
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Total Batches
            </CardTitle>
            <BookOpen className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {loading ? <Skeleton className="h-8 w-12" /> : batches.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Active Batches
            </CardTitle>
            <Activity className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {loading ? <Skeleton className="h-8 w-12" /> : batches.filter(b => b.status === 'ACTIVE').length}
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
              {studentsLoading ? <Skeleton className="h-8 w-12" /> : enrollments.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Course Resources
            </CardTitle>
            <FileText className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {resourcesLoading ? <Skeleton className="h-8 w-12" /> : resources.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Tabs Implementation */}
      <div className="mb-6">
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {['batches', 'students', 'resources'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "py-4 px-6 text-center border-b-2 font-medium text-sm capitalize transition-colors",
                activeTab === tab 
                  ? 'border-primary' 
                  : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
              )}
              style={{
                color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderColor: activeTab === tab ? 'var(--color-primary)' : 'transparent'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Batches Content */}
      {activeTab === 'batches' && (
        <div>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search batches..."
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
                  <SelectItem value="all">All Batches</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="UPCOMING">Upcoming</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Batches Table */}
          <Card>
            <CardHeader>
              <CardTitle>Batches</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredBatches.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map((batch) => (
                      <TableRow key={batch.id} hover>
                        <TableCell className="font-medium">{batch.name}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(batch.status)}>
                            {batch.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(batch.startDate), 'PP')}</TableCell>
                        <TableCell>{format(new Date(batch.endDate), 'PP')}</TableCell>
                        <TableCell>{batch.currentEnrollment || 0}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => router.push(`/dashboard/courses/${courseId}/${batch.id}`)}
                            >
                              View
                            </Button>
                            {canManageBatches && (
                             <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {setSelectedBatch(batch); setShowEditBatchModal(true)} }
                              >
                                Edit
                              </Button>
                               <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => {setSelectedBatch(batch); setShowDeleteBatchDialog(true)} }
                              >
                                Delete
                              </Button>
                             </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📅</div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    No batches found
                  </h3>
                  <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                    {canManageBatches 
                      ? "Get started by creating your first batch"
                      : "No batches are available yet. Check back later!"
                    }
                  </p>
                  {canManageBatches && (
                    <Button 
                      onClick={() => setShowBatchModal(true)}
                    >
                      Create First Batch
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Course Deletion Confirmation Dialog */}
      <Dialog open={showDeleteCourseDialog} onOpenChange={setShowDeleteCourseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
              <span style={{ color: 'var(--color-text)' }}>Confirm Course Deletion</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the course "{course?.title}"? This action will permanently delete the course and all associated data including batches, enrollments, and resources. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteCourseDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteCourse}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Students Content */}
      {activeTab === 'students' && (
        <div>
          {/* Student Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search students by name, email or batch..."
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
              ) : filteredEnrollments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Enrollment Date</TableHead>
                      {canManageEnrollments && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEnrollments.map((enrollment) => (
                      <TableRow key={enrollment._id} hover>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {enrollment.studentId.avatar?.url ? (
                              <img 
                                src={enrollment.studentId.avatar.url} 
                                alt={`${enrollment.studentId.firstName} ${enrollment.studentId.lastName}`}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div 
                                className="h-8 w-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: 'var(--color-primary-light)' }}
                              >
                                <span className="text-xs" style={{ color: 'var(--color-primary)' }}>
                                  {enrollment.studentId.firstName.charAt(0)}{enrollment.studentId.lastName.charAt(0)}
                                </span>
                              </div>
                            )}
                            <span>
                              {enrollment.studentId.firstName} {enrollment.studentId.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{enrollment.studentId.email}</TableCell>
                        <TableCell>
                          {enrollment.batchId?.name || 'No batch assigned'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(enrollment.enrollmentDate), 'PP')}
                        </TableCell>
                        {canManageEnrollments && (
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveEnrollment(enrollment)}
                              disabled={isRemoving}
                            >
                              {isRemoving ? 'Removing...' : 'Remove'}
                            </Button>
                          </TableCell>
                        )}
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
                    {canManageEnrollments 
                      ? "Students will appear here once enrolled in batches"
                      : "No students are enrolled yet"
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'resources' && (
        <div>
          {/* Resource Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search resources by title or description..."
                value={resourceSearchTerm}
                onChange={(e) => setResourceSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
          </div>

          {/* Resources Table */}
          <Card>
            <CardHeader>
              <CardTitle>Course Resources</CardTitle>
            </CardHeader>
            <CardContent>
              {resourcesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredResources.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Upload Date</TableHead>
                      {canManageResources && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResources.map((resource) => (
                      <TableRow 
                        key={resource._id} 
                        hover
                        className="cursor-pointer"
                        onClick={() => setSelectedResource(resource)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <FileIcon fileType={resource.fileType} className="h-8 w-8" />
                            <div className="flex flex-col">
                              <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                                {resource.title}
                              </span>
                              {resource.description && (
                                <span className="text-sm line-clamp-1" style={{ color: 'var(--color-text-secondary)' }}>
                                  {resource.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell style={{ color: 'var(--color-text-secondary)' }}>{formatFileSize(resource.fileSize)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{resource.fileType}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {resource.uploadedBy.avatar?.url ? (
                              <img
                                src={resource.uploadedBy.avatar.url}
                                alt={`${resource.uploadedBy.firstName} ${resource.uploadedBy.lastName}`}
                                className="h-6 w-6 rounded-full"
                              />
                            ) : (
                              <div 
                                className="h-6 w-6 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: 'var(--color-primary-light)' }}
                              >
                                <span className="text-xs" style={{ color: 'var(--color-primary)' }}>
                                  {resource.uploadedBy.firstName?.charAt(0)}{resource.uploadedBy.lastName?.charAt(0)}
                                </span>
                              </div>
                            )}
                            <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                              {resource.uploadedBy.firstName} {resource.uploadedBy.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                          {format(new Date(resource.uploadedAt), 'PP')}
                        </TableCell>
                        {canManageResources && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewResource(resource);
                                }}
                                title="Preview"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadResource(resource);
                                }}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedResource(resource);
                                  setShowDeleteDialog(true);
                                }}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📁</div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    No Resources Found
                  </h3>
                  <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                    {canUploadResources
                      ? "Upload your first resource to get started"
                      : "No resources available for this course yet"
                    }
                  </p>
                  {canUploadResources && (
                    <Button 
                      onClick={() => setShowResourcesModal(true)}
                    >
                      Upload Resource
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resource Detail Dialog */}
      {selectedResource && (
        <Dialog 
          open={!!selectedResource} 
          onOpenChange={(open) => {
            if (!open) setSelectedResource(null);
          }}
        >
          <DialogContent className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="pr-8">{selectedResource.title}</DialogTitle>
              <DialogDescription>
                Resource details
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <FileIcon fileType={selectedResource.fileType} className="h-12 w-12" />
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{selectedResource.originalName}</h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatFileSize(selectedResource.fileSize)} • {selectedResource.fileType}
                  </p>
                </div>
              </div>
              
              {selectedResource.description && (
                <div>
                  <h4 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Description</h4>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{selectedResource.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Access Level</h4>
                  <Badge>{selectedResource.accessLevel}</Badge>
                </div>
                <div>
                  <h4 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Resource Level</h4>
                  <Badge variant="outline">{selectedResource.resourceLevel}</Badge>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Uploaded By</h4>
                <div className="flex items-center gap-2">
                  {selectedResource.uploadedBy.avatar?.url ? (
                    <img
                      src={selectedResource.uploadedBy.avatar.url}
                      alt={`${selectedResource.uploadedBy.firstName} ${selectedResource.uploadedBy.lastName}`}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--color-primary-light)' }}
                    >
                      <span className="text-xs" style={{ color: 'var(--color-primary)' }}>
                        {selectedResource.uploadedBy.firstName?.charAt(0)}{selectedResource.uploadedBy.lastName?.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span style={{ color: 'var(--color-text)' }}>
                    {selectedResource.uploadedBy.firstName} {selectedResource.uploadedBy.lastName}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Upload Date</h4>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(selectedResource.uploadedAt), 'PPpp')}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Downloads</h4>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{selectedResource.downloadCount}</p>
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  handleViewResource(selectedResource);
                  setSelectedResource(null);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownloadResource(selectedResource)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              {canManageResources && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
              Are you sure you want to delete "{selectedResource?.title}"? This action cannot be undone.
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
              onClick={handleDeleteResource}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <Dialog open={showDeleteBatchDialog} onOpenChange={setShowDeleteBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
              <span style={{ color: 'var(--color-text)' }}>Confirm Batch Deletion</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedBatch?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                onChange={(e) => setDeleteClassesFlag(e.target.checked)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span style={{ color: 'var(--color-text)' }}>Remove all classes</span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteBatchDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBatch}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Batch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Creation Modal */}
      {course && (
        <BatchCreationModal
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          courseId={course.id}
          courseName={course.title}
          onBatchCreated={handleBatchCreated}
        />
      )}

      {course && selectedBatch && (
        <BatchCreationModal
          isOpen={showEditBatchModal}
          onClose={() => setShowEditBatchModal(false)}
          courseId={course.id}
          courseName={course.title}
          editingBatch={selectedBatch}
          onBatchCreated={handleBatchCreated}
        />
      )}

      {/* Resource Upload Modal */}
      {course && (
        <ResourceUploadModal
          isOpen={showResourcesModal}
          onClose={() => setShowResourcesModal(false)}
          onResourceCreated={handleResourceCreated}
          onResourceUpdated={handleResourceUpdated}
          context={{
            courseId: Array.isArray(courseId) ? courseId[0] : courseId,
            resourceLevel: 'COURSE'
          }}
        />
      )}

      {/* File Preview Modal */}
      {selectedResource && (
        <FilePreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          resource={selectedResource}
        />
      )}
    </div>
  )
}


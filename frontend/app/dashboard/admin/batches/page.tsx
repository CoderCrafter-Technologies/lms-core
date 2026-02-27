'use client'

import { useAuth } from '../../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { Badge } from '../../../../components/ui/badge'
import { Input } from '../../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table'
import { Skeleton } from '../../../../components/ui/skeleton'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { 
  PlusIcon,
  EyeIcon,
  PencilIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BookOpenIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline'

interface Batch {
  _id: string
  name: string
  batchCode: string
  courseId: {
    _id: string
    title: string
    level: string
    category: string
  }
  instructorId: {
    _id: string
    firstName: string
    lastName: string
    email: string
  }
  startDate: string
  endDate: string
  status: string
  maxStudents: number
  currentEnrollment: number
  schedule: {
    days: string[]
    startTime: string
    endTime: string
  }
}

export default function AdminBatchesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stats, setStats] = useState({
    totalBatches: 0,
    activeBatches: 0,
    totalStudents: 0,
    avgEnrollment: 0
  })

  const canManageBatches = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'

  useEffect(() => {
    if (canManageBatches) {
      fetchBatches()
    }
  }, [canManageBatches])

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const data = await api.getBatches()
      const batchesData = data?.data || []
      setBatches(batchesData)
      
      // Calculate stats
      const totalStudents = batchesData.reduce((sum: number, batch: Batch) => sum + batch.currentEnrollment, 0)
      const activeBatches = batchesData.filter((batch: Batch) => batch.status === 'ACTIVE').length
      
      setStats({
        totalBatches: batchesData.length,
        activeBatches,
        totalStudents,
        avgEnrollment: batchesData.length > 0 ? Math.round(totalStudents / batchesData.length) : 0
      })
    } catch (error) {
      console.error('Error fetching batches:', error)
      toast.error('Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  const filteredBatches = batches.filter(batch => {
    // Filter by search term
    const matchesSearch = batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         batch.batchCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         batch.courseId.title.toLowerCase().includes(searchTerm.toLowerCase())

    // Filter by status
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const viewBatchDetails = (batchId: string) => {
    router.push(`/dashboard/admin/batches/${batchId}`)
  }

  const editBatch = (batchId: string) => {
    router.push(`/dashboard/admin/batches/${batchId}/edit`)
  }

  if (!canManageBatches) {
    return (
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to view batches.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Batch Management 🎓
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage course batches, students, and instructors
            </p>
          </div>
          <Button 
            onClick={() => router.push('/dashboard/admin/batches/create')}
            className="gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Create Batch
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Batches</p>
              <p className="text-3xl font-bold">
                {loading ? <Skeleton className="h-8 w-12" /> : stats.totalBatches}
              </p>
              <p className="text-xs text-blue-600 mt-1">All courses</p>
            </div>
            <BookOpenIcon className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Batches</p>
              <p className="text-3xl font-bold">
                {loading ? <Skeleton className="h-8 w-12" /> : stats.activeBatches}
              </p>
              <p className="text-xs text-green-600 mt-1">Currently running</p>
            </div>
            <AcademicCapIcon className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Students</p>
              <p className="text-3xl font-bold">
                {loading ? <Skeleton className="h-8 w-12" /> : stats.totalStudents}
              </p>
              <p className="text-xs text-purple-600 mt-1">Enrolled students</p>
            </div>
            <UserGroupIcon className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Enrollment</p>
              <p className="text-3xl font-bold">
                {loading ? <Skeleton className="h-8 w-12" /> : stats.avgEnrollment}
              </p>
              <p className="text-xs text-orange-600 mt-1">Students per batch</p>
            </div>
            <VideoCameraIcon className="h-8 w-8 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search batches, courses, or batch codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue 
              placeholder="Filter by status" 
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Batches ({filteredBatches.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredBatches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Details</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow key={batch._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{batch.name}</div>
                        <div className="text-sm text-gray-500">{batch.batchCode}</div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(batch.startDate), 'PP')} - {format(new Date(batch.endDate), 'PP')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{batch.courseId.title}</div>
                        <div className="text-sm text-gray-500">
                          {batch.courseId.category} • {batch.courseId.level}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {batch.instructorId.firstName} {batch.instructorId.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{batch.instructorId.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{batch.schedule.days.join(', ')}</div>
                        <div className="text-gray-500">
                          {batch.schedule.startTime} - {batch.schedule.endTime}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {batch.currentEnrollment} / {batch.maxStudents}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ 
                              width: `${Math.min((batch.currentEnrollment / batch.maxStudents) * 100, 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        batch.status === 'ACTIVE' ? 'default' :
                        batch.status === 'SCHEDULED' ? 'secondary' :
                        batch.status === 'COMPLETED' ? 'outline' :
                        'destructive'
                      }>
                        {batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => viewBatchDetails(batch._id)}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => editBatch(batch._id)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎓</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No batches found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchTerm || statusFilter !== 'all' 
                  ? "No batches match your search criteria"
                  : "Create your first batch to get started"
                }
              </p>
              {(!searchTerm && statusFilter === 'all') && (
                <Button 
                  onClick={() => router.push('/dashboard/admin/batches/create')}
                >
                  Create First Batch
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


'use client'

import { useAuth } from '../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { Skeleton } from '../../../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { 
  Users, 
  Activity, 
  BookOpen, 
  Calendar,
  Plus,
  User,
  Mail,
  Clock,
  AlertCircle,
  ChevronRight
} from 'lucide-react'
import { InstructorModal } from '@/components/modals/InstructorModal'
import { cn } from '@/lib/utils'

interface Course {
  id: string
  title: string
  description: string
  status: string
}

export default function InstructorsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [instructors, setInstructors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showInstructorModal, setShowInstructorModal] = useState(false)
  const [currentInstructor, setCurrentInstructor] = useState<any | null>(null)
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [resettingInstructorId, setResettingInstructorId] = useState<string | null>(null)
  const [deletingInstructorId, setDeletingInstructorId] = useState<string | null>(null)
  
  // Check permissions
  const canManageInstructors = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'

  useEffect(() => {
    if (canManageInstructors) {
      fetchInstructors();
      fetchCourses();
    }
  }, [])

  const fetchInstructors = async () => {
    setLoading(true)
    try {
      const data = await api.getInstructors()
      setInstructors(data.data || [])
    } catch (error) {
      console.error('Error fetching instructors:', error)
      toast.error('Failed to load instructors')
    } finally {
      setLoading(false)
    }
  }

  const fetchCourses = async () => {
    try {
      const jsonData = await api.getCourses()
      setAvailableCourses(jsonData.data || [])
    } catch (err) {
      console.error('Error fetching courses:', err)
    }
  }

  const filteredInstructors = instructors.filter(instructor => {
    // Filter by status
    if (filter !== 'all' && instructor.status !== filter) return false
    
    // Filter by search term
    const searchLower = searchTerm.toLowerCase()
    const fullName = `${instructor.firstName || ''} ${instructor.lastName || ''}`.toLowerCase()
    const email = instructor.email?.toLowerCase() || ''
    
    if (searchTerm && !fullName.includes(searchLower) && !email.includes(searchLower)) {
      return false
    }
    
    return true
  })

  const stats = [
    { 
      label: 'Total Instructors', 
      value: instructors.length, 
      icon: Users, 
      borderColor: 'var(--color-primary)',
      iconBg: 'var(--color-primary-light)'
    },
    { 
      label: 'Active Instructors', 
      value: instructors.filter(i => i.status === 'ACTIVE').length, 
      icon: Activity, 
      borderColor: 'var(--color-success)',
      iconBg: 'var(--color-success-light)'
    },
    { 
      label: 'Assigned Classes', 
      value: instructors.reduce((sum, instructor) => sum + (instructor.classCount || 0), 0), 
      icon: BookOpen, 
      borderColor: 'var(--color-warning)',
      iconBg: 'var(--color-warning-light)'
    },
    { 
      label: 'New This Month', 
      value: instructors.filter(i => {
        const created = new Date(i.createdAt)
        const now = new Date()
        return created > new Date(now.getFullYear(), now.getMonth(), 1)
      }).length, 
      icon: Calendar, 
      borderColor: 'var(--color-purple-500)',
      iconBg: 'rgba(168, 85, 247, 0.15)'
    },
  ]

  const handleResetInstructorPassword = async (instructor: any) => {
    const instructorId = instructor?._id || instructor?.id
    if (!instructorId || user?.role.name !== 'ADMIN') return

    const name = instructor?.name || `${instructor?.firstName || ''} ${instructor?.lastName || ''}`.trim()
    if (!window.confirm(`Reset password for ${name || 'this instructor'}?`)) return

    try {
      setResettingInstructorId(instructorId)
      const response = await api.resetInstructorPassword(instructorId)
      const tempPassword = response?.data?.newPassword || response?.temporaryPassword
      toast.success(tempPassword ? `Password reset. Temporary password: ${tempPassword}` : 'Password reset successfully.')
    } catch (error) {
      console.error('Error resetting instructor password:', error)
      toast.error('Failed to reset password')
    } finally {
      setResettingInstructorId(null)
    }
  }

  const handleDeleteInstructor = async (instructor: any) => {
    const instructorId = instructor?._id || instructor?.id
    if (!instructorId || user?.role.name !== 'ADMIN') return

    const name = instructor?.name || `${instructor?.firstName || ''} ${instructor?.lastName || ''}`.trim()
    if (!window.confirm(`Delete instructor ${name || 'this instructor'}? This will deactivate the account.`)) return

    try {
      setDeletingInstructorId(instructorId)
      await api.deleteAdminInstructor(instructorId)
      toast.success('Instructor deleted successfully')
      fetchInstructors()
    } catch (error) {
      console.error('Error deleting instructor:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete instructor')
    } finally {
      setDeletingInstructorId(null)
    }
  }

  if (!canManageInstructors) {
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
            You don't have permission to access instructor management.
          </p>
        </div>
      </div>
    )
  }

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'ACTIVE':
        return 'success'
      case 'PENDING':
        return 'warning'
      case 'INACTIVE':
        return 'destructive'
      default:
        return 'default'
    }
  }

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-8 py-2 md:py-7 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              Instructors
            </h1>
            <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              Manage instructors and their assignments
            </p>
          </div>
          {user?.role.name === 'ADMIN' && (
            <Button 
              onClick={() => {  
                setCurrentInstructor(null)
                setShowInstructorModal(true)
              }} 
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Instructor
            </Button>
          )}
        </div>
      </div>

      {/* Instructor Stats */}
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
                    {loading ? <Skeleton className="h-8 w-12" /> : stat.value}
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

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search instructors..."
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
              <SelectItem value="all">All Instructors</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Instructors Table */}
      <Card>
        <CardHeader>
          <CardTitle>Instructor List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredInstructors.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Classes</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstructors.map((instructor) => (
                    <TableRow key={instructor._id || instructor.id} hover>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                            style={{ 
                              backgroundColor: 'var(--color-primary-light)',
                              color: 'var(--color-primary)'
                            }}
                          >
                            {instructor.firstName?.charAt(0) || instructor.name?.charAt(0) || '?'}
                          </div>
                          <span style={{ color: 'var(--color-text)' }}>
                            {instructor.name || `${instructor.firstName || ''} ${instructor.lastName || ''}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                        {instructor.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(instructor.status)}>
                          {instructor.status || 'PENDING'}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ color: 'var(--color-text)' }}>
                        {instructor.classCount || 0}
                      </TableCell>
                      <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                        {instructor.createdAt ? format(new Date(instructor.createdAt), 'PP') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(`/dashboard/instructors/${instructor._id || instructor.id}`)
                            }
                          >
                            View
                          </Button>
                          {user?.role.name === 'ADMIN' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCurrentInstructor(instructor)
                                setShowInstructorModal(true)
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          {user?.role.name === 'ADMIN' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={resettingInstructorId === (instructor._id || instructor.id)}
                              onClick={() => handleResetInstructorPassword(instructor)}
                            >
                              {resettingInstructorId === (instructor._id || instructor.id) ? 'Resetting...' : 'Reset Password'}
                            </Button>
                          )}
                          {user?.role.name === 'ADMIN' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingInstructorId === (instructor._id || instructor.id)}
                              onClick={() => handleDeleteInstructor(instructor)}
                            >
                              {deletingInstructorId === (instructor._id || instructor.id) ? 'Deleting...' : 'Delete'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4">
                <User className="w-16 h-16" style={{ color: 'var(--color-text-tertiary)' }} />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                No instructors found
              </h3>
              <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                {user?.role.name === 'ADMIN'
                  ? "Get started by adding your first instructor"
                  : "No instructors are available yet."}
              </p>
              {user?.role.name === 'ADMIN' && (
                <Button 
                  onClick={() => setShowInstructorModal(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Instructor
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <InstructorModal
        isOpen={showInstructorModal}
        onClose={() => setShowInstructorModal(false)}
        instructor={currentInstructor}
        courses={availableCourses}
        onSuccess={() => {
          setShowInstructorModal(false);
          fetchInstructors();
        }}
      />
    </div>
  )
}


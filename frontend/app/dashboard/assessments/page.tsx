'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../components/providers/AuthProvider'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Input } from '../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs'
import { 
  ClockIcon,
  AcademicCapIcon,
  PlayIcon,
  DocumentTextIcon,
  CalendarIcon,
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

interface Assessment {
  id: string
  title: string
  description: string
  type: 'quiz' | 'exam' | 'assignment' | 'practice'
  status: 'draft' | 'published' | 'archived'
  courseId: {
    _id: string
    title: string
  }
  batchId?: {
    _id: string
    name: string
    batchCode: string
  }
  settings: {
    timeLimit: number | null
    attempts: number
  }
  grading: {
    totalPoints: number
    passingScore: number
  }
  schedule: {
    isScheduled: boolean
    startDate?: string
    endDate?: string
  }
  createdAt: string
  publishedAt?: string
  submissions?: any[]
  hasAttempts?: boolean
  canAttempt?: boolean
  bestScore?: number | null
}

const typeColors = {
  quiz: { bg: 'var(--color-badge-blue-bg)', text: 'var(--color-badge-blue-text)' },
  exam: { bg: 'var(--color-badge-red-bg)', text: 'var(--color-badge-red-text)' },
  assignment: { bg: 'var(--color-badge-green-bg)', text: 'var(--color-badge-green-text)' },
  practice: { bg: 'var(--color-badge-purple-bg)', text: 'var(--color-badge-purple-text)' }
}

const statusColors = {
  draft: { bg: 'var(--color-badge-yellow-bg)', text: 'var(--color-badge-yellow-text)' },
  published: { bg: 'var(--color-badge-green-bg)', text: 'var(--color-badge-green-text)' },
  archived: { bg: 'var(--color-badge-red-bg)', text: 'var(--color-badge-red-text)' }
}

export default function AssessmentsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('available')
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchAssessments()
  }, [user])

  useEffect(() => {
    filterAssessments()
  }, [assessments, activeTab, searchTerm, typeFilter, statusFilter])

  const fetchAssessments = async () => {
    try {
      let endpoint = '/assessments'
      
      if (user?.role?.name === 'STUDENT') {
        endpoint = '/assessments/available'
      } else {
        endpoint = '/assessments'
      }

      // Use raw request path to avoid runtime mismatch if helper methods are stale in HMR cache.
      const response = await api.requestRaw(endpoint)
      const data = await response.json()
      setAssessments(data.data || [])
    } catch (err) {
      console.error('Error fetching assessments:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch assessments')
    } finally {
      setLoading(false)
    }
  }

  const filterAssessments = () => {
    let filtered = [...assessments]

    if (activeTab === 'available') {
      filtered = filtered.filter(assessment => 
        assessment.status === 'published' && 
        (!assessment.hasAttempts || assessment.canAttempt)
      )
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(assessment => 
        assessment.hasAttempts && !assessment.canAttempt
      )
    } else if (activeTab === 'draft') {
      filtered = filtered.filter(assessment => assessment.status === 'draft')
    }

    if (searchTerm) {
      filtered = filtered.filter(assessment =>
        assessment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessment.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessment.courseId.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(assessment => assessment.type === typeFilter)
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(assessment => assessment.status === statusFilter)
    }

    setFilteredAssessments(filtered)
  }

  const handleTakeAssessment = (assessmentId: string) => {
    const takeUrl = `/assessment-player/${assessmentId}?autoStart=1`
    const popup = window.open(takeUrl, '_blank', 'noopener,noreferrer')
    if (!popup) {
      router.push(takeUrl)
    }
  }

  const handleViewResults = (assessmentId: string) => {
    router.push(`/dashboard/assessments/${assessmentId}/results`)
  }

  const handleCreateAssessment = () => {
    router.push('/dashboard/assessments/create')
  }

  const handleEditAssessment = (assessmentId: string) => {
    router.push(`/dashboard/assessments/${assessmentId}/edit`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isAssessmentAvailable = (assessment: Assessment) => {
    if (!assessment.schedule.isScheduled) return true
    
    const now = new Date()
    const startDate = assessment.schedule.startDate ? new Date(assessment.schedule.startDate) : null
    const endDate = assessment.schedule.endDate ? new Date(assessment.schedule.endDate) : null
    
    if (startDate && now < startDate) return false
    if (endDate && now > endDate) return false
    
    return true
  }

  const getTabCounts = () => {
    const available = assessments.filter(a => 
      a.status === 'published' && 
      (!a.hasAttempts || a.canAttempt)
    ).length
    
    const completed = assessments.filter(a => 
      a.hasAttempts && !a.canAttempt
    ).length
    
    const draft = assessments.filter(a => a.status === 'draft').length

    return { available, completed, draft }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-8 w-8 border-b-2 mb-4 mx-auto"
            style={{ borderColor: 'var(--color-primary)' }}
          ></div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading assessments...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12" style={{ backgroundColor: 'var(--color-background)' }}>
        <XCircleIcon className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-error)' }} />
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
          Failed to load assessments
        </h3>
        <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
        <Button onClick={fetchAssessments}>Try Again</Button>
      </div>
    )
  }

  const tabCounts = getTabCounts()

  return (
    <div className="space-y-6 min-h-screen p-6" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <div className="flex items-center border-b py-0 md:py-7 justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            Assessments
          </h1>
          <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            Manage and take quizzes, exams, and assignments
          </p>
        </div>
        
        {user?.role?.name !== 'STUDENT' && (
          <Button onClick={handleCreateAssessment} className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Create Assessment
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
              <Input
                placeholder="Search assessments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="practice">Practice</SelectItem>
              </SelectContent>
            </Select>

            {user?.role?.name !== 'STUDENT' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="available" className="gap-2">
            Available
            {tabCounts.available > 0 && (
              <Badge variant="secondary" className="ml-1">
                {tabCounts.available}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            Completed
            {tabCounts.completed > 0 && (
              <Badge variant="secondary" className="ml-1">
                {tabCounts.completed}
              </Badge>
            )}
          </TabsTrigger>
          {user?.role?.name !== 'STUDENT' && (
            <TabsTrigger value="draft" className="gap-2">
              Draft
              {tabCounts.draft > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {tabCounts.draft}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredAssessments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  No assessments found
                </h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {activeTab === 'available' 
                    ? 'No assessments are currently available for you to take.'
                    : activeTab === 'completed'
                    ? 'You haven\'t completed any assessments yet.'
                    : 'No draft assessments found.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredAssessments.map((assessment) => (
                <Card key={assessment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg line-clamp-2">
                        {assessment.title}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Badge 
                          style={{ 
                            backgroundColor: typeColors[assessment.type]?.bg,
                            color: typeColors[assessment.type]?.text
                          }}
                        >
                          {assessment.type}
                        </Badge>
                        <Badge 
                          style={{ 
                            backgroundColor: statusColors[assessment.status]?.bg,
                            color: statusColors[assessment.status]?.text
                          }}
                        >
                          {assessment.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                      {assessment.description}
                    </p>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      {/* Course Info */}
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <AcademicCapIcon className="h-4 w-4" />
                        <span>{assessment.courseId.title}</span>
                      </div>

                      {assessment.batchId && (
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          <UsersIcon className="h-4 w-4" />
                          <span>{assessment.batchId.name}</span>
                        </div>
                      )}

                      {/* Assessment Info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                          <ClockIcon className="h-4 w-4" />
                          <span>
                            {assessment.settings.timeLimit 
                              ? `${assessment.settings.timeLimit} min`
                              : 'No limit'
                            }
                          </span>
                        </div>
                        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                          <DocumentTextIcon className="h-4 w-4" />
                          <span>{assessment.grading.totalPoints} pts</span>
                        </div>
                      </div>

                      {/* Schedule */}
                      {assessment.schedule.isScheduled && (
                        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            <span>
                              {assessment.schedule.startDate && 
                                `From ${formatDate(assessment.schedule.startDate)}`
                              }
                              {assessment.schedule.endDate && 
                                ` to ${formatDate(assessment.schedule.endDate)}`
                              }
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Student Progress */}
                      {user?.role?.name === 'STUDENT' && (
                        <div className="space-y-2">
                          {assessment.hasAttempts && (
                            <div className="flex items-center justify-between text-sm">
                              <span style={{ color: 'var(--color-text-secondary)' }}>Attempts:</span>
                              <span style={{ color: 'var(--color-text)' }}>{assessment.submissions?.length || 0}/{assessment.settings.attempts}</span>
                            </div>
                          )}
                          {assessment.bestScore !== null && (
                            <div className="flex items-center justify-between text-sm">
                              <span style={{ color: 'var(--color-text-secondary)' }}>Best Score:</span>
                              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{assessment.bestScore}%</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-4">
                        {user?.role?.name === 'STUDENT' ? (
                          // Student actions
                          <>
                            {activeTab === 'available' && assessment.canAttempt && isAssessmentAvailable(assessment) && (
                              <Button 
                                onClick={() => handleTakeAssessment(assessment.id)}
                                className="flex-1 gap-2"
                              >
                                <PlayIcon className="h-4 w-4" />
                                Take Assessment
                              </Button>
                            )}
                            {assessment.hasAttempts && (
                              <Button 
                                variant="outline"
                                onClick={() => handleViewResults(assessment.id)}
                                className="flex-1 gap-2"
                              >
                                View Results
                              </Button>
                            )}
                            {!isAssessmentAvailable(assessment) && (
                              <Button disabled className="flex-1">
                                Not Available
                              </Button>
                            )}
                          </>
                        ) : (
                          // Instructor/Admin actions
                          <>
                            <Button
                              variant="outline"
                              onClick={() => handleEditAssessment(assessment.id)}
                              className="flex-1"
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleViewResults(assessment.id)}
                              className="flex-1"
                            >
                              View Results
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}



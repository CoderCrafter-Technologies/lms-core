'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '../../../components/providers/AuthProvider'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { 
  AcademicCapIcon,
  ChartBarIcon,
  ClockIcon,
  TrophyIcon,
  UsersIcon,
  BookOpenIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

interface AnalyticsData {
  overview: {
    totalCourses: number
    totalStudents: number
    totalInstructors: number
    totalAssessments: number
    avgCourseCompletion: number
    avgAssessmentScore: number
  }
  courseStats: Array<{
    id: string
    title: string
    enrollments: number
    completionRate: number
    avgScore: number
    totalAssessments: number
  }>
  assessmentStats: Array<{
    id: string
    title: string
    type: string
    attempts: number
    avgScore: number
    passRate: number
  }>
  studentProgress: Array<{
    studentId: string
    studentName: string
    email: string
    coursesEnrolled: number
    coursesCompleted: number
    avgScore: number
    totalAssessments: number
    completedAssessments: number
  }>
  recentActivity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
    user: {
      name: string
      email: string
    }
  }>
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'assessments' | 'students'>('overview')
  const [dateRange, setDateRange] = useState('30') // days

  useEffect(() => {
    fetchAnalyticsData()
  }, [dateRange])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      const data = await api.getAdminAnalytics(dateRange)
      setAnalyticsData(data?.data || null)
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <AnalyticsSkeleton />
  }

  if (!analyticsData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold mb-2">Analytics Unavailable</h3>
            <p className="text-muted-foreground">Unable to load analytics data at this time.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive insights into your LMS performance
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          
          <Button onClick={fetchAnalyticsData}>
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatsCard
          title="Total Courses"
          value={analyticsData.overview.totalCourses}
          icon={BookOpenIcon}
          color="blue"
        />
        <StatsCard
          title="Total Students"
          value={analyticsData.overview.totalStudents}
          icon={UsersIcon}
          color="green"
        />
        <StatsCard
          title="Instructors"
          value={analyticsData.overview.totalInstructors}
          icon={AcademicCapIcon}
          color="purple"
        />
        <StatsCard
          title="Assessments"
          value={analyticsData.overview.totalAssessments}
          icon={ClipboardDocumentIcon}
          color="orange"
        />
        <StatsCard
          title="Avg Completion"
          value={`${analyticsData.overview.avgCourseCompletion}%`}
          icon={CheckCircleIcon}
          color="teal"
        />
        <StatsCard
          title="Avg Score"
          value={`${analyticsData.overview.avgAssessmentScore}%`}
          icon={TrophyIcon}
          color="yellow"
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: ChartBarIcon },
            { id: 'courses', name: 'Courses', icon: BookOpenIcon },
            { id: 'assessments', name: 'Assessments', icon: ClipboardDocumentIcon },
            { id: 'students', name: 'Students', icon: UsersIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <OverviewTab analyticsData={analyticsData} />
        )}
        
        {activeTab === 'courses' && (
          <CoursesTab courses={analyticsData.courseStats} />
        )}
        
        {activeTab === 'assessments' && (
          <AssessmentsTab assessments={analyticsData.assessmentStats} />
        )}
        
        {activeTab === 'students' && (
          <StudentsTab students={analyticsData.studentProgress} />
        )}
      </div>
    </div>
  )
}

function StatsCard({ title, value, icon: Icon, color }: {
  title: string
  value: string | number
  icon: any
  color: string
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
    green: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
    teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-300',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300',
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className={`p-2 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OverviewTab({ analyticsData }: { analyticsData: AnalyticsData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activity.user.name} • {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Courses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.courseStats
              .sort((a, b) => b.completionRate - a.completionRate)
              .slice(0, 5)
              .map((course) => (
                <div key={course.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{course.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {course.enrollments} students
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {course.completionRate}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">completion</p>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CoursesTab({ courses }: { courses: AnalyticsData['courseStats'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Course</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Enrollments</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Completion Rate</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Avg Score</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Assessments</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                    {course.title}
                  </td>
                  <td className="text-center py-3 px-4 text-gray-600 dark:text-gray-400">
                    {course.enrollments}
                  </td>
                  <td className="text-center py-3 px-4">
                    <Badge variant={course.completionRate >= 80 ? 'default' : course.completionRate >= 60 ? 'secondary' : 'destructive'}>
                      {course.completionRate}%
                    </Badge>
                  </td>
                  <td className="text-center py-3 px-4 text-gray-600 dark:text-gray-400">
                    {course.avgScore}%
                  </td>
                  <td className="text-center py-3 px-4 text-gray-600 dark:text-gray-400">
                    {course.totalAssessments}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function AssessmentsTab({ assessments }: { assessments: AnalyticsData['assessmentStats'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessment Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Assessment</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Type</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Attempts</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Avg Score</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((assessment) => (
                <tr key={assessment.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                    {assessment.title}
                  </td>
                  <td className="text-center py-3 px-4">
                    <Badge variant="outline">{assessment.type}</Badge>
                  </td>
                  <td className="text-center py-3 px-4 text-gray-600 dark:text-gray-400">
                    {assessment.attempts}
                  </td>
                  <td className="text-center py-3 px-4 text-gray-600 dark:text-gray-400">
                    {assessment.avgScore}%
                  </td>
                  <td className="text-center py-3 px-4">
                    <Badge variant={assessment.passRate >= 80 ? 'default' : assessment.passRate >= 60 ? 'secondary' : 'destructive'}>
                      {assessment.passRate}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function StudentsTab({ students }: { students: AnalyticsData['studentProgress'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Student</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Courses</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Completed</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Avg Score</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Assessments</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.studentId} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {student.studentName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {student.email}
                      </p>
                    </div>
                  </td>
                  <td className="text-center py-3 px-4 text-gray-600 dark:text-gray-400">
                    {student.coursesEnrolled}
                  </td>
                  <td className="text-center py-3 px-4 text-gray-600 dark:text-gray-400">
                    {student.coursesCompleted}
                  </td>
                  <td className="text-center py-3 px-4">
                    <Badge variant={student.avgScore >= 80 ? 'default' : student.avgScore >= 60 ? 'secondary' : 'destructive'}>
                      {student.avgScore}%
                    </Badge>
                  </td>
                  <td className="text-center py-3 px-4 text-gray-600 dark:text-gray-400">
                    {student.completedAssessments}/{student.totalAssessments}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

// Fix missing import
function ClipboardDocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}


'use client'

import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../../../../../components/providers/AuthProvider'
import { Button } from '../../../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card'
import { Badge } from '../../../../../components/ui/badge'
import { Input } from '../../../../../components/ui/input'
import { Progress } from '../../../../../components/ui/progress'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TrophyIcon,
  ChartBarIcon,
  UserGroupIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

interface Assessment {
  id?: string
  _id?: string
  title: string
  description?: string
  type: string
  grading: {
    totalPoints?: number
    passingScore: number
  }
  settings: {
    showCorrectAnswers?: boolean
    allowReview?: boolean
  }
  questions?: Question[]
}

interface Question {
  id: string
  type: string
  question: string
  points: number
  correctAnswer?: any
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>
  explanation?: string
}

interface Answer {
  questionId: string
  answer: any
  isCorrect?: boolean
  points?: number
}

interface Submission {
  _id?: string
  id?: string
  attemptNumber: number
  startedAt: string
  completedAt?: string
  timeSpent?: number
  isCompleted: boolean
  scoring: {
    totalQuestions: number
    correctAnswers: number
    totalPoints: number
    earnedPoints: number
    percentage: number
    grade: string
    isPassed: boolean
  }
  answers?: Answer[]
  status?: 'in-progress' | 'submitted' | 'graded' | 'late' | 'incomplete' | 'abandoned'
  feedback?: {
    overallComments?: string
    questionComments?: Array<{ questionId: string; comment?: string; points?: number }>
    gradedAt?: string
  }
  violations?: Array<{ type: string; details?: string; timestamp?: string }> | string[]
  studentId?: {
    _id: string
    firstName: string
    lastName: string
    email: string
  }
}

function safeNumber(value: any): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function AssessmentResultsPage() {
  const params = useParams()
  const assessmentId = Array.isArray(params.assessmentId) ? params.assessmentId[0] : params.assessmentId
  const { user } = useAuth()
  const router = useRouter()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [studentAttempts, setStudentAttempts] = useState<Submission[]>([])
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null)
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'submissions' | 'analytics'>('overview')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)

  const isStudent = user?.role?.name === 'STUDENT'

  useEffect(() => {
    if (!assessmentId || !user) return
    fetchResults()
  }, [assessmentId, user])

  const fetchResults = async () => {
    try {
      setLoading(true)
      setError(null)

      if (isStudent) {
        const payload = await api.getAssessmentResults(assessmentId as string)

        const fetchedAssessment = payload.data.assessment || null
        const fetchedQuestions = payload.data.questions || []
        const attempts = (payload.data.attempts || []).filter((attempt) => attempt.isCompleted)

        setAssessment(fetchedAssessment as Assessment | null)
        setQuestions(fetchedQuestions as Question[])
        setStudentAttempts(attempts as Submission[])

        if (attempts.length > 0) {
          const latest = [...attempts].sort(
            (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
          )[0]
          setSelectedAttemptId((latest._id || latest.id) ?? null)
        }
      } else {
        const [assessmentResponse, submissionsResponse] = await Promise.all([
          api.getAssessmentById(assessmentId as string),
          api.getAssessmentSubmissions(assessmentId as string, 500)
        ])

        const submissions = Array.isArray(submissionsResponse.data) ? submissionsResponse.data : []

        setAssessment(assessmentResponse.data as Assessment)
        const completedSubmissions = submissions.filter((submission) => submission.isCompleted) as Submission[]
        setAllSubmissions(completedSubmissions)
        if (completedSubmissions.length > 0) {
          const firstId = completedSubmissions[0]?._id || completedSubmissions[0]?.id || null
          setSelectedSubmissionId(firstId)
        }
      }
    } catch (fetchError) {
      console.error(fetchError)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch results')
    } finally {
      setLoading(false)
    }
  }

  const selectedStudentSubmission = useMemo(() => {
    return studentAttempts.find((submission) => (submission._id || submission.id) === selectedAttemptId) ?? null
  }, [selectedAttemptId, studentAttempts])

  const filteredSubmissions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allSubmissions
    return allSubmissions.filter((submission) => {
      const fullName = `${submission.studentId?.firstName || ''} ${submission.studentId?.lastName || ''}`.toLowerCase()
      const email = (submission.studentId?.email || '').toLowerCase()
      return fullName.includes(q) || email.includes(q)
    })
  }, [allSubmissions, search])

  const selectedDetailedSubmission = useMemo(
    () => allSubmissions.find((submission) => (submission._id || submission.id) === selectedSubmissionId) ?? null,
    [allSubmissions, selectedSubmissionId]
  )

  const questionMap = useMemo(() => {
    const entries = (assessment?.questions || []).map((question) => [question.id, question] as const)
    return new Map(entries)
  }, [assessment?.questions])

  const analytics = useMemo(() => {
    const scores = allSubmissions.map((submission) => safeNumber(submission.scoring?.percentage)).sort((a, b) => a - b)
    const total = scores.length
    const avg = total ? Math.round(scores.reduce((sum, score) => sum + score, 0) / total) : 0
    const median = total
      ? total % 2 === 0
        ? Math.round((scores[total / 2 - 1] + scores[total / 2]) / 2)
        : scores[Math.floor(total / 2)]
      : 0
    const passed = allSubmissions.filter((submission) => safeNumber(submission.scoring?.percentage) >= safeNumber(assessment?.grading.passingScore || 60)).length
    const passRate = total ? Math.round((passed / total) * 100) : 0
    const top = total ? scores[total - 1] : 0
    const bottom = total ? scores[0] : 0

    return { total, avg, median, passed, passRate, top, bottom }
  }, [allSubmissions, assessment?.grading.passingScore])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`
  }

  const formatDate = (isoDate: string) =>
    new Date(isoDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

  const gradeClass = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
    if (grade.startsWith('D')) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <XCircleIcon className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <p className="mb-4 text-sm text-muted-foreground">{error}</p>
            <Button onClick={fetchResults}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Assessment Results</h1>
          <p className="text-sm text-muted-foreground">{assessment?.title}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          {isStudent && (
            <Button
              onClick={() => {
                const takeUrl = `/assessment-player/${assessmentId}?autoStart=1`
                const popup = window.open(takeUrl, '_blank', 'noopener,noreferrer')
                if (!popup) {
                  router.push(takeUrl)
                }
              }}
            >
              <ArrowPathIcon className="mr-2 h-4 w-4" />
              Retake
            </Button>
          )}
        </div>
      </div>

      {isStudent && selectedStudentSubmission ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div
                  className={[
                    'mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full',
                    selectedStudentSubmission.scoring.isPassed
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                  ].join(' ')}
                >
                  {selectedStudentSubmission.scoring.isPassed ? (
                    <CheckCircleIcon className="h-7 w-7" />
                  ) : (
                    <XCircleIcon className="h-7 w-7" />
                  )}
                </div>
                <p className="text-2xl font-bold">{selectedStudentSubmission.scoring.percentage}%</p>
                <p className="text-xs text-muted-foreground">
                  {selectedStudentSubmission.scoring.isPassed ? 'Passed' : 'Failed'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Badge className={gradeClass(selectedStudentSubmission.scoring.grade)}>
                  {selectedStudentSubmission.scoring.grade}
                </Badge>
                <p className="mt-2 text-xl font-semibold">
                  {selectedStudentSubmission.scoring.earnedPoints}/{selectedStudentSubmission.scoring.totalPoints}
                </p>
                <p className="text-xs text-muted-foreground">Points</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xl font-semibold">
                  {selectedStudentSubmission.scoring.correctAnswers}/{selectedStudentSubmission.scoring.totalQuestions}
                </p>
                <p className="text-xs text-muted-foreground">Correct Answers</p>
                <Progress
                  value={
                    selectedStudentSubmission.scoring.totalQuestions
                      ? (selectedStudentSubmission.scoring.correctAnswers / selectedStudentSubmission.scoring.totalQuestions) * 100
                      : 0
                  }
                  className="mt-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="mb-1 flex items-center justify-center gap-1">
                  <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xl font-semibold">{formatTime(selectedStudentSubmission.timeSpent || 0)}</p>
                </div>
                <p className="text-xs text-muted-foreground">Time Spent</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attempts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {studentAttempts.map((attempt) => {
                const id = attempt._id || attempt.id || ''
                const selected = id === selectedAttemptId
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedAttemptId(id)}
                    className={[
                      'rounded border px-3 py-2 text-sm',
                      selected ? 'border-primary bg-primary/10 text-primary' : 'border-border'
                    ].join(' ')}
                  >
                    Attempt {attempt.attemptNumber} - {attempt.scoring.percentage}%
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {assessment?.settings.allowReview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Question Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {questions.map((question, index) => {
                  const answer = selectedStudentSubmission.answers.find((entry) => entry.questionId === question.id)
                  return (
                    <div key={question.id} className="border-b pb-5 last:border-b-0">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">Question {index + 1}</p>
                        <Badge variant={answer?.isCorrect ? 'default' : 'destructive'}>
                          {safeNumber(answer?.points)}/{question.points} pts
                        </Badge>
                      </div>
                      <p className="mb-3 text-sm">{question.question}</p>
                      <p className="text-sm">
                        <span className="font-medium">Your answer:</span> {renderAnswer(question, answer?.answer)}
                      </p>
                      {assessment.settings.showCorrectAnswers && (
                        <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                          <span className="font-medium">Correct answer:</span> {renderAnswer(question, question.correctAnswer)}
                        </p>
                      )}
                      {question.explanation && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium">Explanation:</span> {question.explanation}
                        </p>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-2 border-b pb-2">
            {(['overview', 'submissions', 'analytics'] as const).map((tab) => (
              <Button key={tab} variant={selectedTab === tab ? 'default' : 'ghost'} onClick={() => setSelectedTab(tab)}>
                {tab[0].toUpperCase() + tab.slice(1)}
              </Button>
            ))}
          </div>

          {selectedTab === 'overview' && (
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Students" value={new Set(allSubmissions.map((submission) => submission.studentId?._id)).size} icon={<UserGroupIcon className="h-5 w-5 text-blue-500" />} />
              <MetricCard label="Attempts" value={analytics.total} icon={<ChartBarIcon className="h-5 w-5 text-emerald-500" />} />
              <MetricCard label="Average" value={`${analytics.avg}%`} icon={<TrophyIcon className="h-5 w-5 text-yellow-500" />} />
              <MetricCard label="Pass Rate" value={`${analytics.passRate}%`} icon={<CheckCircleIcon className="h-5 w-5 text-purple-500" />} />
            </div>
          )}

          {selectedTab === 'submissions' && (
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>All Submissions</CardTitle>
                <Input
                  placeholder="Search by student name or email"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full sm:w-72"
                />
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submissions found.</p>
                ) : (
                  filteredSubmissions.map((submission) => (
                    <div key={submission._id || submission.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            {submission.studentId?.firstName} {submission.studentId?.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{submission.studentId?.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Attempt {submission.attemptNumber} | {formatDate(submission.completedAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{safeNumber(submission.scoring?.percentage)}%</p>
                          <Badge className={gradeClass(submission.scoring?.grade || 'F')}>
                            {submission.scoring?.grade || 'F'}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {safeNumber(submission.scoring?.correctAnswers)}/{safeNumber(submission.scoring?.totalQuestions)} correct
                          </p>
                          <p className="text-xs text-muted-foreground">Status: {submission.status || 'graded'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSubmissionId(submission._id || submission.id || null)}
                        >
                          View Detailed Result
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {selectedTab === 'submissions' && selectedDetailedSubmission && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Detailed Result: {selectedDetailedSubmission.studentId?.firstName} {selectedDetailedSubmission.studentId?.lastName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricCard label="Score" value={`${safeNumber(selectedDetailedSubmission.scoring?.percentage)}%`} icon={<ChartBarIcon className="h-5 w-5 text-blue-500" />} />
                  <MetricCard label="Grade" value={selectedDetailedSubmission.scoring?.grade || 'N/A'} icon={<TrophyIcon className="h-5 w-5 text-yellow-500" />} />
                  <MetricCard label="Status" value={selectedDetailedSubmission.status || 'graded'} icon={<CheckCircleIcon className="h-5 w-5 text-emerald-500" />} />
                  <MetricCard label="Time Spent" value={formatTime(selectedDetailedSubmission.timeSpent || 0)} icon={<ClockIcon className="h-5 w-5 text-purple-500" />} />
                </div>

                {selectedDetailedSubmission.feedback?.overallComments && (
                  <div className="rounded-lg border p-3">
                    <p className="text-sm font-semibold">Instructor Feedback</p>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedDetailedSubmission.feedback.overallComments}</p>
                  </div>
                )}

                {selectedDetailedSubmission.answers && selectedDetailedSubmission.answers.length > 0 ? (
                  <div className="space-y-4">
                    {selectedDetailedSubmission.answers.map((answer, index) => {
                      const question = questionMap.get(answer.questionId)
                      const questionTitle = question?.question || `Question ${index + 1}`
                      return (
                        <div key={`${answer.questionId}-${index}`} className="rounded-lg border p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">Q{index + 1}. {questionTitle}</p>
                            <Badge variant={answer.isCorrect ? 'default' : 'secondary'}>
                              {safeNumber(answer.points)}/{safeNumber(question?.points)} pts
                            </Badge>
                          </div>
                          <p className="text-sm">
                            <span className="font-medium">Student answer:</span> {renderAnswer(question || ({ id: answer.questionId, type: 'short-answer', question: questionTitle, points: 0 } as Question), answer.answer)}
                          </p>
                          {question?.correctAnswer !== undefined && (
                            <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                              <span className="font-medium">Correct answer:</span> {renderAnswer(question, question.correctAnswer)}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No answer details available for this submission.</p>
                )}

                {selectedDetailedSubmission.violations && selectedDetailedSubmission.violations.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-sm font-semibold">Violations</p>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {selectedDetailedSubmission.violations.map((violation: any, idx: number) => (
                        <p key={idx}>
                          {typeof violation === 'string'
                            ? violation
                            : `${violation.type}${violation.details ? `: ${violation.details}` : ''}`}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedTab === 'analytics' && (
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Median Score" value={`${analytics.median}%`} icon={<ChartBarIcon className="h-5 w-5 text-blue-500" />} />
              <MetricCard label="Top Score" value={`${analytics.top}%`} icon={<TrophyIcon className="h-5 w-5 text-emerald-500" />} />
              <MetricCard label="Lowest Score" value={`${analytics.bottom}%`} icon={<XCircleIcon className="h-5 w-5 text-red-500" />} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function renderAnswer(question: Question, answer: any) {
  if (answer === null || answer === undefined || answer === '') return 'No answer provided'
  if (question.type === 'multiple-choice') {
    const normalizedAnswer = String(answer ?? '').trim().toLowerCase()
    const option = question.options?.find((opt) => {
      const optionId = String(opt.id ?? '').trim()
      const optionText = String(opt.text ?? '').trim().toLowerCase()
      return optionId === answer || optionText === normalizedAnswer
    })
    return option ? option.text : 'Unknown option'
  }
  if (question.type === 'coding') {
    if (typeof answer === 'object') {
      const language = answer.language ? `Language: ${answer.language}` : 'Language: -'
      const tests = answer.totalTestCases ? `Tests: ${answer.passedTestCases || 0}/${answer.totalTestCases}` : 'Tests: not run'
      return `${language} | ${tests}`
    }
    return 'Code submitted'
  }
  if (question.type === 'true-false') {
    return answer === true ? 'True' : answer === false ? 'False' : String(answer)
  }
  return String(answer)
}



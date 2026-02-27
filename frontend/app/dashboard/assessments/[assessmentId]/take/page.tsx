'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useAuth } from '../../../../../components/providers/AuthProvider'
import { Button } from '../../../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card'
import { Badge } from '../../../../../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../../../../components/ui/dialog'
import {
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  CheckCircleIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/outline'

interface QuestionOption {
  id: string
  text: string
}

interface AssessmentSection {
  id: string
  title: string
  type: 'theory' | 'mcq' | 'coding'
  description?: string
  totalPoints?: number
  order?: number
}

interface Question {
  id: string
  _id?: string
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'fill-blank' | 'coding'
  sectionId?: string
  question: string
  options?: QuestionOption[]
  coding?: {
    allowedLanguages?: string[]
    starterCode?: Record<string, string>
    testCases?: Array<{
      input?: string
      expectedOutput?: string
      isHidden?: boolean
      weight?: number
    }>
  }
  points: number
  order?: number
}

interface Assessment {
  id?: string
  _id?: string
  title: string
  description?: string
  instructions?: {
    general?: string
    additional?: string
  }
  type: string
  settings: {
    timeLimit: number | null
    attempts: number
    shuffleQuestions: boolean
    shuffleOptions: boolean
    requireCamera: boolean
    requireFullScreen: boolean
    preventCopyPaste: boolean
  }
  sections?: AssessmentSection[]
  grading: {
    totalPoints?: number
    passingScore: number
  }
}

interface Submission {
  id: string
  _id?: string
  attemptNumber: number
  startedAt: string
  timeLimit: number | null
  remainingTime: number | null
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const getQuestionKey = (question: Partial<Question> | null | undefined) =>
  (typeof question?.id === 'string' && question.id.trim()) ||
  (typeof question?._id === 'string' && question._id.trim()) ||
  ''

const normalizeAssessment = (raw: any): Assessment => ({
  id: raw?._id || raw?.id,
  _id: raw?._id,
  title: raw?.title || '',
  description: raw?.description || '',
  instructions: {
    general: raw?.instructions?.general || '',
    additional: raw?.instructions?.additional || ''
  },
  type: raw?.type || 'quiz',
  settings: {
    timeLimit: raw?.settings?.timeLimit ?? null,
    attempts: Number(raw?.settings?.attempts ?? 1),
    shuffleQuestions: Boolean(raw?.settings?.shuffleQuestions),
    shuffleOptions: Boolean(raw?.settings?.shuffleOptions),
    requireCamera: Boolean(raw?.settings?.requireCamera),
    requireFullScreen: Boolean(raw?.settings?.requireFullScreen),
    preventCopyPaste: Boolean(raw?.settings?.preventCopyPaste)
  },
  sections: Array.isArray(raw?.sections)
    ? raw.sections.map((section: any, index: number) => ({
        id: section?.id || section?._id || `sec_${index}`,
        title: section?.title || `Section ${index + 1}`,
        type: section?.type || 'theory',
        description: section?.description || '',
        totalPoints: Number(section?.totalPoints ?? 0),
        order: Number(section?.order ?? index)
      }))
    : [],
  grading: {
    totalPoints: Number(raw?.grading?.totalPoints ?? 0),
    passingScore: Number(raw?.grading?.passingScore ?? 60)
  }
})

const normalizeQuestions = (items: any[]): Question[] =>
  items.map((question, index) => ({
    id: question?.id || question?._id || `q_${index}`,
    _id: question?._id,
    type: question?.type || 'multiple-choice',
    sectionId: question?.sectionId || question?.section?._id,
    question: question?.question || '',
    options: Array.isArray(question?.options)
      ? question.options.map((option: any, optionIndex: number) => ({
          id: option?.id || option?._id || `opt_${index}_${optionIndex}`,
          text: option?.text || ''
        }))
      : [],
    coding: question?.coding
      ? {
          allowedLanguages: Array.isArray(question.coding.allowedLanguages)
            ? question.coding.allowedLanguages
            : [],
          starterCode:
            question.coding.starterCode && typeof question.coding.starterCode === 'object'
              ? question.coding.starterCode
              : {},
          testCases: Array.isArray(question.coding.testCases)
            ? question.coding.testCases.map((testCase: any) => ({
                input: testCase?.input || '',
                expectedOutput: testCase?.expectedOutput || '',
                isHidden: Boolean(testCase?.isHidden),
                weight: Number(testCase?.weight ?? 1)
              }))
            : []
        }
      : undefined,
    points: Number(question?.points ?? 1),
    order: Number(question?.order ?? index)
  }))

const normalizeSubmission = (raw: any): Submission => ({
  id: raw?.id || raw?._id || '',
  _id: raw?._id,
  attemptNumber: Number(raw?.attemptNumber ?? 1),
  startedAt: raw?.startedAt || new Date().toISOString(),
  timeLimit: raw?.timeLimit ?? null,
  remainingTime: raw?.remainingTime ?? null
})

export default function TakeAssessmentPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const assessmentId = Array.isArray(params.assessmentId) ? params.assessmentId[0] : params.assessmentId
  const { user } = useAuth()
  const router = useRouter()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Map<string, any>>(new Map())
  const [dirtyQuestionIds, setDirtyQuestionIds] = useState<Set<string>>(new Set())
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Set<string>>(new Set())
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [violations, setViolations] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isStartingAttempt, setIsStartingAttempt] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fullscreenLocked, setFullscreenLocked] = useState(false)
  const [autoStartTried, setAutoStartTried] = useState(false)
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)
  const [redirectAfterModalClose, setRedirectAfterModalClose] = useState<string | null>(null)
  const [statusModal, setStatusModal] = useState<{
    open: boolean
    type: 'success' | 'error' | 'warning'
    title: string
    message: string
  }>({
    open: false,
    type: 'warning',
    title: '',
    message: ''
  })

  const hasStartedRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const warningShownRef = useRef(false)
  const fullscreenViolationSentRef = useRef(false)
  const autoStartRequested = searchParams.get('autoStart') === '1'
  const forceFullscreen = searchParams.get('fullscreen') === '1'
  const [codeRunState, setCodeRunState] = useState<
    Record<
      string,
      {
        running: boolean
        output: string
        error: string
        results?: Array<{
          index: number
          input: string
          expectedOutput: string
          actualOutput: string
          stderr?: string
          passed: boolean
        }>
      }
    >
  >({})

  const showStatusModal = useCallback(
    (type: 'success' | 'error' | 'warning', title: string, message: string) => {
      setStatusModal({
        open: true,
        type,
        title,
        message
      })
    },
    []
  )

  const closeStatusModal = useCallback(() => {
    setStatusModal((prev) => ({ ...prev, open: false }))
    if (redirectAfterModalClose) {
      const redirectPath = redirectAfterModalClose
      setRedirectAfterModalClose(null)
      router.push(redirectPath)
    }
  }, [redirectAfterModalClose, router])

  const enterFullscreen = useCallback(async () => {
    if (!document.documentElement.requestFullscreen) return false
    try {
      await document.documentElement.requestFullscreen()
      return !!document.fullscreenElement
    } catch (fullscreenError) {
      console.error('Fullscreen request failed:', fullscreenError)
      return false
    }
  }, [])

  const saveProgress = useCallback(
    async (questionId: string, answer: any) => {
      if (!submission || answer === undefined) return

      try {
        await api.saveAssessmentProgress(submission.id, {
          questionId,
          answer
        })
      } catch (saveError) {
        console.error('Error saving progress:', saveError)
      }
    },
    [submission]
  )

  const flushDirtyAnswers = useCallback(async () => {
    if (!submission || dirtyQuestionIds.size === 0) return

    const ids = Array.from(dirtyQuestionIds)
    await Promise.all(
      ids.map(async (questionId) => {
        await saveProgress(questionId, answers.get(questionId))
      })
    )
    setDirtyQuestionIds(new Set())
  }, [answers, dirtyQuestionIds, saveProgress, submission])

  const addViolation = useCallback(
    async (type: string, details: string) => {
      setViolations((prev) => [...prev, `${type}: ${details}`])
      if (!submission) return

      try {
        await api.reportAssessmentViolation(submission.id, { type, details })
      } catch (violationError) {
        console.error('Error sending violation:', violationError)
      }
    },
    [submission]
  )

  const handleSubmit = useCallback(
    async (forceSubmit = false) => {
      if (isSubmitting || !submission) return
      if (forceFullscreen && fullscreenLocked && !forceSubmit) {
        showStatusModal('warning', 'Fullscreen Required', 'Re-enter fullscreen to continue this assessment.')
        return
      }

      setIsSubmitting(true)
      try {
        await flushDirtyAnswers()

        const answersArray = questions
          .map((question) => {
            const questionId = getQuestionKey(question)
            if (!questionId) return null
            const answer = answers.get(questionId)
            if (answer === undefined || answer === '') return null
            return {
              questionId,
              answer,
              timeSpent: 0
            }
          })
          .filter(Boolean)

        await api.submitAssessmentAttempt(submission.id, {
          answers: answersArray,
          deviceInfo: {
            userAgent: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        })
        setRedirectAfterModalClose(`/dashboard/assessments/${assessmentId}/results`)
        showStatusModal('success', 'Assessment Submitted', 'Your test has been submitted successfully.')
      } catch (submitError) {
        console.error('Error submitting assessment:', submitError)
        showStatusModal(
          'error',
          'Submission Failed',
          submitError instanceof Error ? submitError.message : 'Submission failed. Please retry.'
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [answers, assessmentId, flushDirtyAnswers, forceFullscreen, fullscreenLocked, isSubmitting, showStatusModal, submission]
  )

  const startAttempt = useCallback(async (options?: { allowFullscreenFailure?: boolean }) => {
    if (!assessmentId || hasStartedRef.current || !assessment) return
    setIsStartingAttempt(true)

    try {
      if (forceFullscreen || assessment.settings.requireFullScreen) {
        const fullscreenEntered = await enterFullscreen()
        if (!fullscreenEntered) {
          if (options?.allowFullscreenFailure) {
            return
          }
          throw new Error('Fullscreen mode is required for this assessment. Please allow fullscreen and try again.')
        }
      }

      hasStartedRef.current = true
      const data = await api.startAssessmentAttempt(assessmentId as string)
      const fetchedAssessment = normalizeAssessment(data.data.assessment)
      const fetchedSubmission = normalizeSubmission(data.data.submission)
      const fetchedQuestions = normalizeQuestions(data.data.questions || [])

      const normalizedQuestions = (fetchedAssessment.settings.shuffleQuestions
        ? shuffleArray(fetchedQuestions)
        : fetchedQuestions
      ).map((question) => ({
        ...question,
        options:
          fetchedAssessment.settings.shuffleOptions && question.options
            ? shuffleArray(question.options)
            : question.options
      }))

      setAssessment((prev) => ({
        ...(prev || fetchedAssessment),
        ...fetchedAssessment
      }))
      setSubmission(fetchedSubmission)
      setQuestions(normalizedQuestions)
      if (fetchedAssessment.sections?.length) {
        setActiveSectionId(fetchedAssessment.sections[0].id)
      }

      if (fetchedSubmission.remainingTime !== null && fetchedSubmission.remainingTime !== undefined) {
        setTimeRemainingSeconds(fetchedSubmission.remainingTime * 60)
      } else if (fetchedAssessment.settings.timeLimit) {
        setTimeRemainingSeconds(fetchedAssessment.settings.timeLimit * 60)
      } else {
        setTimeRemainingSeconds(null)
      }
    } catch (startError) {
      console.error('Error starting assessment:', startError)
      setError(startError instanceof Error ? startError.message : 'Failed to start assessment')
      hasStartedRef.current = false
    } finally {
      setIsStartingAttempt(false)
    }
  }, [assessment, assessmentId, enterFullscreen])

  useEffect(() => {
    const fetchAssessmentMeta = async () => {
      if (!assessmentId) return
      try {
        const data = await api.getAssessmentById(assessmentId as string)
        setAssessment(normalizeAssessment(data.data))
      } catch (metaError) {
        console.error(metaError)
        setError(metaError instanceof Error ? metaError.message : 'Failed to load assessment')
      } finally {
        setLoading(false)
      }
    }

    if (user) fetchAssessmentMeta()
  }, [assessmentId, user])

  useEffect(() => {
    if (!assessment || !submission) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addViolation('tab-switch', 'User switched away from assessment tab')
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (assessment.settings.preventCopyPaste && (event.ctrlKey || event.metaKey)) {
        const key = event.key.toLowerCase()
        if (key === 'c' || key === 'v' || key === 'x') {
          event.preventDefault()
          addViolation('copy-paste', 'Copy/paste blocked')
        }
      }

      if (event.key === 'ArrowRight' && !fullscreenLocked) {
        setCurrentQuestionIndex((prev) => Math.min(prev + 1, questions.length - 1))
      }
      if (event.key === 'ArrowLeft' && !fullscreenLocked) {
        setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0))
      }
    }

    const handleContextMenu = (event: MouseEvent) => {
      if (assessment.settings.preventCopyPaste) {
        event.preventDefault()
        addViolation('right-click', 'Context menu blocked')
      }
    }

    const handleFullscreenChange = () => {
      if (!(forceFullscreen || assessment.settings.requireFullScreen)) return
      const inFullscreen = !!document.fullscreenElement
      if (!inFullscreen) {
        setFullscreenLocked(true)
        if (!fullscreenViolationSentRef.current) {
          fullscreenViolationSentRef.current = true
          addViolation('fullscreen-exit', 'Exited fullscreen during assessment')
        }
      } else {
        setFullscreenLocked(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [addViolation, assessment, forceFullscreen, fullscreenLocked, questions.length, submission])

  useEffect(() => {
    if (!submission || timeRemainingSeconds === null || timeRemainingSeconds <= 0) return

    timerRef.current = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          handleSubmit(true)
          return 0
        }
        if (prev === 300 && !warningShownRef.current) {
          warningShownRef.current = true
          showStatusModal('warning', 'Time Warning', 'Only 5 minutes remaining.')
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [handleSubmit, showStatusModal, submission, timeRemainingSeconds])

  useEffect(() => {
    if (!submission) return
    const interval = setInterval(() => {
      flushDirtyAnswers()
    }, 20000)
    return () => clearInterval(interval)
  }, [flushDirtyAnswers, submission])

  useEffect(() => {
    if (!assessment || submission || loading || isStartingAttempt || autoStartTried || !autoStartRequested) return
    setAutoStartTried(true)
    startAttempt({ allowFullscreenFailure: true })
  }, [
    assessment,
    submission,
    loading,
    isStartingAttempt,
    autoStartTried,
    autoStartRequested,
    startAttempt
  ])
 const currentQuestion = questions[currentQuestionIndex]

 const questionsBySection = useMemo(() => {
    const map = new Map<string, Question[]>()
    questions.forEach((question) => {
      const key = question.sectionId || 'default'
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(question)
    })
    return map
  }, [questions])
  useEffect(() => {
    if (!currentQuestion?.sectionId) return
    setActiveSectionId(currentQuestion.sectionId)
  }, [currentQuestion?.sectionId])

 
  

  const sectionBreakup = useMemo(() => {
    const sections = assessment?.sections || []
    return sections.map((section) => ({
      ...section,
      totalPoints: (questionsBySection.get(section.id) || []).reduce((sum, question) => sum + (question.points || 0), 0),
      totalQuestions: (questionsBySection.get(section.id) || []).length
    }))
  }, [assessment?.sections, questionsBySection])

  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const key = getQuestionKey(question)
        return key && answers.get(key) !== undefined && answers.get(key) !== ''
      }).length,
    [answers, questions]
  )
  const unansweredCount = questions.length - answeredCount
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const handleAnswerChange = (questionId: string, value: any) => {
    if (fullscreenLocked) return
    if (!questionId) return
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(questionId, value)
      return next
    })
    setDirtyQuestionIds((prev) => new Set(prev).add(questionId))
  }

  const toggleFlag = (questionId: string) => {
    if (!questionId) return
    setFlaggedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  const runCode = async (question: Question) => {
    if (!submission) return
    const questionKey = getQuestionKey(question)
    if (!questionKey) return
    const currentAnswer = answers.get(questionKey) || {}
    const language = currentAnswer.language || question.coding?.allowedLanguages?.[0] || 'javascript'
    const code = currentAnswer.code || question.coding?.starterCode?.[language] || ''

    if (!code.trim()) {
      setCodeRunState((prev) => ({
        ...prev,
        [questionKey]: { running: false, output: '', error: 'Please write code before running.', results: [] }
      }))
      return
    }

    setCodeRunState((prev) => ({
      ...prev,
      [questionKey]: { running: true, output: '', error: '', results: [] }
    }))

    try {
      const payload = await api.runAssessmentCode(submission.id, questionKey, { language, code })
      if (!payload.success) {
        throw new Error(payload.message || 'Execution failed')
      }

      const results = payload.data.results || []
      const combinedOutput = results
        .map((result: any) => {
          const status = result.passed ? 'PASS' : 'FAIL'
          return `Case ${result.index}: ${status}\nInput: ${result.input}\nExpected: ${result.expectedOutput}\nOutput: ${result.actualOutput}\n${result.stderr ? `Error: ${result.stderr}\n` : ''}`
        })
        .join('\n')

      const updatedAnswer = {
        ...currentAnswer,
        language,
        code,
        passedTestCases: payload.data.passedTestCases || 0,
        totalTestCases: payload.data.totalTestCases || 0,
        lastRunAt: new Date().toISOString()
      }
      handleAnswerChange(questionKey, updatedAnswer)

      setCodeRunState((prev) => ({
        ...prev,
        [questionKey]: { running: false, output: combinedOutput || 'Executed successfully.', error: '', results }
      }))
    } catch (runError: any) {
      console.error('Sample test execution failed:', runError)
      setCodeRunState((prev) => ({
        ...prev,
        [questionKey]: { running: false, output: '', error: runError?.message || 'Execution failed', results: [] }
      }))
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading assessment...</p>
        </div>
      </div>
    )
  }

  if (error || !assessment) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center">
            <ExclamationTriangleIcon className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <p className="mb-4 text-sm text-muted-foreground">{error || 'Assessment data is unavailable.'}</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!submission || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-4xl space-y-6 py-6">
          <Card>
            <CardHeader>
              <CardTitle>{assessment.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {assessment.description && (
                <div>
                  <p className="font-medium">Description</p>
                  <p className="text-muted-foreground">{assessment.description}</p>
                </div>
              )}

              <div>
                <p className="mb-2 font-medium">Assessment Rules</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Allowed attempts: {assessment.settings.attempts}</li>
                  {assessment.settings.timeLimit ? (
                    <li>Time limit: {assessment.settings.timeLimit} minute(s)</li>
                  ) : (
                    <li>No fixed time limit</li>
                  )}
                  {(forceFullscreen || assessment.settings.requireFullScreen) && (
                    <li>Fullscreen is mandatory throughout the attempt</li>
                  )}
                  {assessment.settings.requireCamera && <li>Camera is required during attempt</li>}
                  {assessment.settings.preventCopyPaste && <li>Copy/paste actions are blocked</li>}
                </ul>
              </div>

              {sectionBreakup.length > 0 && (
                <div>
                  <p className="mb-2 font-medium">Section-wise Marks Breakup</p>
                  <div className="space-y-2">
                    {sectionBreakup.map((section) => (
                      <div key={section.id} className="rounded-md border border-gray-200 p-2 dark:border-gray-700">
                        <p className="font-medium">{section.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {section.totalQuestions} question(s) . {section.totalPoints} marks
                        </p>
                        {section.description && (
                          <p className="text-xs text-muted-foreground">{section.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {assessment.instructions?.general && (
                <div>
                  <p className="font-medium">General Instructions</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{assessment.instructions.general}</p>
                </div>
              )}

              {assessment.instructions?.additional && (
                <div>
                  <p className="font-medium">Additional Instructions</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{assessment.instructions.additional}</p>
                </div>
              )}

              {(forceFullscreen || assessment.settings.requireFullScreen) && (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
                  <p className="font-medium">Fullscreen Required</p>
                  <p className="text-sm">You can start only after fullscreen is granted.</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button onClick={() => startAttempt()} disabled={isStartingAttempt}>
                  {isStartingAttempt ? 'Starting...' : 'Start Assessment'}
                </Button>
                {(forceFullscreen || assessment.settings.requireFullScreen) && (
                  <Button variant="outline" onClick={enterFullscreen}>
                    <ArrowsPointingOutIcon className="mr-2 h-4 w-4" />
                    Test Fullscreen
                  </Button>
                )}
              </div>
              {autoStartRequested && (forceFullscreen || assessment.settings.requireFullScreen) && (
                <p className="text-xs text-muted-foreground">
                  Opened in a new tab. Click <span className="font-medium">Start Assessment</span> to continue with fullscreen.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Coding questions: use <span className="font-medium">Run Sample Tests</span> to validate your solution before final submission.
                Final score is evaluated on complete test suite (including hidden tests).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">{assessment.type.toUpperCase()}</p>
            <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">{assessment.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {timeRemainingSeconds !== null && (
              <Badge variant={timeRemainingSeconds <= 300 ? 'destructive' : 'secondary'} className="px-3 py-1 text-sm font-semibold shadow-sm">
                <ClockIcon className="mr-1 h-4 w-4" />
                {formatTime(timeRemainingSeconds)}
              </Badge>
            )}
            <Badge variant="outline" className="rounded-full bg-card/80 px-3 py-1">Attempt #{submission.attemptNumber}</Badge>
            <Badge variant="outline" className="rounded-full bg-card/80 px-3 py-1">{answeredCount}/{questions.length} answered</Badge>
            <Button onClick={() => setConfirmSubmitOpen(true)} disabled={isSubmitting || fullscreenLocked} className="min-w-[120px] rounded-xl shadow-sm">
              {isSubmitting ? 'Submitting...' : 'Submit Test'}
            </Button>
          </div>
        </div>
      </header>

      {fullscreenLocked && (
        <div className="mx-auto mt-3 w-full max-w-7xl rounded-xl border border-red-300/70 bg-red-50/90 px-4 py-2 text-sm text-red-900 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          Fullscreen was exited. Re-enter fullscreen to continue.
          <Button variant="outline" size="sm" className="ml-3" onClick={enterFullscreen}>
            Re-enter Fullscreen
          </Button>
        </div>
      )}

      {violations.length > 0 && (
        <div className="mx-auto mt-3 w-full max-w-7xl rounded-xl border border-yellow-300/70 bg-yellow-50/90 px-4 py-2 text-sm text-yellow-900 shadow-sm dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">
          {violations.length} proctoring event(s) detected in this attempt.
        </div>
      )}

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-6 xl:py-6">
        <Card className={`border-border/70 bg-card/95 shadow-lg ${fullscreenLocked ? 'pointer-events-none opacity-70' : ''}`}>
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl tracking-tight">Question {currentQuestionIndex + 1}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentQuestion.type.replace('-', ' ')} • {currentQuestion.points} point{currentQuestion.points > 1 ? 's' : ''}
                </p>
                {currentQuestion.sectionId && (
                  <p className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Section: {assessment.sections?.find((section) => section.id === currentQuestion.sectionId)?.title || currentQuestion.sectionId}
                  </p>
                )}
              </div>
              <Button
                variant={flaggedQuestionIds.has(getQuestionKey(currentQuestion)) ? 'default' : 'outline'}
                size="sm"
                className="rounded-xl"
                onClick={() => toggleFlag(getQuestionKey(currentQuestion))}
              >
                <FlagIcon className="mr-2 h-4 w-4" />
                {flaggedQuestionIds.has(getQuestionKey(currentQuestion)) ? 'Flagged' : 'Flag'}
              </Button>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {currentQuestion.type !== 'coding' && (
              <p className="whitespace-pre-wrap text-lg leading-8">{currentQuestion.question}</p>
            )}

            <QuestionInput
              question={currentQuestion}
              value={answers.get(getQuestionKey(currentQuestion))}
              onChange={(value) => handleAnswerChange(getQuestionKey(currentQuestion), value)}
              onRunCode={() => runCode(currentQuestion)}
              runState={codeRunState[getQuestionKey(currentQuestion)]}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
              <Button variant="outline" className="rounded-xl" onClick={() => flushDirtyAnswers()} disabled={fullscreenLocked}>
                Save
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={currentQuestionIndex === 0 || fullscreenLocked}
                >
                  Previous
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(prev + 1, questions.length - 1))}
                  disabled={currentQuestionIndex === questions.length - 1 || fullscreenLocked}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit border-border/70 bg-card/95 shadow-lg lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle className="text-lg">Question Palette</CardTitle>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">{answeredCount} Answered</span>
              <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">{unansweredCount} Unanswered</span>
              <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 text-yellow-700 dark:text-yellow-300">{flaggedQuestionIds.size} Flagged</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
              {questions.map((question, index) => {
                const isCurrent = index === currentQuestionIndex
                const questionKey = getQuestionKey(question)
                const isAnswered = questionKey ? answers.get(questionKey) !== undefined && answers.get(questionKey) !== '' : false
                const isFlagged = questionKey ? flaggedQuestionIds.has(questionKey) : false

                return (
                  <button
                    key={questionKey || index}
                    type="button"
                    onClick={() => !fullscreenLocked && setCurrentQuestionIndex(index)}
                    className={[
                      'relative h-10 rounded-xl border text-sm font-semibold shadow-sm transition-all',
                      isCurrent ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                      !isCurrent && isAnswered ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : '',
                      !isCurrent && !isAnswered ? 'text-muted-foreground' : '',
                      fullscreenLocked ? 'pointer-events-none opacity-70' : ''
                    ].join(' ')}
                  >
                    {index + 1}
                    {isFlagged && <FlagIcon className="absolute right-1 top-1 h-3 w-3 text-yellow-500" />}
                  </button>
                )
              })}
            </div>

            {assessment.sections && assessment.sections.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs">
                <p className="font-medium text-muted-foreground">Sections</p>
                <div className="space-y-1">
                  {assessment.sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        const firstQuestionIndex = questions.findIndex((q) => q.sectionId === section.id)
                        if (firstQuestionIndex >= 0) {
                          setCurrentQuestionIndex(firstQuestionIndex)
                          setActiveSectionId(section.id)
                        }
                      }}
                      className={`w-full rounded-lg border px-2 py-1 text-left transition-colors ${activeSectionId === section.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                Green = Answered
              </div>
              <div className="flex items-center gap-2">
                <FlagIcon className="h-4 w-4 text-yellow-500" />
                Flag icon = Marked for review
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Submit Assessment?</DialogTitle>
            <DialogDescription>
              You will not be able to edit your answers after submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmSubmitOpen(false)
                handleSubmit(false)
              }}
              disabled={isSubmitting}
            >
              Confirm Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusModal.open} onOpenChange={(open) => !open && closeStatusModal()}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {statusModal.type === 'success' ? (
                <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
              ) : statusModal.type === 'error' ? (
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
              )}
              {statusModal.title}
            </DialogTitle>
            <DialogDescription className="text-sm">{statusModal.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={closeStatusModal}>{statusModal.type === 'success' ? 'Continue' : 'Close'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuestionInput({
  question,
  value,
  onChange,
  onRunCode,
  runState
}: {
  question: Question
  value: any
  onChange: (value: any) => void
  onRunCode?: () => void
  runState?: {
    running: boolean
    output: string
    error: string
    results?: Array<{
      index: number
      input: string
      expectedOutput: string
      actualOutput: string
      stderr?: string
      passed: boolean
    }>
  }
}) {
  const [codingPaneTab, setCodingPaneTab] = useState<'instructions' | 'output'>('instructions')
  const questionKey = getQuestionKey(question)

  useEffect(() => {
    if (runState?.error || (runState?.results && runState.results.length > 0)) {
      setCodingPaneTab('output')
    }
  }, [runState?.error, runState?.results])

  const getDefaultStarter = (language: string) => {
    if (language === 'javascript') {
      return `function solve() {\n  // Write your solution\n}`
    }
    if (language === 'python') {
      return `def solve():\n    # Write your solution\n    pass`
    }
    return ''
  }

  switch (question.type) {
    case 'multiple-choice':
      return (
        <div className="space-y-3">
          {question.options?.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm transition-colors hover:bg-muted/40"
            >
              <input
                type="radio"
                name={`question-${questionKey || 'unknown'}`}
                value={option.id}
                checked={value === option.id}
                onChange={(event) => onChange(event.target.value)}
                className="h-4 w-4"
              />
              <span className="text-sm">{option.text}</span>
            </label>
          ))}
        </div>
      )
    case 'true-false':
      return (
        <div className="space-y-3">
          {[
            { label: 'True', value: true },
            { label: 'False', value: false }
          ].map((option) => (
            <label
              key={option.label}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm transition-colors hover:bg-muted/40"
            >
              <input
                type="radio"
                name={`question-${questionKey || 'unknown'}`}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="h-4 w-4"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      )
    case 'short-answer':
    case 'fill-blank':
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your answer"
          className="w-full rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      )
    case 'essay':
      return (
        <textarea
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          rows={8}
          placeholder="Write your answer"
          className="w-full rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      )
    case 'coding': {
      const allowedLanguages = question.coding?.allowedLanguages || ['javascript']
      const currentLanguage = value?.language || allowedLanguages[0]
      const starterCode = question.coding?.starterCode?.[currentLanguage] || getDefaultStarter(currentLanguage)
      const currentCode = value?.code || starterCode
      const sampleCases = (question.coding?.testCases || []).filter((testCase) => !testCase.isHidden)
      const hasStdinBoilerplate =
        typeof currentCode === 'string' && /fs\.readFileSync|process\.stdin|sys\.stdin|input\s*\(/i.test(currentCode)

      return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg">
          <div className="grid min-h-[640px] grid-cols-1 xl:grid-cols-[1.05fr_1.45fr]">
            <section className="border-b border-border/70 bg-muted/15 xl:border-b-0 xl:border-r">
              <div className="flex items-center gap-2 border-b border-border/70 p-3">
                <button
                  type="button"
                  onClick={() => setCodingPaneTab('instructions')}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    codingPaneTab === 'instructions' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Instructions
                </button>
                <button
                  type="button"
                  onClick={() => setCodingPaneTab('output')}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    codingPaneTab === 'output' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Output
                </button>
              </div>

              {codingPaneTab === 'instructions' ? (
                <div className="max-h-[590px] space-y-4 overflow-auto p-4">
                  <p className="whitespace-pre-wrap text-lg leading-8">{question.question}</p>
                  {sampleCases.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
                      <p className="text-sm font-semibold">Sample Tests</p>
                      {sampleCases.map((testCase, index) => (
                        <div key={index} className="rounded-lg border border-border/70 bg-muted/20 p-2 text-xs">
                          <p className="font-medium">Case {index + 1}</p>
                          <p className="text-muted-foreground">Input: {testCase.input || '(empty)'}</p>
                          <p className="text-muted-foreground">Expected: {testCase.expectedOutput || '(empty)'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasStdinBoilerplate && (
                    <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-800 dark:text-yellow-200">
                      Remove stdin parsing code. Just implement the required function.
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-h-[590px] overflow-auto p-4">
                  <div className="space-y-2 text-xs">
                    {runState?.error ? (
                      <pre className="whitespace-pre-wrap rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-700 dark:text-red-300">{runState.error}</pre>
                    ) : runState?.results && runState.results.length > 0 ? (
                      runState.results.map((result) => (
                        <div key={result.index} className="rounded-lg border border-border/70 bg-background/70 p-3">
                          <p className={result.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                            Case {result.index}: {result.passed ? 'PASS' : 'FAIL'}
                          </p>
                          <p className="text-muted-foreground">Input: {result.input || '(empty)'}</p>
                          <p className="text-muted-foreground">Expected: {result.expectedOutput || '(empty)'}</p>
                          <p className="text-muted-foreground">Output: {result.actualOutput || '(empty)'}</p>
                          {result.stderr ? <p className="text-red-600 dark:text-red-400">Error: {result.stderr}</p> : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">Run sample tests to view output.</p>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="bg-background/70">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">Language</span>
                  <select
                    value={currentLanguage}
                    onChange={(event) =>
                      onChange({
                        ...(value || {}),
                        language: event.target.value,
                        code: value?.code || question.coding?.starterCode?.[event.target.value] || ''
                      })
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {allowedLanguages.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() =>
                      onChange({
                        ...(value || {}),
                        language: currentLanguage,
                        code: starterCode
                      })
                    }
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="grid grid-rows-[minmax(300px,1fr)_220px]">
                <div className="overflow-hidden border-b border-border/70 bg-[#f9fafc] dark:bg-[#0a0d14]">
                  <div className="border-b border-slate-200 bg-[#eef1f6] px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-[#121826] dark:text-slate-200">
                    Solution
                  </div>
                  <textarea
                    value={currentCode}
                    onChange={(event) =>
                      onChange({
                        ...(value || {}),
                        language: currentLanguage,
                        code: event.target.value
                      })
                    }
                    rows={14}
                    placeholder="Write your solution"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    className="h-full w-full resize-none border-0 bg-[#f9fafc] px-4 py-3 font-mono text-sm leading-6 text-slate-800 focus:outline-none dark:bg-[#0a0d14] dark:text-slate-100"
                  />
                </div>

                <div className="overflow-hidden bg-[#f4f6fb] dark:bg-[#111521]">
                  <div className="border-b border-slate-200 bg-[#e9edf5] px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-[#171f31] dark:text-slate-200">
                    Sample Tests
                  </div>
                  <div className="max-h-[170px] overflow-auto px-3 py-2 text-xs text-slate-700 dark:text-slate-100">
                    {sampleCases.length === 0 ? (
                      <p className="text-slate-500 dark:text-slate-400">No visible sample tests configured.</p>
                    ) : (
                      <div className="space-y-2">
                        {sampleCases.map((testCase, index) => (
                          <div key={index} className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-600/60 dark:bg-[#0d1220]">
                            <p className="font-semibold">Case {index + 1}</p>
                            <p className="text-slate-600 dark:text-slate-300">Input: {testCase.input || '(empty)'}</p>
                            <p className="text-slate-600 dark:text-slate-300">Expected: {testCase.expectedOutput || '(empty)'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/70 bg-card/80 px-3 py-3">
                <div className="text-xs text-muted-foreground">
                  {value?.totalTestCases ? (
                    <span>{value?.passedTestCases || 0}/{value.totalTestCases} tests passed</span>
                  ) : (
                    <span>Run tests to validate your solution.</span>
                  )}
                  {value?.lastRunAt ? <span className="ml-2">Last run: {new Date(value.lastRunAt).toLocaleTimeString()}</span> : null}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="rounded-lg" onClick={onRunCode} disabled={runState?.running}>
                    {runState?.running ? 'Running...' : 'TEST'}
                  </Button>
                  <Button type="button" className="rounded-lg" onClick={onRunCode} disabled={runState?.running}>
                    ATTEMPT
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      )
    }
    default:
      return <p className="text-sm text-muted-foreground">Unsupported question type</p>
  }
}



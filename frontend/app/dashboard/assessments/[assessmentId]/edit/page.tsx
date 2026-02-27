// assessments/edit/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '../../../../../components/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { 
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  XMarkIcon,
  ChevronLeftIcon,
  AcademicCapIcon,
  Cog6ToothIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { Save, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Question {
  id: string
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'fill-blank' | 'coding'
  question: string
  options: Array<{ id: string; text: string; isCorrect: boolean }>
  correctAnswer: any
  points: number
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  coding?: {
    allowedLanguages: string[]
    starterCode: Record<string, string>
    testCases: Array<{
      input: string
      expectedOutput: string
      isHidden: boolean
      weight: number
    }>
  }
  tags: string[]
  order: number
}

interface Course {
  _id: string
  title: string
}

interface Batch {
  _id: string
  name: string
  batchCode: string
  courseId: string
}

interface Assessment {
  _id: string
  title: string
  description: string
  instructions: {
    general: string
    additional: string
  }
  type: 'quiz' | 'exam' | 'assignment' | 'practice'
  courseId: string
  batchId?: string
  settings: {
    timeLimit: number | null
    attempts: number
    shuffleQuestions: boolean
    shuffleOptions: boolean
    showResults: 'immediately' | 'after-deadline' | 'manual' | 'never'
    showCorrectAnswers: boolean
    allowReview: boolean
    requireCamera: boolean
    requireFullScreen: boolean
    preventCopyPaste: boolean
  }
  grading: {
    passingScore: number
    gradingMethod: 'automatic' | 'manual' | 'hybrid'
    weightage: number
  }
  schedule: {
    isScheduled: boolean
    startDate?: string
    endDate?: string
    timezone: string
  }
  status: 'draft' | 'published'
  questions: Question[]
}

const questionTypes = [
  { value: 'multiple-choice', label: 'Multiple Choice', icon: '🔘' },
  { value: 'true-false', label: 'True/False', icon: '✅' },
  { value: 'short-answer', label: 'Short Answer', icon: '📝' },
  { value: 'essay', label: 'Essay', icon: '📄' },
  { value: 'fill-blank', label: 'Fill in the Blank', icon: '🔤' },
  { value: 'coding', label: 'Coding (DSA)', icon: '💻' }
]

const difficulties = [
  { value: 'easy', label: 'Easy', color: 'text-green-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'hard', label: 'Hard', color: 'text-red-600' }
]

const ALL_BATCHES_VALUE = '__all_batches__'

export default function EditAssessmentPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const assessmentId = params.assessmentId as string
  
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTab, setSelectedTab] = useState('details')

  useEffect(() => {
    if (assessmentId) {
      fetchAssessment()
      fetchCourses()
    }
  }, [assessmentId])

  useEffect(() => {
    if (assessment?.courseId) {
      fetchBatches(assessment.courseId)
    } else {
      setBatches([])
    }
  }, [assessment?.courseId])

  const fetchAssessment = async () => {
    try {
      const data = await api.getAssessmentById(assessmentId as string)
      const fetched = data.data as any

      setAssessment({
        _id: fetched?._id || fetched?.id || assessmentId,
        title: fetched?.title || '',
        description: fetched?.description || '',
        instructions: {
          general: fetched?.instructions?.general || '',
          additional: fetched?.instructions?.additional || ''
        },
        type: fetched?.type || 'quiz',
        courseId:
          typeof fetched?.courseId === 'string'
            ? fetched.courseId
            : fetched?.courseId?._id || fetched?.courseId?.id || '',
        batchId:
          typeof fetched?.batchId === 'string'
            ? fetched.batchId
            : fetched?.batchId?._id || fetched?.batchId?.id || undefined,
        settings: {
          timeLimit: fetched?.settings?.timeLimit ?? null,
          attempts: Number(fetched?.settings?.attempts ?? 1),
          shuffleQuestions: Boolean(fetched?.settings?.shuffleQuestions),
          shuffleOptions: Boolean(fetched?.settings?.shuffleOptions),
          showResults: fetched?.settings?.showResults || 'immediately',
          showCorrectAnswers:
            fetched?.settings?.showCorrectAnswers === undefined
              ? true
              : Boolean(fetched.settings.showCorrectAnswers),
          allowReview:
            fetched?.settings?.allowReview === undefined ? true : Boolean(fetched.settings.allowReview),
          requireCamera: Boolean(fetched?.settings?.requireCamera),
          requireFullScreen: Boolean(fetched?.settings?.requireFullScreen),
          preventCopyPaste: Boolean(fetched?.settings?.preventCopyPaste)
        },
        grading: {
          passingScore: Number(fetched?.grading?.passingScore ?? 60),
          gradingMethod: fetched?.grading?.gradingMethod || 'automatic',
          weightage: Number(fetched?.grading?.weightage ?? 100)
        },
        schedule: {
          isScheduled: Boolean(fetched?.schedule?.isScheduled),
          startDate: fetched?.schedule?.startDate || undefined,
          endDate: fetched?.schedule?.endDate || undefined,
          timezone: fetched?.schedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        status: fetched?.status === 'published' ? 'published' : 'draft',
        questions: []
      })
      setQuestions(
        (fetched?.questions || []).map((question: any, index: number) => ({
          id: question?.id || question?._id || `q_${Date.now()}_${index}`,
          type: question?.type || 'multiple-choice',
          question: question?.question || '',
          options: Array.isArray(question?.options)
            ? question.options.map((option: any, optionIndex: number) => ({
                id: option?.id || option?._id || `opt_${index}_${optionIndex}`,
                text: option?.text || '',
                isCorrect: Boolean(option?.isCorrect)
              }))
            : [],
          correctAnswer: question?.correctAnswer ?? null,
          points: Number(question?.points ?? 1),
          explanation: question?.explanation || '',
          difficulty: question?.difficulty || 'medium',
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
          tags: Array.isArray(question?.tags) ? question.tags : [],
          order: Number(question?.order ?? index)
        }))
      )
    } catch (error) {
      console.error('Error fetching assessment:', error)
      toast.error('Failed to load assessment')
    } finally {
      setLoading(false)
    }
  }

  const fetchCourses = async () => {
    try {
      const data = await api.getCourses()
      setCourses(data.data || [])
    } catch (error) {
      console.error('Error fetching courses:', error)
      toast.error('Failed to load courses')
    }
  }

  const fetchBatches = async (courseId: string) => {
    try {
      const data = await api.getBatches({ courseId })
      setBatches(data.data || [])
    } catch (error) {
      console.error('Error fetching batches:', error)
      toast.error('Failed to load batches')
    }
  }

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      type: 'multiple-choice',
      question: '',
      options: [
        { id: `opt_${Date.now()}_1`, text: '', isCorrect: true },
        { id: `opt_${Date.now()}_2`, text: '', isCorrect: false }
      ],
      correctAnswer: null,
      points: 1,
      explanation: '',
      difficulty: 'medium',
      tags: [],
      order: questions.length
    }
    setQuestions([...questions, newQuestion])
    setSelectedTab('questions')
    toast.success('Question added')
  }

  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ))
  }

  const deleteQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId))
    toast.success('Question deleted')
  }

  const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
    const index = questions.findIndex(q => q.id === questionId)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= questions.length) return

    const newQuestions = [...questions]
    const [movedQuestion] = newQuestions.splice(index, 1)
    newQuestions.splice(newIndex, 0, movedQuestion)

    newQuestions.forEach((q, i) => q.order = i)
    setQuestions(newQuestions)
    toast.success(`Question moved ${direction}`)
  }

  const addOption = (questionId: string) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return

    const newOption = {
      id: `opt_${Date.now()}`,
      text: '',
      isCorrect: false
    }

    updateQuestion(questionId, {
      options: [...question.options, newOption]
    })
  }

  const updateOption = (questionId: string, optionId: string, updates: { text?: string; isCorrect?: boolean }) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return

    const newOptions = question.options.map(opt => 
      opt.id === optionId ? { ...opt, ...updates } : opt
    )

    updateQuestion(questionId, { options: newOptions })
  }

  const deleteOption = (questionId: string, optionId: string) => {
    const question = questions.find(q => q.id === questionId)
    if (!question || question.options.length <= 2) return

    const newOptions = question.options.filter(opt => opt.id !== optionId)
    updateQuestion(questionId, { options: newOptions })
  }

  const handleSave = async (status: 'draft' | 'published' = 'draft') => {
    if (!assessment) return
    
    setSaving(true)
    try {
      const assessmentData = {
        ...assessment,
        status,
        questions: questions.map(q => ({
          ...q,
          options: q.type === 'multiple-choice' ? q.options : undefined
        }))
      }

      const data = await api.updateAssessmentById(assessmentId as string, assessmentData)
      toast.success(`Assessment ${status === 'published' ? 'published' : 'saved'} successfully`)
      
      if (status === 'published') {
        router.push('/dashboard/assessments')
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Error updating assessment:', error)
      toast.error('Failed to update assessment')
    } finally {
      setSaving(false)
    }
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Assessment not found
          </h1>
          <Button onClick={() => router.push('/dashboard/assessments')}>
            Back to Assessments
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.back()}
            className="rounded-full h-9 w-9 p-0"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Edit Assessment
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Update your assessment details and questions
            </p>
          </div>
          <Badge variant={assessment.status === 'published' ? 'default' : 'secondary'} className="ml-2">
            {assessment.status === 'published' ? 'Published' : 'Draft'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button 
            variant="outline"
            onClick={() => handleSave('draft')}
            disabled={saving || !assessment.title || !assessment.courseId}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button 
            onClick={() => handleSave('published')}
            disabled={saving || !assessment.title || !assessment.courseId || questions.length === 0}
            className="gap-2"
          >
            <EyeIcon className="h-4 w-4" />
            Update & Publish
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-4 gap-2 w-full">
        <Button
          variant={selectedTab === 'details' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('details')}
          className="flex items-center gap-2"
        >
          <AcademicCapIcon className="h-4 w-4" />
          Details
        </Button>
        <Button
          variant={selectedTab === 'questions' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('questions')}
          className="flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Questions
          {questions.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {questions.length}
            </Badge>
          )}
        </Button>
        <Button
          variant={selectedTab === 'settings' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('settings')}
          className="flex items-center gap-2"
        >
          <Cog6ToothIcon className="h-4 w-4" />
          Settings
        </Button>
        <Button
          variant={selectedTab === 'schedule' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('schedule')}
          className="flex items-center gap-2"
        >
          <CalendarIcon className="h-4 w-4" />
          Schedule
        </Button>
      </div>

      {/* Assessment Details */}
      {selectedTab === 'details' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Set up the basic details of your assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Assessment Title*</Label>
                  <Input
                    id="title"
                    value={assessment.title}
                    onChange={(e) => setAssessment({...assessment, title: e.target.value})}
                    placeholder="Enter assessment title"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="type">Type*</Label>
                  <Select 
                    value={assessment.type} 
                    onValueChange={(value: any) => setAssessment({...assessment, type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="practice">Practice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={assessment.description}
                  onChange={(e) => setAssessment({...assessment, description: e.target.value})}
                  placeholder="Enter assessment description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="generalInstructions">General Instructions</Label>
                <Textarea
                  id="generalInstructions"
                  value={assessment.instructions?.general || ''}
                  onChange={(e) =>
                    setAssessment({
                      ...assessment,
                      instructions: {
                        ...(assessment.instructions || { general: '', additional: '' }),
                        general: e.target.value
                      }
                    })
                  }
                  placeholder="Instructions shown before student starts this assessment"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalInstructions">Additional Instructions</Label>
                <Textarea
                  id="additionalInstructions"
                  value={assessment.instructions?.additional || ''}
                  onChange={(e) =>
                    setAssessment({
                      ...assessment,
                      instructions: {
                        ...(assessment.instructions || { general: '', additional: '' }),
                        additional: e.target.value
                      }
                    })
                  }
                  placeholder="Optional extra instructions for this specific assessment"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="course">Course*</Label>
                  <Select 
                    value={assessment.courseId} 
                    onValueChange={(value) => setAssessment({...assessment, courseId: value, batchId: undefined})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course._id} value={course._id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batch">Batch (optional)</Label>
                  <Select 
                    value={assessment.batchId || ALL_BATCHES_VALUE}
                    onValueChange={(value) =>
                      setAssessment({
                        ...assessment,
                        batchId: value === ALL_BATCHES_VALUE ? undefined : value
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch or leave empty for all" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_BATCHES_VALUE}>All batches</SelectItem>
                      {batches.map(batch => (
                        <SelectItem key={batch._id} value={batch._id}>
                          {batch.name} ({batch.batchCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
              <CardTitle>Grading</CardTitle>
              <CardDescription>
                Configure how this assessment will be graded
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="passingScore">Passing Score (%)</Label>
                  <Input
                    id="passingScore"
                    type="number"
                    min="0"
                    max="100"
                    value={assessment.grading.passingScore}
                    onChange={(e) => setAssessment({
                      ...assessment, 
                      grading: {...assessment.grading, passingScore: Number(e.target.value)}
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gradingMethod">Grading Method</Label>
                  <Select 
                    value={assessment.grading.gradingMethod}
                    onValueChange={(value: any) => setAssessment({
                      ...assessment, 
                      grading: {...assessment.grading, gradingMethod: value}
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatic">Automatic</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weightage">Weightage (%)</Label>
                  <Input
                    id="weightage"
                    type="number"
                    min="0"
                    max="100"
                    value={assessment.grading.weightage}
                    onChange={(e) => setAssessment({
                      ...assessment, 
                      grading: {...assessment.grading, weightage: Number(e.target.value)}
                    })}
                  />
                </div>
              </div>

              {questions.length > 0 && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Points: <span className="font-semibold">{totalPoints}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Questions */}
      {selectedTab === 'questions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Questions</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Add and manage your assessment questions
              </p>
            </div>
            <Button onClick={addQuestion} className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Add Question
            </Button>
          </div>

          {questions.length === 0 ? (
            <Card className="text-center py-12 border-0 shadow-lg bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20">
              <CardContent>
                <Sparkles className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No questions yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start by adding your first question to this assessment
                </p>
                <Button onClick={addQuestion} className="gap-2">
                  <PlusIcon className="h-4 w-4" />
                  Add Your First Question
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <Card key={question.id} className="border-0 shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                        {index + 1}
                      </span>
                      <span className="font-medium">Question {index + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveQuestion(question.id, 'up')}
                        disabled={index === 0}
                        className="h-8 w-8 p-0"
                      >
                        <ArrowUpIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveQuestion(question.id, 'down')}
                        disabled={index === questions.length - 1}
                        className="h-8 w-8 p-0"
                      >
                        <ArrowDownIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteQuestion(question.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="md:col-span-2 space-y-2">
                        <Label>Question Text*</Label>
                        <Textarea
                          value={question.question}
                          onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                          placeholder="Enter your question"
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select 
                            value={question.type}
                            onValueChange={(value: any) => updateQuestion(question.id, { 
                              type: value,
                              options: value === 'multiple-choice' ? question.options : []
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {questionTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  <span className="flex items-center gap-2">
                                    <span>{type.icon}</span>
                                    {type.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Points</Label>
                          <Input
                            type="number"
                            min="1"
                            value={question.points}
                            onChange={(e) => updateQuestion(question.id, { points: Number(e.target.value) })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Difficulty</Label>
                          <Select 
                            value={question.difficulty}
                            onValueChange={(value: any) => updateQuestion(question.id, { difficulty: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {difficulties.map(diff => (
                                <SelectItem key={diff.value} value={diff.value}>
                                  <span className={diff.color}>{diff.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <QuestionTypeContent
                      question={question}
                      onUpdate={(updates) => updateQuestion(question.id, updates)}
                      onAddOption={() => addOption(question.id)}
                      onUpdateOption={(optionId, updates) => updateOption(question.id, optionId, updates)}
                      onDeleteOption={(optionId) => deleteOption(question.id, optionId)}
                    />

                    <div className="space-y-2">
                      <Label>Explanation (optional)</Label>
                      <Textarea
                        value={question.explanation}
                        onChange={(e) => updateQuestion(question.id, { explanation: e.target.value })}
                        placeholder="Explain the correct answer"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      {selectedTab === 'settings' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
              <CardTitle>Assessment Settings</CardTitle>
              <CardDescription>
                Configure how students will experience this assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    min="0"
                    value={assessment.settings.timeLimit || ''}
                    onChange={(e) => setAssessment({
                      ...assessment,
                      settings: {
                        ...assessment.settings,
                        timeLimit: e.target.value ? Number(e.target.value) : null
                      }
                    })}
                    placeholder="No time limit"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attempts">Allowed Attempts</Label>
                  <Input
                    id="attempts"
                    type="number"
                    min="1"
                    value={assessment.settings.attempts}
                    onChange={(e) => setAssessment({
                      ...assessment,
                      settings: { ...assessment.settings, attempts: Number(e.target.value) }
                    })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-lg">Question Display</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="shuffleQuestions" className="text-base">Shuffle Questions</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Randomize question order for each attempt</p>
                    </div>
                    <Switch
                      checked={assessment.settings.shuffleQuestions}
                      onCheckedChange={(checked) => setAssessment({
                        ...assessment,
                        settings: { ...assessment.settings, shuffleQuestions: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="shuffleOptions" className="text-base">Shuffle Options</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Randomize answer choices order</p>
                    </div>
                    <Switch
                      checked={assessment.settings.shuffleOptions}
                      onCheckedChange={(checked) => setAssessment({
                        ...assessment,
                        settings: { ...assessment.settings, shuffleOptions: checked }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-lg">Results & Review</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="showResults">Show Results</Label>
                    <Select 
                      value={assessment.settings.showResults}
                      onValueChange={(value: any) => setAssessment({
                        ...assessment,
                        settings: { ...assessment.settings, showResults: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediately">Immediately</SelectItem>
                        <SelectItem value="after-deadline">After Deadline</SelectItem>
                        <SelectItem value="manual">Manual Release</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label htmlFor="showCorrectAnswers" className="text-base">Show Correct Answers</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Reveal correct answers after submission</p>
                      </div>
                      <Switch
                        checked={assessment.settings.showCorrectAnswers}
                        onCheckedChange={(checked) => setAssessment({
                          ...assessment,
                          settings: { ...assessment.settings, showCorrectAnswers: checked }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label htmlFor="allowReview" className="text-base">Allow Review</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Let students review their attempts</p>
                      </div>
                      <Switch
                        checked={assessment.settings.allowReview}
                        onCheckedChange={(checked) => setAssessment({
                          ...assessment,
                          settings: { ...assessment.settings, allowReview: checked }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-lg">Security Settings</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="requireCamera" className="text-base">Require Camera</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Enable camera monitoring during assessment</p>
                    </div>
                    <Switch
                      checked={assessment.settings.requireCamera}
                      onCheckedChange={(checked) => setAssessment({
                        ...assessment,
                        settings: { ...assessment.settings, requireCamera: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="requireFullScreen" className="text-base">Require Full Screen</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Prevent switching to other applications</p>
                    </div>
                    <Switch
                      checked={assessment.settings.requireFullScreen}
                      onCheckedChange={(checked) => setAssessment({
                        ...assessment,
                        settings: { ...assessment.settings, requireFullScreen: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="preventCopyPaste" className="text-base">Prevent Copy/Paste</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Disable copy and paste functionality</p>
                    </div>
                    <Switch
                      checked={assessment.settings.preventCopyPaste}
                      onCheckedChange={(checked) => setAssessment({
                        ...assessment,
                        settings: { ...assessment.settings, preventCopyPaste: checked }
                      })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Schedule */}
      {selectedTab === 'schedule' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
              <CardTitle>Assessment Schedule</CardTitle>
              <CardDescription>
                Set when this assessment will be available to students
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <Label htmlFor="isScheduled" className="text-base">Schedule Assessment</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Enable to set specific start and end times</p>
                </div>
                <Switch
                  checked={assessment.schedule.isScheduled}
                  onCheckedChange={(checked) => setAssessment({
                    ...assessment,
                    schedule: { ...assessment.schedule, isScheduled: checked }
                  })}
                />
              </div>

              {assessment.schedule.isScheduled && (
                <div className="space-y-4 pl-4 border-l-2 border-amber-300 dark:border-amber-700">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date & Time</Label>
                      <Input
                        id="startDate"
                        type="datetime-local"
                        value={assessment.schedule.startDate || ''}
                        onChange={(e) => setAssessment({
                          ...assessment,
                          schedule: { ...assessment.schedule, startDate: e.target.value }
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date & Time</Label>
                      <Input
                        id="endDate"
                        type="datetime-local"
                        value={assessment.schedule.endDate || ''}
                        onChange={(e) => setAssessment({
                          ...assessment,
                          schedule: { ...assessment.schedule, endDate: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={assessment.schedule.timezone}
                      onChange={(e) => setAssessment({
                        ...assessment,
                        schedule: { ...assessment.schedule, timezone: e.target.value }
                      })}
                      placeholder="e.g., America/New_York"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Component for question type specific content
function QuestionTypeContent({
  question,
  onUpdate,
  onAddOption,
  onUpdateOption,
  onDeleteOption
}: {
  question: Question
  onUpdate: (updates: Partial<Question>) => void
  onAddOption: () => void
  onUpdateOption: (optionId: string, updates: { text?: string; isCorrect?: boolean }) => void
  onDeleteOption: (optionId: string) => void
}) {
  switch (question.type) {
    case 'multiple-choice':
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Options</Label>
            <Button variant="outline" size="sm" onClick={onAddOption} className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Add Option
            </Button>
          </div>
          
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <div key={option.id} className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  checked={option.isCorrect}
                  onChange={() => {
                    question.options.forEach(opt => {
                      onUpdateOption(opt.id, { isCorrect: opt.id === option.id })
                    })
                  }}
                  className="h-4 w-4 text-blue-600"
                />
                <Input
                  value={option.text}
                  onChange={(e) => onUpdateOption(option.id, { text: e.target.value })}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1"
                />
                {question.options.length > 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDeleteOption(option.id)}
                    className="text-red-600 hover:text-red-700 h-9 w-9 p-0"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )

    case 'true-false':
      return (
        <div className="space-y-3">
          <Label>Correct Answer</Label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 cursor-pointer p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex-1 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <input
                type="radio"
                name={`answer-${question.id}`}
                checked={question.correctAnswer === true}
                onChange={() => onUpdate({ correctAnswer: true })}
                className="h-4 w-4 text-blue-600"
              />
              <span>True</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex-1 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <input
                type="radio"
                name={`answer-${question.id}`}
                checked={question.correctAnswer === false}
                onChange={() => onUpdate({ correctAnswer: false })}
                className="h-4 w-4 text-blue-600"
              />
              <span>False</span>
            </label>
          </div>
        </div>
      )

    case 'short-answer':
    case 'fill-blank':
      return (
        <div className="space-y-2">
          <Label>Correct Answer(s)</Label>
          <Input
            value={question.correctAnswer || ''}
            onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
            placeholder="Enter the correct answer (use | to separate multiple acceptable answers)"
          />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Tip: Use | to separate multiple acceptable answers (e.g., "yes|correct|true")
          </p>
        </div>
      )

    case 'essay':
      return (
        <div className="space-y-2">
          <Label>Sample Answer (optional)</Label>
          <Textarea
            value={question.correctAnswer || ''}
            onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
            placeholder="Enter a sample answer or grading rubric"
            rows={4}
          />
        </div>
      )

    case 'coding':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Allowed Languages</Label>
            <Input
              value={(question.coding?.allowedLanguages || []).join(',')}
              onChange={(e) =>
                onUpdate({
                  coding: {
                    ...(question.coding || { starterCode: {}, testCases: [] }),
                    allowedLanguages: e.target.value
                      .split(',')
                      .map((lang) => lang.trim())
                      .filter(Boolean)
                  }
                })
              }
              placeholder="e.g. javascript,python,java,cpp"
            />
          </div>

          <div className="space-y-2">
            <Label>Starter Code (JSON by language)</Label>
            <Textarea
              value={JSON.stringify(question.coding?.starterCode || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value || '{}')
                  onUpdate({
                    coding: {
                      ...(question.coding || { allowedLanguages: [], testCases: [] }),
                      starterCode: parsed
                    }
                  })
                } catch {
                  // Ignore invalid JSON while typing
                }
              }}
              rows={5}
              placeholder='{"javascript":"// code","python":"# code"}'
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Test Cases</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onUpdate({
                    coding: {
                      ...(question.coding || { allowedLanguages: [], starterCode: {} }),
                      testCases: [
                        ...(question.coding?.testCases || []),
                        { input: '', expectedOutput: '', isHidden: false, weight: 1 }
                      ]
                    }
                  })
                }
              >
                Add Test Case
              </Button>
            </div>

            {(question.coding?.testCases || []).map((testCase, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700 md:grid-cols-12">
                <Input
                  className="md:col-span-4"
                  value={testCase.input}
                  onChange={(e) => {
                    const updated = [...(question.coding?.testCases || [])]
                    updated[index] = { ...updated[index], input: e.target.value }
                    onUpdate({
                      coding: { ...(question.coding || { allowedLanguages: [], starterCode: {} }), testCases: updated }
                    })
                  }}
                  placeholder="Input"
                />
                <Input
                  className="md:col-span-4"
                  value={testCase.expectedOutput}
                  onChange={(e) => {
                    const updated = [...(question.coding?.testCases || [])]
                    updated[index] = { ...updated[index], expectedOutput: e.target.value }
                    onUpdate({
                      coding: { ...(question.coding || { allowedLanguages: [], starterCode: {} }), testCases: updated }
                    })
                  }}
                  placeholder="Expected output"
                />
                <Input
                  className="md:col-span-2"
                  type="number"
                  min="1"
                  value={testCase.weight}
                  onChange={(e) => {
                    const updated = [...(question.coding?.testCases || [])]
                    updated[index] = { ...updated[index], weight: Number(e.target.value) || 1 }
                    onUpdate({
                      coding: { ...(question.coding || { allowedLanguages: [], starterCode: {} }), testCases: updated }
                    })
                  }}
                  placeholder="Weight"
                />
                <label className="md:col-span-1 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!testCase.isHidden}
                    onChange={(e) => {
                      const updated = [...(question.coding?.testCases || [])]
                      updated[index] = { ...updated[index], isHidden: e.target.checked }
                      onUpdate({
                        coding: { ...(question.coding || { allowedLanguages: [], starterCode: {} }), testCases: updated }
                      })
                    }}
                  />
                  Hidden
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="md:col-span-1 text-red-600 hover:text-red-700 h-9 w-9 p-0"
                  onClick={() => {
                    const updated = [...(question.coding?.testCases || [])]
                    updated.splice(index, 1)
                    onUpdate({
                      coding: { ...(question.coding || { allowedLanguages: [], starterCode: {} }), testCases: updated }
                    })
                  }}
                >
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )

    default:
      return null
  }
}



'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../../components/providers/AuthProvider'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import { Textarea } from '../../../../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select'
import { Switch } from '../../../../components/ui/switch'
import { Badge } from '../../../../components/ui/badge'
import { 
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { Download, FileUp, Save } from 'lucide-react'
import { parseAssessmentImportFile, parseCodingTestCasesFile } from '@/lib/assessmentImport'
import { toast } from 'sonner'

interface Question {
  id: string
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'fill-blank' | 'coding'
  sectionId?: string
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

interface AssessmentSection {
  id: string
  title: string
  type: 'theory' | 'mcq' | 'coding'
  description: string
  order: number
}

interface Course {
  _id: string
  id?: string
  title: string
}

interface Batch {
  _id: string
  name: string
  batchCode: string
  courseId: string
}

interface Assessment {
  title: string
  description: string
  instructions: {
    general: string
    additional: string
  }
  type: 'quiz' | 'exam' | 'assignment' | 'practice'
  courseId: string
  batchId?: string
  sections: AssessmentSection[]
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
}

const initialAssessment: Assessment = {
  title: '',
  description: '',
  instructions: {
    general: '',
    additional: ''
  },
  type: 'quiz',
  courseId: '',
  batchId: undefined,
  sections: [
    { id: 'sec_theory', title: 'Theory', type: 'theory', description: 'Text, paragraph, and fill-in-the-blank questions', order: 0 },
    { id: 'sec_mcq', title: 'MCQ', type: 'mcq', description: 'Objective and multiple-choice questions', order: 1 },
    { id: 'sec_coding', title: 'Coding DSA', type: 'coding', description: 'Programming challenges with test cases', order: 2 }
  ],
  settings: {
    timeLimit: null,
    attempts: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    showResults: 'immediately',
    showCorrectAnswers: true,
    allowReview: true,
    requireCamera: false,
    requireFullScreen: false,
    preventCopyPaste: false
  },
  grading: {
    passingScore: 60,
    gradingMethod: 'automatic',
    weightage: 100
  },
  schedule: {
    isScheduled: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  },
  status: 'draft'
}

const questionTypes = [
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True/False' },
  { value: 'short-answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
  { value: 'fill-blank', label: 'Fill in the Blank' },
  { value: 'coding', label: 'Coding (DSA)' }
]

const difficulties = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' }
]

const tabs = [
  { id: 'details', label: 'Details' },
  { id: 'questions', label: 'Questions' },
  { id: 'settings', label: 'Settings' },
  { id: 'schedule', label: 'Schedule' }
]

const ALL_BATCHES_VALUE = '__all_batches__'

export default function CreateAssessmentPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [assessment, setAssessment] = useState<Assessment>(initialAssessment)
  const [questions, setQuestions] = useState<Question[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const assessmentImportInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (assessment.courseId) {
      fetchBatches(assessment.courseId)
    } else {
      setBatches([])
    }
  }, [assessment.courseId])

  const fetchCourses = async () => {
    try {
      const data = await api.getCourses()
      setCourses(data.data || [])
    } catch (error) {
      console.error('Error fetching courses:', error)
    }
  }

  const fetchBatches = async (courseId: string) => {
    try {
      const data = await api.getBatches({ courseId })
      setBatches(data.data || [])
    } catch (error) {
      console.error('Error fetching batches:', error)
    }
  }

  const addQuestion = () => {
    const defaultSectionId = assessment.sections[0]?.id
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      type: 'multiple-choice',
      sectionId: defaultSectionId,
      question: '',
      options: [
        { id: `opt_${Date.now()}_1`, text: '', isCorrect: true },
        { id: `opt_${Date.now()}_2`, text: '', isCorrect: false }
      ],
      correctAnswer: null,
      points: 1,
      explanation: '',
      difficulty: 'medium',
      coding: {
        allowedLanguages: ['javascript', 'python', 'java', 'cpp'],
        starterCode: {
          javascript: '// Write your solution here\n',
          python: '# Write your solution here\n',
          java: 'class Main {\n  public static void main(String[] args) {\n    \n  }\n}\n',
          cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main(){\n  \n  return 0;\n}\n'
        },
        testCases: []
      },
      tags: [],
      order: questions.length
    }
    setQuestions([...questions, newQuestion])
    setActiveTab('questions')
  }

  const addSection = () => {
    const newSection: AssessmentSection = {
      id: `sec_${Date.now()}`,
      title: `Section ${assessment.sections.length + 1}`,
      type: 'theory',
      description: '',
      order: assessment.sections.length
    }
    setAssessment(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }))
  }

  const updateSection = (sectionId: string, updates: Partial<AssessmentSection>) => {
    setAssessment(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId ? { ...section, ...updates } : section
      )
    }))
  }

  const deleteSection = (sectionId: string) => {
    if (assessment.sections.length <= 1) {
      toast.error('At least one section is required.')
      return
    }

    setAssessment(prev => ({
      ...prev,
      sections: prev.sections.filter(section => section.id !== sectionId)
    }))

    setQuestions(prev =>
      prev.map(question =>
        question.sectionId === sectionId
          ? { ...question, sectionId: assessment.sections.find(section => section.id !== sectionId)?.id }
          : question
      )
    )
  }

  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ))
  }

  const deleteQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId))
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

  const downloadQuestionsImportTemplate = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const sample = {
        assessment: {
          title: 'DSA Mid-Term',
          description: 'Imported assessment example',
          type: 'exam',
          instructions: {
            general: 'Read each question carefully.',
            additional: 'Show your steps where needed.'
          }
        },
        sections: [
          { id: 'sec_theory', title: 'Theory', type: 'theory', description: 'Short/essay questions', order: 0 },
          { id: 'sec_mcq', title: 'MCQ', type: 'mcq', description: 'Objective questions', order: 1 },
          { id: 'sec_coding', title: 'Coding', type: 'coding', description: 'Programming tasks', order: 2 }
        ],
        questions: [
          {
            type: 'multiple-choice',
            sectionId: 'sec_mcq',
            question: 'What is the time complexity of binary search?',
            options: [
              { text: 'O(n)', isCorrect: false },
              { text: 'O(log n)', isCorrect: true },
              { text: 'O(n log n)', isCorrect: false }
            ],
            points: 2,
            difficulty: 'easy',
            explanation: 'Binary search halves the search space.',
            tags: ['searching', 'complexity']
          },
          {
            type: 'coding',
            sectionId: 'sec_coding',
            question: 'Return the index of target in sorted array using binary search.',
            points: 10,
            difficulty: 'medium',
            coding: {
              allowedLanguages: ['javascript', 'python'],
              starterCode: {
                javascript: 'function solve(input) {\n  // {{USER_CODE}}\n}\n',
                python: 'def solve(input):\n    # {{USER_CODE}}\n    pass\n'
              },
              testCases: [
                { input: '1 3 5 7|5', expectedOutput: '2', isHidden: false, weight: 1 },
                { input: '2 4 6 8|7', expectedOutput: '-1', isHidden: true, weight: 2 }
              ]
            }
          }
        ]
      }

      const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'assessment-import-template.json'
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    const csv = [
      'type,sectionId,sectionTitle,sectionType,question,points,difficulty,correctAnswer,optionsJson,explanation,tags,codingLanguages,starterCodeJson,testCasesJson',
      '"multiple-choice","sec_mcq","MCQ","mcq","What is O(1)?",2,"easy","Constant time","[{""text"":""Constant time"",""isCorrect"":true},{""text"":""Linear time"",""isCorrect"":false}]","Complexity class","complexity|basics","","",""',
      '"coding","sec_coding","Coding","coding","Write function to reverse string",10,"medium","","","","strings|coding","javascript|python","{""javascript"":""function solve(input){\\n  // {{USER_CODE}}\\n}\\n""}","[{""input"":""abc"",""expectedOutput"":""cba"",""isHidden"":false,""weight"":1}]"'
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'assessment-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAssessmentImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setImporting(true)
      const imported = await parseAssessmentImportFile(file, assessment.sections)

      if (!imported.questions.length) {
        toast.error('No valid questions found in the import file.')
        return
      }

      setAssessment((prev) => ({
        ...prev,
        title: imported.assessment?.title || prev.title,
        description: imported.assessment?.description || prev.description,
        type: imported.assessment?.type || prev.type,
        instructions: {
          general: imported.assessment?.instructions?.general || prev.instructions.general,
          additional: imported.assessment?.instructions?.additional || prev.instructions.additional
        },
        sections: imported.sections.length ? imported.sections : prev.sections
      }))

      setQuestions((prev) => {
        const offset = prev.length
        const mapped = imported.questions.map((question, index) => ({
          ...question,
          id: `${question.id}_${Date.now()}_${index}`,
          order: offset + index
        }))
        return [...prev, ...mapped]
      })

      setActiveTab('questions')
      toast.success(`Imported ${imported.questions.length} question(s) successfully.`)
    } catch (error: any) {
      console.error('Assessment import error:', error)
      toast.error(error?.message || 'Failed to import assessment file')
    } finally {
      event.target.value = ''
      setImporting(false)
    }
  }

  const handleSave = async (status: 'draft' | 'published' = 'draft') => {
    // Validate required fields
    if (!assessment.title.trim()) {
      toast.error('Please enter a title for the assessment.')
      return
    }
    
    if (!assessment.courseId) {
      toast.error('Please select a course for the assessment.')
      return
    }
    
    if (status === 'published' && questions.length === 0) {
      toast.error('Please add at least one question before publishing.')
      return
    }
    
    // Validate that multiple choice questions have correct answers marked
    if (status === 'published') {
      const incompleteQuestions = questions.filter(q => {
        if (q.type === 'multiple-choice') {
          return !q.options.some(opt => opt.isCorrect) || !q.question.trim()
        }
        if (q.type === 'true-false') {
          return q.correctAnswer === null || q.correctAnswer === undefined
        }
        if (q.type === 'coding') {
          return !q.coding?.allowedLanguages?.length || !q.coding?.testCases?.length
        }
        return !q.question.trim()
      })
      
      if (incompleteQuestions.length > 0) {
        toast.error(`Please complete all questions before publishing. ${incompleteQuestions.length} question(s) need attention.`)
        return
      }
    }

    setSaving(true)
    try {
      const assessmentData = {
        ...assessment,
        status,
        questions: questions.map(q => {
          let correctAnswer = q.correctAnswer;
          
          // For multiple choice questions, persist correctAnswer as option id.
          if (q.type === 'multiple-choice' && q.options) {
            const correctOption = q.options.find(opt => opt.isCorrect);
            if (correctOption) {
              correctAnswer = correctOption.id;
            }
          }
          
          return {
            ...q,
            correctAnswer,
            options: q.type === 'multiple-choice' ? q.options : undefined
          };
        })
      }

      const data = await api.createAssessment(assessmentData)

      if (status === 'published') {
        toast.success('Assessment published successfully.')
        router.push('/dashboard/assessments')
      } else {
        toast.success('Assessment saved as draft.')
        router.push(`/dashboard/assessments/${data.data._id}/edit`)
      }
    } catch (saveError: any) {
      console.error('Error saving assessment:', saveError)
      toast.error(`Failed to save assessment: ${saveError?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Create Assessment
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create a new quiz, exam, or assignment
          </p>
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
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button 
            onClick={() => handleSave('published')}
            disabled={saving || !assessment.title || !assessment.courseId || questions.length === 0}
          >
            <EyeIcon className="h-4 w-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }
                whitespace-nowrap flex items-center gap-2
              `}
            >
              {tab.label}
              {tab.id === 'questions' && questions.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {questions.length}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {/* Assessment Details */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    value={assessment.instructions.general}
                    onChange={(e) =>
                      setAssessment({
                        ...assessment,
                        instructions: {
                          ...assessment.instructions,
                          general: e.target.value
                        }
                      })
                    }
                    placeholder="Enter exam instructions shown before student starts (allowed materials, marking rules, etc.)"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalInstructions">Additional Instructions</Label>
                  <Textarea
                    id="additionalInstructions"
                    value={assessment.instructions.additional}
                    onChange={(e) =>
                      setAssessment({
                        ...assessment,
                        instructions: {
                          ...assessment.instructions,
                          additional: e.target.value
                        }
                      })
                    }
                    placeholder="Optional custom instructions for this assessment attempt"
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
                        {courses
                          .filter(course => Boolean(course._id || course.id))
                          .map(course => (
                            <SelectItem key={course._id || course.id} value={course._id || course.id || course.title}>
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Assessment Sections</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addSection}>
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Add Section
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {assessment.sections.map((section) => (
                      <div key={section.id} className="grid gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 md:grid-cols-12">
                        <div className="space-y-1 md:col-span-4">
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={section.title}
                            onChange={(e) => updateSection(section.id, { title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1 md:col-span-3">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={section.type}
                            onValueChange={(value: any) => updateSection(section.id, { type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="theory">Theory</SelectItem>
                              <SelectItem value="mcq">MCQ</SelectItem>
                              <SelectItem value="coding">Coding DSA</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 md:col-span-4">
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={section.description}
                            onChange={(e) => updateSection(section.id, { description: e.target.value })}
                            placeholder="Optional section guidance"
                          />
                        </div>
                        <div className="flex items-end md:col-span-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => deleteSection(section.id)}
                            className="w-full text-red-600 hover:text-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Grading</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
        {activeTab === 'questions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Questions</h2>
              <div className="flex gap-2">
                <input
                  ref={assessmentImportInputRef}
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={handleAssessmentImport}
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => assessmentImportInputRef.current?.click()}
                  disabled={importing}
                  className="gap-2"
                >
                  <FileUp className="h-4 w-4" />
                  {importing ? 'Importing...' : 'Import Questions'}
                </Button>
                <Button variant="outline" type="button" onClick={() => downloadQuestionsImportTemplate('json')} className="gap-2">
                  <Download className="h-4 w-4" />
                  JSON Template
                </Button>
                <Button variant="outline" type="button" onClick={() => downloadQuestionsImportTemplate('csv')} className="gap-2">
                  <Download className="h-4 w-4" />
                  CSV Template
                </Button>
                <Button onClick={addQuestion} className="gap-2">
                  <PlusIcon className="h-4 w-4" />
                  Add Question
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Supported import formats: <strong>JSON</strong> and <strong>CSV</strong>.
                  Use template files to import all question types (MCQ, True/False, Short, Essay, Fill Blank, Coding) with options and coding test cases.
                </p>
              </CardContent>
            </Card>

            {questions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No questions added yet. Start by adding your first question.
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
                  <Card key={question.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <CardTitle className="text-base">
                          Question {index + 1}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveQuestion(question.id, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUpIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveQuestion(question.id, 'down')}
                            disabled={index === questions.length - 1}
                          >
                            <ArrowDownIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteQuestion(question.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                            <Label>Section</Label>
                            <Select
                              value={question.sectionId || assessment.sections[0]?.id || ''}
                              onValueChange={(value) => updateQuestion(question.id, { sectionId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select section" />
                              </SelectTrigger>
                              <SelectContent>
                                {assessment.sections.map(section => (
                                  <SelectItem key={section.id} value={section.id}>
                                    {section.title} ({section.type.toUpperCase()})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select 
                              value={question.type}
                              onValueChange={(value: any) => updateQuestion(question.id, { 
                                type: value,
                                options: value === 'multiple-choice'
                                  ? (question.options?.length ? question.options : [
                                      { id: `opt_${Date.now()}_1`, text: '', isCorrect: true },
                                      { id: `opt_${Date.now()}_2`, text: '', isCorrect: false }
                                    ])
                                  : [],
                                coding: value === 'coding'
                                  ? (question.coding || {
                                      allowedLanguages: ['javascript', 'python'],
                                      starterCode: {
                                        javascript: '// Write your solution here\n',
                                        python: '# Write your solution here\n'
                                      },
                                      testCases: []
                                    })
                                  : undefined
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {questionTypes.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
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
                                    {diff.label}
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
                        onImportCodingTestCases={async (file) => {
                          const importedCases = await parseCodingTestCasesFile(file)
                          updateQuestion(question.id, {
                            coding: {
                              ...(question.coding || { allowedLanguages: ['javascript', 'python'], starterCode: {}, testCases: [] }),
                              testCases: importedCases
                            }
                          })
                        }}
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
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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
                  <h4 className="font-medium">Question Display</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="shuffleQuestions">Shuffle Questions</Label>
                      <Switch
                        checked={assessment.settings.shuffleQuestions}
                        onCheckedChange={(checked) => setAssessment({
                          ...assessment,
                          settings: { ...assessment.settings, shuffleQuestions: checked }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="shuffleOptions">Shuffle Options</Label>
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
                  <h4 className="font-medium">Results & Review</h4>
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="showCorrectAnswers">Show Correct Answers</Label>
                        <Switch
                          checked={assessment.settings.showCorrectAnswers}
                          onCheckedChange={(checked) => setAssessment({
                            ...assessment,
                            settings: { ...assessment.settings, showCorrectAnswers: checked }
                          })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="allowReview">Allow Review</Label>
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
                  <h4 className="font-medium">Security Settings</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="requireCamera">Require Camera</Label>
                      <Switch
                        checked={assessment.settings.requireCamera}
                        onCheckedChange={(checked) => setAssessment({
                          ...assessment,
                          settings: { ...assessment.settings, requireCamera: checked }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="requireFullScreen">Require Full Screen</Label>
                      <Switch
                        checked={assessment.settings.requireFullScreen}
                        onCheckedChange={(checked) => setAssessment({
                          ...assessment,
                          settings: { ...assessment.settings, requireFullScreen: checked }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="preventCopyPaste">Prevent Copy/Paste</Label>
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
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isScheduled">Schedule Assessment</Label>
                  <Switch
                    checked={assessment.schedule.isScheduled}
                    onCheckedChange={(checked) => setAssessment({
                      ...assessment,
                      schedule: { ...assessment.schedule, isScheduled: checked }
                    })}
                  />
                </div>

                {assessment.schedule.isScheduled && (
                  <div className="space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
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
    </div>
  )
}

// Component for question type specific content
function QuestionTypeContent({
  question,
  onUpdate,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onImportCodingTestCases
}: {
  question: Question
  onUpdate: (updates: Partial<Question>) => void
  onAddOption: () => void
  onUpdateOption: (optionId: string, updates: { text?: string; isCorrect?: boolean }) => void
  onDeleteOption: (optionId: string) => void
  onImportCodingTestCases: (file: File) => Promise<void>
}) {
  const testcaseImportRef = useRef<HTMLInputElement>(null)

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
                // Create a new array of options with only this option marked as correct
                const updatedOptions = question.options.map(opt => ({
                  ...opt,
                  isCorrect: opt.id === option.id
                }));
                onUpdate({ options: updatedOptions });
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
                className="text-red-600 hover:text-red-700"
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
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={`answer-${question.id}`}
                checked={question.correctAnswer === true}
                onChange={() => onUpdate({ correctAnswer: true })}
                className="h-4 w-4 text-blue-600"
              />
              <span>True</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
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
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Tip: Use <code>{'{{USER_CODE}}'}</code> in starter template to inject student function automatically at run/submit.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Test Cases</Label>
              <div className="flex gap-2">
                <input
                  ref={testcaseImportRef}
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    try {
                      await onImportCodingTestCases(file)
                      toast.success('Test cases imported successfully.')
                    } catch (error: any) {
                      toast.error(error?.message || 'Failed to import test cases')
                    } finally {
                      event.target.value = ''
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testcaseImportRef.current?.click()}
                >
                  Import Test Cases
                </Button>
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
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Test case import format: JSON array (or object with `testCases`), or CSV columns: input, expectedOutput, isHidden, weight.
            </p>

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
                  className="md:col-span-1 text-red-600 hover:text-red-700"
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



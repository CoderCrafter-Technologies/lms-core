'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Modal } from '../ui/Modal'
import { 
  FileText, 
  Image, 
  DollarSign, 
  Tag, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Upload,
  Clock,
  BookOpen,
  BarChart
} from 'lucide-react'

interface Pricing {
  type: 'FREE' | 'PAID' | 'SUBSCRIPTION'
  amount: number
  currency: string
}

interface CourseData {
  // Step 1: Basic Info
  title: string
  description: string
  shortDescription: string
  category: string
  level: string
  
  // Step 2: Media & Resources
  thumbnail: File | null
  thumbnailPreview: string
  materials: Array<{ name: string; type: string; url: string }>
  
  // Step 3: Pricing & Settings
  pricing: Pricing
  isPublic: boolean
  
  // Step 4: Prerequisites & Tags
  prerequisites: string
  tags: string[]
  estimatedHours: number
  estimatedMinutes: number
}

interface CourseCreationWizardProps {
  isOpen: boolean
  onClose: () => void
  onCourseCreated: (course: any) => void
}

export function CourseCreationWizard({ isOpen, onClose, onCourseCreated }: CourseCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null)
  const [courseData, setCourseData] = useState<CourseData>({
    title: '',
    description: '',
    shortDescription: '',
    category: 'PROGRAMMING',
    level: 'BEGINNER',
    thumbnail: null,
    thumbnailPreview: '',
    materials: [],
    pricing: {
      type: 'FREE',
      amount: 0,
      currency: 'USD'
    },
    isPublic: true,
    prerequisites: '',
    tags: [],
    estimatedHours: 0,
    estimatedMinutes: 0
  })

  const steps = [
    { id: 1, name: 'Basic Information', icon: FileText },
    { id: 2, name: 'Media & Resources', icon: Image },
    { id: 3, name: 'Pricing & Settings', icon: DollarSign },
    { id: 4, name: 'Prerequisites & Tags', icon: Tag }
  ]

  const categories = [
    'PROGRAMMING', 'DATA_SCIENCE', 'DESIGN', 'BUSINESS', 'MARKETING', 'LANGUAGE', 'OTHER'
  ]

  const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']

  const handleInputChange = (field: string, value: any) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })

    if (field.startsWith('pricing.')) {
      const pricingField = field.split('.')[1]
      setCourseData(prev => ({
        ...prev,
        pricing: {
          ...prev.pricing,
          [pricingField]: value
        }
      }))
    } else {
      setCourseData(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setCourseData(prev => ({
          ...prev,
          thumbnail: file,
          thumbnailPreview: reader.result as string
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const addTag = (tag: string) => {
    if (tag && !courseData.tags.includes(tag)) {
      setCourseData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }))
    }
  }

  const removeTag = (tagToRemove: string) => {
    setCourseData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const validateByStep = (step: number) => {
    const errors: Record<string, string> = {}

    if (step === 1) {
      if (!courseData.title.trim()) errors.title = 'Course title is required'
      else if (courseData.title.trim().length < 3) errors.title = 'Course title must be between 3 and 200 characters'

      if (!courseData.description.trim()) errors.description = 'Course description is required'
      else if (courseData.description.trim().length < 10) errors.description = 'Course description must be at least 10 characters'

      if (!courseData.category) errors.category = 'Category is required'
      if (!courseData.level) errors.level = 'Difficulty level is required'
    }

    if (step === 3 && courseData.pricing.type !== 'FREE') {
      const amount = Number(courseData.pricing.amount)
      if (!Number.isFinite(amount)) errors['pricing.amount'] = 'Pricing amount must be a number'
      else if (amount <= 0) errors['pricing.amount'] = 'Pricing amount must be greater than 0'
    }

    return errors
  }

  const validateAll = () => {
    const merged = {
      ...validateByStep(1),
      ...validateByStep(2),
      ...validateByStep(3),
      ...validateByStep(4),
    }

    if (Object.keys(merged).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...merged }))
      if (merged.title || merged.description || merged.category || merged.level) {
        setCurrentStep(1)
      } else if (merged['pricing.amount']) {
        setCurrentStep(3)
      }
      toast.error(Object.values(merged)[0])
      return false
    }

    return true
  }

  const getInputStyles = (field: string, extra: Record<string, any> = {}) => ({
    backgroundColor: 'var(--color-surface)',
    borderColor: fieldErrors[field] ? 'var(--color-error)' : 'var(--color-border)',
    color: 'var(--color-text)',
    ...extra
  })

  const nextStep = () => {
    const errors = validateByStep(currentStep)
    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }))
      toast.error(Object.values(errors)[0])
      return
    }
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    try {
      if (!validateAll()) return
      setIsSubmitting(true)

      const payload = new FormData()
      payload.append('title', courseData.title.trim())
      payload.append('description', courseData.description.trim())
      payload.append('shortDescription', courseData.shortDescription.trim())
      payload.append('category', courseData.category)
      payload.append('level', courseData.level)
      payload.append('pricing.type', courseData.pricing.type)
      payload.append('pricing.amount', String(courseData.pricing.amount || 0))
      payload.append('pricing.currency', courseData.pricing.currency || 'USD')
      payload.append('estimatedDuration.hours', String(courseData.estimatedHours || 0))
      payload.append('estimatedDuration.minutes', String(courseData.estimatedMinutes || 0))
      payload.append('isPublic', String(Boolean(courseData.isPublic)))
      payload.append('tags', JSON.stringify(courseData.tags || []))

      if (courseData.thumbnail) {
        payload.append('thumbnail', courseData.thumbnail)
      }

      const created = await api.createCourse(payload as any)
      if (!created?.data) {
        throw new Error('Invalid course creation response')
      }

      onCourseCreated(created.data)
      toast.success('Course created successfully.')
      onClose()
      
      // Reset form
      setCourseData({
        title: '', description: '', shortDescription: '', category: 'PROGRAMMING',
        level: 'BEGINNER', thumbnail: null, thumbnailPreview: '', materials: [],
        pricing: {
          type: 'FREE',
          amount: 0,
          currency: 'USD'
        },
        isPublic: true,
        prerequisites: '', tags: [], estimatedHours: 0, estimatedMinutes: 0
      })
      setCurrentStep(1)
      
    } catch (error) {
      console.error('Failed to create course:', error)
      const details = Array.isArray((error as any)?.details) ? (error as any).details : []
      if (details.length > 0) {
        const nextErrors: Record<string, string> = {}
        details.forEach((item: any) => {
          if (item?.path && item?.msg) nextErrors[item.path] = item.msg
        })
        if (Object.keys(nextErrors).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...nextErrors }))
          if (nextErrors.title || nextErrors.description || nextErrors.category || nextErrors.level) {
            setCurrentStep(1)
          } else if (nextErrors['pricing.amount']) {
            setCurrentStep(3)
          }
        }
      }
      toast.error((error as any)?.message || 'Failed to create course.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Course Title *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={getInputStyles('title')}
                placeholder="Enter course title"
                value={courseData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              {fieldErrors.title && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>{fieldErrors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Short Description
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                placeholder="Brief description for course cards"
                value={courseData.shortDescription}
                onChange={(e) => handleInputChange('shortDescription', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Detailed Description *
              </label>
              <textarea
                required
                rows={4}
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={getInputStyles('description', { resize: 'vertical' })}
                placeholder="Detailed course description"
                value={courseData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              {fieldErrors.description && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>{fieldErrors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Category
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={getInputStyles('category')}
                  value={courseData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)'
                    e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                {fieldErrors.category && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>{fieldErrors.category}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Difficulty Level
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={getInputStyles('level')}
                  value={courseData.level}
                  onChange={(e) => handleInputChange('level', e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)'
                    e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {levels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
                {fieldErrors.level && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>{fieldErrors.level}</p>
                )}
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Course Thumbnail
              </label>
              <div 
                className="border-2 border-dashed rounded-lg p-6"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {courseData.thumbnailPreview ? (
                  <div className="text-center">
                    <img
                      src={courseData.thumbnailPreview}
                      alt="Course thumbnail"
                      className="mx-auto h-32 w-32 object-cover rounded-lg mb-4"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCourseData(prev => ({
                          ...prev,
                          thumbnail: null,
                          thumbnailPreview: ''
                        }))
                      }}
                      className="px-3 py-1 text-sm rounded-md transition-colors"
                      style={{ 
                        color: 'var(--color-error)',
                        backgroundColor: 'var(--color-error-light)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-error)'
                        e.currentTarget.style.color = 'white'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-error-light)'
                        e.currentTarget.style.color = 'var(--color-error)'
                      }}
                    >
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12" style={{ color: 'var(--color-text-tertiary)' }} />
                    <div className="mt-4">
                      <button
                        type="button"
                        className="mt-2 text-sm font-medium underline-offset-2 hover:underline"
                        style={{ color: 'var(--color-text)' }}
                        onClick={() => thumbnailInputRef.current?.click()}
                      >
                        Upload course thumbnail
                      </button>
                      <input
                        ref={thumbnailInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Clock className="h-4 w-4 inline mr-1" />
                Estimated Duration
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ 
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                    placeholder="Hours"
                    value={courseData.estimatedHours}
                    onChange={(e) => handleInputChange('estimatedHours', parseInt(e.target.value) || 0)}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)'
                      e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Hours</span>
                </div>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ 
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                    placeholder="Minutes"
                    value={courseData.estimatedMinutes}
                    onChange={(e) => handleInputChange('estimatedMinutes', parseInt(e.target.value) || 0)}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)'
                      e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Minutes</span>
                </div>
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Pricing Type
              </label>
              <div className="space-y-2">
                {['FREE', 'PAID', 'SUBSCRIPTION'].map(type => (
                  <label key={type} className="flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-surface-hover">
                    <input
                      type="radio"
                      name="pricingType"
                      value={type}
                      checked={courseData.pricing.type === type}
                      onChange={(e) => handleInputChange('pricing.type', e.target.value)}
                      className="h-4 w-4 rounded-full focus:ring-2 focus:ring-opacity-50"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {courseData.pricing.type !== 'FREE' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={getInputStyles('pricing.amount')}
                    value={courseData.pricing.amount}
                    onChange={(e) => handleInputChange('pricing.amount', parseFloat(e.target.value) || 0)}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)'
                      e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  {fieldErrors['pricing.amount'] && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>{fieldErrors['pricing.amount']}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Currency
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ 
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                    value={courseData.pricing.currency}
                    onChange={(e) => handleInputChange('pricing.currency', e.target.value)}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)'
                      e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 p-2 rounded-md">
              <input
                type="checkbox"
                id="isPublic"
                checked={courseData.isPublic}
                onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                className="h-4 w-4 rounded focus:ring-2 focus:ring-opacity-50"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <label htmlFor="isPublic" className="text-sm" style={{ color: 'var(--color-text)' }}>
                Make course publicly visible
              </label>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                <BookOpen className="h-4 w-4 inline mr-1" />
                Prerequisites
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  resize: 'vertical'
                }}
                placeholder="What should students know before taking this course?"
                value={courseData.prerequisites}
                onChange={(e) => handleInputChange('prerequisites', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Tag className="h-4 w-4 inline mr-1" />
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {courseData.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-full text-sm flex items-center gap-1"
                    style={{ 
                      backgroundColor: 'var(--color-primary-light)',
                      color: 'var(--color-primary)'
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:opacity-80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
                placeholder="Add tags (press Enter to add)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag((e.target as HTMLInputElement).value.trim())
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Course" size="lg">
      {/* Step Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors`}
                  style={{ 
                    backgroundColor: currentStep >= step.id ? 'var(--color-primary)' : 'transparent',
                    borderColor: currentStep >= step.id ? 'var(--color-primary)' : 'var(--color-border)'
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: currentStep >= step.id ? 'white' : 'var(--color-text-tertiary)' }} />
                </div>
                <div className="ml-2 hidden sm:block">
                  <p className={`text-sm font-medium`} style={{ 
                    color: currentStep >= step.id ? 'var(--color-primary)' : 'var(--color-text-tertiary)'
                  }}>
                    {step.name}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div 
                    className="w-8 h-px mx-4"
                    style={{ 
                      backgroundColor: currentStep > step.id ? 'var(--color-primary)' : 'var(--color-border)'
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-6">
        {renderStepContent()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={prevStep}
          disabled={currentStep === 1}
          className="px-4 py-2 text-sm font-medium border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ 
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (currentStep !== 1) {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
            }
          }}
          onMouseLeave={(e) => {
            if (currentStep !== 1) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border rounded-md transition-colors"
            style={{ 
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Cancel
          </button>
          
          {currentStep === steps.length ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center gap-2"
              style={{ backgroundColor: 'var(--color-primary)', opacity: isSubmitting ? 0.75 : 1 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Course'}
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center gap-2"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

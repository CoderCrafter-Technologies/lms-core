'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Modal } from '../ui/Modal'
import { toast } from 'react-hot-toast'

interface Course {
  id: string
  title: string
}

interface Batch {
  id: string
  name: string
  batchCode: string
  courseId: string
}

interface LiveClass {
  id: string
  title: string
  scheduledStartTime: string
  batchId: string
}

interface ResourceUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onResourceCreated: (resource: any) => void
  onResourceUpdated: (resource: any) => void
  editingResource?: any
  context?: {
    courseId?: string
    batchId?: string
    liveClassId?: string
    resourceLevel?: 'COURSE' | 'BATCH' | 'CLASS'
  }
}

export function ResourceUploadModal({ 
  isOpen, 
  onClose, 
  onResourceCreated,
  onResourceUpdated,
  editingResource,
  context 
}: ResourceUploadModalProps) {
  const [resourceData, setResourceData] = useState({
    title: '',
    description: '',
    resourceLevel: context?.resourceLevel || 'COURSE',
    accessLevel: 'ENROLLED_ONLY',
    courseId: context?.courseId || '',
    batchId: context?.batchId || '',
    liveClassId: context?.liveClassId || '',
    tags: [] as string[],
    expiresAt: '',
    file: null as File | null
  })

  const [courses, setCourses] = useState<Course[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [filePreview, setFilePreview] = useState<string | null>(null)

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCourses()
      
      // If we have context info, load related data
      if (context?.courseId) {
        loadBatches(context.courseId)
      }
      
      if (context?.batchId) {
        loadLiveClasses(context.batchId)
      }

      // Populate form when editing
      if (editingResource) {
        setResourceData({
          title: editingResource.title || '',
          description: editingResource.description || '',
          resourceLevel: editingResource.resourceLevel || 'COURSE',
          accessLevel: editingResource.accessLevel || 'ENROLLED_ONLY',
          courseId: editingResource.courseId?._id || editingResource.courseId || '',
          batchId: editingResource.batchId?._id || editingResource.batchId || '',
          liveClassId: editingResource.liveClassId?._id || editingResource.liveClassId || '',
          tags: editingResource.tags || [],
          expiresAt: editingResource.expiresAt ? new Date(editingResource.expiresAt).toISOString().split('T')[0] : '',
          file: null
        })
        
        if (editingResource.fileUrl) {
          setFilePreview(editingResource.fileUrl)
        }
      } else {
        // Reset form for creating new resource
        setResourceData({
          title: '',
          description: '',
          resourceLevel: context?.resourceLevel || 'COURSE',
          accessLevel: 'ENROLLED_ONLY',
          courseId: context?.courseId || '',
          batchId: context?.batchId || '',
          liveClassId: context?.liveClassId || '',
          tags: [],
          expiresAt: '',
          file: null
        })
        setFilePreview(null)
      }
    }
  }, [isOpen, editingResource, context])

  const loadCourses = async () => {
    try {
      const data = await api.getCourses({ limit: '100' })
      setCourses(data.data?.courses || data.data || [])
    } catch (error) {
      console.error('Error loading courses:', error)
    }
  }

  const loadBatches = async (courseId: string) => {
    try {
      const data = await api.getCourseBatches(courseId)
      setBatches(data.data?.batches || data.data || [])
    } catch (error) {
      console.error('Error loading batches:', error)
    }
  }

  const loadLiveClasses = async (batchId: string) => {
    try {
      const data = await api.getBatchLiveClasses(batchId)
      setLiveClasses(data.data?.liveClasses || data.data || [])
    } catch (error) {
      console.error('Error loading live classes:', error)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setResourceData(prev => ({ ...prev, [field]: value }))
    
    // If course changes, load its batches
    if (field === 'courseId' && value) {
      loadBatches(value)
    }
    
    // If batch changes, load its live classes
    if (field === 'batchId' && value) {
      loadLiveClasses(value)
    }
    
    // If resource level changes, reset dependent fields
    if (field === 'resourceLevel') {
      setResourceData(prev => ({
        ...prev,
        courseId: value === 'COURSE' ? prev.courseId : '',
        batchId: value === 'BATCH' ? prev.batchId : '',
        liveClassId: value === 'CLASS' ? prev.liveClassId : ''
      }))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setResourceData(prev => ({ ...prev, file }))
    
    // Create preview for images
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !resourceData.tags.includes(tagInput.trim())) {
      setResourceData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setResourceData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate required fields
      if (!resourceData.title) {
        throw new Error('Title is required')
      }
      
      // For new resources, file is required
      if (!editingResource && !resourceData.file) {
        throw new Error('File is required')
      }
      
      // Validate resource level specific fields
      if (resourceData.resourceLevel === 'COURSE' && !resourceData.courseId) {
        throw new Error('Course is required for course-level resources')
      }
      
      if (resourceData.resourceLevel === 'BATCH' && !resourceData.batchId) {
        throw new Error('Batch is required for batch-level resources')
      }
      
      if (resourceData.resourceLevel === 'CLASS' && !resourceData.liveClassId) {
        throw new Error('Live class is required for class-level resources')
      }

      const formData = new FormData()
      formData.append('title', resourceData.title)
      formData.append('description', resourceData.description)
      formData.append('resourceLevel', resourceData.resourceLevel)
      formData.append('accessLevel', resourceData.accessLevel)
      
      if (resourceData.tags.length > 0) {
        formData.append('tags', JSON.stringify(resourceData.tags))
      }
      
      if (resourceData.expiresAt) {
        formData.append('expiresAt', new Date(resourceData.expiresAt).toISOString())
      }
      
      if (resourceData.courseId) {
        formData.append('courseId', resourceData.courseId)
      }
      
      if (resourceData.batchId) {
        formData.append('batchId', resourceData.batchId)
      }
      
      if (resourceData.liveClassId) {
        formData.append('liveClassId', resourceData.liveClassId)
      }
      
      if (resourceData.file) {
        formData.append('file', resourceData.file)
      }

      let data
      if (editingResource) {
        // Update existing resource
        data = await api.updateResource(editingResource.id, formData)
      } else {
        // Create new resource
        data = await api.createResource(formData)
      }
      
      if (editingResource) {
        onResourceUpdated(data.data)
        toast.success('Resource updated successfully!')
      } else {
        onResourceCreated(data.data)
        toast.success('Resource uploaded successfully!')
      }
      
      onClose()

    } catch (error) {
      console.error(`Failed to ${editingResource ? 'update' : 'create'} resource:`, error)
      setError(error instanceof Error ? error.message : `Failed to ${editingResource ? 'update' : 'create'} resource`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingResource ? `Edit Resource "${editingResource.title}"` : 'Upload Resource'} size="lg">
      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Resource title"
              value={resourceData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Resource description"
              value={resourceData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Resource Level *
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={resourceData.resourceLevel}
              onChange={(e) => handleInputChange('resourceLevel', e.target.value)}
            >
              <option value="COURSE">Course Level</option>
              <option value="BATCH">Batch Level</option>
              <option value="CLASS">Class Level</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Access Level *
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={resourceData.accessLevel}
              onChange={(e) => handleInputChange('accessLevel', e.target.value)}
            >
              <option value="PUBLIC">Public</option>
              <option value="ENROLLED_ONLY">Enrolled Students Only</option>
              <option value="INSTRUCTOR_ONLY">Instructors Only</option>
              <option value="ADMIN_ONLY">Admins Only</option>
            </select>
          </div>

          {resourceData.resourceLevel === 'COURSE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Course *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                value={resourceData.courseId}
                onChange={(e) => handleInputChange('courseId', e.target.value)}
              >
                <option value="">Select a course</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {resourceData.resourceLevel === 'BATCH' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Course *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  value={resourceData.courseId}
                  onChange={(e) => handleInputChange('courseId', e.target.value)}
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Batch *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  value={resourceData.batchId}
                  onChange={(e) => handleInputChange('batchId', e.target.value)}
                  disabled={!resourceData.courseId}
                >
                  <option value="">Select a batch</option>
                  {batches.map(batch => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name} ({batch.batchCode})
                    </option>
                  ))}
                </select>
                {!resourceData.courseId && (
                  <p className="text-sm text-amber-600 mt-1">Please select a course first</p>
                )}
              </div>
            </>
          )}

          {resourceData.resourceLevel === 'CLASS' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Course *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  value={resourceData.courseId}
                  onChange={(e) => handleInputChange('courseId', e.target.value)}
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Batch *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  value={resourceData.batchId}
                  onChange={(e) => handleInputChange('batchId', e.target.value)}
                  disabled={!resourceData.courseId}
                >
                  <option value="">Select a batch</option>
                  {batches.map(batch => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name} ({batch.batchCode})
                    </option>
                  ))}
                </select>
                {!resourceData.courseId && (
                  <p className="text-sm text-amber-600 mt-1">Please select a course first</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Live Class *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  value={resourceData.liveClassId}
                  onChange={(e) => handleInputChange('liveClassId', e.target.value)}
                  disabled={!resourceData.batchId}
                >
                  <option value="">Select a live class</option>
                  {liveClasses.map(liveClass => (
                    <option key={liveClass.id} value={liveClass.id}>
                      {liveClass.title} ({new Date(liveClass.scheduledStartTime).toLocaleDateString()})
                    </option>
                  ))}
                </select>
                {!resourceData.batchId && (
                  <p className="text-sm text-amber-600 mt-1">Please select a batch first</p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expiry Date (Optional)
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={resourceData.expiresAt}
              onChange={(e) => handleInputChange('expiresAt', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Add a tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {resourceData.tags.map(tag => (
                <span key={tag} className="inline-flex items-center px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingResource ? 'Replace File (Optional)' : 'File Upload *'}
          </h4>
          
          {filePreview && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview:</p>
              <img 
                src={filePreview} 
                alt="File preview" 
                className="max-h-40 rounded-lg border border-gray-300 dark:border-gray-600"
              />
            </div>
          )}
          
          {editingResource && !resourceData.file && (
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Current file:</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{editingResource.originalName}</p>
              <a 
                href={editingResource.fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View current file
              </a>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {editingResource ? 'Replace File' : 'Select File *'}
            </label>
            <input
              type="file"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || 
            !resourceData.title || 
            (!editingResource && !resourceData.file) ||
            (resourceData.resourceLevel === 'COURSE' && !resourceData.courseId) ||
            (resourceData.resourceLevel === 'BATCH' && (!resourceData.courseId || !resourceData.batchId)) ||
            (resourceData.resourceLevel === 'CLASS' && (!resourceData.courseId || !resourceData.batchId || !resourceData.liveClassId))
          }
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting 
            ? (editingResource ? 'Updating...' : 'Uploading...') 
            : (editingResource ? 'Update Resource' : 'Upload Resource')
          }
        </button>
      </div>
    </Modal>
  )
}


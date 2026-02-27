'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { Modal } from '../ui/Modal'
import { toast } from 'sonner'

interface DeactivateModalProps {
  isOpen: boolean
  onClose: () => void
  student: { id: string; email: string; isActive: boolean }
  onDeactivate: () => void
}

export function DeactivateModal({ 
  isOpen, 
  onClose, 
  student,
  onDeactivate 
}: DeactivateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const action = student?.isActive ? 'Deactivate' : 'Activate'

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      await api.updateStudentStatus(student.id, {
        isActive: !student.isActive
      })

      onDeactivate()
      toast.success(`Account ${action.toLowerCase()}d successfully`)
      onClose()
    } catch (error) {
      console.error(`${action} failed:`, error)
      toast.error(`Failed to ${action.toLowerCase()} account`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`${action} Account`}
      size="sm"
    >
      <div className="p-4">
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to {action.toLowerCase()} the account for <strong>{student.email}</strong>?
        </p>
        {student.isActive && (
          <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
            The student will no longer be able to access the platform.
          </p>
        )}
      </div>

      <div className="p-4 border-t flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border rounded hover:bg-gray-100"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className={`px-4 py-2 text-sm text-white rounded hover:opacity-90 disabled:opacity-50 ${
            student.isActive ? 'bg-red-600' : 'bg-green-600'
          }`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Processing...' : action}
        </button>
      </div>
    </Modal>
  )
}


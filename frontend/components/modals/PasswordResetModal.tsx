'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { Modal } from '../ui/Modal'
import { toast } from 'sonner'

interface PasswordResetModalProps {
  isOpen: boolean
  onClose: () => void
  student?: { id: string; email: string }
  account?: { id: string; email: string }
  entityLabel?: string
  onSubmitReset?: (id: string, payload: { newPassword: string; notifyUser: boolean }) => Promise<any>
  onPasswordReset: (newPassword: string) => void
}

export function PasswordResetModal({ 
  isOpen, 
  onClose, 
  student,
  account,
  entityLabel = 'student',
  onSubmitReset,
  onPasswordReset 
}: PasswordResetModalProps) {
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOtpSending, setIsOtpSending] = useState(false)

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const handleGenerateClick = () => {
    const generatedPassword = generateRandomPassword()
    setNewPassword(generatedPassword)
  }

  const handleSubmit = async () => {
    const target = account || student
    if (!target?.id) {
      toast.error(`Invalid ${entityLabel} account`)
      return
    }

    if (!autoGenerate && !newPassword) {
      toast.error('Please enter or generate a password')
      return
    }

    setIsSubmitting(true)
    
    try {
      const passwordToUse = autoGenerate ? generateRandomPassword() : newPassword
      
      // Call API to reset password
      if (onSubmitReset) {
        await onSubmitReset(target.id, {
          newPassword: passwordToUse,
          notifyUser: sendEmail
        })
      } else {
        await api.resetStudentPassword(target.id, {
          newPassword: passwordToUse,
          notifyUser: sendEmail
        })
      }

      onPasswordReset(passwordToUse)
      toast.success('Password reset successfully')
      onClose()
    } catch (error) {
      console.error('Password reset failed:', error)
      toast.error('Failed to reset password')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendOtpSetupRequest = async () => {
    const target = account || student
    if (!target?.id) {
      toast.error(`Invalid ${entityLabel} account`)
      return
    }

    try {
      setIsOtpSending(true)
      const response = await api.requestUserPasswordSetupOtp(target.id)
      toast.success(response?.message || 'OTP request sent successfully')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send OTP request')
    } finally {
      setIsOtpSending(false)
    }
  }

  const titleEmail = (account || student)?.email || ''

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Reset Password for ${titleEmail}`}
      size="md"
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoGenerate"
            checked={autoGenerate}
            onChange={(e) => setAutoGenerate(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <label htmlFor="autoGenerate" className="text-sm">
            Auto-generate secure password
          </label>
        </div>

        {!autoGenerate && (
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
        )}

        {autoGenerate && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateClick}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              Generate Password
            </button>
            {newPassword && (
              <div className="text-sm bg-gray-50 p-2 rounded">
                <span className="font-medium">Preview:</span> {newPassword.substring(0, 3)}*****
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="sendEmail"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <label htmlFor="sendEmail" className="text-sm">
            Send email notification to user
          </label>
        </div>
      </div>

      <div className="p-4 border-t flex justify-end gap-2">
        <button
          onClick={handleSendOtpSetupRequest}
          className="px-4 py-2 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
          disabled={isSubmitting || isOtpSending}
        >
          {isOtpSending ? 'Sending OTP...' : 'Send OTP Setup Request'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border rounded hover:bg-gray-100"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </div>
    </Modal>
  )
}


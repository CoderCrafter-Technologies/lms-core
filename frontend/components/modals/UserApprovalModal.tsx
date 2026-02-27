'use client'

import { useState } from 'react'
import { Modal } from '../ui/Modal'

interface UserApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  pendingUser: any
  onUserApproved: (approvalData: any) => void
  onUserRejected: (userId: string, reason: string) => void
  availableCourses: any[]
  availableBatches: any[]
}

export function UserApprovalModal({ 
  isOpen, 
  onClose, 
  pendingUser, 
  onUserApproved, 
  onUserRejected, 
  availableCourses,
  availableBatches 
}: UserApprovalModalProps) {
  const [approvalData, setApprovalData] = useState({
    decision: 'approve' as 'approve' | 'reject',
    assignedCourses: [] as string[],
    assignedBatches: [] as string[],
    role: pendingUser?.requestedRole || 'STUDENT',
    rejectionReason: '',
    welcomeMessage: 'Welcome to our Learning Management System! Your account has been approved.',
    permissions: [] as string[]
  })

  const roles = ['STUDENT', 'INSTRUCTOR', 'MANAGER']

  const handleInputChange = (field: string, value: any) => {
    setApprovalData(prev => ({ ...prev, [field]: value }))
  }

  const toggleCourseAssignment = (courseId: string) => {
    setApprovalData(prev => ({
      ...prev,
      assignedCourses: prev.assignedCourses.includes(courseId)
        ? prev.assignedCourses.filter(id => id !== courseId)
        : [...prev.assignedCourses, courseId]
    }))
  }

  const toggleBatchAssignment = (batchId: string) => {
    setApprovalData(prev => ({
      ...prev,
      assignedBatches: prev.assignedBatches.includes(batchId)
        ? prev.assignedBatches.filter(id => id !== batchId)
        : [...prev.assignedBatches, batchId]
    }))
  }

  const handleApprove = async () => {
    try {
      const userData = {
        userId: pendingUser.id,
        ...approvalData,
        approvedAt: new Date().toISOString(),
        status: 'approved'
      }

      onUserApproved(userData)
      onClose()
      resetForm()

    } catch (error) {
      console.error('Failed to approve user:', error)
    }
  }

  const handleReject = async () => {
    try {
      onUserRejected(pendingUser.id, approvalData.rejectionReason)
      onClose()
      resetForm()

    } catch (error) {
      console.error('Failed to reject user:', error)
    }
  }

  const resetForm = () => {
    setApprovalData({
      decision: 'approve',
      assignedCourses: [],
      assignedBatches: [],
      role: 'STUDENT',
      rejectionReason: '',
      welcomeMessage: 'Welcome to our Learning Management System! Your account has been approved.',
      permissions: []
    })
  }

  if (!pendingUser) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review User Application" size="xl">
      <div className="space-y-6">
        {/* User Information */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Applicant Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {pendingUser.firstName} {pendingUser.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{pendingUser.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Requested Role</p>
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {pendingUser.requestedRole}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Applied On</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(pendingUser.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Decision */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Decision</h4>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="approve"
                checked={approvalData.decision === 'approve'}
                onChange={(e) => handleInputChange('decision', e.target.value)}
                className="mr-3"
              />
              <span className="text-green-600 font-medium">✅ Approve Application</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="reject"
                checked={approvalData.decision === 'reject'}
                onChange={(e) => handleInputChange('decision', e.target.value)}
                className="mr-3"
              />
              <span className="text-red-600 font-medium">❌ Reject Application</span>
            </label>
          </div>
        </div>

        {/* Approval Details */}
        {approvalData.decision === 'approve' && (
          <div className="space-y-6">
            {/* Role Assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assign Role
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                value={approvalData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
              >
                {roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Course Assignment */}
            {(approvalData.role === 'STUDENT' || approvalData.role === 'INSTRUCTOR') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign Courses
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                  {availableCourses.length > 0 ? (
                    <div className="space-y-2">
                      {availableCourses.map(course => (
                        <label key={course.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={approvalData.assignedCourses.includes(course.id)}
                            onChange={() => toggleCourseAssignment(course.id)}
                            className="mr-3"
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{course.title}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{course.category}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No courses available</p>
                  )}
                </div>
              </div>
            )}

            {/* Batch Assignment */}
            {approvalData.role === 'STUDENT' && approvalData.assignedCourses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign Batches
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                  {availableBatches.filter(batch => 
                    approvalData.assignedCourses.includes(batch.courseId)
                  ).map(batch => (
                    <label key={batch.id} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={approvalData.assignedBatches.includes(batch.id)}
                        onChange={() => toggleBatchAssignment(batch.id)}
                        className="mr-3"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{batch.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {batch.startDate} - {batch.endDate}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Welcome Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Welcome Message
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                value={approvalData.welcomeMessage}
                onChange={(e) => handleInputChange('welcomeMessage', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Rejection Reason */}
        {approvalData.decision === 'reject' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rejection Reason *
            </label>
            <textarea
              rows={4}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Please provide a reason for rejection..."
              value={approvalData.rejectionReason}
              onChange={(e) => handleInputChange('rejectionReason', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        
        {approvalData.decision === 'approve' ? (
          <button
            type="button"
            onClick={handleApprove}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 transition-colors"
          >
            ✅ Approve User
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReject}
            disabled={!approvalData.rejectionReason}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ❌ Reject User
          </button>
        )}
      </div>
    </Modal>
  )
}
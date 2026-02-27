'use client'

import { useState } from 'react'
import { Modal } from '../ui/Modal'

interface ClassSchedulingModalProps {
  isOpen: boolean
  onClose: () => void
  batchId: string
  batchName: string
  courseTitle: string
  onClassScheduled: (classData: any) => void
}

export function ClassSchedulingModal({ 
  isOpen, 
  onClose, 
  batchId, 
  batchName, 
  courseTitle, 
  onClassScheduled 
}: ClassSchedulingModalProps) {
  const [classData, setClassData] = useState({
    title: '',
    description: '',
    agenda: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
    settings: {
      maxParticipants: 100,
      allowRecording: true,
      allowScreenShare: true,
      allowWhiteboard: true,
      allowChat: true,
      allowStudentMic: false,
      allowStudentCamera: false,
      requireApproval: false
    },
    materials: [] as Array<{ name: string; type: string; url: string }>
  })

  const handleInputChange = (field: string, value: any) => {
    setClassData(prev => ({ ...prev, [field]: value }))
  }

  const handleSettingsChange = (field: string, value: any) => {
    setClassData(prev => ({
      ...prev,
      settings: { ...prev.settings, [field]: value }
    }))
  }

  const generateRoomId = () => {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const handleSubmit = async () => {
    try {
      const roomId = generateRoomId()
      
      const newClass = {
        id: Date.now().toString(),
        batchId,
        roomId,
        ...classData,
        status: 'SCHEDULED',
        stats: {
          totalParticipants: 0,
          peakParticipants: 0,
          averageParticipants: 0,
          totalChatMessages: 0
        },
        recording: {
          isRecorded: false,
          recordingUrl: null,
          recordingId: null,
          recordingSize: 0,
          recordingDuration: 0
        },
        createdAt: new Date().toISOString()
      }

      onClassScheduled(newClass)
      onClose()

      // Reset form
      setClassData({
        title: '', description: '', agenda: '', scheduledStartTime: '', scheduledEndTime: '',
        settings: {
          maxParticipants: 100, allowRecording: true, allowScreenShare: true, allowWhiteboard: true,
          allowChat: true, allowStudentMic: false, allowStudentCamera: false, requireApproval: false
        },
        materials: []
      })

    } catch (error) {
      console.error('Failed to schedule class:', error)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Schedule Class for "${batchName}"`} size="xl">
      <div className="space-y-6">
        {/* Course Context */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-blue-600 dark:text-blue-400 text-xl mr-3">📚</div>
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-100">{courseTitle}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">Batch: {batchName}</p>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Class Details</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Class Title *
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="e.g., Introduction to React Hooks"
              value={classData.title}
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
              placeholder="Brief description of what will be covered in this class"
              value={classData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Agenda
            </label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Class agenda and topics to be covered..."
              value={classData.agenda}
              onChange={(e) => handleInputChange('agenda', e.target.value)}
            />
          </div>
        </div>

        {/* Scheduling */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Schedule</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                value={classData.scheduledStartTime}
                onChange={(e) => handleInputChange('scheduledStartTime', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                value={classData.scheduledEndTime}
                onChange={(e) => handleInputChange('scheduledEndTime', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Class Settings */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Class Settings</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Maximum Participants
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={classData.settings.maxParticipants}
              onChange={(e) => handleSettingsChange('maxParticipants', parseInt(e.target.value) || 100)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'allowRecording', label: 'Allow Recording', description: 'Record the live session' },
              { key: 'allowScreenShare', label: 'Screen Sharing', description: 'Enable screen sharing' },
              { key: 'allowWhiteboard', label: 'Whiteboard', description: 'Interactive whiteboard' },
              { key: 'allowChat', label: 'Chat', description: 'Enable text chat' },
              { key: 'allowStudentMic', label: 'Student Microphone', description: 'Allow students to unmute' },
              { key: 'allowStudentCamera', label: 'Student Camera', description: 'Allow students to turn on camera' },
              { key: 'requireApproval', label: 'Require Approval', description: 'Approve before students join' }
            ].map(setting => (
              <div key={setting.key} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{setting.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{setting.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={Boolean(classData.settings[setting.key as keyof typeof classData.settings])}
                    onChange={(e) => handleSettingsChange(setting.key, e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Live Class Features Preview */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Live Class Features</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-white dark:bg-gray-600 rounded-lg">
              <div className="text-2xl mb-1">🎥</div>
              <p className="text-xs text-gray-600 dark:text-gray-300">HD Video</p>
            </div>
            <div className="p-3 bg-white dark:bg-gray-600 rounded-lg">
              <div className="text-2xl mb-1">🎤</div>
              <p className="text-xs text-gray-600 dark:text-gray-300">Audio</p>
            </div>
            <div className="p-3 bg-white dark:bg-gray-600 rounded-lg">
              <div className="text-2xl mb-1">📺</div>
              <p className="text-xs text-gray-600 dark:text-gray-300">Screen Share</p>
            </div>
            <div className="p-3 bg-white dark:bg-gray-600 rounded-lg">
              <div className="text-2xl mb-1">✏️</div>
              <p className="text-xs text-gray-600 dark:text-gray-300">Whiteboard</p>
            </div>
          </div>
        </div>
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
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!classData.title || !classData.scheduledStartTime || !classData.scheduledEndTime}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Schedule Class
        </button>
      </div>
    </Modal>
  )
}

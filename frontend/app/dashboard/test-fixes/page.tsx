'use client'

import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import PreJoinModal from '../../../components/PreJoinModal'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

export default function TestFixesPage() {
  const [showPreJoinModal, setShowPreJoinModal] = useState(false)
  const [testResults, setTestResults] = useState<{[key: string]: boolean}>({})

  const mockClassData = {
    name: 'Test Live Class',
    roomId: 'test-room-123'
  }

  const handlePreJoinTest = (preferences: { micOn: boolean; camOn: boolean }) => {
    console.log('Pre-join preferences:', preferences)
    setTestResults(prev => ({ ...prev, preJoinModal: true }))
    setShowPreJoinModal(false)
    toast.success(`Pre-join test successful. Mic ${preferences.micOn ? 'ON' : 'OFF'}, Camera ${preferences.camOn ? 'ON' : 'OFF'}.`)
  }

  const tests = [
    {
      id: 'assessmentCreation',
      title: 'Assessment Creation Fix',
      description: 'Course ID mapping fix for MongoDB _id field',
      status: 'implemented',
      details: 'Fixed course.id to course._id in assessment creation form'
    },
    {
      id: 'preJoinModal',
      title: 'Pre-Join Meeting Modal',
      description: 'Modal for audio/video preferences before joining meetings',
      status: 'implemented',
      action: () => setShowPreJoinModal(true),
      actionLabel: 'Test Modal'
    },
    {
      id: 'supportSection',
      title: 'Support Section',
      description: 'Complete support ticket and leave request system',
      status: 'implemented',
      details: 'Full frontend + backend implementation with admin management'
    },
    {
      id: 'urgentNotifications',
      title: 'Urgent Notifications',
      description: 'Persistent notifications for admins about urgent tickets',
      status: 'implemented',
      details: 'Auto-polling notification system with dismissible alerts'
    }
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Fix Validation Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Test and validate implemented fixes and enhancements
        </p>
      </div>

      <div className="grid gap-4">
        {tests.map(test => (
          <Card key={test.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{test.title}</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge 
                    className={
                      test.status === 'implemented' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {test.status === 'implemented' ? (
                      <CheckCircleIcon className="h-3 w-3 mr-1" />
                    ) : (
                      <XCircleIcon className="h-3 w-3 mr-1" />
                    )}
                    {test.status}
                  </Badge>
                  {testResults[test.id] && (
                    <Badge className="bg-blue-100 text-blue-800">
                      ✓ Tested
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3">{test.description}</p>
              {test.details && (
                <p className="text-sm text-gray-500 mb-3">{test.details}</p>
              )}
              {test.action && (
                <Button onClick={test.action} variant="outline" size="sm">
                  {test.actionLabel}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* File Locations Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold">Assessment Creation Fix:</h4>
              <p className="text-gray-600">📁 frontend/app/dashboard/assessments/create/page.tsx</p>
            </div>
            <div>
              <h4 className="font-semibold">Pre-Join Modal:</h4>
              <p className="text-gray-600">📁 frontend/components/PreJoinModal.tsx</p>
              <p className="text-gray-600">📁 frontend/components/NewClassRoom.tsx (updated)</p>
            </div>
            <div>
              <h4 className="font-semibold">Support Section:</h4>
              <p className="text-gray-600">📁 frontend/app/dashboard/support/page.tsx</p>
              <p className="text-gray-600">📁 frontend/app/dashboard/admin/support/page.tsx</p>
              <p className="text-gray-600">📁 backend/src/models/Ticket.js</p>
              <p className="text-gray-600">📁 backend/src/controllers/supportController.js</p>
              <p className="text-gray-600">📁 backend/src/routes/support.js</p>
            </div>
            <div>
              <h4 className="font-semibold">Notifications:</h4>
              <p className="text-gray-600">📁 frontend/components/UrgentNotification.tsx</p>
              <p className="text-gray-600">📁 frontend/app/dashboard/layout.tsx (updated)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Modal */}
      <PreJoinModal
        isOpen={showPreJoinModal}
        classData={mockClassData}
        onJoin={handlePreJoinTest}
        onCancel={() => setShowPreJoinModal(false)}
      />
    </div>
  )
}

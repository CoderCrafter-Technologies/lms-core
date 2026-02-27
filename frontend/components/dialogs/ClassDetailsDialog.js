'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { ErrorBoundary } from 'react-error-boundary'

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="p-4 bg-red-100 text-red-700 rounded">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button 
        onClick={resetErrorBoundary}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Try again
      </button>
    </div>
  )
}

export default function ClassDetailsDialog({ 
  isOpen, 
  onClose, 
  classItem, 
  onJoinClass,
  isClassActive 
}) {
  const [activeDialogTab, setActiveDialogTab] = useState('details')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  if (!isMounted || !isOpen || !classItem) return null

  const dialogContent = (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{classItem.title}</DialogTitle>
            <button 
              onClick={onClose}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <span className="sr-only">Close</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </DialogHeader>
          
          <div className="w-full">
            {/* Custom Tabs Implementation */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
              <Button
                variant={activeDialogTab === 'details' ? 'default' : 'ghost'}
                className="flex-1"
                onClick={() => setActiveDialogTab('details')}
              >
                Details
              </Button>
              <Button
                variant={activeDialogTab === 'resources' ? 'default' : 'ghost'}
                className="flex-1"
                onClick={() => setActiveDialogTab('resources')}
              >
                Resources
              </Button>
              <Button
                variant={activeDialogTab === 'leave' ? 'default' : 'ghost'}
                className="flex-1"
                onClick={() => setActiveDialogTab('leave')}
              >
                Leave Request
              </Button>
            </div>

            {/* Tab Contents */}
            {activeDialogTab === 'details' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Description</h3>
                  <p className="text-sm text-muted-foreground">
                    {classItem.description || 'No description provided'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Start Time</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(classItem.scheduledStartTime), 'PPpp')}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">End Time</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(classItem.scheduledEndTime), 'PPpp')}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Status</h3>
                    <Badge variant={
                      classItem.status === 'COMPLETED' ? 'default' :
                      classItem.status === 'SCHEDULED' ? 'secondary' :
                      'destructive'
                    }>
                      {classItem.status}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-medium">Recording Available</h3>
                    <p className="text-sm text-muted-foreground">
                      {classItem.recordingUrl ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
                
                {isClassActive(classItem) && (
                  <Button 
                    className="mt-4"
                    onClick={() => onJoinClass(classItem)}
                  >
                    Join Live Class
                  </Button>
                )}
              </div>
            )}

            {activeDialogTab === 'resources' && (
              classItem.resources?.length > 0 ? (
                <div className="space-y-4">
                  {classItem.resources.map((resource, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                          {resource.type === 'pdf' ? '📄' : 
                          resource.type === 'video' ? '🎬' : 
                          resource.type === 'link' ? '🔗' : '📁'}
                        </div>
                        <div>
                          <h4 className="font-medium">{resource.title}</h4>
                          <p className="text-sm text-muted-foreground">{resource.description}</p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                      >
                        <a 
                          href={resource.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No resources shared for this class</p>
                </div>
              )
            )}

            {activeDialogTab === 'leave' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Request Leave for This Class</h3>
                  <p className="text-sm text-muted-foreground">
                    Submit a leave request if you can't attend this class session.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Reason</label>
                  <textarea 
                    className="w-full p-2 border rounded-md min-h-[100px]" 
                    placeholder="Explain your reason for requesting leave..."
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button>Submit Request</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  )

  return dialogContent
}
import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

interface PreJoinModalProps {
  isOpen: boolean;
  classData: any;
  onJoin: (preferences: { micOn: boolean; camOn: boolean }) => void;
  onCancel: () => void;
}

export default function PreJoinModal({ isOpen, classData, onJoin, onCancel }: PreJoinModalProps) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const handleJoin = () => {
    onJoin({ micOn, camOn });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-center">
            Join Meeting
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {classData?.name || 'Live Class'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preview Area */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg h-32 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Camera Preview</p>
            </div>
          </div>

          {/* Audio/Video Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MicIcon className={`w-5 h-5 ${micOn ? 'text-green-500' : 'text-red-500'}`} />
                <Label htmlFor="mic-toggle">Microphone</Label>
              </div>
              <Switch
                id="mic-toggle"
                checked={micOn}
                onCheckedChange={setMicOn}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CameraIcon className={`w-5 h-5 ${camOn ? 'text-green-500' : 'text-red-500'}`} />
                <Label htmlFor="camera-toggle">Camera</Label>
              </div>
              <Switch
                id="camera-toggle"
                checked={camOn}
                onCheckedChange={setCamOn}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleJoin}
            >
              Join Meeting
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            You can change these settings anytime during the meeting
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Icon components
function MicIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
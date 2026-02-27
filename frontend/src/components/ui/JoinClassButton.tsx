'use client';

import React from 'react';
import { Button } from './button';
import { VideoCameraIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

interface JoinClassButtonProps {
  roomId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  children?: React.ReactNode;
  disabled?: boolean;
}

export default function JoinClassButton({ 
  roomId, 
  className = '', 
  size = 'md',
  variant = 'default',
  children,
  disabled = false
}: JoinClassButtonProps) {
  
  const handleJoinClass = () => {
    if (!roomId || disabled) return;
    
    // Open classroom in new tab
    const classroomUrl = `/classroom/${roomId}`;
    const newWindow = window.open(classroomUrl, '_blank', 'noopener,noreferrer');
    
    if (!newWindow) {
      // Fallback if popup is blocked
      toast.error('Popup blocked. We will open the classroom in this tab instead.');
      // Navigate in same window as fallback
      window.location.href = classroomUrl;
    }
  };

  return (
    <Button
      onClick={handleJoinClass}
      disabled={disabled}
      variant={variant}
      size={size}
      className={`flex items-center gap-2 ${className}`}
    >
      <VideoCameraIcon className="w-4 h-4" />
      {children || 'Join Class'}
      <ArrowTopRightOnSquareIcon className="w-3 h-3 opacity-70" />
    </Button>
  );
}

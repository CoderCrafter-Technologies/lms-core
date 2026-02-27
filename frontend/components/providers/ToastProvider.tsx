'use client'

import { Toaster as HotToaster } from 'react-hot-toast'
import { Toaster as SonnerToaster } from 'sonner'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <HotToaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--toast-bg)',
            color: 'var(--toast-color)',
            border: '1px solid var(--toast-border)',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#ffffff',
            },
          },
        }}
      />
      <SonnerToaster
        position="top-right"
        duration={4000}
        theme="system"
        richColors
      />
      <style jsx global>{`
        :root {
          --toast-bg: #ffffff;
          --toast-color: #374151;
          --toast-border: #e5e7eb;
        }
        
        .dark {
          --toast-bg: #1f2937;
          --toast-color: #f9fafb;
          --toast-border: #374151;
        }
      `}</style>
    </>
  )
}

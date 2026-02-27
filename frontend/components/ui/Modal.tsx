'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  hideCloseButton?: boolean
  showCloseButton?: boolean
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  hideCloseButton = false,
  showCloseButton = true
}: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl'
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const shouldShowCloseButton = !hideCloseButton && showCloseButton

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 transition-opacity"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className={`relative w-full ${sizeClasses[size]} transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-xl transition-all`}
          style={{ 
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 
              className="text-lg font-medium leading-6"
              style={{ color: 'var(--color-text)' }}
            >
              {title}
            </h3>
            {shouldShowCloseButton && (
              <button
                type="button"
                className="rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
                onClick={onClose}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  e.currentTarget.style.color = 'var(--color-text)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span className="sr-only">Close</span>
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div style={{ color: 'var(--color-text)' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// Optional: Export a confirm modal variant
interface ConfirmModalProps extends ModalProps {
  onConfirm: () => void
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'destructive' | 'success'
}

export function ConfirmModal({
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  ...props
}: ConfirmModalProps) {
  const getConfirmButtonStyles = () => {
    switch (confirmVariant) {
      case 'destructive':
        return {
          backgroundColor: 'var(--color-error)',
          color: 'white'
        }
      case 'success':
        return {
          backgroundColor: 'var(--color-success)',
          color: 'white'
        }
      case 'primary':
      default:
        return {
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-btn-primary-text)'
        }
    }
  }

  const confirmStyles = getConfirmButtonStyles()

  return (
    <Modal {...props}>
      <div className="space-y-4">
        {props.children}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={props.onClose}
            className="px-4 py-2 rounded-md transition-colors"
            style={{
              backgroundColor: 'var(--color-secondary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-secondary-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-secondary)'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md transition-colors"
            style={confirmStyles}
            onMouseEnter={(e) => {
              if (confirmVariant === 'primary') {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
              } else if (confirmVariant === 'destructive') {
                e.currentTarget.style.backgroundColor = 'var(--color-error-hover)'
              } else if (confirmVariant === 'success') {
                e.currentTarget.style.backgroundColor = 'var(--color-success-hover)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = confirmStyles.backgroundColor
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
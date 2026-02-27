import { cn } from '../../lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  className?: string
  label?: string
  showLabel?: boolean
}

export function Spinner({ 
  size = 'md', 
  variant = 'primary',
  className,
  label,
  showLabel = false
}: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }

  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          border: 'var(--color-border)',
          borderTop: 'var(--color-primary)'
        }
      case 'success':
        return {
          border: 'var(--color-border)',
          borderTop: 'var(--color-success)'
        }
      case 'warning':
        return {
          border: 'var(--color-border)',
          borderTop: 'var(--color-warning)'
        }
      case 'danger':
        return {
          border: 'var(--color-border)',
          borderTop: 'var(--color-error)'
        }
      case 'default':
      default:
        return {
          border: 'var(--color-border)',
          borderTop: 'var(--color-text-secondary)'
        }
    }
  }

  const colors = getVariantColors()

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'animate-spin rounded-full border-2',
          sizeClasses[size],
          className
        )}
        style={{
          borderColor: colors.border,
          borderTopColor: colors.borderTop
        }}
      />
      {showLabel && label && (
        <span style={{ color: 'var(--color-text-secondary)' }} className="text-sm">
          {label}
        </span>
      )}
    </div>
  )
}

// Optional: Full page spinner
export function FullPageSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div 
        className="flex flex-col items-center gap-4 p-8 rounded-lg"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <Spinner size="xl" variant="primary" />
        {label && (
          <p style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
        )}
      </div>
    </div>
  )
}

// Optional: Inline spinner with text
export function InlineSpinner({ text, ...props }: SpinnerProps & { text?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Spinner size="sm" {...props} />
      {text && (
        <span style={{ color: 'var(--color-text-secondary)' }} className="text-sm">
          {text}
        </span>
      )}
    </div>
  )
}

// Optional: Loading button spinner
export function ButtonSpinner({ ...props }: SpinnerProps) {
  return (
    <Spinner 
      size="sm" 
      variant="default"
      className="mr-2"
      {...props}
    />
  )
}


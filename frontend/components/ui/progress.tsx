import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  indicatorClassName?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  showPercentage?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ 
    className, 
    value, 
    max = 100, 
    indicatorClassName,
    variant = 'default',
    size = 'md',
    showPercentage = false,
    style,
    ...props 
  }, ref) => {
    const percentage = Math.min(Math.max(value, 0), max)
    
    const getVariantColor = () => {
      switch (variant) {
        case 'success':
          return 'var(--color-success)'
        case 'warning':
          return 'var(--color-warning)'
        case 'danger':
          return 'var(--color-error)'
        case 'default':
        default:
          return 'var(--color-primary)'
      }
    }

    const getSizeHeight = () => {
      switch (size) {
        case 'sm':
          return 'h-1'
        case 'lg':
          return 'h-4'
        case 'md':
        default:
          return 'h-2'
      }
    }

    const progressColor = getVariantColor()
    const sizeClass = getSizeHeight()

    return (
      <div className="relative">
        <div
          ref={ref}
          className={cn(
            'relative w-full overflow-hidden rounded-full',
            sizeClass,
            className
          )}
          style={{
            backgroundColor: 'var(--color-surface-muted)',
            ...style
          }}
          {...props}
        >
          <div
            className={cn(
              'h-full w-full flex-1 transition-all duration-300 ease-in-out',
              indicatorClassName
            )}
            style={{ 
              transform: `translateX(-${100 - percentage}%)`,
              backgroundColor: progressColor
            }}
          />
        </div>
        {showPercentage && (
          <span 
            className="absolute -right-8 top-1/2 transform -translate-y-1/2 text-xs font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    )
  }
)
Progress.displayName = 'Progress'

// Optional: Export a CircularProgress component for a different style
interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  variant?: 'default' | 'success' | 'warning' | 'danger'
  showPercentage?: boolean
  className?: string
}

export function CircularProgress({
  value,
  max = 100,
  size = 80,
  strokeWidth = 8,
  variant = 'default',
  showPercentage = true,
  className
}: CircularProgressProps) {
  const percentage = Math.min(Math.max(value, 0), max)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  const getVariantColor = () => {
    switch (variant) {
      case 'success':
        return 'var(--color-success)'
      case 'warning':
        return 'var(--color-warning)'
      case 'danger':
        return 'var(--color-error)'
      case 'default':
      default:
        return 'var(--color-primary)'
    }
  }

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-muted)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getVariantColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.3s ease-in-out',
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%'
          }}
        />
      </svg>
      {showPercentage && (
        <span 
          className="absolute text-sm font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  )
}

export { Progress }
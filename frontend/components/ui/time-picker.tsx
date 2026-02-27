'use client'

import { useState, useEffect, useRef } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  value?: string
  onChange?: (time: string) => void
  className?: string
  label?: string
  error?: string
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  step?: number
  showIcon?: boolean
  variant?: 'default' | 'outline' | 'filled'
  size?: 'sm' | 'md' | 'lg'
  placeholder?: string
  use12Hour?: boolean
}

export function TimePicker({ 
  value = '00:00', 
  onChange, 
  className,
  label,
  error,
  required,
  disabled,
  min,
  max,
  step = 60,
  showIcon = true,
  variant = 'default',
  size = 'md',
  placeholder = 'Select time',
  use12Hour = false
}: TimePickerProps) {
  const [time, setTime] = useState(value)
  const [period, setPeriod] = useState<'AM' | 'PM'>(
    parseInt(value.split(':')[0]) >= 12 ? 'PM' : 'AM'
  )
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (onChange) {
      onChange(time)
    }
  }, [time, onChange])

  // Convert 24h to 12h format for display
  const convertTo12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Convert 12h to 24h format
  const convertTo24Hour = (time12: string, period: 'AM' | 'PM') => {
    const [time, ampm] = time12.split(' ')
    let [hours, minutes] = time.split(':').map(Number)
    
    if (ampm === 'PM' && hours !== 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'outline':
        return {
          backgroundColor: 'transparent',
          border: `1px solid var(--color-border)`
        }
      case 'filled':
        return {
          backgroundColor: 'var(--color-surface-muted)',
          border: `1px solid transparent`
        }
      case 'default':
      default:
        return {
          backgroundColor: 'var(--color-surface)',
          border: `1px solid var(--color-border)`
        }
    }
  }

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          padding: '0.375rem 0.75rem',
          fontSize: '0.75rem',
          height: '32px'
        }
      case 'lg':
        return {
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          height: '48px'
        }
      case 'md':
      default:
        return {
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          height: '40px'
        }
    }
  }

  const variantStyles = getVariantStyles()
  const sizeStyles = getSizeStyles()

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label 
          className="block text-sm font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
          {required && (
            <span 
              className="ml-1"
              style={{ color: 'var(--color-error)' }}
            >
              *
            </span>
          )}
        </label>
      )}
      
      <div className="relative">
        {showIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <Clock 
              className={cn(
                size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
              )}
              style={{ color: 'var(--color-text-secondary)' }}
            />
          </div>
        )}

        <input
          ref={inputRef}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={cn(
            "block w-full rounded-md transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showIcon && (size === 'sm' ? 'pl-8' : size === 'lg' ? 'pl-11' : 'pl-10')
          )}
          style={{
            ...variantStyles,
            ...sizeStyles,
            borderColor: error ? 'var(--color-error)' : variantStyles.border,
            color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text)',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = 'var(--color-primary)'
              e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
            }
          }}
          onBlur={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = variantStyles.border as string
              e.currentTarget.style.boxShadow = 'none'
            }
          }}
        />
      </div>

      {error && (
        <p 
          className="text-xs mt-1"
          style={{ color: 'var(--color-error)' }}
        >
          {error}
        </p>
      )}

      {use12Hour && (
        <div className="flex gap-2 mt-2">
          {(['AM', 'PM'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p)
                // Update the time when period changes
                const currentTime = time
                setTime(convertTo24Hour(convertTo12Hour(currentTime), p))
              }}
              className={cn(
                "flex-1 px-3 py-1 text-sm rounded-md transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-offset-2"
              )}
              style={{
                backgroundColor: period === p ? 'var(--color-primary)' : 'var(--color-surface-muted)',
                color: period === p ? 'white' : 'var(--color-text)',
                border: period === p ? 'none' : `1px solid var(--color-border)`
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Optional: TimeRangePicker component
interface TimeRangePickerProps {
  startTime?: string
  endTime?: string
  onStartChange?: (time: string) => void
  onEndChange?: (time: string) => void
  className?: string
  label?: string
}

export function TimeRangePicker({
  startTime = '09:00',
  endTime = '17:00',
  onStartChange,
  onEndChange,
  className,
  label
}: TimeRangePickerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label style={{ color: 'var(--color-text-secondary)' }} className="text-sm font-medium">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <TimePicker value={startTime} onChange={onStartChange} size="sm" />
        <span style={{ color: 'var(--color-text-secondary)' }}>to</span>
        <TimePicker value={endTime} onChange={onEndChange} size="sm" />
      </div>
    </div>
  )
}
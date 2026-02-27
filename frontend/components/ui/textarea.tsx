import * as React from "react"
import { cn } from "../../lib/utils"

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  resize?: "none" | "both" | "horizontal" | "vertical"
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, resize = "vertical", style, ...props }, ref) => {
    const getResizeClass = () => {
      switch (resize) {
        case "none":
          return "resize-none"
        case "both":
          return "resize"
        case "horizontal":
          return "resize-x"
        case "vertical":
        default:
          return "resize-y"
      }
    }

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm transition-colors",
          "placeholder:text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          getResizeClass(),
          className
        )}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: error ? 'var(--color-error)' : 'var(--color-border)',
          color: 'var(--color-text)',
          ...style
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-error)' : 'var(--color-primary)'
          e.currentTarget.style.boxShadow = error 
            ? `0 0 0 2px var(--color-error-light)` 
            : `0 0 0 2px var(--color-focus-ring)`
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-error)' : 'var(--color-border)'
          e.currentTarget.style.boxShadow = 'none'
        }}
        ref={ref}
        {...props}
      />
    )
  }
)

Textarea.displayName = "Textarea"

// Optional: Label wrapper for textarea
interface TextareaFieldProps extends TextareaProps {
  label?: string
  errorMessage?: string
  required?: boolean
}

export function TextareaField({
  label,
  errorMessage,
  required,
  id,
  className,
  ...props
}: TextareaFieldProps) {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`
  const hasError = !!errorMessage || props.error

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label
          htmlFor={textareaId}
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
      <Textarea
        id={textareaId}
        error={hasError}
        aria-invalid={hasError}
        aria-describedby={errorMessage ? `${textareaId}-error` : undefined}
        {...props}
      />
      {errorMessage && (
        <p
          id={`${textareaId}-error`}
          className="text-xs mt-1"
          style={{ color: 'var(--color-error)' }}
        >
          {errorMessage}
        </p>
      )}
    </div>
  )
}

// Optional: Character counter
interface TextareaWithCounterProps extends TextareaProps {
  maxLength: number
  showCounter?: boolean
}

export function TextareaWithCounter({
  maxLength,
  showCounter = true,
  value = "",
  onChange,
  className,
  ...props
}: TextareaWithCounterProps) {
  const [charCount, setCharCount] = React.useState(typeof value === 'string' ? value.length : 0)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    if (newValue.length <= maxLength) {
      setCharCount(newValue.length)
      onChange?.(e)
    }
  }

  const remainingChars = maxLength - charCount
  const isNearLimit = remainingChars <= 20
  const isAtLimit = remainingChars <= 0

  return (
    <div className={cn("space-y-2", className)}>
      <Textarea
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
        {...props}
      />
      {showCounter && (
        <div className="flex justify-end">
          <span
            className="text-xs"
            style={{
              color: isAtLimit 
                ? 'var(--color-error)' 
                : isNearLimit 
                  ? 'var(--color-warning)' 
                  : 'var(--color-text-secondary)'
            }}
          >
            {charCount}/{maxLength} characters
          </span>
        </div>
      )}
    </div>
  )
}

export { Textarea }

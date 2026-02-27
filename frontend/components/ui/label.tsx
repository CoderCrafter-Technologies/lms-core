import { HTMLAttributes, forwardRef } from 'react'

interface LabelProps extends HTMLAttributes<HTMLLabelElement> {
  htmlFor?: string
  required?: boolean
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, htmlFor, required, children, style, ...props }, ref) => {
    return (
      <label
        ref={ref}
        htmlFor={htmlFor}
        className={`block text-sm font-medium mb-1 ${className || ''}`}
        style={{
          color: 'var(--color-text-secondary)',
          ...style
        }}
        {...props}
      >
        {children}
        {required && (
          <span 
            className="ml-1"
            style={{ color: 'var(--color-error)' }}
          >
            *
          </span>
        )}
      </label>
    )
  }
)

Label.displayName = 'Label'

// Optional: Export a helper function for form field requirements
export function getRequiredIndicator(required?: boolean) {
  if (!required) return null
  return (
    <span style={{ color: 'var(--color-error)' }} className="ml-1">
      *
    </span>
  )
}

// Optional: Export a Label wrapper for form fields with consistent spacing
export function FormField({
  label,
  required,
  htmlFor,
  children,
  error,
  className
}: {
  label?: string
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
  error?: string
  className?: string
}) {
  return (
    <div className={`space-y-1 ${className || ''}`}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error && (
        <p 
          className="text-xs mt-1"
          style={{ color: 'var(--color-error)' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
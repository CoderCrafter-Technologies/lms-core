import { ButtonHTMLAttributes, forwardRef } from "react"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'success'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', style, ...props }, ref) => {
    const getVariantStyles = () => {
      switch (variant) {
        case 'default':
          return {
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-btn-primary-text)',
            border: 'none'
          }
        case 'secondary':
          return {
            backgroundColor: 'var(--color-secondary)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)'
          }
        case 'destructive':
          return {
            backgroundColor: 'var(--color-error)',
            color: 'white',
            border: 'none'
          }
        case 'success':
          return {
            backgroundColor: 'var(--color-success)',
            color: 'white',
            border: 'none'
          }
        case 'outline':
          return {
            backgroundColor: 'transparent',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)'
          }
        case 'ghost':
          return {
            backgroundColor: 'transparent',
            color: 'var(--color-text)',
            border: 'none'
          }
        default:
          return {
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-btn-primary-text)',
            border: 'none'
          }
      }
    }

    const getHoverStyles = () => {
      switch (variant) {
        case 'default':
          return { backgroundColor: 'var(--color-primary-hover)' }
        case 'secondary':
          return { backgroundColor: 'var(--color-secondary-hover)' }
        case 'destructive':
          return { backgroundColor: 'var(--color-error-hover)' }
        case 'success':
          return { backgroundColor: 'var(--color-success-hover)' }
        case 'outline':
          return { backgroundColor: 'var(--color-surface-hover)' }
        case 'ghost':
          return { backgroundColor: 'var(--color-surface-hover)' }
        default:
          return { backgroundColor: 'var(--color-primary-hover)' }
      }
    }

    const getSizeStyles = () => {
      switch (size) {
        case 'sm':
          return { height: '36px', padding: '0 12px', fontSize: '14px' }
        case 'lg':
          return { height: '48px', padding: '0 32px', fontSize: '16px' }
        case 'icon':
          return { height: '40px', width: '40px', padding: '0', fontSize: '14px' }
        default:
          return { height: '40px', padding: '0 16px', fontSize: '14px' }
      }
    }

    const variantStyles = getVariantStyles()
    const sizeStyles = getSizeStyles()
    const hoverStyles = getHoverStyles()

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center rounded-md font-medium transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50
          disabled:opacity-50 disabled:pointer-events-none
          ${className || ''}
        `}
        style={{
          ...variantStyles,
          ...sizeStyles,
          ...style
        }}
        onMouseEnter={(e) => {
          Object.assign(e.currentTarget.style, hoverStyles)
          if (variant === 'outline' || variant === 'ghost') {
            e.currentTarget.style.borderColor = 'var(--color-border-hover)'
          }
        }}
        onMouseLeave={(e) => {
          Object.assign(e.currentTarget.style, variantStyles)
          if (variant === 'outline' || variant === 'ghost') {
            e.currentTarget.style.borderColor = 'var(--color-border)'
          }
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none'
        }}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

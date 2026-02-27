import { cn } from "@/lib/utils"
import { HTMLAttributes } from "react"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
}

export function Badge({
  className,
  variant = 'default',
  style,
  ...props
}: BadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: 'var(--color-badge-blue-bg)',
          color: 'var(--color-badge-blue-text)'
        }
      case 'secondary':
        return {
          backgroundColor: 'var(--color-secondary)',
          color: 'var(--color-text-secondary)'
        }
      case 'destructive':
        return {
          backgroundColor: 'var(--color-badge-red-bg)',
          color: 'var(--color-badge-red-text)'
        }
      case 'success':
        return {
          backgroundColor: 'var(--color-badge-green-bg)',
          color: 'var(--color-badge-green-text)'
        }
      case 'warning':
        return {
          backgroundColor: 'var(--color-badge-yellow-bg)',
          color: 'var(--color-badge-yellow-text)'
        }
      case 'info':
        return {
          backgroundColor: 'var(--color-info-light)',
          color: 'var(--color-info)'
        }
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-text)',
          borderColor: 'var(--color-border)'
        }
      default:
        return {
          backgroundColor: 'var(--color-badge-blue-bg)',
          color: 'var(--color-badge-blue-text)'
        }
    }
  }

  const variantStyles = getVariantStyles()

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === 'outline' && "border",
        className
      )}
      style={{
        ...variantStyles,
        ...style
      }}
      {...props}
    />
  )
}
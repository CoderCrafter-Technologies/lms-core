import { HTMLAttributes, forwardRef } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-lg border shadow-sm overflow-hidden ${className || ''}`}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-card-border)',
          ...style
        }}
        {...props}
      />
    )
  }
)

Card.displayName = "Card"

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex flex-col space-y-1.5 p-6 ${className || ''}`}
        style={{
          borderBottom: '1px solid var(--color-card-border-inner)',
          ...style
        }}
        {...props}
      />
    )
  }
)

CardHeader.displayName = "CardHeader"

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={`text-lg font-semibold leading-none tracking-tight ${className || ''}`}
        style={{
          color: 'var(--color-text)',
          ...style
        }}
        {...props}
      />
    )
  }
)

CardTitle.displayName = "CardTitle"

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`p-6 pt-0 ${className || ''}`}
        {...props}
      />
    )
  }
)

CardContent.displayName = "CardContent"

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={`text-sm ${className || ''}`}
        style={{
          color: 'var(--color-text-secondary)',
          ...style
        }}
        {...props}
      />
    )
  }
)

CardDescription.displayName = "CardDescription"

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center p-6 pt-0 ${className || ''}`}
        style={style}
        {...props}
      />
    )
  }
)

CardFooter.displayName = "CardFooter"
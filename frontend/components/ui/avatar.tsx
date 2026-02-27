import * as React from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = 'md', style, ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
      xl: 'h-16 w-16'
    }

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full',
          sizeClasses[size],
          className
        )}
        style={style}
        {...props}
      />
    )
  }
)
Avatar.displayName = 'Avatar'

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, ...props }, ref) => (
    <img
      ref={ref}
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  )
)
AvatarImage.displayName = 'AvatarImage'

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  delayMs?: number
}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, delayMs, style, children, ...props }, ref) => {
    const [showFallback, setShowFallback] = React.useState(!delayMs)

    React.useEffect(() => {
      if (delayMs) {
        const timer = setTimeout(() => setShowFallback(true), delayMs)
        return () => clearTimeout(timer)
      }
    }, [delayMs])

    if (!showFallback) return null

    return (
      <div
        ref={ref}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full text-sm font-medium',
          className
        )}
        style={{
          backgroundColor: 'var(--color-primary-light)',
          color: 'var(--color-primary)',
          ...style
        }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
AvatarFallback.displayName = 'AvatarFallback'

// Optional: Group avatar component for showing multiple avatars
interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  max?: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  spacing?: 'tight' | 'normal' | 'loose'
}

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ children, max = 4, size = 'md', spacing = 'normal', className, ...props }, ref) => {
    const childrenArray = React.Children.toArray(children)
    const total = childrenArray.length
    const displayed = childrenArray.slice(0, max)
    const remaining = total - max

    const spacingClasses = {
      tight: '-space-x-2',
      normal: '-space-x-3',
      loose: '-space-x-4'
    }

    const sizeClasses = {
      sm: 'h-8 w-8 text-xs',
      md: 'h-10 w-10 text-sm',
      lg: 'h-12 w-12 text-base',
      xl: 'h-16 w-16 text-lg'
    }

    return (
      <div
        ref={ref}
        className={cn('flex items-center', spacingClasses[spacing], className)}
        {...props}
      >
        {displayed.map((child, index) => (
          <div key={index} className="ring-2 ring-surface rounded-full">
            {child}
          </div>
        ))}
        {remaining > 0 && (
          <div
            className={cn(
              'flex items-center justify-center rounded-full ring-2 ring-surface font-medium',
              sizeClasses[size]
            )}
            style={{
              backgroundColor: 'var(--color-surface-muted)',
              color: 'var(--color-text-secondary)'
            }}
          >
            +{remaining}
          </div>
        )}
      </div>
    )
  }
)
AvatarGroup.displayName = 'AvatarGroup'

// Optional: Status indicator for avatar
interface AvatarWithStatusProps extends AvatarProps {
  status?: 'online' | 'offline' | 'away' | 'busy'
  src?: string
  alt?: string
  fallback?: string
}

export const AvatarWithStatus = React.forwardRef<HTMLDivElement, AvatarWithStatusProps>(
  ({ status = 'offline', src, alt, fallback, children, size = 'md', ...props }, ref) => {
    const statusColors = {
      online: 'var(--color-success)',
      offline: 'var(--color-text-tertiary)',
      away: 'var(--color-warning)',
      busy: 'var(--color-error)'
    }

    const sizeClasses = {
      sm: 'h-2 w-2 bottom-0 right-0',
      md: 'h-2.5 w-2.5 bottom-0 right-0',
      lg: 'h-3 w-3 bottom-0.5 right-0.5',
      xl: 'h-4 w-4 bottom-1 right-1'
    }

    return (
      <div className="relative inline-block">
        <Avatar ref={ref} size={size} {...props}>
          {src ? (
            <AvatarImage src={src} alt={alt} />
          ) : (
            <AvatarFallback>{fallback || children}</AvatarFallback>
          )}
        </Avatar>
        <span
          className={cn(
            'absolute block rounded-full ring-2 ring-surface',
            sizeClasses[size]
          )}
          style={{
            backgroundColor: statusColors[status]
          }}
        />
      </div>
    )
  }
)
AvatarWithStatus.displayName = 'AvatarWithStatus'

export { Avatar, AvatarImage, AvatarFallback }
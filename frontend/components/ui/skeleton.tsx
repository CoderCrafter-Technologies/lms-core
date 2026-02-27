import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "card" | "text" | "circle"
  animation?: "pulse" | "shimmer" | "none"
}

export function Skeleton({
  className,
  variant = "default",
  animation = "pulse",
  style,
  ...props
}: SkeletonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "card":
        return {
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-lg)'
        }
      case "text":
        return {
          backgroundColor: 'var(--color-surface-muted)',
          borderRadius: 'var(--radius-sm)'
        }
      case "circle":
        return {
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: '50%'
        }
      case "default":
      default:
        return {
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-base)'
        }
    }
  }

  const getAnimationClass = () => {
    switch (animation) {
      case "shimmer":
        return "animate-shimmer"
      case "none":
        return ""
      case "pulse":
      default:
        return "animate-pulse"
    }
  }

  const variantStyles = getVariantStyles()
  const animationClass = getAnimationClass()

  return (
    <div
      className={cn(
        animationClass,
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

// If you need to add shimmer animation to your globals.css, add this:
/*
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(
    to right,
    var(--color-surface-hover) 0%,
    var(--color-surface-muted) 20%,
    var(--color-surface-hover) 40%,
    var(--color-surface-hover) 100%
  );
  background-size: 1000px 100%;
}
*/

// Optional: Pre-built skeleton components for common use cases
export function SkeletonCard() {
  return (
    <div className="space-y-3" style={{ backgroundColor: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
      <Skeleton variant="card" className="h-48 w-full" />
      <Skeleton variant="text" className="h-4 w-3/4" />
      <Skeleton variant="text" className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton variant="circle" className="h-8 w-8" />
        <Skeleton variant="text" className="h-8 flex-1" />
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          variant="text" 
          className={cn("h-4", i === lines - 1 ? "w-3/4" : "w-full")} 
        />
      ))}
    </div>
  )
}

export function SkeletonAvatar({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  }

  return (
    <Skeleton 
      variant="circle" 
      className={cn(sizeClasses[size], className)} 
    />
  )
}

export function SkeletonButton({ className }: { className?: string }) {
  return (
    <Skeleton 
      variant="default" 
      className={cn("h-10 w-24", className)} 
    />
  )
}


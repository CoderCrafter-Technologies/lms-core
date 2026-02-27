import * as React from "react"
import { cn } from "../../lib/utils"

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, style, ...props }, ref) => {
    const isHorizontal = orientation === "horizontal"
    
    return (
      <div
        ref={ref}
        role={decorative ? "none" : "separator"}
        aria-orientation={decorative ? undefined : orientation}
        className={cn(
          "shrink-0",
          isHorizontal ? "h-[1px] w-full" : "h-full w-[1px]",
          className
        )}
        style={{
          backgroundColor: 'var(--color-border)',
          ...style
        }}
        {...props}
      />
    )
  }
)

Separator.displayName = "Separator"

// Optional: Add a themed separator with variants
interface ThemedSeparatorProps extends SeparatorProps {
  variant?: "default" | "subtle" | "strong"
}

export const ThemedSeparator = React.forwardRef<HTMLDivElement, ThemedSeparatorProps>(
  ({ className, variant = "default", style, ...props }, ref) => {
    const getVariantColor = () => {
      switch (variant) {
        case "subtle":
          return 'var(--color-card-border-inner)'
        case "strong":
          return 'var(--color-border-hover)'
        case "default":
        default:
          return 'var(--color-border)'
      }
    }

    return (
      <Separator
        ref={ref}
        className={className}
        style={{
          backgroundColor: getVariantColor(),
          ...style
        }}
        {...props}
      />
    )
  }
)
ThemedSeparator.displayName = "ThemedSeparator"

// Optional: Add a separator with label
interface LabeledSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  orientation?: "horizontal" | "vertical"
}

export const LabeledSeparator = React.forwardRef<HTMLDivElement, LabeledSeparatorProps>(
  ({ className, label, orientation = "horizontal", style, ...props }, ref) => {
    if (orientation === "vertical") {
      return (
        <div
          ref={ref}
          className={cn("flex flex-col items-center gap-2", className)}
          style={style}
          {...props}
        >
          <div 
            className="w-[1px] flex-1" 
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <span 
            className="text-xs font-medium rotate-180 whitespace-nowrap"
            style={{ color: 'var(--color-text-secondary)', writingMode: 'vertical-rl' }}
          >
            {label}
          </span>
          <div 
            className="w-[1px] flex-1" 
            style={{ backgroundColor: 'var(--color-border)' }}
          />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-3", className)}
        style={style}
        {...props}
      >
        <div 
          className="flex-1 h-[1px]" 
          style={{ backgroundColor: 'var(--color-border)' }}
        />
        <span 
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
        </span>
        <div 
          className="flex-1 h-[1px]" 
          style={{ backgroundColor: 'var(--color-border)' }}
        />
      </div>
    )
  }
)
LabeledSeparator.displayName = "LabeledSeparator"

export { Separator }
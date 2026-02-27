import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, style, ...props }, ref) => (
  <ScrollAreaPrimitive.Root 
    ref={ref} 
    className={cn("relative overflow-hidden", className)} 
    style={style}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", style, ...props }, ref) => {
  const isVertical = orientation === "vertical"
  
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors",
        isVertical && "h-full w-2.5 border-l border-l-transparent p-[1px]",
        !isVertical && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
        className,
      )}
      style={{
        // Scrollbar track styling
        backgroundColor: 'transparent',
        ...style
      }}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb 
        className="relative flex-1 rounded-full transition-colors"
        style={{
          backgroundColor: 'var(--color-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-border-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-border)'
        }}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
})
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

// Optional: Add a custom scrollbar with different sizes
interface CustomScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  scrollbarSize?: 'sm' | 'md' | 'lg'
  hideScrollbar?: boolean
}

export const CustomScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  CustomScrollAreaProps
>(({ className, children, scrollbarSize = 'md', hideScrollbar = false, style, ...props }, ref) => {
  const getScrollbarSize = () => {
    switch (scrollbarSize) {
      case 'sm':
        return 'w-1.5'
      case 'lg':
        return 'w-3.5'
      case 'md':
      default:
        return 'w-2.5'
    }
  }

  return (
    <ScrollAreaPrimitive.Root 
      ref={ref} 
      className={cn("relative overflow-hidden", className)} 
      style={style}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      {!hideScrollbar && (
        <ScrollBar className={getScrollbarSize()} />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
})
CustomScrollArea.displayName = "CustomScrollArea"

export { ScrollArea, ScrollBar }

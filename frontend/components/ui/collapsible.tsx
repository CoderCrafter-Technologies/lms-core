import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface CollapsibleProps extends React.ComponentProps<typeof CollapsiblePrimitive.Root> {
  children: React.ReactNode;
  open?: boolean;
}

const Collapsible = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Root>,
  CollapsibleProps
>(({ children, ...props }, ref) => {
  return (
    <CollapsiblePrimitive.Root ref={ref} {...props}>
      {children}
    </CollapsiblePrimitive.Root>
  );
});

Collapsible.displayName = 'Collapsible';

interface CollapsibleTriggerProps 
  extends React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger> {
  asChild?: boolean;
  children?: React.ReactNode;
}

const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Trigger>,
  CollapsibleTriggerProps
>(({ className, children, asChild, style, ...props }, ref) => (
  <CollapsiblePrimitive.Trigger
    ref={ref}
    className={cn(
      'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className
    )}
    style={{
      color: 'var(--color-text)',
      backgroundColor: 'transparent',
      ...style
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
    }}
    onFocus={(e) => {
      e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`;
    }}
    onBlur={(e) => {
      e.currentTarget.style.boxShadow = 'none';
    }}
    asChild={asChild}
    {...props}
  >
    {children}
    {!asChild && (
      <ChevronDown 
        className="h-4 w-4 transition-transform duration-200" 
        style={{ color: 'var(--color-text-secondary)' }}
      />
    )}
  </CollapsiblePrimitive.Trigger>
));

CollapsibleTrigger.displayName = CollapsiblePrimitive.Trigger.displayName;

interface CollapsibleContentProps 
  extends React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content> {
  children?: React.ReactNode;
}

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  CollapsibleContentProps
>(({ className, children, style, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
      className
    )}
    style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-base)',
      marginTop: '0.5rem',
      padding: '1rem',
      ...style
    }}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.Content>
));

CollapsibleContent.displayName = CollapsiblePrimitive.Content.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };

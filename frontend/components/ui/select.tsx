'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'

type SelectContextValue = {
  value: string
  setValue: (value: string) => void
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  selectedLabel: React.ReactNode
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(component: string) {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error(`${component} must be used within Select`)
  }
  return context
}

type CollectedItem = {
  value: string
  label: React.ReactNode
}

function collectItems(children: React.ReactNode): CollectedItem[] {
  const items: CollectedItem[] = []

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return

    const childType = child.type as any
    const displayName = childType?.displayName

    if (displayName === 'SelectItem') {
      items.push({
        value: String(child.props.value),
        label: child.props.children
      })
      return
    }

    if (child.props?.children) {
      items.push(...collectItems(child.props.children))
    }
  })

  return items
}

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  name?: string
  className?: string
}

export function Select({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  children,
  name,
  className
}: SelectProps) {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [isOpen, setIsOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  const value = isControlled ? String(controlledValue ?? '') : internalValue
  const items = React.useMemo(() => collectItems(children), [children])
  const selectedLabel = items.find((item) => item.value === value)?.label

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) setInternalValue(nextValue)
      onValueChange?.(nextValue)
      setIsOpen(false)
    },
    [isControlled, onValueChange]
  )

  React.useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  return (
    <SelectContext.Provider value={{ value, setValue, isOpen, setIsOpen, selectedLabel, triggerRef }}>
      <div ref={rootRef} className={`relative ${className || ''}`}>
        {name ? <input type="hidden" name={name} value={value} /> : null}
        {children}
      </div>
    </SelectContext.Provider>
  )
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { isOpen, setIsOpen, triggerRef } = useSelectContext('SelectTrigger')

    return (
      <button
        type="button"
        ref={(node) => {
          ;(triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            ;(ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
          }
        }}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors
          ${className || ''}
        `}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: isOpen ? 'var(--color-primary)' : 'var(--color-border)',
          color: 'var(--color-text)'
        }}
        {...props}
      >
        {children}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-text-secondary)' }}
        />
      </button>
    )
  }
)

SelectTrigger.displayName = 'SelectTrigger'

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { selectedLabel } = useSelectContext('SelectValue')

  if (selectedLabel !== undefined) {
    return <span>{selectedLabel}</span>
  }

  return (
    <span style={{ color: 'var(--color-text-secondary)' }}>
      {placeholder || 'Select an option'}
    </span>
  )
}

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

export function SelectContent({ children, className }: SelectContentProps) {
  const { isOpen, triggerRef } = useSelectContext('SelectContent')
  const [mounted, setMounted] = React.useState(false)
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0, maxHeight: 240 })

  const updatePosition = React.useCallback(() => {
    const triggerEl = triggerRef.current
    if (!triggerEl) return

    const rect = triggerEl.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const showAbove = spaceBelow < 180 && spaceAbove > spaceBelow
    const calculatedMaxHeight = Math.max(140, Math.min(280, showAbove ? spaceAbove : spaceBelow))

    setPosition({
      top: showAbove ? rect.top - calculatedMaxHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: calculatedMaxHeight
    })
  }, [triggerRef])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!isOpen) return
    updatePosition()

    const handleWindowChange = () => updatePosition()
    window.addEventListener('resize', handleWindowChange)
    window.addEventListener('scroll', handleWindowChange, true)

    return () => {
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
    }
  }, [isOpen, updatePosition])

  if (!isOpen) return null
  if (!mounted) return null

  return createPortal(
    <div
      className={`
        overflow-auto rounded-md py-1 shadow-lg
        ${className || ''}
      `}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        maxHeight: `${position.maxHeight}px`,
        zIndex: 9999,
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)'
      }}
    >
      {children}
    </div>,
    document.body
  )
}

interface SelectItemProps {
  children: React.ReactNode
  value: string
}

export function SelectItem({ children, value }: SelectItemProps) {
  const { value: selectedValue, setValue } = useSelectContext('SelectItem')
  const isSelected = selectedValue === value

  return (
    <div
      onMouseDown={(event) => {
        event.preventDefault()
        setValue(value)
      }}
      className="cursor-pointer px-4 py-2 text-sm transition-colors"
      style={{
        backgroundColor: isSelected ? 'var(--color-secondary)' : 'transparent',
        color: isSelected ? 'var(--color-primary)' : 'var(--color-text)'
      }}
      onMouseEnter={(event) => {
        if (!isSelected) event.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
      }}
      onMouseLeave={(event) => {
        if (!isSelected) event.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      {children}
    </div>
  )
}

SelectItem.displayName = 'SelectItem'

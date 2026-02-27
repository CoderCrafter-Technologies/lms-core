"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "../../lib/utils"

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value"> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  value?: string
  variant?: "default" | "success" | "warning"
  size?: "default" | "sm"
}

// Radix types in this workspace are incompatible with the current React TS setup.
// Keep runtime behavior from Radix and expose a stable local prop contract.
const SwitchRoot = SwitchPrimitives.Root as unknown as React.ComponentType<any>
const SwitchThumb = SwitchPrimitives.Thumb as unknown as React.ComponentType<any>

const Switch = React.forwardRef<
  HTMLButtonElement,
  SwitchProps
>(
  (
    {
      className,
      variant = "default",
      size = "default",
      style,
      checked: checkedProp,
      defaultChecked,
      onCheckedChange,
      ...props
    },
    ref
  ) => {
  const getVariantStyles = (checked: boolean) => {
    if (!checked) {
      return {
        backgroundColor: 'var(--color-border)'
      }
    }

    switch (variant) {
      case "success":
        return {
          backgroundColor: 'var(--color-success)'
        }
      case "warning":
        return {
          backgroundColor: 'var(--color-warning)'
        }
      case "default":
      default:
        return {
          backgroundColor: 'var(--color-primary)'
        }
    }
  }

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return {
          root: "h-5 w-9",
          thumb: "h-4 w-4 data-[state=checked]:translate-x-4"
        }
      case "default":
      default:
        return {
          root: "h-6 w-11",
          thumb: "h-5 w-5 data-[state=checked]:translate-x-5"
        }
    }
  }

  const sizeStyles = getSizeStyles()
  const [checked, setChecked] = React.useState(Boolean(checkedProp ?? defaultChecked ?? false))

  React.useEffect(() => {
    if (checkedProp !== undefined) {
      setChecked(Boolean(checkedProp))
    }
  }, [checkedProp])

  const handleCheckedChange = (newChecked: boolean) => {
    setChecked(newChecked)
    onCheckedChange?.(newChecked)
  }

  return (
    <SwitchRoot
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        sizeStyles.root,
        className
      )}
      style={{
        backgroundColor: getVariantStyles(checked).backgroundColor,
        ...style
      }}
      checked={checkedProp}
      defaultChecked={defaultChecked}
      onCheckedChange={handleCheckedChange}
      {...props}
      ref={ref}
    >
      <SwitchThumb
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform",
          sizeStyles.thumb,
          "data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchRoot>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

// Optional: Add a SwitchWithLabel component
interface SwitchWithLabelProps extends SwitchProps {
  label: string
  description?: string
  labelPosition?: "left" | "right"
  id?: string
}

export function SwitchWithLabel({
  label,
  description,
  labelPosition = "right",
  id,
  ...props
}: SwitchWithLabelProps) {
  const switchId = id || `switch-${Math.random().toString(36).slice(2, 11)}`
  
  return (
    <div className={cn(
      "flex items-center gap-3",
      labelPosition === "left" ? "flex-row" : "flex-row-reverse justify-end"
    )}>
      <Switch id={switchId} {...props} />
      <div className="flex flex-col">
        <label 
          htmlFor={switchId}
          className="text-sm font-medium cursor-pointer"
          style={{ color: 'var(--color-text)' }}
        >
          {label}
        </label>
        {description && (
          <span 
            className="text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {description}
          </span>
        )}
      </div>
    </div>
  )
}

export { Switch }

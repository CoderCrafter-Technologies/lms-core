"use client"

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  text?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  showIcon?: boolean;
  iconPosition?: "left" | "right";
  fallbackPath?: string;
}

export default function BackButton({ 
  text = "",
  variant = "default",
  size = "md",
  className,
  showIcon = true,
  iconPosition = "left",
  fallbackPath
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    try {
      router.back();
    } catch (error) {
      // If router.back() fails and fallbackPath is provided, navigate there
      if (fallbackPath) {
        router.push(fallbackPath);
      }
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "text-xs px-2 py-1 gap-1";
      case "lg":
        return "text-base px-4 py-2 gap-2";
      case "md":
      default:
        return "text-sm px-3 py-1.5 gap-1.5";
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "outline":
        return {
          color: 'var(--color-primary)',
          backgroundColor: 'transparent',
          border: `1px solid var(--color-border)`,
          hoverColor: 'var(--color-primary-hover)',
          hoverBg: 'var(--color-surface-hover)'
        };
      case "ghost":
        return {
          color: 'var(--color-text-secondary)',
          backgroundColor: 'transparent',
          border: 'none',
          hoverColor: 'var(--color-text)',
          hoverBg: 'var(--color-surface-hover)'
        };
      case "default":
      default:
        return {
          color: 'var(--color-primary)',
          backgroundColor: 'transparent',
          border: 'none',
          hoverColor: 'var(--color-primary-hover)',
          hoverBg: 'transparent'
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeClasses = getSizeClasses();

  const icon = showIcon ? <ArrowLeft className={cn(
    "transition-transform group-hover:-translate-x-0.5",
    size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4"
  )} /> : null;

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group inline-flex items-center rounded-md transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        sizeClasses,
        className
      )}
      style={{
        color: variantStyles.color,
        backgroundColor: variantStyles.backgroundColor,
        border: variantStyles.border,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = variantStyles.hoverColor;
        if (variantStyles.hoverBg) {
          e.currentTarget.style.backgroundColor = variantStyles.hoverBg;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = variantStyles.color;
        if (variantStyles.hoverBg) {
          e.currentTarget.style.backgroundColor = variantStyles.backgroundColor;
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-focus-ring)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {showIcon && iconPosition === "left" && icon}
      <span>
         Back {text !== "" ? `to ${text}` : ""}
      </span>
      {showIcon && iconPosition === "right" && icon}
    </button>
  );
}

// Optional: BackButton with tooltip
interface BackButtonWithTooltipProps extends BackButtonProps {
  tooltip?: string;
}

export function BackButtonWithTooltip({ tooltip = "Go back", ...props }: BackButtonWithTooltipProps) {
  return (
    <div className="relative group">
      <BackButton {...props} />
      <div 
        className="absolute left-0 top-full mt-1 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          zIndex: 10
        }}
      >
        {tooltip}
      </div>
    </div>
  );
}
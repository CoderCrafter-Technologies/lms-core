import * as React from "react"
import { cn } from "../../lib/utils"

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}

export function Table({ className, style, ...props }: TableProps) {
  return (
    <table
      className={cn("w-full caption-bottom text-sm", className)}
      style={{
        color: 'var(--color-text)',
        ...style
      }}
      {...props}
    />
  )
}

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableHeader({ className, style, ...props }: TableHeaderProps) {
  return (
    <thead 
      className={className} 
      style={style}
      {...props} 
    />
  )
}

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableBody({ className, style, ...props }: TableBodyProps) {
  return (
    <tbody 
      className={className} 
      style={style}
      {...props} 
    />
  )
}

interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableFooter({ className, style, ...props }: TableFooterProps) {
  return (
    <tfoot 
      className={cn("border-t font-medium", className)}
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface-muted)',
        ...style
      }}
      {...props}
    />
  )
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hover?: boolean
}

export function TableRow({ className, hover = true, style, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        "border-b transition-colors",
        hover && "hover:bg-surface-hover",
        className
      )}
      style={{
        borderColor: 'var(--color-border)',
        ...style
      }}
      {...props}
    />
  )
}

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right"
}

export function TableHead({ 
  className, 
  align = "left", 
  style,
  ...props 
}: TableHeadProps) {
  const alignmentClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right"
  }[align]

  return (
    <th
      className={cn(
        "h-12 px-4 align-middle font-medium",
        alignmentClass,
        className
      )}
      style={{
        color: 'var(--color-text-secondary)',
        ...style
      }}
      {...props}
    />
  )
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right"
}

export function TableCell({ 
  className, 
  align = "left",
  style,
  ...props 
}: TableCellProps) {
  const alignmentClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right"
  }[align]

  return (
    <td
      className={cn(
        "p-4 align-middle",
        alignmentClass,
        className
      )}
      style={{
        color: 'var(--color-text)',
        ...style
      }}
      {...props}
    />
  )
}

interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {}

export function TableCaption({ className, style, ...props }: TableCaptionProps) {
  return (
    <caption
      className={cn("mt-4 text-sm", className)}
      style={{
        color: 'var(--color-text-secondary)',
        ...style
      }}
      {...props}
    />
  )
}

// Optional: Compact table variant
interface CompactTableProps extends TableProps {
  size?: "default" | "sm" | "lg"
}

export function CompactTable({ className, size = "sm", ...props }: CompactTableProps) {
  const sizeClasses = {
    sm: "text-xs",
    default: "text-sm",
    lg: "text-base"
  }

  return (
    <Table className={cn(sizeClasses[size], className)} {...props} />
  )
}

// Optional: Striped table variant
interface StripedTableProps extends TableProps {
  striped?: boolean
}

export function StripedTableRow({ className, ...props }: TableRowProps) {
  return (
    <TableRow
      className={cn(
        "even:bg-surface-muted",
        className
      )}
      {...props}
    />
  )
}
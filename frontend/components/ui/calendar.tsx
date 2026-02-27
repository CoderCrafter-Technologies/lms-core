'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

interface CalendarProps {
  mode?: 'single'
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  className?: string
}

export function Calendar({
  mode = 'single',
  selected,
  onSelect,
  className
}: CalendarProps) {
  return (
    <div className={className} style={{ backgroundColor: 'var(--color-surface)' }}>
      <DayPicker
        mode={mode}
        selected={selected}
        onSelect={onSelect}
        styles={{
          root: {
            margin: 0,
            padding: '1rem',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: `1px solid var(--color-border)`,
            borderRadius: 'var(--radius-lg)'
          },
          caption: {
            color: 'var(--color-text)',
            fontWeight: 600,
            paddingBottom: '0.5rem'
          },
          nav: {
            display: 'flex',
            gap: '0.25rem'
          },
          nav_button: {
            backgroundColor: 'transparent',
            border: `1px solid var(--color-border)`,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text)',
            padding: '0.25rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          },
          nav_button_previous: {
            marginRight: '0.25rem'
          },
          nav_button_next: {
            marginLeft: '0.25rem'
          },
          table: {
            width: '100%',
            borderCollapse: 'collapse'
          },
          head: {
            color: 'var(--color-text-secondary)'
          },
          head_row: {
            display: 'flex',
            marginBottom: '0.5rem'
          },
          head_cell: {
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            width: '2rem',
            textAlign: 'center'
          },
          row: {
            display: 'flex',
            width: '100%'
          },
          cell: {
            textAlign: 'center',
            padding: '0.125rem'
          },
          day: {
            width: '2rem',
            height: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            color: 'var(--color-text)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s, color 0.2s'
          },
          day_selected: {
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-btn-primary-text)'
          },
          day_today: {
            border: `2px solid var(--color-primary)`
          },
          day_disabled: {
            color: 'var(--color-text-tertiary)',
            cursor: 'not-allowed'
          },
          day_outside: {
            color: 'var(--color-text-tertiary)',
            opacity: 0.5
          }
        }}
        modifiersStyles={{
          selected: {
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-btn-primary-text)'
          },
          today: {
            border: `2px solid var(--color-primary)`
          }
        }}
      />
    </div>
  )
}

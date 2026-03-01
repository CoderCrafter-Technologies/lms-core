'use client'

import Link from 'next/link'
import { Brush, LayoutPanelTop, Palette, ArrowRight } from 'lucide-react'

export default function AppearanceHubPage() {
  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
          <Brush className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Appearance</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Customize your public website and dashboard look and feel.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Link
          href="/dashboard/appearance/homepage"
          className="rounded-2xl border p-6 transition-all hover:shadow-lg"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
              <LayoutPanelTop className="h-5 w-5" style={{ color: 'rgb(59, 130, 246)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Edit Homepage</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Drag-and-drop sections, edit content, and style the public landing page.
              </p>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            Open homepage builder <ArrowRight className="h-4 w-4" />
          </div>
        </Link>

        <Link
          href="/dashboard/appearance/dashboard"
          className="rounded-2xl border p-6 transition-all hover:shadow-lg"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
              <Palette className="h-5 w-5" style={{ color: 'rgb(16, 185, 129)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Edit Dashboard</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Adjust dashboard colors, typography, and UI styling with live preview.
              </p>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            Open dashboard editor <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
      </div>
    </div>
  )
}

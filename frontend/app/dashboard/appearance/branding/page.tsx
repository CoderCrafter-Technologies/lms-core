'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import logo from '@/assets/logo_blue.png'
import { useSetup } from '@/components/providers/SetupProvider'

export default function BrandingAppearancePage() {
  const { branding, updateBranding, updateSetupSettings, refreshSettings } = useSetup()
  const [draft, setDraft] = useState({ appName: branding?.appName || 'Institute LMS', logoUrl: branding?.logoUrl || '' })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setDraft({ appName: branding?.appName || 'Institute LMS', logoUrl: branding?.logoUrl || '' })
  }, [branding?.appName, branding?.logoUrl])

  const saveBranding = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const payload = {
        appName: draft.appName.trim() || 'Institute LMS',
        logoUrl: draft.logoUrl,
        faviconUrl: draft.logoUrl
      }
      const response = await api.updateBrandingSettings(payload)
      const saved = response?.settings || response?.data || payload
      updateBranding({
        appName: saved.appName || payload.appName,
        logoUrl: saved.logoUrl || payload.logoUrl,
        faviconUrl: saved.faviconUrl || payload.faviconUrl
      })
      updateSetupSettings({
        branding: {
          appName: saved.appName || payload.appName,
          logoUrl: saved.logoUrl || payload.logoUrl,
          faviconUrl: saved.faviconUrl || payload.faviconUrl
        }
      })
      await refreshSettings()
      setStatus({ type: 'success', message: 'Branding updated successfully.' })
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.message || 'Failed to update branding.' })
    } finally {
      setSaving(false)
    }
  }

  const uploadBrandLogo = async (file: File) => {
    const form = new FormData()
    form.append('logo', file)
    try {
      const response = await api.uploadSetupBrandAssets(form)
      const logoUrl = response?.data?.logoUrl || response?.settings?.logoUrl || response?.logoUrl || ''
      if (logoUrl) {
        setDraft((prev) => ({ ...prev, logoUrl }))
        const payload = {
          appName: draft.appName.trim() || 'Institute LMS',
          logoUrl,
          faviconUrl: logoUrl
        }
        const savedResponse = await api.updateBrandingSettings(payload)
        const saved = savedResponse?.settings || savedResponse?.data || payload
        updateBranding({
          appName: saved.appName || payload.appName,
          logoUrl: saved.logoUrl || payload.logoUrl,
          faviconUrl: saved.faviconUrl || payload.faviconUrl
        })
        updateSetupSettings({
          branding: {
            appName: saved.appName || payload.appName,
            logoUrl: saved.logoUrl || payload.logoUrl,
            faviconUrl: saved.faviconUrl || payload.faviconUrl
          }
        })
        await refreshSettings()
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.message || 'Failed to upload logo.' })
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Branding</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Update your institute name and logo across the platform.
        </p>
      </div>

      {status && (
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: status.type === 'error' ? '#FCA5A5' : 'var(--color-border)',
            backgroundColor: status.type === 'error' ? 'rgba(248, 113, 113, 0.12)' : 'var(--color-background)',
            color: status.type === 'error' ? '#991B1B' : 'var(--color-text)'
          }}
        >
          {status.message}
        </div>
      )}

      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Institute Name
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={draft.appName}
            onChange={(event) => setDraft((prev) => ({ ...prev, appName: event.target.value }))}
          />
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Logo
          <input
            type="file"
            accept="image/*"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) uploadBrandLogo(file)
            }}
          />
        </label>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl border flex items-center justify-center bg-white">
            <img src={draft.logoUrl || branding?.logoUrl || logo.src} alt="Logo preview" className="h-12 w-auto object-contain" />
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Preview</div>
        </div>
        <button
          type="button"
          onClick={saveBranding}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </div>
  )
}

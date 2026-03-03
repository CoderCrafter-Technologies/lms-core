'use client'

import { useEffect } from 'react'
import { useSetup } from '@/components/providers/SetupProvider'

const normalizeHost = (value: string) => value.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

const isIpOrLocalhost = (host: string) => {
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
}

export default function DomainRedirect() {
  const { completed, settings } = useSetup()

  useEffect(() => {
    const run = () => {
      if (typeof window === 'undefined') return
      const savedDomain = settings?.customDomain?.domain ? String(settings.customDomain.domain).trim() : ''
      if (!completed || !savedDomain) return

      const currentHost = normalizeHost(window.location.hostname)
      const targetHost = normalizeHost(savedDomain)

      if (!targetHost || currentHost === targetHost) return

      if (!isIpOrLocalhost(currentHost) && !currentHost.endsWith(`.${targetHost}`)) {
        return
      }

      const targetUrl = `${window.location.protocol}//${targetHost}${window.location.pathname}${window.location.search}${window.location.hash}`
      window.location.replace(targetUrl)
    }

    run()
  }, [completed, settings?.customDomain?.domain])

  return null
}

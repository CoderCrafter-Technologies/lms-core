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
  const { loading, settings } = useSetup()

  useEffect(() => {
    if (loading || typeof window === 'undefined') return
    const setupCompleted = Boolean(settings?.completed)
    const savedDomain = settings?.customDomain?.domain ? String(settings.customDomain.domain).trim() : ''
    if (!setupCompleted || !savedDomain) return

    const currentHost = normalizeHost(window.location.hostname)
    const targetHost = normalizeHost(savedDomain)

    if (!targetHost || currentHost === targetHost) return

    // Only auto-redirect from localhost/IP bootstrap hosts.
    // Redirecting between public hosts can create loops behind proxies/CDNs.
    if (!isIpOrLocalhost(currentHost)) {
      return
    }

    const targetProtocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const targetUrl = `${targetProtocol}//${targetHost}${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.replace(targetUrl)
  }, [loading, settings])

  return null
}

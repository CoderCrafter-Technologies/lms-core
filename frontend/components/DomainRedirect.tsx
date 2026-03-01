'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api'

const normalizeHost = (value: string) => value.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

const isIpOrLocalhost = (host: string) => {
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
}

export default function DomainRedirect() {
  useEffect(() => {
    let active = true

    const run = async () => {
      if (typeof window === 'undefined') return
      try {
        const response = await api.getPublicSetupSettings()
        if (!active) return
        const data = response?.data || {}
        const completed = Boolean(data.completed)
        const savedDomain = data.customDomain?.domain ? String(data.customDomain.domain).trim() : ''
        if (!completed || !savedDomain) return

        const currentHost = normalizeHost(window.location.hostname)
        const targetHost = normalizeHost(savedDomain)

        if (!targetHost || currentHost === targetHost) return

        if (!isIpOrLocalhost(currentHost) && !currentHost.endsWith(`.${targetHost}`)) {
          return
        }

        const targetUrl = `${window.location.protocol}//${targetHost}${window.location.pathname}${window.location.search}${window.location.hash}`
        window.location.replace(targetUrl)
      } catch {
        // ignore
      }
    }

    run()
    return () => {
      active = false
    }
  }, [])

  return null
}

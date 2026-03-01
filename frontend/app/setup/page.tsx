'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Building2, Palette, Globe, Database, UserCircle, Mail, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react'

type SetupForm = {
  institute: {
    name: string
    website: string
    supportEmail: string
    supportPhone: string
    address: string
  }
  branding: {
    appName: string
    logoUrl: string
    faviconUrl: string
    primaryColor: string
    accentColor: string
    whiteLabelEnabled: boolean
  }
  defaults: {
    timezone: string
    dateFormat: string
    timeFormat: string
    locale: string
  }
  customDomains: Array<{
    domain: string
    expectedIp?: string
    status?: string
    verificationToken?: string
    verifiedAt?: string | null
    lastCheckedAt?: string | null
    savedAt?: string | null
  }>
  admin: {
    email: string
    firstName: string
    lastName: string
    password: string
  }
  database: {
    mode: 'mongodb' | 'postgres_uri' | 'postgres_same_server'
    mongodbUri: string
    postgresUri: string
    postgresSameServer: {
      host: string
      port: number
      database: string
      user: string
      password: string
      ssl: boolean
    }
  }
  smtp: {
    enabled: boolean
    host: string
    port: number
    secure: boolean
    requireTLS: boolean
    authUser: string
    authPass: string
    fromName: string
    fromEmail: string
    replyTo: string
    testEmail: string
  }
}

const initialForm: SetupForm = {
  institute: {
    name: '',
    website: '',
    supportEmail: '',
    supportPhone: '',
    address: ''
  },
  branding: {
    appName: 'Institute LMS',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#2563EB',
    accentColor: '#0EA5E9',
    whiteLabelEnabled: false
  },
  defaults: {
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
    locale: 'en-US'
  },
  customDomains: [],
  admin: {
    email: '',
    firstName: '',
    lastName: '',
    password: ''
  },
  database: {
    mode: 'mongodb',
    mongodbUri: 'mongodb://localhost:27017/lms_futureproof',
    postgresUri: '',
    postgresSameServer: {
      host: 'postgres',
      port: 5432,
      database: 'lms_futureproof',
      user: 'postgres',
      password: 'postgres',
      ssl: false
    }
  },
  smtp: {
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    requireTLS: false,
    authUser: '',
    authPass: '',
    fromName: 'LMS Notifications',
    fromEmail: '',
    replyTo: '',
    testEmail: ''
  }
}

const sections = [
  { id: 'institute', label: 'Institute', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'domain', label: 'Domain', icon: Globe },
  { id: 'defaults', label: 'Defaults', icon: Globe },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'smtp', label: 'SMTP', icon: Mail },
  { id: 'admin', label: 'Admin', icon: UserCircle }
] as const

type SectionId = (typeof sections)[number]['id']

const cardClass = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700'
const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'

type DnsRecord = {
  type: 'A' | 'TXT'
  host: string
  value: string
}

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState<SetupForm>(initialForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [faviconPreview, setFaviconPreview] = useState('')
  const [customDomain, setCustomDomain] = useState({
    domain: '',
    serverIp: '',
    status: '',
    records: [] as DnsRecord[],
    lastCheckedAt: '',
    frontendPort: 3001,
    backendPort: 5001,
    certbotEmail: '',
    nginxConfig: '',
    sslMessage: '',
    sslEnabled: false,
    caddyMessage: '',
    savedAt: ''
  })
  const lastPreparedDomainRef = useRef<string>('')
  const [domainBusy, setDomainBusy] = useState(false)
  const apiOrigin = useMemo(() => (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, ''), [])

  const timezoneOptions = useMemo(() => {
    const supported = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined
    return supported?.length
      ? supported
      : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Kolkata', 'Europe/London']
  }, [])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const [statusResult, prefillResult] = await Promise.allSettled([
          api.getSetupStatus(),
          api.getSetupPrefill()
        ])

        if (!mounted) return
        const statusRes = statusResult.status === 'fulfilled' ? statusResult.value : null
        if (statusRes?.data?.completed) {
          router.replace('/auth/login')
          return
        }
        if (statusResult.status === 'rejected') {
          throw new Error('Failed to verify setup status')
        }

        const prefillRes = prefillResult.status === 'fulfilled' ? prefillResult.value : null
        const setup = prefillRes?.data?.setup || {}
        const database = prefillRes?.data?.database || {}
        const smtp = prefillRes?.data?.smtp || {}
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

        const nextForm = (prev: SetupForm) => ({
          ...prev,
          institute: { ...prev.institute, ...(setup?.institute || {}) },
          branding: { ...prev.branding, ...(setup?.branding || {}) },
          defaults: { ...prev.defaults, ...(setup?.defaults || {}), timezone: setup?.defaults?.timezone || detectedTimezone },
          customDomains: Array.isArray(setup?.customDomains) ? setup.customDomains : prev.customDomains,
          database: {
            ...prev.database,
            ...database,
            postgresSameServer: { ...prev.database.postgresSameServer, ...(database?.postgresSameServer || {}) }
          },
          smtp: { ...prev.smtp, ...smtp, authPass: '' }
        })

        setForm((prev) => {
          const merged = nextForm(prev)
          const isPostgresSameServer = merged.database?.mode === 'postgres_same_server'
          const currentHost = String(merged.database?.postgresSameServer?.host || '').trim().toLowerCase()
          if (isPostgresSameServer && (currentHost === '127.0.0.1' || currentHost === 'localhost')) {
            merged.database.postgresSameServer.host = 'postgres'
            if (!merged.database.postgresSameServer.password) {
              merged.database.postgresSameServer.password = 'postgres'
            }
          }
          const toAssetUrl = (value: string) => {
            if (!value) return ''
            if (value.startsWith('/uploads/')) return value
            if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('blob:')) return value
            return apiOrigin ? `${apiOrigin}${value}` : value
          }
          const mergedLogo = toAssetUrl(merged.branding.logoUrl || '')
          const mergedFavicon = toAssetUrl(merged.branding.faviconUrl || merged.branding.logoUrl || '')
          setLogoPreview(mergedLogo)
          setFaviconPreview(mergedFavicon)
          const domainEntry = Array.isArray(merged.customDomains) ? merged.customDomains[0] : null
          if (domainEntry?.domain) {
            const records: DnsRecord[] = []
            if (domainEntry.expectedIp) {
              records.push({ type: 'A', host: '@', value: domainEntry.expectedIp })
            }
            if (domainEntry.verificationToken) {
              records.push({ type: 'TXT', host: '_lms-verify', value: domainEntry.verificationToken })
            }
            setCustomDomain((prev) => ({
              ...prev,
              domain: domainEntry.domain,
              serverIp: domainEntry.expectedIp || '',
              status: domainEntry.status || '',
              records,
              lastCheckedAt: domainEntry.lastCheckedAt || '',
              savedAt: domainEntry.savedAt || ''
            }))
          }
          return merged
        })

      } catch (error: any) {
        toast.error(error?.message || 'Failed to load setup prefill. Using defaults.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [router])

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
      if (faviconPreview.startsWith('blob:')) URL.revokeObjectURL(faviconPreview)
    }
  }, [logoPreview, faviconPreview])

  const setNested = (path: string, value: any) => {
    setForm((prev) => {
      const clone: any = { ...prev }
      const parts = path.split('.')
      let node = clone
      for (let i = 0; i < parts.length - 1; i += 1) {
        node[parts[i]] = { ...node[parts[i]] }
        node = node[parts[i]]
      }
      node[parts[parts.length - 1]] = value
      return clone
    })
  }

  const syncCustomDomainToForm = (entry: { domain: string; expectedIp?: string; status?: string; verificationToken?: string; verifiedAt?: string | null; lastCheckedAt?: string | null }) => {
    setForm((prev) => ({
      ...prev,
      customDomains: [entry]
    }))
  }

  const handlePrepareDomain = async () => {
    const domain = customDomain.domain.trim()
    if (!domain) {
      toast.error('Please enter a domain name')
      return
    }

    try {
      setDomainBusy(true)
      const response = await api.prepareCustomDomain({
        domain,
        serverIp: customDomain.serverIp.trim() || undefined
      })
      const data = response?.data || {}
      const records = (data.records || []) as DnsRecord[]
      setCustomDomain((prev) => ({
        ...prev,
        domain: data.domain || prev.domain,
        status: data.status || 'pending',
        records,
        serverIp: data.expectedIp || prev.serverIp,
        lastCheckedAt: '',
        nginxConfig: ''
      }))
      syncCustomDomainToForm({
        domain: data.domain || domain,
        expectedIp: data.expectedIp || customDomain.serverIp,
        status: data.status || 'pending',
        verificationToken: data.verificationToken || '',
        verifiedAt: null,
        lastCheckedAt: null
      })
      toast.success('DNS records generated. Add them in your domain registrar.')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate DNS records')
    } finally {
      setDomainBusy(false)
    }
  }

  const handleVerifyDomain = async () => {
    const domain = customDomain.domain.trim()
    if (!domain) {
      toast.error('Please enter a domain name')
      return
    }

    try {
      setDomainBusy(true)
      const response = await api.verifyCustomDomain({
        domain,
        serverIp: customDomain.serverIp.trim() || undefined
      })
      const data = response?.data || {}
      const verified = Boolean(data.verified)
      const status = data.status || (verified ? 'verified' : 'pending')
      const lastCheckedAt = data.lastCheckedAt || ''

      setCustomDomain((prev) => ({
        ...prev,
        status,
        lastCheckedAt
      }))

      setForm((prev) => {
        const current = prev.customDomains?.[0]
        if (!current) return prev
        return {
          ...prev,
          customDomains: [{
            ...current,
            status,
            lastCheckedAt,
            verifiedAt: verified ? lastCheckedAt : current.verifiedAt || null
          }]
        }
      })

      if (verified) {
        toast.success('Domain verified successfully')
        try {
          const applyResponse = await api.applyCaddyConfig({ domain, email: form.institute.supportEmail })
          setCustomDomain((prev) => ({
            ...prev,
            caddyMessage: applyResponse?.message || 'Caddy configuration applied'
          }))
        } catch (applyError: any) {
          setCustomDomain((prev) => ({
            ...prev,
            caddyMessage: applyError?.message || 'Failed to apply Caddy config'
          }))
        }
      } else {
        toast.error('DNS records not detected yet. Please try again after propagation.')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to verify domain')
    } finally {
      setDomainBusy(false)
    }
  }

  const handleDiagnoseDomain = async () => {
    const domain = customDomain.domain.trim().toLowerCase()
    if (!domain) {
      toast.error('Please enter a domain name')
      return
    }
    if (!isValidDomain(domain)) {
      toast.error('Please enter a valid domain name')
      return
    }

    try {
      setDomainBusy(true)
      const response = await api.diagnoseCustomDomain({ domain })
      const data = response?.data
      if (!data) {
        toast.error('No diagnostics available')
        return
      }

      const lines = [
        `TXT host: ${data.expected?.txtHost || '-'}`,
        `TXT value: ${data.expected?.txtValue || '-'}`,
        `Resolved TXT: ${(data.resolved?.txtRecords || []).join(', ') || 'none'}`,
        `A host: ${data.expected?.aHost || '-'}`,
        `A value: ${data.expected?.aValue || '-'}`,
        `Resolved A: ${(data.resolved?.aRecords || []).join(', ') || 'none'}`,
        `Match TXT: ${data.matches?.txt ? 'yes' : 'no'}`,
        `Match A: ${data.matches?.a ? 'yes' : 'no'}`
      ]
      toast.message('DNS diagnostics', {
        description: lines.join('\n')
      })
    } catch (error: any) {
      toast.error(error?.message || 'Failed to run diagnostics')
    } finally {
      setDomainBusy(false)
    }
  }

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const isValidDomain = (value: string) => {
    const domain = value.trim().toLowerCase()
    if (domain.length < 4) return false
    if (!domain.includes('.')) return false
    if (/\s/.test(domain)) return false
    return /^[a-z0-9.-]+$/.test(domain)
  }

  const handleDomainBlur = async () => {
    const domain = customDomain.domain.trim().toLowerCase()
    if (!domain) return
    if (!isValidDomain(domain)) return
    if (lastPreparedDomainRef.current === domain) return
    await handlePrepareDomain()
    lastPreparedDomainRef.current = domain
  }

  const handleGenerateNginxConfig = async () => {
    const domain = customDomain.domain.trim()
    if (!domain) {
      toast.error('Please enter a domain name')
      return
    }

    try {
      setDomainBusy(true)
      const response = await api.getNginxConfig({
        domain,
        frontendPort: customDomain.frontendPort,
        backendPort: customDomain.backendPort
      })
      const config = String(response?.data?.config || '')
      setCustomDomain((prev) => ({ ...prev, nginxConfig: config }))
      if (config) {
        toast.success('Nginx config generated')
      } else {
        toast.error('Failed to generate config')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate Nginx config')
    } finally {
      setDomainBusy(false)
    }
  }

  const handleEnableSsl = async () => {
    const domain = customDomain.domain.trim()
    const email = customDomain.certbotEmail.trim()
    if (!domain) {
      toast.error('Please enter a domain name')
      return
    }
    if (!email) {
      toast.error('Please enter an email for certbot')
      return
    }

    try {
      setDomainBusy(true)
      const response = await api.enableCustomDomainSsl({ domain, email })
      const automated = Boolean(response?.data?.automated)
      const command = String(response?.data?.command || '')
      const output = String(response?.data?.output || '')

      if (!automated && command) {
        setCustomDomain((prev) => ({
          ...prev,
          sslMessage: `Run this on your server: ${command}`
        }))
        toast.success('Certbot command generated')
        return
      }

      if (automated) {
        setCustomDomain((prev) => ({
          ...prev,
          sslMessage: output || 'SSL enabled successfully'
        }))
        toast.success('SSL enabled successfully')
        return
      }

      toast.error('SSL enable response was unexpected')
    } catch (error: any) {
      setCustomDomain((prev) => ({
        ...prev,
        sslMessage: error?.message || 'SSL enable failed'
      }))
      toast.error(error?.message || 'SSL enable failed')
    } finally {
      setDomainBusy(false)
    }
  }

  const handleApplyCaddy = async () => {
    const domain = customDomain.domain.trim()
    if (!domain) {
      toast.error('Please enter a domain name')
      return
    }
    try {
      setDomainBusy(true)
      const response = await api.applyCaddyConfig({ domain, email: form.institute.supportEmail })
      setCustomDomain((prev) => ({
        ...prev,
        caddyMessage: response?.message || 'Caddy configuration applied'
      }))
      toast.success('Caddy configuration applied')
    } catch (error: any) {
      setCustomDomain((prev) => ({
        ...prev,
        caddyMessage: error?.message || 'Failed to apply Caddy config'
      }))
      toast.error(error?.message || 'Failed to apply Caddy config')
    } finally {
      setDomainBusy(false)
    }
  }

  const handleSaveDomain = async () => {
    const domain = customDomain.domain.trim().toLowerCase()
    if (!domain) {
      toast.error('Please enter a domain name')
      return
    }
    if (customDomain.status !== 'verified') {
      toast.error('Verify DNS before saving the domain')
      return
    }
    try {
      setDomainBusy(true)
      const response = await api.saveCustomDomain({ domain })
      const savedAt = response?.data?.savedAt || new Date().toISOString()
      setCustomDomain((prev) => ({ ...prev, savedAt }))
      toast.success('Domain saved successfully')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save domain')
    } finally {
      setDomainBusy(false)
    }
  }

  const handleEditDomain = () => {
    setCustomDomain((prev) => ({ ...prev, savedAt: '' }))
  }

  const handleDeleteDomain = async () => {
    const domain = customDomain.domain.trim().toLowerCase()
    if (!domain) return
    if (!window.confirm(`Remove domain ${domain}?`)) return
    try {
      setDomainBusy(true)
      await api.deleteCustomDomain(domain)
      setCustomDomain({
        domain: '',
        serverIp: '',
        status: '',
        records: [] as DnsRecord[],
        lastCheckedAt: '',
        frontendPort: 3001,
        backendPort: 5001,
        certbotEmail: '',
        nginxConfig: '',
        sslMessage: '',
        sslEnabled: false,
        caddyMessage: '',
        savedAt: ''
      })
      lastPreparedDomainRef.current = ''
      toast.success('Domain removed')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove domain')
    } finally {
      setDomainBusy(false)
    }
  }

  const validateStep = (step: number) => {
    const section = sections[step].id as SectionId

    if (section === 'institute' && !form.institute.name.trim()) {
      toast.error('Institute name is required.')
      return false
    }

    if (section === 'domain') {
      const domain = customDomain.domain.trim().toLowerCase()
      if (domain && !isValidDomain(domain)) {
        toast.error('Please enter a valid domain (example: lms.yourdomain.com).')
        return false
      }
    }

    if (section === 'database') {
      if (form.database.mode === 'mongodb' && !form.database.mongodbUri.trim()) {
        toast.error('MongoDB URI is required.')
        return false
      }
      if (form.database.mode === 'postgres_uri' && !form.database.postgresUri.trim()) {
        toast.error('PostgreSQL URI is required.')
        return false
      }
      if (form.database.mode === 'postgres_same_server') {
        const cfg = form.database.postgresSameServer
        if (!cfg.host || !cfg.port || !cfg.database || !cfg.user) {
          toast.error('Host, port, database, and user are required for PostgreSQL host/port mode.')
          return false
        }
      }
    }

    if (section === 'admin') {
      if (!form.admin.email || !form.admin.firstName || !form.admin.lastName || form.admin.password.length < 8) {
        toast.error('Admin email, full name, and password (min 8 chars) are required.')
        return false
      }
    }

    if (section === 'smtp' && form.smtp.enabled) {
      if (!form.smtp.host.trim() || !form.smtp.port || !form.smtp.authUser.trim() || !form.smtp.fromEmail.trim()) {
        toast.error('SMTP host, port, username, and from email are required when SMTP is enabled.')
        return false
      }
    }

    return true
  }

  const goNext = () => {
    if (!validateStep(activeStep)) return
    setActiveStep((prev) => Math.min(prev + 1, sections.length - 1))
  }

  const goBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0))
  }

  const handleSubmit = async () => {
    if (!validateStep(activeStep)) return

    setSubmitting(true)
    try {
      const payload: SetupForm = JSON.parse(JSON.stringify(form))
      if (payload.database.mode === 'postgres_same_server') {
        const host = String(payload.database.postgresSameServer.host || '').trim().toLowerCase()
        if (host === '127.0.0.1' || host === 'localhost') {
          payload.database.postgresSameServer.host = 'postgres'
          toast.warning('Postgres host changed to "postgres" for Docker Compose.')
        }
      }

      if (logoFile || faviconFile) {
        const formData = new FormData()
        if (logoFile) formData.append('logo', logoFile)
        if (faviconFile) formData.append('favicon', faviconFile)

        const uploadResponse = await api.uploadSetupBrandAssets(formData)
        const assets = uploadResponse?.data || {}
        payload.branding.logoUrl = String(assets.logoUrl || payload.branding.logoUrl || '').trim()
        payload.branding.faviconUrl = String(
          assets.faviconUrl || payload.branding.faviconUrl || payload.branding.logoUrl || ''
        ).trim()
      }

      if (!payload.branding.faviconUrl && payload.branding.logoUrl) {
        payload.branding.faviconUrl = payload.branding.logoUrl
      }

      if (!payload.smtp.enabled) {
        payload.smtp.authPass = ''
      }

      await api.completeSetup(payload)
      toast.success('Setup completed. You can now sign in as admin.')
      router.replace('/auth/login')
    } catch (error: any) {
      const message = String(error?.message || '')
      if (message.includes('ECONNREFUSED 127.0.0.1:5432')) {
        toast.error('Postgres connection refused at 127.0.0.1:5432. In Docker Compose, set host to "postgres" and use postgres/postgres.')
        return
      }
      toast.error(error?.message || 'Setup failed. Please review inputs.')
    } finally {
      setSubmitting(false)
    }
  }

  const renderInstitute = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input className={inputClass} placeholder="Institute Name *" value={form.institute.name} onChange={(e) => setNested('institute.name', e.target.value)} />
        <input className={inputClass} placeholder="Website" value={form.institute.website} onChange={(e) => setNested('institute.website', e.target.value)} />
        <input className={inputClass} type="email" placeholder="Support Email" value={form.institute.supportEmail} onChange={(e) => setNested('institute.supportEmail', e.target.value)} />
        <input className={inputClass} placeholder="Support Phone" value={form.institute.supportPhone} onChange={(e) => setNested('institute.supportPhone', e.target.value)} />
      </div>
      <textarea className={inputClass} rows={3} placeholder="Address" value={form.institute.address} onChange={(e) => setNested('institute.address', e.target.value)} />
    </div>
  )

  const renderBranding = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input className={inputClass} placeholder="App Name" value={form.branding.appName} onChange={(e) => setNested('branding.appName', e.target.value)} />
        <div className="flex gap-2 items-center">
          <input className="w-12 h-12 rounded-xl border border-gray-300 dark:border-gray-600" type="color" value={form.branding.primaryColor} onChange={(e) => setNested('branding.primaryColor', e.target.value)} />
          <input className="w-12 h-12 rounded-xl border border-gray-300 dark:border-gray-600" type="color" value={form.branding.accentColor} onChange={(e) => setNested('branding.accentColor', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Logo Upload</label>
          <input
            className={inputClass}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setLogoFile(file)
              if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
              if (file) {
                const blobUrl = URL.createObjectURL(file)
                setLogoPreview(blobUrl)
                if (!faviconFile) setFaviconPreview(blobUrl)
              }
            }}
          />
          {logoPreview && (
            <img src={logoPreview} alt="Logo preview" className="h-12 w-12 rounded border border-gray-300 dark:border-gray-600 object-contain bg-white" />
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Favicon Upload (Optional)</label>
          <input
            className={inputClass}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setFaviconFile(file)
              if (faviconPreview.startsWith('blob:')) URL.revokeObjectURL(faviconPreview)
              if (file) {
                setFaviconPreview(URL.createObjectURL(file))
              } else if (logoPreview) {
                setFaviconPreview(logoPreview)
              }
            }}
          />
          {faviconPreview && (
            <img src={faviconPreview} alt="Favicon preview" className="h-10 w-10 rounded border border-gray-300 dark:border-gray-600 object-contain bg-white" />
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={form.branding.whiteLabelEnabled} onChange={(e) => setNested('branding.whiteLabelEnabled', e.target.checked)} />
        Enable white labeling
      </label>
      <p className="text-sm text-blue-700 dark:text-blue-300">Suggested logo: 512x512 PNG/SVG. Favicon: 64x64. If favicon is not uploaded, logo will be used as favicon. CoderCrafter watermark remains visible.</p>
    </div>
  )

  const renderDefaults = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <select className={inputClass} value={form.defaults.timezone} onChange={(e) => setNested('defaults.timezone', e.target.value)}>
        {timezoneOptions.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
      </select>
      <select className={inputClass} value={form.defaults.dateFormat} onChange={(e) => setNested('defaults.dateFormat', e.target.value)}>
        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        <option value="DD-MM-YYYY">DD-MM-YYYY</option>
        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
      </select>
      <select className={inputClass} value={form.defaults.timeFormat} onChange={(e) => setNested('defaults.timeFormat', e.target.value)}>
        <option value="24h">24-hour</option>
        <option value="12h">12-hour</option>
      </select>
      <input className={inputClass} placeholder="Locale (en-US)" value={form.defaults.locale} onChange={(e) => setNested('defaults.locale', e.target.value)} />
    </div>
  )

  const renderDomain = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Custom Domain (Optional)</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add a custom domain for your LMS. We’ll generate DNS records and verify them when ready.
          </p>
        </div>
        {customDomain.savedAt ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">Saved domain</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{customDomain.domain}</p>
              {customDomain.serverIp && (
                <p className="text-xs text-gray-500 dark:text-gray-400">IP: {customDomain.serverIp}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleEditDomain}
                className="px-3 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDeleteDomain}
                className="px-3 py-1 text-xs rounded-md border border-red-300 text-red-600 dark:border-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="yourdomain.com"
                value={customDomain.domain}
                onChange={(e) => {
                  const value = e.target.value
                  setCustomDomain((prev) => ({
                    ...prev,
                    domain: value,
                    records: value.trim().toLowerCase() === lastPreparedDomainRef.current ? prev.records : []
                  }))
                }}
                onBlur={handleDomainBlur}
              />
              <input
                className={inputClass}
                placeholder="Server public IP (A record)"
                value={customDomain.serverIp}
                onChange={(e) => setCustomDomain((prev) => ({ ...prev, serverIp: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Frontend Port</label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="3001"
                  value={customDomain.frontendPort}
                  onChange={(e) => setCustomDomain((prev) => ({ ...prev, frontendPort: Number(e.target.value || 3001) }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Backend Port</label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="5001"
                  value={customDomain.backendPort}
                  onChange={(e) => setCustomDomain((prev) => ({ ...prev, backendPort: Number(e.target.value || 5001) }))}
                />
              </div>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400">
              If another service is already running on these ports, change them before continuing.
            </p>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrepareDomain}
            disabled={domainBusy}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-60"
          >
            {domainBusy ? 'Working...' : 'Generate DNS Records'}
          </button>
          <button
            type="button"
            onClick={handleVerifyDomain}
            disabled={domainBusy || !customDomain.domain}
            className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-60"
          >
            Verify DNS
          </button>
          <button
            type="button"
            onClick={handleDiagnoseDomain}
            disabled={domainBusy || !customDomain.domain}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-60"
          >
            Diagnose DNS
          </button>
          {customDomain.status && (
            <span className={`px-3 py-2 rounded-xl text-sm font-medium ${customDomain.status === 'verified' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
              {customDomain.status === 'verified' ? 'Verified' : 'Pending'}
            </span>
          )}
        </div>

        {customDomain.records.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">DNS records to add:</p>
            <p className="text-xs text-gray-500">
              Note: For subdomains (example: <code>app.example.com</code>), the A record host shows the subdomain and the TXT host becomes
              <code>_lms-verify.app</code>. If your DNS provider uses multi-part TLDs (like <code>.co.in</code>), use the full hostname if required.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {customDomain.records.map((record, idx) => (
                <div
                  key={`${record.type}-${record.host}-${idx}`}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                >
                  <div className="text-sm">
                    <span className="font-semibold text-gray-900 dark:text-white">{record.type}</span>
                    <span className="mx-2 text-gray-400">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Host: {record.host}</span>
                    <span className="mx-2 text-gray-400">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Value: {record.value}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(record.host)}
                      className="px-3 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                    >
                      Copy Host
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(record.value)}
                      className="px-3 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                    >
                      Copy Value
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {customDomain.lastCheckedAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last checked: {new Date(customDomain.lastCheckedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {customDomain.caddyMessage && (
          <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 text-xs text-gray-800 dark:text-gray-200">
            {customDomain.caddyMessage}
          </div>
        )}

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={customDomain.sslEnabled}
              onChange={(e) => setCustomDomain((prev) => ({ ...prev, sslEnabled: e.target.checked }))}
            />
            Enable SSL
          </label>
          {customDomain.sslEnabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  type="email"
                  placeholder="Certbot email (required)"
                  value={customDomain.certbotEmail}
                  onChange={(e) => setCustomDomain((prev) => ({ ...prev, certbotEmail: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={handleEnableSsl}
                  disabled={domainBusy || !customDomain.domain}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-60"
                >
                  Enable SSL
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Certbot automation runs only if the server enables it. Otherwise we show the command to run manually.
              </p>
              {customDomain.sslMessage && (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 text-xs text-gray-800 dark:text-gray-200">
                  {customDomain.sslMessage}
                </div>
              )}
            </>
          )}
        </div>
        {!customDomain.savedAt && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveDomain}
              disabled={domainBusy || customDomain.status !== 'verified'}
              className="px-4 py-2 rounded-xl bg-green-600 text-white disabled:opacity-60"
            >
              Save Domain
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const renderDatabase = () => (
    <div className="space-y-4">
      <select
        className={inputClass}
        value={form.database.mode}
        onChange={(e) => setNested('database.mode', e.target.value as SetupForm['database']['mode'])}
      >
        <option value="mongodb">MongoDB (URI)</option>
        <option value="postgres_uri">PostgreSQL (URI)</option>
        <option value="postgres_same_server">PostgreSQL (Docker Compose Host/Port)</option>
      </select>

      {form.database.mode === 'mongodb' && (
        <input
          className={inputClass}
          placeholder="mongodb://localhost:27017/lms_futureproof"
          value={form.database.mongodbUri}
          onChange={(e) => setNested('database.mongodbUri', e.target.value)}
        />
      )}

      {form.database.mode === 'postgres_uri' && (
        <input
          className={inputClass}
          placeholder="postgresql://user:pass@host:5432/db"
          value={form.database.postgresUri}
          onChange={(e) => setNested('database.postgresUri', e.target.value)}
        />
      )}

      {form.database.mode === 'postgres_same_server' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-lg border border-blue-300 text-blue-700 dark:text-blue-300 dark:border-blue-700"
              onClick={() => {
                setNested('database.postgresSameServer.host', 'postgres')
                setNested('database.postgresSameServer.port', 5432)
                setNested('database.postgresSameServer.database', 'lms_futureproof')
                setNested('database.postgresSameServer.user', 'postgres')
                setNested('database.postgresSameServer.password', 'postgres')
                setNested('database.postgresSameServer.ssl', false)
                toast.success('Applied Docker Compose Postgres defaults.')
              }}
            >
              Use Docker Defaults
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className={inputClass} placeholder="Host (use postgres for Docker Compose)" value={form.database.postgresSameServer.host} onChange={(e) => setNested('database.postgresSameServer.host', e.target.value)} />
          <input className={inputClass} type="number" placeholder="Port" value={form.database.postgresSameServer.port} onChange={(e) => setNested('database.postgresSameServer.port', Number(e.target.value))} />
          <input className={inputClass} placeholder="Database" value={form.database.postgresSameServer.database} onChange={(e) => setNested('database.postgresSameServer.database', e.target.value)} />
          <input className={inputClass} placeholder="User" value={form.database.postgresSameServer.user} onChange={(e) => setNested('database.postgresSameServer.user', e.target.value)} />
          <input className={inputClass} type="password" placeholder="Password" value={form.database.postgresSameServer.password} onChange={(e) => setNested('database.postgresSameServer.password', e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.database.postgresSameServer.ssl} onChange={(e) => setNested('database.postgresSameServer.ssl', e.target.checked)} />
            Use SSL
          </label>
        </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Docker Compose tip: Host <code>postgres</code>, Port <code>5432</code>, User <code>postgres</code>, Password <code>postgres</code>.
          </p>
        </div>
      )}
    </div>
  )

  const renderAdmin = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <input
          className={inputClass}
          type="email"
          placeholder="Admin Email *"
          value={form.admin.email}
          onChange={(e) => setNested('admin.email', e.target.value)}
        />
      </div>
      <input className={inputClass} type="password" placeholder="Password (min 8) *" value={form.admin.password} onChange={(e) => setNested('admin.password', e.target.value)} />
      <input className={inputClass} placeholder="First Name *" value={form.admin.firstName} onChange={(e) => setNested('admin.firstName', e.target.value)} />
      <input className={inputClass} placeholder="Last Name *" value={form.admin.lastName} onChange={(e) => setNested('admin.lastName', e.target.value)} />
    </div>
  )

  const renderSmtp = () => (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={form.smtp.enabled}
          onChange={(e) => setNested('smtp.enabled', e.target.checked)}
        />
        Enable SMTP email sending
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input className={inputClass} placeholder="SMTP Host (e.g. mail.codercrafter.in)" value={form.smtp.host} onChange={(e) => setNested('smtp.host', e.target.value)} />
        <input className={inputClass} type="number" placeholder="SMTP Port" value={form.smtp.port} onChange={(e) => setNested('smtp.port', Number(e.target.value || 587))} />
        <input className={inputClass} placeholder="SMTP Username" value={form.smtp.authUser} onChange={(e) => setNested('smtp.authUser', e.target.value)} />
        <input className={inputClass} type="password" placeholder="SMTP Password" value={form.smtp.authPass} onChange={(e) => setNested('smtp.authPass', e.target.value)} />
        <input className={inputClass} placeholder="From Name" value={form.smtp.fromName} onChange={(e) => setNested('smtp.fromName', e.target.value)} />
        <input className={inputClass} placeholder="From Email" value={form.smtp.fromEmail} onChange={(e) => setNested('smtp.fromEmail', e.target.value)} />
        <input className={inputClass} placeholder="Reply-To (Optional)" value={form.smtp.replyTo} onChange={(e) => setNested('smtp.replyTo', e.target.value)} />
        <input className={inputClass} placeholder="Test Email (Optional)" value={form.smtp.testEmail} onChange={(e) => setNested('smtp.testEmail', e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.smtp.secure} onChange={(e) => setNested('smtp.secure', e.target.checked)} />
          SSL (port 465)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.smtp.requireTLS} onChange={(e) => setNested('smtp.requireTLS', e.target.checked)} />
          Require STARTTLS
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
          onClick={async () => {
            try {
              const payload = { ...form.smtp }
              await api.testSetupSmtp(payload)
              toast.success(payload.testEmail ? `SMTP verified and test email sent to ${payload.testEmail}` : 'SMTP connection verified.')
            } catch (error: any) {
              toast.error(error?.message || 'SMTP test failed')
            }
          }}
        >
          Test SMTP
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Enter only hostname, not URL. Use <code>mail.codercrafter.in</code> (not <code>https://mail.codercrafter.in</code>).
      </p>
    </div>
  )

  const renderStep = () => {
    const section = sections[activeStep].id as SectionId
    if (section === 'institute') return renderInstitute()
    if (section === 'branding') return renderBranding()
    if (section === 'domain') return renderDomain()
    if (section === 'defaults') return renderDefaults()
    if (section === 'database') return renderDatabase()
    if (section === 'smtp') return renderSmtp()
    return renderAdmin()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center space-y-4">
          <Spinner size="lg" className="mx-auto" />
          <p className="text-gray-600 dark:text-gray-400 animate-pulse">Loading setup wizard...</p>
        </div>
      </div>
    )
  }

  const active = sections[activeStep]
  const ActiveIcon = active.icon
  const isLast = activeStep === sections.length - 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="sticky top-0 z-10 backdrop-blur-lg bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">{form.branding.appName || 'LMS'} Setup</h1>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Step {activeStep + 1} of {sections.length}</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 space-y-8 pb-20">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 overflow-x-auto">
            {sections.map((section, index) => {
              const Icon = section.icon
              const isActive = index === activeStep
              const isDone = index < activeStep
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap transition-all ${isActive ? 'bg-blue-600 text-white' : isDone ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  <span className="text-sm font-medium">{section.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className={`${cardClass} flex flex-col`}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl text-white">
                <ActiveIcon className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{active.label}</h2>
            </div>
          </div>

          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {renderStep()}
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={activeStep === 0 || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {!isLast ? (
              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" /> Completing Setup...
                  </>
                ) : (
                  <>
                    Complete Setup <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

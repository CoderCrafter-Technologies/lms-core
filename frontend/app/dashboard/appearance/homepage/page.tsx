
'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { LayoutPanelTop, Plus, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import logo from '@/assets/logo_blue.png'
import { useSetup } from '@/components/providers/SetupProvider'

type LandingSection = {
  id: 'hero' | 'courses' | 'features' | 'stats' | 'cta'
  label: string
  enabled: boolean
  layout: string
}

type LandingContent = {
  hero: {
    headline: string
    subheadline: string
    primaryCtaText: string
    primaryCtaUrl: string
    secondaryCtaText: string
    secondaryCtaUrl: string
  }
  courses: {
    title: string
    subtitle: string
    items: Array<{ title: string; description: string; gradient: string }>
  }
  features: {
    title: string
    items: Array<{ title: string; description: string }>
  }
  stats: {
    items: Array<{ value: string; label: string }>
  }
  cta: {
    headline: string
    subheadline: string
    buttonText: string
    buttonUrl: string
  }
}

type LandingStyles = {
  pageBackground: string
  heroBackground: string
  coursesBackground: string
  featuresBackground: string
  statsBackground: string
  ctaBackground: string
  textColor: string
  secondaryTextColor: string
  headingColor: string
  primaryColor: string
  accentColor: string
  fontFamily: string
  headingFontFamily: string
  baseFontSize: number
  heroHeadingSize: number
  sectionHeadingSize: number
}

type LandingSettings = {
  enabled: boolean
  layoutPreset: string
  showHeader: boolean
  sections: LandingSection[]
  content: LandingContent
  styles: LandingStyles
}

const defaultLandingSettings: LandingSettings = {
  enabled: true,
  layoutPreset: 'aurora',
  showHeader: true,
  sections: [
    { id: 'hero', label: 'Hero', enabled: true, layout: 'centered' },
    { id: 'courses', label: 'Popular Courses', enabled: true, layout: 'grid-4' },
    { id: 'features', label: 'Key Features', enabled: true, layout: 'cards' },
    { id: 'stats', label: 'Stats', enabled: true, layout: 'metrics' },
    { id: 'cta', label: 'Call To Action', enabled: true, layout: 'banner' }
  ],
  content: {
    hero: {
      headline: 'Launch Your Tech Career with',
      subheadline: 'Master in-demand technologies with industry experts. Learn with hands-on projects.',
      primaryCtaText: 'Get Started',
      primaryCtaUrl: '/auth/register',
      secondaryCtaText: 'Explore Courses',
      secondaryCtaUrl: '/auth/login'
    },
    courses: {
      title: 'Most Popular Courses',
      subtitle: 'Join thousands of students learning the most in-demand skills in the tech industry.',
      items: [
        {
          title: 'Full Stack Development',
          description: 'Master MERN stack, React, Node.js and build real-world applications.',
          gradient: 'from-blue-500 to-blue-700'
        },
        {
          title: 'DevOps Engineering',
          description: 'Learn Docker, Kubernetes, AWS, CI/CD and infrastructure automation.',
          gradient: 'from-green-500 to-green-700'
        },
        {
          title: 'Mobile Development',
          description: 'Build iOS and Android apps with React Native, Flutter and Swift.',
          gradient: 'from-purple-500 to-purple-700'
        },
        {
          title: 'Data Science and AI',
          description: 'Master Python, Machine Learning, TensorFlow and data visualization.',
          gradient: 'from-red-500 to-red-700'
        }
      ]
    },
    features: {
      title: 'Why Choose Us?',
      items: [
        {
          title: 'Industry Expert Instructors',
          description: 'Learn from professionals working at top tech companies with real-world experience.'
        },
        {
          title: 'Live Interactive Classes',
          description: 'Live sessions with code collaboration, whiteboard, and real-time doubt solving.'
        },
        {
          title: 'Career Support',
          description: 'Resume building, mock interviews, and placement assistance to launch your career.'
        }
      ]
    },
    stats: {
      items: [
        { value: '5000+', label: 'Students Trained' },
        { value: '100+', label: 'Industry Experts' },
        { value: '85%', label: 'Placement Rate' },
        { value: '24/7', label: 'Mentor Support' }
      ]
    },
    cta: {
      headline: 'Ready to launch your tech career?',
      subheadline: 'Join thousands of students who have transformed their careers.',
      buttonText: 'Get Started Today',
      buttonUrl: '/auth/register'
    }
  },
  styles: {
    pageBackground: '',
    heroBackground: '',
    coursesBackground: '',
    featuresBackground: '',
    statsBackground: '',
    ctaBackground: '',
    textColor: '',
    secondaryTextColor: '',
    headingColor: '',
    primaryColor: '',
    accentColor: '',
    fontFamily: '',
    headingFontFamily: '',
    baseFontSize: 14,
    heroHeadingSize: 56,
    sectionHeadingSize: 32
  }
}

const mergeLandingSettings = (settings: Partial<LandingSettings>): LandingSettings => {
  const merged: LandingSettings = {
    ...defaultLandingSettings,
    ...settings,
    content: {
      ...defaultLandingSettings.content,
      ...(settings.content || {}),
      hero: { ...defaultLandingSettings.content.hero, ...(settings.content?.hero || {}) },
      courses: { ...defaultLandingSettings.content.courses, ...(settings.content?.courses || {}) },
      features: { ...defaultLandingSettings.content.features, ...(settings.content?.features || {}) },
      stats: { ...defaultLandingSettings.content.stats, ...(settings.content?.stats || {}) },
      cta: { ...defaultLandingSettings.content.cta, ...(settings.content?.cta || {}) }
    },
    styles: { ...defaultLandingSettings.styles, ...(settings.styles || {}) },
    sections: Array.isArray(settings.sections) && settings.sections.length
      ? settings.sections as LandingSection[]
      : defaultLandingSettings.sections
  }
  return merged
}

const stopEnter = (event: React.KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).blur()
  }
}

const resolveColor = (value: string, fallback: string) => (value?.trim() ? value : fallback)

export default function HomepageAppearancePage() {
  const [settings, setSettings] = useState<LandingSettings>(defaultLandingSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const { branding } = useSetup()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const response = await api.getLandingPageSettings()
        const data = response?.settings || response?.data || {}
        if (!mounted) return
        setSettings(mergeLandingSettings(data))
      } catch (error: any) {
        if (mounted) {
          setStatus({ type: 'error', message: error?.message || 'Failed to load homepage settings.' })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const updateSection = (id: LandingSection['id'], patch: Partial<LandingSection>) => {
    setSettings((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => (section.id === id ? { ...section, ...patch } : section))
    }))
  }

  const updateContent = <K extends keyof LandingContent>(key: K, patch: Partial<LandingContent[K]>) => {
    setSettings((prev) => ({
      ...prev,
      content: { ...prev.content, [key]: { ...prev.content[key], ...patch } }
    }))
  }

  const updateStyles = (patch: Partial<LandingStyles>) => {
    setSettings((prev) => ({
      ...prev,
      styles: { ...prev.styles, ...patch }
    }))
  }

  const saveSettings = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const response = await api.updateLandingPageSettings(settings)
      const saved = response?.settings || response?.data || settings
      setSettings(mergeLandingSettings(saved))
      setStatus({ type: 'success', message: 'Homepage updated successfully.' })
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.message || 'Failed to save homepage.' })
    } finally {
      setSaving(false)
    }
  }

  const appName = branding?.appName || 'Institute LMS'
  const brandLogo = branding?.logoUrl || logo.src

  const landingColors = useMemo(() => ({
    text: resolveColor(settings.styles.textColor, 'var(--color-text)'),
    secondaryText: resolveColor(settings.styles.secondaryTextColor, 'var(--color-text-secondary)'),
    heading: resolveColor(settings.styles.headingColor, resolveColor(settings.styles.textColor, 'var(--color-text)')),
    primary: resolveColor(settings.styles.primaryColor, 'var(--color-primary)'),
    accent: resolveColor(settings.styles.accentColor, 'var(--color-accent)')
  }), [settings.styles])

  const layoutTone = settings.layoutPreset === 'minimal'
    ? 'minimal'
    : settings.layoutPreset === 'editorial'
      ? 'editorial'
      : settings.layoutPreset === 'classic'
        ? 'classic'
        : 'aurora'

  const sections = settings.sections.filter((section) => section.enabled)

  const pageStyle = {
    backgroundColor: resolveColor(settings.styles.pageBackground, 'var(--color-background)'),
    color: landingColors.text,
    fontFamily: settings.styles.fontFamily || undefined,
    fontSize: settings.styles.baseFontSize ? `${settings.styles.baseFontSize}px` : undefined
  } as React.CSSProperties

  const headingStyle = {
    color: landingColors.heading,
    fontFamily: settings.styles.headingFontFamily || settings.styles.fontFamily || undefined
  } as React.CSSProperties

  const heroHeadlineStyle = {
    ...headingStyle,
    fontSize: settings.styles.heroHeadingSize ? `${settings.styles.heroHeadingSize}px` : undefined
  } as React.CSSProperties

  const sectionHeadingStyle = {
    ...headingStyle,
    fontSize: settings.styles.sectionHeadingSize ? `${settings.styles.sectionHeadingSize}px` : undefined
  } as React.CSSProperties

  const renderHero = (layout: string) => {
    const isSplit = layout === 'split' || layoutTone === 'editorial'
    return (
      <section
        className={`mx-auto max-w-6xl py-24 sm:py-28 ${isSplit ? 'lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center' : ''}`}
        style={{ backgroundColor: resolveColor(settings.styles.heroBackground, 'transparent') }}
      >
        <div className={isSplit ? '' : 'text-center'}>
          <h1
            className="font-bold tracking-tight sm:text-6xl"
            style={heroHeadlineStyle}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('hero', { headline: event.currentTarget.innerText.trim() })}
            onKeyDown={stopEnter}
          >
            {settings.content.hero.headline}{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {appName}
            </span>
          </h1>
          <p
            className="mt-6 text-lg leading-8"
            style={{ color: landingColors.secondaryText }}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('hero', { subheadline: event.currentTarget.innerText.trim() })}
          >
            {settings.content.hero.subheadline}
          </p>
          <div className={`mt-10 flex ${isSplit ? 'justify-start' : 'justify-center'} gap-4 flex-wrap`}>
            <Link
              href={settings.content.hero.primaryCtaUrl || '/auth/register'}
              className="rounded-md text-md px-6 py-2 text-white transition-colors"
              style={{ backgroundColor: landingColors.primary }}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => updateContent('hero', { primaryCtaText: event.currentTarget.innerText.trim() })}
                onKeyDown={stopEnter}
              >
                {settings.content.hero.primaryCtaText}
              </span>
            </Link>
            <Link
              href={settings.content.hero.secondaryCtaUrl || '/auth/login'}
              className="text-md font-semibold border px-6 py-2 rounded-md transition-colors"
              style={{ color: landingColors.text, borderColor: landingColors.primary }}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => updateContent('hero', { secondaryCtaText: event.currentTarget.innerText.trim() })}
                onKeyDown={stopEnter}
              >
                {settings.content.hero.secondaryCtaText}
              </span>
            </Link>
          </div>
        </div>
        {isSplit && (
          <div className="mt-10 lg:mt-0">
            <div className="rounded-3xl border p-6 shadow-lg" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="grid grid-cols-2 gap-4">
                {['Full Stack', 'DevOps', 'Mobile', 'AI/ML'].map((item) => (
                  <div key={item} className="rounded-2xl p-4 text-sm font-semibold text-center" style={{ backgroundColor: 'var(--color-primary-light)', color: landingColors.primary }}>
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm" style={{ color: landingColors.secondaryText }}>
                Cohorts starting every week with live mentor support.
              </p>
            </div>
          </div>
        )}
      </section>
    )
  }

  const renderCourses = (layout: string) => {
    const gridCols = layout === 'grid-3' ? 'lg:grid-cols-3' : layout === 'list' ? 'lg:grid-cols-1' : 'lg:grid-cols-4'
    const cardLayout = layout === 'list' ? 'md:flex md:items-center md:gap-6' : 'flex flex-col'
    return (
      <section className="mx-auto max-w-7xl px-6 lg:px-8 py-16" style={{ backgroundColor: resolveColor(settings.styles.coursesBackground, 'transparent') }}>
        <div className="mx-auto lg:text-center">
          <span
            className="inline-block px-4 py-1 font-semibold mb-4 text-sm rounded-full border border-white/20"
            style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: landingColors.accent }}
          >
            * Trending Technologies
          </span>
          <p
            className="mt-2 font-bold tracking-tight sm:text-4xl"
            style={sectionHeadingStyle}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('courses', { title: event.currentTarget.innerText.trim() })}
            onKeyDown={stopEnter}
          >
            {settings.content.courses.title}
          </p>
          <p
            className="mt-4 text-lg"
            style={{ color: landingColors.secondaryText }}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('courses', { subtitle: event.currentTarget.innerText.trim() })}
          >
            {settings.content.courses.subtitle}
          </p>
        </div>
        <div className={`mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none ${gridCols}`}>
          {settings.content.courses.items.map((course, index) => (
            <div
              key={`${course.title}-${index}`}
              className={`overflow-hidden rounded-xl transition-all hover:shadow-md hover:-translate-y-1 ${cardLayout}`}
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderWidth: '1px' }}
            >
              <div className={`h-28 ${layout === 'list' ? 'md:w-40 md:flex-shrink-0 md:h-full' : ''} bg-gradient-to-r ${course.gradient} flex items-center justify-center`}>
                <span className="text-white text-sm font-semibold">Course</span>
              </div>
              <div className="p-6 space-y-2">
                <h3
                  className="text-xl font-bold"
                  style={{ color: landingColors.text }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.courses.items]
                    next[index] = { ...course, title: event.currentTarget.innerText.trim() }
                    updateContent('courses', { items: next })
                  }}
                  onKeyDown={stopEnter}
                >
                  {course.title}
                </h3>
                <p
                  style={{ color: landingColors.secondaryText }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.courses.items]
                    next[index] = { ...course, description: event.currentTarget.innerText.trim() }
                    updateContent('courses', { items: next })
                  }}
                >
                  {course.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  const renderFeatures = (layout: string) => {
    const isList = layout === 'list'
    const isSplit = layout === 'split'
    return (
      <section
        className="mx-auto max-w-7xl px-6 lg:px-8 py-20 rounded-2xl border"
        style={{ backgroundColor: resolveColor(settings.styles.featuresBackground, 'var(--color-surface)'), borderColor: 'var(--color-border)' }}
      >
        <div className="mx-auto max-w-2xl lg:text-center">
          <span
            className="inline-block px-4 py-1 font-semibold mb-4 text-sm rounded-full border border-white/20"
            style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: landingColors.accent }}
          >
            * Learn Better
          </span>
          <p
            className="mt-2 font-bold tracking-tight sm:text-4xl"
            style={sectionHeadingStyle}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('features', { title: event.currentTarget.innerText.trim() })}
            onKeyDown={stopEnter}
          >
            {settings.content.features.title}
          </p>
        </div>
        <div className={`mx-auto mt-12 max-w-2xl ${isSplit ? 'lg:grid lg:grid-cols-2 lg:gap-10 lg:max-w-5xl' : 'lg:max-w-none'}`}>
          <dl className={`grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 ${isList ? '' : 'lg:grid-cols-3'} ${isSplit ? 'lg:grid-cols-1' : ''}`}>
            {settings.content.features.items.map((feature, index) => (
              <div key={`${feature.title}-${index}`} className={`flex flex-col ${isList ? 'border-b pb-6' : ''}`} style={isList ? { borderColor: 'var(--color-border)' } : undefined}>
                <dt className="text-base font-semibold leading-7" style={{ color: landingColors.text }}>
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: landingColors.primary }}>
                    <span className="text-white text-sm">★</span>
                  </div>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => {
                      const next = [...settings.content.features.items]
                      next[index] = { ...feature, title: event.currentTarget.innerText.trim() }
                      updateContent('features', { items: next })
                    }}
                    onKeyDown={stopEnter}
                  >
                    {feature.title}
                  </span>
                </dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7" style={{ color: landingColors.secondaryText }}>
                  <p
                    className="flex-auto"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => {
                      const next = [...settings.content.features.items]
                      next[index] = { ...feature, description: event.currentTarget.innerText.trim() }
                      updateContent('features', { items: next })
                    }}
                  >
                    {feature.description}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
          {isSplit && (
            <div className="mt-10 lg:mt-0">
              <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                <h3 className="text-lg font-semibold" style={{ color: landingColors.text }}>Built for Outcomes</h3>
                <p className="mt-4 text-sm" style={{ color: landingColors.secondaryText }}>
                  Structured pathways, mentor reviews, and portfolio-ready capstones help learners stand out.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    )
  }

  const renderStats = (layout: string) => {
    if (layout === 'tiles') {
      return (
        <section className="mx-auto max-w-7xl px-6 lg:px-8 py-20" style={{ backgroundColor: resolveColor(settings.styles.statsBackground, 'transparent') }}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {settings.content.stats.items.map((stat, index) => (
              <div key={`${stat.label}-${index}`} className="rounded-2xl border p-6 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <div
                  className="text-3xl font-bold"
                  style={{ color: landingColors.primary }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...stat, value: event.currentTarget.innerText.trim() }
                    updateContent('stats', { items: next })
                  }}
                  onKeyDown={stopEnter}
                >
                  {stat.value}
                </div>
                <div
                  className="mt-2 text-sm"
                  style={{ color: landingColors.secondaryText }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...stat, label: event.currentTarget.innerText.trim() }
                    updateContent('stats', { items: next })
                  }}
                  onKeyDown={stopEnter}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      )
    }
    return (
      <section className="mx-auto max-w-7xl px-6 lg:px-8 py-20" style={{ backgroundColor: resolveColor(settings.styles.statsBackground, 'transparent') }}>
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
            {settings.content.stats.items.map((stat, index) => (
              <div key={`${stat.label}-${index}`} className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt
                  className="text-4xl font-bold leading-9 tracking-tight"
                  style={{ color: landingColors.primary }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...stat, value: event.currentTarget.innerText.trim() }
                    updateContent('stats', { items: next })
                  }}
                  onKeyDown={stopEnter}
                >
                  {stat.value}
                </dt>
                <dd
                  className="text-base leading-7"
                  style={{ color: landingColors.secondaryText }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...stat, label: event.currentTarget.innerText.trim() }
                    updateContent('stats', { items: next })
                  }}
                  onKeyDown={stopEnter}
                >
                  {stat.label}
                </dd>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const renderCta = (layout: string) => {
    if (layout === 'boxed') {
      return (
        <section className="mx-auto max-w-6xl px-6 lg:px-8 mb-24" style={{ backgroundColor: resolveColor(settings.styles.ctaBackground, 'transparent') }}>
          <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{ color: landingColors.text }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(event) => updateContent('cta', { headline: event.currentTarget.innerText.trim() })}
              onKeyDown={stopEnter}
            >
              {settings.content.cta.headline}
            </h2>
            <p
              className="mt-4 text-lg leading-8"
              style={{ color: landingColors.secondaryText }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(event) => updateContent('cta', { subheadline: event.currentTarget.innerText.trim() })}
            >
              {settings.content.cta.subheadline}
            </p>
            <div className="mt-8">
              <Link
                href={settings.content.cta.buttonUrl || '/auth/register'}
                className="rounded-md px-6 py-3 text-lg font-semibold text-white shadow-sm hover:opacity-90 transition-all"
                style={{ backgroundColor: landingColors.primary }}
              >
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => updateContent('cta', { buttonText: event.currentTarget.innerText.trim() })}
                  onKeyDown={stopEnter}
                >
                  {settings.content.cta.buttonText}
                </span>
              </Link>
            </div>
          </div>
        </section>
      )
    }
    return (
      <section className="rounded-2xl shadow-xl mx-6 lg:mx-8 py-16 px-6 lg:px-8 mb-24" style={{ backgroundColor: resolveColor(settings.styles.ctaBackground, landingColors.primary) }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('cta', { headline: event.currentTarget.innerText.trim() })}
            onKeyDown={stopEnter}
          >
            {settings.content.cta.headline}
          </h2>
          <p
            className="mt-4 text-lg leading-8 text-white/80"
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('cta', { subheadline: event.currentTarget.innerText.trim() })}
          >
            {settings.content.cta.subheadline}
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href={settings.content.cta.buttonUrl || '/auth/register'}
              className="rounded-md bg-white px-6 py-3 text-lg font-semibold shadow-sm hover:bg-opacity-90 transition-all"
              style={{ color: landingColors.primary }}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => updateContent('cta', { buttonText: event.currentTarget.innerText.trim() })}
                onKeyDown={stopEnter}
              >
                {settings.content.cta.buttonText}
              </span>
            </Link>
          </div>
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading homepage settings...</div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] h-[calc(100vh-4rem)]">
      <aside className="border-r p-6 overflow-y-auto" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
            <LayoutPanelTop className="h-4 w-4" style={{ color: 'rgb(59, 130, 246)' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Homepage Editor</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Inline edit the live preview.</p>
          </div>
        </div>

        {status && (
          <div
            className="mt-4 rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: status.type === 'error' ? '#FCA5A5' : 'var(--color-border)',
              backgroundColor: status.type === 'error' ? 'rgba(248, 113, 113, 0.12)' : 'var(--color-background)',
              color: status.type === 'error' ? '#991B1B' : 'var(--color-text)'
            }}
          >
            {status.message}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <h2 className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Global Styles</h2>
          <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Page Background
            <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={settings.styles.pageBackground || '#f8fafc'} onChange={(event) => updateStyles({ pageBackground: event.target.value })} />
          </label>
          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Primary Color
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={settings.styles.primaryColor || '#2563eb'} onChange={(event) => updateStyles({ primaryColor: event.target.value })} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Accent Color
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={settings.styles.accentColor || '#0ea5e9'} onChange={(event) => updateStyles({ accentColor: event.target.value })} />
            </label>
          </div>
          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Text Color
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={settings.styles.textColor || '#0f172a'} onChange={(event) => updateStyles({ textColor: event.target.value })} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Secondary Text
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={settings.styles.secondaryTextColor || '#475569'} onChange={(event) => updateStyles({ secondaryTextColor: event.target.value })} />
            </label>
          </div>
          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Heading Color
              <input type="color" className="mt-1 w-full h-9 rounded-lg border" value={settings.styles.headingColor || '#0f172a'} onChange={(event) => updateStyles({ headingColor: event.target.value })} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Base Font Size
              <input type="number" min={12} max={20} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={settings.styles.baseFontSize} onChange={(event) => updateStyles({ baseFontSize: Number(event.target.value || 14) })} />
            </label>
          </div>
          <div className="grid gap-3 grid-cols-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Hero Heading Size
              <input type="number" min={32} max={80} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={settings.styles.heroHeadingSize} onChange={(event) => updateStyles({ heroHeadingSize: Number(event.target.value || 56) })} />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Section Heading Size
              <input type="number" min={20} max={48} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={settings.styles.sectionHeadingSize} onChange={(event) => updateStyles({ sectionHeadingSize: Number(event.target.value || 32) })} />
            </label>
          </div>
          <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Font Family
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={settings.styles.fontFamily} onChange={(event) => updateStyles({ fontFamily: event.target.value })} />
          </label>
          <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Heading Font Family
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={settings.styles.headingFontFamily} onChange={(event) => updateStyles({ headingFontFamily: event.target.value })} />
          </label>
        </div>

        <div className="mt-6 space-y-4">
          <h2 className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Section Settings</h2>
          {settings.sections.map((section) => (
            <div key={section.id} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{section.label}</div>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(event) => updateSection(section.id, { enabled: event.target.checked })}
                  />
                  Visible
                </label>
              </div>
              <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Layout
                <select
                  className="mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                  value={section.layout}
                  onChange={(event) => updateSection(section.id, { layout: event.target.value })}
                >
                  {section.id === 'hero' && (
                    <>
                      <option value="centered">Centered</option>
                      <option value="split">Split</option>
                    </>
                  )}
                  {section.id === 'courses' && (
                    <>
                      <option value="grid-4">Grid 4</option>
                      <option value="grid-3">Grid 3</option>
                      <option value="list">List</option>
                    </>
                  )}
                  {section.id === 'features' && (
                    <>
                      <option value="cards">Cards</option>
                      <option value="list">List</option>
                      <option value="split">Split</option>
                    </>
                  )}
                  {section.id === 'stats' && (
                    <>
                      <option value="metrics">Metrics</option>
                      <option value="tiles">Tiles</option>
                    </>
                  )}
                  {section.id === 'cta' && (
                    <>
                      <option value="banner">Banner</option>
                      <option value="boxed">Boxed</option>
                    </>
                  )}
                </select>
              </label>
              <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Background
                <input
                  type="color"
                  className="mt-1 w-full h-8 rounded-lg border"
                  value={
                    section.id === 'hero' ? settings.styles.heroBackground || '#ffffff'
                      : section.id === 'courses' ? settings.styles.coursesBackground || '#ffffff'
                        : section.id === 'features' ? settings.styles.featuresBackground || '#ffffff'
                          : section.id === 'stats' ? settings.styles.statsBackground || '#ffffff'
                            : settings.styles.ctaBackground || '#2563eb'
                  }
                  onChange={(event) => {
                    const value = event.target.value
                    if (section.id === 'hero') updateStyles({ heroBackground: value })
                    if (section.id === 'courses') updateStyles({ coursesBackground: value })
                    if (section.id === 'features') updateStyles({ featuresBackground: value })
                    if (section.id === 'stats') updateStyles({ statsBackground: value })
                    if (section.id === 'cta') updateStyles({ ctaBackground: value })
                  }}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          <h2 className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Content Blocks</h2>

          <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Courses</div>
            {settings.content.courses.items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-lg border p-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <input
                  className="w-full rounded border px-2 py-1 text-xs"
                  value={item.title}
                  onChange={(event) => {
                    const next = [...settings.content.courses.items]
                    next[index] = { ...item, title: event.target.value }
                    updateContent('courses', { items: next })
                  }}
                />
                <textarea
                  rows={2}
                  className="mt-2 w-full rounded border px-2 py-1 text-xs"
                  value={item.description}
                  onChange={(event) => {
                    const next = [...settings.content.courses.items]
                    next[index] = { ...item, description: event.target.value }
                    updateContent('courses', { items: next })
                  }}
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-red-500 inline-flex items-center gap-1"
                  onClick={() => {
                    const next = settings.content.courses.items.filter((_, idx) => idx !== index)
                    updateContent('courses', { items: next })
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs inline-flex items-center gap-1 text-blue-600"
              onClick={() => {
                const next = [...settings.content.courses.items, { title: 'New Course', description: 'Course description.', gradient: 'from-blue-500 to-blue-700' }]
                updateContent('courses', { items: next })
              }}
            >
              <Plus className="h-3 w-3" /> Add course
            </button>
          </div>

          <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Features</div>
            {settings.content.features.items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-lg border p-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <input
                  className="w-full rounded border px-2 py-1 text-xs"
                  value={item.title}
                  onChange={(event) => {
                    const next = [...settings.content.features.items]
                    next[index] = { ...item, title: event.target.value }
                    updateContent('features', { items: next })
                  }}
                />
                <textarea
                  rows={2}
                  className="mt-2 w-full rounded border px-2 py-1 text-xs"
                  value={item.description}
                  onChange={(event) => {
                    const next = [...settings.content.features.items]
                    next[index] = { ...item, description: event.target.value }
                    updateContent('features', { items: next })
                  }}
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-red-500 inline-flex items-center gap-1"
                  onClick={() => {
                    const next = settings.content.features.items.filter((_, idx) => idx !== index)
                    updateContent('features', { items: next })
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs inline-flex items-center gap-1 text-blue-600"
              onClick={() => {
                const next = [...settings.content.features.items, { title: 'New Feature', description: 'Feature description.' }]
                updateContent('features', { items: next })
              }}
            >
              <Plus className="h-3 w-3" /> Add feature
            </button>
          </div>

          <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Stats</div>
            {settings.content.stats.items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded-lg border p-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <input
                  className="w-full rounded border px-2 py-1 text-xs"
                  value={item.value}
                  onChange={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...item, value: event.target.value }
                    updateContent('stats', { items: next })
                  }}
                />
                <input
                  className="mt-2 w-full rounded border px-2 py-1 text-xs"
                  value={item.label}
                  onChange={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...item, label: event.target.value }
                    updateContent('stats', { items: next })
                  }}
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-red-500 inline-flex items-center gap-1"
                  onClick={() => {
                    const next = settings.content.stats.items.filter((_, idx) => idx !== index)
                    updateContent('stats', { items: next })
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs inline-flex items-center gap-1 text-blue-600"
              onClick={() => {
                const next = [...settings.content.stats.items, { value: '123', label: 'New Stat' }]
                updateContent('stats', { items: next })
              }}
            >
              <Plus className="h-3 w-3" /> Add stat
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Homepage'}
        </button>
      </aside>

      <main className="overflow-y-auto" style={pageStyle}>
        {settings.showHeader && (
          <header className="absolute inset-x-0 top-0 z-50">
            <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
              <div className="flex lg:flex-1">
                <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
                  <img src={brandLogo} alt={`${appName} Logo`} className="h-10 w-auto object-contain" />
                </Link>
              </div>
              <div className="flex lg:flex-1 items-center lg:justify-end space-x-4">
                <Link
                  href="/auth/login"
                  className="px-4 py-2 rounded-md text-sm transition-colors"
                  style={{ color: landingColors.text, backgroundColor: 'var(--color-secondary)', border: '1px solid var(--color-border)' }}
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2 rounded-md text-sm text-white transition-colors"
                  style={{ backgroundColor: landingColors.primary }}
                >
                  Get started
                </Link>
              </div>
            </nav>
          </header>
        )}

        <main className={`relative isolate px-6 pt-14 lg:px-8 ${layoutTone === 'minimal' ? 'pb-10' : ''}`}>
          {layoutTone === 'aurora' && (
            <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
              <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-blue-400 to-purple-500 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
            </div>
          )}

          {sections.map((section) => {
            switch (section.id) {
              case 'hero':
                return <div key={section.id}>{renderHero(section.layout)}</div>
              case 'courses':
                return <div key={section.id}>{renderCourses(section.layout)}</div>
              case 'features':
                return <div key={section.id}>{renderFeatures(section.layout)}</div>
              case 'stats':
                return <div key={section.id}>{renderStats(section.layout)}</div>
              case 'cta':
                return <div key={section.id}>{renderCta(section.layout)}</div>
              default:
                return null
            }
          })}

          {layoutTone === 'aurora' && (
            <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
              <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-blue-400 to-purple-500 opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" />
            </div>
          )}
        </main>
      </main>
    </div>
  )
}

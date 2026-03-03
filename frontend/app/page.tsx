'use client'

import { useAuth } from '../components/providers/AuthProvider'
import { useSetup } from '../components/providers/SetupProvider'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '../components/ui/Spinner'
import Link from 'next/link'
import logo from '@/assets/logo_blue.png'
import { getDashboardRouteForRole } from '@/lib/role-routing'
import { useTheme } from '@/components/providers/ThemeProvider'

type LandingSection = {
  id: string
  label: string
  enabled: boolean
  layout: string
}

type LandingSettings = {
  enabled: boolean
  layoutPreset: string
  showHeader: boolean
  sections: LandingSection[]
  content: {
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
  styles: {
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
  builder: {
    blocks: BuilderBlock[]
  }
  elementStyles: Record<string, ElementStyle>
}

type ElementStyle = {
  textColor?: string
  backgroundColor?: string
  backgroundType?: 'solid' | 'transparent' | 'gradient'
  gradientFrom?: string
  gradientTo?: string
  gradientAngle?: number
  fontSize?: number
  fontWeight?: number
  padding?: number
  borderRadius?: number
  textAlign?: 'left' | 'center' | 'right'
}

type BuilderBlock =
  | {
      id: string
      type: 'text'
      content: string
    }
  | {
      id: string
      type: 'button'
      text: string
      url: string
    }
  | {
      id: string
      type: 'image'
      src: string
      alt: string
    }
  | {
      id: string
      type: 'table'
      headers: string[]
      rows: string[][]
    }
  | {
      id: string
      type: 'columns'
      columns: BuilderBlock[][]
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
        { gradient: 'from-blue-500 to-blue-700', title: 'Full Stack Development', description: 'Master MERN stack, React, Node.js and build real-world applications' },
        { gradient: 'from-green-500 to-green-700', title: 'DevOps Engineering', description: 'Learn Docker, Kubernetes, AWS, CI/CD and infrastructure automation' },
        { gradient: 'from-purple-500 to-purple-700', title: 'Mobile Development', description: 'Build iOS and Android apps with React Native, Flutter and Swift' },
        { gradient: 'from-red-500 to-red-700', title: 'Data Science and AI', description: 'Master Python, Machine Learning, TensorFlow and data visualization' }
      ]
    },
    features: {
      title: 'Why Choose Us?',
      items: [
        { title: 'Industry Expert Instructors', description: 'Learn from professionals working at top tech companies with real-world experience.' },
        { title: 'Live Interactive Classes', description: 'Live sessions with code collaboration, whiteboard, and real-time doubt solving.' },
        { title: 'Career Support', description: 'Resume building, mock interviews, and placement assistance to launch your career.' }
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
      subheadline: 'Join thousands of students who have transformed their careers with industry-relevant courses.',
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
  },
  builder: {
    blocks: []
  },
  elementStyles: {}
}

export default function HomePage() {
  const { user, loading } = useAuth()
  const { branding, settings } = useSetup()
  const { theme } = useTheme()
  const router = useRouter()
  const appName = branding?.appName || 'Institute LMS'
  const brandLogo = branding?.logoUrl || logo.src

  const landingSettings = useMemo<LandingSettings>(() => {
    const fromSettings = settings?.publicLanding || {}
    const sections = Array.isArray(fromSettings.sections) && fromSettings.sections.length
      ? fromSettings.sections
      : defaultLandingSettings.sections
    return {
      ...defaultLandingSettings,
      ...fromSettings,
      sections,
      content: {
        ...defaultLandingSettings.content,
        ...(fromSettings.content || {}),
        hero: { ...defaultLandingSettings.content.hero, ...(fromSettings.content?.hero || {}) },
        courses: { ...defaultLandingSettings.content.courses, ...(fromSettings.content?.courses || {}) },
        features: { ...defaultLandingSettings.content.features, ...(fromSettings.content?.features || {}) },
        stats: { ...defaultLandingSettings.content.stats, ...(fromSettings.content?.stats || {}) },
        cta: { ...defaultLandingSettings.content.cta, ...(fromSettings.content?.cta || {}) }
      },
      styles: { ...defaultLandingSettings.styles, ...(fromSettings.styles || {}) },
      builder: {
        blocks: Array.isArray(fromSettings.builder?.blocks) ? fromSettings.builder.blocks : defaultLandingSettings.builder.blocks
      },
      elementStyles: fromSettings.elementStyles || {}
    }
  }, [settings])

  const allowCustomStyles = theme === 'system'
  const resolveThemeColor = (value: string, fallback: string) => (allowCustomStyles ? (value?.trim() ? value : fallback) : fallback)

  const landingColors = useMemo(() => {
    const styles = landingSettings.styles
    return {
      text: resolveThemeColor(styles.textColor, 'var(--color-text)'),
      secondaryText: resolveThemeColor(styles.secondaryTextColor, 'var(--color-text-secondary)'),
      heading: resolveThemeColor(styles.headingColor, resolveThemeColor(styles.textColor, 'var(--color-text)')),
      primary: resolveThemeColor(styles.primaryColor, 'var(--color-primary)'),
      accent: resolveThemeColor(styles.accentColor, 'var(--color-accent)')
    }
  }, [landingSettings.styles, allowCustomStyles])


  useEffect(() => {
    document.documentElement.classList.add('landing-scroll')
    document.body.classList.add('landing-scroll')
    return () => {
      document.documentElement.classList.remove('landing-scroll')
      document.body.classList.remove('landing-scroll')
    }
  }, [])

  useEffect(() => {
    if (!loading && user) {
      router.replace(getDashboardRouteForRole(user.role || user))
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  const layoutPreset = landingSettings.layoutPreset || 'aurora'
  const layoutTone = layoutPreset === 'minimal'
    ? 'minimal'
    : layoutPreset === 'editorial'
      ? 'editorial'
      : layoutPreset === 'classic'
        ? 'classic'
        : 'aurora'

  const sections = landingSettings.sections.filter((section) => section.enabled)
  const styles = landingSettings.styles
  const pageStyle: React.CSSProperties = {
    backgroundColor: resolveThemeColor(styles.pageBackground, 'var(--color-background)'),
    color: landingColors.text,
    fontFamily: allowCustomStyles ? (styles.fontFamily || undefined) : undefined,
    fontSize: allowCustomStyles && styles.baseFontSize ? `${styles.baseFontSize}px` : undefined
  }
  const headingStyle: React.CSSProperties = {
    color: landingColors.heading,
    fontFamily: allowCustomStyles ? (styles.headingFontFamily || styles.fontFamily || undefined) : undefined
  }
  const heroHeadlineStyle: React.CSSProperties = {
    ...headingStyle,
    fontSize: allowCustomStyles && styles.heroHeadingSize ? `${styles.heroHeadingSize}px` : undefined
  }
  const sectionHeadingStyle: React.CSSProperties = {
    ...headingStyle,
    fontSize: allowCustomStyles && styles.sectionHeadingSize ? `${styles.sectionHeadingSize}px` : undefined
  }

  const applyElementStyle = (id: string, baseStyle?: React.CSSProperties): React.CSSProperties => {
    if (!allowCustomStyles) {
      return baseStyle || {}
    }
    const style = landingSettings.elementStyles?.[id] || {}
    const backgroundType = style.backgroundType || 'solid'
    const backgroundImage = backgroundType === 'gradient' && style.gradientFrom && style.gradientTo
      ? `linear-gradient(${style.gradientAngle ?? 135}deg, ${style.gradientFrom}, ${style.gradientTo})`
      : undefined
    return {
      ...baseStyle,
      color: style.textColor ?? baseStyle?.color,
      backgroundColor: backgroundType === 'transparent'
        ? 'transparent'
        : style.backgroundColor ?? baseStyle?.backgroundColor,
      backgroundImage,
      fontSize: style.fontSize ? `${style.fontSize}px` : baseStyle?.fontSize,
      fontWeight: style.fontWeight ?? baseStyle?.fontWeight,
      padding: style.padding ? `${style.padding}px` : baseStyle?.padding,
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : baseStyle?.borderRadius,
      textAlign: style.textAlign ?? baseStyle?.textAlign
    }
  }

  const renderHero = (layout: string) => {
    const isSplit = layout === 'split' || layoutTone === 'editorial'
    const isStacked = layout === 'stacked'
    const hero = landingSettings.content.hero
    return (
      <section
        className={`mx-auto max-w-6xl py-24 sm:py-32 ${isSplit ? 'lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center' : ''}`}
        style={applyElementStyle('section.hero', { backgroundColor: resolveThemeColor(styles.heroBackground, 'transparent') })}
      >
        <div className={isSplit ? '' : 'text-center'}>
          <h1 className="font-bold tracking-tight sm:text-6xl" style={applyElementStyle('hero.headline', heroHeadlineStyle)}>
            {hero.headline}{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {appName}
            </span>
          </h1>
          <p className="mt-6 text-lg leading-8" style={applyElementStyle('hero.subheadline', { color: landingColors.secondaryText })}>
            {hero.subheadline}
          </p>
          <div className={`mt-10 flex ${isSplit ? 'justify-start' : 'justify-center'} gap-4 flex-wrap`}>
            <Link
              href={hero.primaryCtaUrl || '/auth/register'}
              className="rounded-md text-md px-6 py-2 text-white transition-colors"
              style={applyElementStyle('hero.primaryCta', { backgroundColor: landingColors.primary })}
            >
              {hero.primaryCtaText}
            </Link>
            <Link
              href={hero.secondaryCtaUrl || '/auth/login'}
              className="text-md font-semibold border px-6 py-2 rounded-md transition-colors"
              style={applyElementStyle('hero.secondaryCta', { color: landingColors.text, borderColor: landingColors.primary })}
            >
              {hero.secondaryCtaText}
            </Link>
          </div>
        </div>
        {isSplit && (
          <div className={`mt-10 lg:mt-0 ${isStacked ? 'lg:order-first' : ''}`}>
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
    const courses = landingSettings.content.courses
    return (
      <section className="mx-auto max-w-7xl px-6 lg:px-8 py-12" style={applyElementStyle('section.courses', { backgroundColor: resolveThemeColor(styles.coursesBackground, 'transparent') })}>
        <div className="mx-auto lg:text-center">
          <span
            className="inline-block px-4 py-1 font-semibold mb-4 text-sm rounded-full border border-white/20"
            style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: landingColors.accent }}
          >
            * Trending Technologies
          </span>
          <p className="mt-2 font-bold tracking-tight sm:text-4xl" style={applyElementStyle('courses.title', sectionHeadingStyle)}>
            {courses.title}
          </p>
          <p className="mt-4 text-lg" style={applyElementStyle('courses.subtitle', { color: landingColors.secondaryText })}>
            {courses.subtitle}
          </p>
        </div>
        <div className={`mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:mt-20 lg:mt-24 lg:max-w-none ${gridCols}`}>
          {courses.items.map((course, index) => (
            <div
              key={index}
              className={`overflow-hidden rounded-xl transition-all hover:shadow-md hover:-translate-y-1 ${cardLayout}`}
              style={applyElementStyle(`courses.item.${index}`, { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderWidth: '1px' })}
            >
              <div className={`h-28 ${layout === 'list' ? 'md:w-40 md:flex-shrink-0 md:h-full' : ''} bg-gradient-to-r ${course.gradient} flex items-center justify-center`}>
                <span className="text-white text-sm font-semibold">Course</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold" style={applyElementStyle(`courses.item.${index}.title`, { color: landingColors.text })}>{course.title}</h3>
                <p className="mt-2" style={applyElementStyle(`courses.item.${index}.desc`, { color: landingColors.secondaryText })}>{course.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/auth/register" className="inline-flex items-center font-semibold hover:opacity-80 transition-opacity" style={{ color: landingColors.primary }}>
            View All Courses
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    )
  }

  const renderFeatures = (layout: string) => {
    const isList = layout === 'list'
    const isSplit = layout === 'split'
    const features = landingSettings.content.features
    return (
      <section
        className="mx-auto max-w-7xl px-6 lg:px-8 py-24 rounded-2xl border"
        style={applyElementStyle('section.features', { backgroundColor: resolveThemeColor(styles.featuresBackground, 'var(--color-surface)'), borderColor: 'var(--color-border)' })}
      >
        <div className="mx-auto max-w-2xl lg:text-center">
          <span
            className="inline-block px-4 py-1 font-semibold mb-4 text-sm rounded-full border border-white/20"
            style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: landingColors.accent }}
          >
            * Learn Better
          </span>
          <p className="mt-2 font-bold tracking-tight sm:text-4xl" style={applyElementStyle('features.title', sectionHeadingStyle)}>
            {features.title}
          </p>
        </div>
        <div className={`mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 ${isSplit ? 'lg:grid lg:grid-cols-2 lg:gap-10 lg:max-w-5xl' : 'lg:max-w-none'}`}>
          <dl className={`grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 ${isList ? '' : 'lg:grid-cols-3'} ${isSplit ? 'lg:grid-cols-1' : ''}`}>
            {features.items.map((feature, index) => (
              <div key={index} className={`flex flex-col ${isList ? 'border-b pb-6' : ''}`} style={isList ? applyElementStyle(`features.item.${index}`, { borderColor: 'var(--color-border)' }) : applyElementStyle(`features.item.${index}`)}>
                <dt className="text-base font-semibold leading-7" style={applyElementStyle(`features.item.${index}.title`, { color: landingColors.text })}>
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: landingColors.primary }}>
                    <span className="text-white text-sm">★</span>
                  </div>
                  {feature.title}
                </dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7" style={applyElementStyle(`features.item.${index}.desc`, { color: landingColors.secondaryText })}>
                  <p className="flex-auto">{feature.description}</p>
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
    const stats = landingSettings.content.stats.items
    if (layout === 'tiles') {
      return (
        <section className="mx-auto max-w-7xl px-6 lg:px-8 py-24" style={applyElementStyle('section.stats', { backgroundColor: resolveThemeColor(styles.statsBackground, 'transparent') })}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={stat.label} className="rounded-2xl border p-6 text-center" style={applyElementStyle(`stats.item.${index}`, { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' })}>
                <div className="text-3xl font-bold" style={applyElementStyle(`stats.item.${index}.value`, { color: landingColors.primary })}>{stat.value}</div>
                <div className="mt-2 text-sm" style={applyElementStyle(`stats.item.${index}.label`, { color: landingColors.secondaryText })}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      )
    }
    return (
      <section className="mx-auto max-w-7xl px-6 lg:px-8 py-24" style={applyElementStyle('section.stats', { backgroundColor: resolveThemeColor(styles.statsBackground, 'transparent') })}>
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={stat.label} className="mx-auto flex max-w-xs flex-col gap-y-4" style={applyElementStyle(`stats.item.${index}`)}>
                <dt className="text-4xl font-bold leading-9 tracking-tight" style={applyElementStyle(`stats.item.${index}.value`, { color: landingColors.primary })}>
                  {stat.value}
                </dt>
                <dd className="text-base leading-7" style={applyElementStyle(`stats.item.${index}.label`, { color: landingColors.secondaryText })}>
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
    const cta = landingSettings.content.cta
    if (layout === 'boxed') {
      return (
        <section className="mx-auto max-w-6xl px-6 lg:px-8 mb-24" style={applyElementStyle('section.cta', { backgroundColor: resolveThemeColor(styles.ctaBackground, 'transparent') })}>
          <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <h2 className="text-3xl font-bold tracking-tight" style={applyElementStyle('cta.headline', { color: landingColors.text })}>
              {cta.headline}
            </h2>
            <p className="mt-4 text-lg leading-8" style={applyElementStyle('cta.subheadline', { color: landingColors.secondaryText })}>
              {cta.subheadline}
            </p>
            <div className="mt-8">
              <Link
                href={cta.buttonUrl || '/auth/register'}
                className="rounded-md px-6 py-3 text-lg font-semibold text-white shadow-sm hover:opacity-90 transition-all"
                style={applyElementStyle('cta.button', { backgroundColor: landingColors.primary })}
              >
                {cta.buttonText}
              </Link>
            </div>
          </div>
        </section>
      )
    }
    return (
      <section className="rounded-2xl shadow-xl mx-6 lg:mx-8 py-16 px-6 lg:px-8 mb-24" style={applyElementStyle('section.cta', { backgroundColor: resolveThemeColor(styles.ctaBackground, landingColors.primary) })}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl" style={applyElementStyle('cta.headline', { color: '#ffffff' })}>
            {cta.headline}
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/80" style={applyElementStyle('cta.subheadline', { color: 'rgba(255, 255, 255, 0.8)' })}>
            {cta.subheadline}
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href={cta.buttonUrl || '/auth/register'}
              className="rounded-md bg-white px-6 py-3 text-lg font-semibold shadow-sm hover:bg-opacity-90 transition-all"
              style={applyElementStyle('cta.button', { color: landingColors.primary })}
            >
              {cta.buttonText}
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const renderBuilderBlocks = (blocks: BuilderBlock[]) => {
    if (!blocks.length) return null
    return (
      <div className="space-y-6">
        {blocks.map((block) => (
          <div key={block.id} className="rounded-xl border border-transparent" style={applyElementStyle(block.id, { backgroundColor: 'transparent' })}>
            {block.type === 'text' && (
              <p className="text-base leading-7" style={applyElementStyle(block.id, { color: landingColors.text })}>
                {block.content}
              </p>
            )}
            {block.type === 'button' && (
              <Link
                href={block.url || '/auth/register'}
                className="inline-flex items-center rounded-md px-5 py-2 text-sm font-semibold text-white shadow-sm"
                style={applyElementStyle(block.id, { backgroundColor: landingColors.primary, color: '#ffffff' })}
              >
                {block.text}
              </Link>
            )}
            {block.type === 'image' && (
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                <img src={block.src} alt={block.alt} className="h-64 w-full object-cover" />
              </div>
            )}
            {block.type === 'table' && (
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {block.headers.map((header, index) => (
                        <th key={`${block.id}-header-${index}`} className="px-4 py-2 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${block.id}-row-${rowIndex}`} className="border-t">
                        {row.map((cell, cellIndex) => (
                          <td key={`${block.id}-cell-${rowIndex}-${cellIndex}`} className="px-4 py-3">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {block.type === 'columns' && (
              <div className="grid gap-6 md:grid-cols-2">
                {block.columns.map((column, columnIndex) => (
                  <div key={`${block.id}-col-${columnIndex}`} className="space-y-6">
                    {renderBuilderBlocks(column)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (!landingSettings.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{appName}</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            The public landing page is currently disabled. Please sign in to continue.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/auth/login" className="px-4 py-2 rounded-md text-sm text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      {landingSettings.showHeader && (
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

      <main className="relative isolate px-6 pt-14 lg:px-8 pb-0">
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

        {landingSettings.builder.blocks.length > 0 && (
          <section className="mx-auto max-w-6xl px-6 lg:px-8 pt-10 pb-0">
            {renderBuilderBlocks(landingSettings.builder.blocks)}
          </section>
        )}

        {layoutTone === 'aurora' && (
          <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
            {/*             <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-blue-400 to-purple-500 opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" />
 */}
          </div>
        )}
      </main>
    </div>
  )
}

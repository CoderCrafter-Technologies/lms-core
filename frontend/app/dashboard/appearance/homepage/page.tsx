
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { ChevronLeft, LayoutPanelTop, Plus, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useSetup } from '@/components/providers/SetupProvider'
import { useTheme } from '@/components/providers/ThemeProvider'

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

type SelectedTarget = {
  id: string
  label: string
  kind: 'section' | 'text' | 'item' | 'block'
  meta?: {
    sectionId?: LandingSection['id']
    itemIndex?: number
    blockId?: string
  }
}

type AddTarget =
  | { scope: 'root' }
  | { scope: 'column'; blockId: string; columnIndex: number }

type InlineToolbarState = {
  x: number
  y: number
  visible: boolean
}

type LandingSettings = {
  enabled: boolean
  layoutPreset: string
  showHeader: boolean
  sections: LandingSection[]
  content: LandingContent
  styles: LandingStyles
  builder: {
    blocks: BuilderBlock[]
  }
  elementStyles: Record<string, ElementStyle>
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
  },
  builder: {
    blocks: []
  },
  elementStyles: {}
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
      : defaultLandingSettings.sections,
    builder: {
      blocks: Array.isArray(settings.builder?.blocks) ? settings.builder?.blocks as BuilderBlock[] : defaultLandingSettings.builder.blocks
    },
    elementStyles: settings.elementStyles || {}
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

const makeId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
  ? crypto.randomUUID()
  : `id-${Math.random().toString(36).slice(2, 10)}`

const updateBlocksById = (blocks: BuilderBlock[], id: string, updater: (block: BuilderBlock) => BuilderBlock): BuilderBlock[] => {
  return blocks.map((block) => {
    if (block.id === id) return updater(block)
    if (block.type === 'columns') {
      return {
        ...block,
        columns: block.columns.map((column) => updateBlocksById(column, id, updater))
      }
    }
    return block
  })
}

const removeBlockById = (blocks: BuilderBlock[], id: string): BuilderBlock[] => {
  const filtered = blocks.filter((block) => block.id !== id)
  return filtered.map((block) => {
    if (block.type === 'columns') {
      return {
        ...block,
        columns: block.columns.map((column) => removeBlockById(column, id))
      }
    }
    return block
  })
}

const addBlockToColumn = (blocks: BuilderBlock[], columnBlockId: string, columnIndex: number, newBlock: BuilderBlock): BuilderBlock[] => {
  return blocks.map((block) => {
    if (block.id === columnBlockId && block.type === 'columns') {
      const nextColumns = block.columns.map((column, idx) => (idx === columnIndex ? [...column, newBlock] : column))
      return { ...block, columns: nextColumns }
    }
    if (block.type === 'columns') {
      return {
        ...block,
        columns: block.columns.map((column) => addBlockToColumn(column, columnBlockId, columnIndex, newBlock))
      }
    }
    return block
  })
}

const findBlockById = (blocks: BuilderBlock[], id: string): BuilderBlock | undefined => {
  for (const block of blocks) {
    if (block.id === id) return block
    if (block.type === 'columns') {
      for (const column of block.columns) {
        const found = findBlockById(column, id)
        if (found) return found
      }
    }
  }
  return undefined
}

export default function HomepageAppearancePage() {
  const [settings, setSettings] = useState<LandingSettings>(defaultLandingSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selected, setSelected] = useState<SelectedTarget | null>(null)
  const [activeAddTarget, setActiveAddTarget] = useState<AddTarget | null>(null)
  const [inlineToolbar, setInlineToolbar] = useState<InlineToolbarState>({ x: 0, y: 0, visible: false })
  const inlineRangeRef = useRef<Range | null>(null)
  const { branding } = useSetup()
  const { theme } = useTheme()

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

  const getElementStyle = (id: string) => settings.elementStyles[id] || {}

  const updateElementStyle = (id: string, patch: Partial<ElementStyle>) => {
    setSettings((prev) => ({
      ...prev,
      elementStyles: {
        ...prev.elementStyles,
        [id]: { ...(prev.elementStyles[id] || {}), ...patch }
      }
    }))
  }

  const addBuilderBlock = (target: AddTarget, block: BuilderBlock) => {
    setSettings((prev) => {
      if (target.scope === 'root') {
        return { ...prev, builder: { blocks: [...prev.builder.blocks, block] } }
      }
      return {
        ...prev,
        builder: {
          blocks: addBlockToColumn(prev.builder.blocks, target.blockId, target.columnIndex, block)
        }
      }
    })
    setActiveAddTarget(null)
    setSelected({ id: block.id, kind: 'block', label: block.type === 'text' ? 'Text Block' : block.type === 'button' ? 'Button' : block.type === 'image' ? 'Image' : block.type === 'table' ? 'Table' : 'Columns', meta: { blockId: block.id } })
  }

  const updateBuilderBlock = (id: string, patch: Partial<BuilderBlock>) => {
    setSettings((prev) => ({
      ...prev,
      builder: {
        blocks: updateBlocksById(prev.builder.blocks, id, (block) => ({ ...block, ...patch } as BuilderBlock))
      }
    }))
  }

  const updateImageFromFile = (blockId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        updateBuilderBlock(blockId, { src: result } as BuilderBlock)
      }
    }
    reader.readAsDataURL(file)
  }

  const createBlock = (type: BuilderBlock['type']): BuilderBlock => {
    const id = makeId()
    if (type === 'text') return { id, type: 'text', content: 'Edit this text.' }
    if (type === 'button') return { id, type: 'button', text: 'Click me', url: '/auth/register' }
    if (type === 'image') return { id, type: 'image', src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80', alt: 'Team working' }
    if (type === 'table') return { id, type: 'table', headers: ['Column A', 'Column B'], rows: [['Row 1', 'Row 1'], ['Row 2', 'Row 2']] }
    return { id, type: 'columns', columns: [[], []] }
  }

  const deleteSelected = () => {
    if (!selected) return
    if (selected.kind === 'block' && selected.meta?.blockId) {
      setSettings((prev) => ({
        ...prev,
        builder: { blocks: removeBlockById(prev.builder.blocks, selected.meta!.blockId!) }
      }))
      setSelected(null)
      return
    }
    if (selected.kind === 'item' && selected.meta?.sectionId && typeof selected.meta.itemIndex === 'number') {
      if (selected.meta.sectionId === 'courses') {
        const next = settings.content.courses.items.filter((_, idx) => idx !== selected.meta!.itemIndex!)
        updateContent('courses', { items: next })
      }
      if (selected.meta.sectionId === 'features') {
        const next = settings.content.features.items.filter((_, idx) => idx !== selected.meta!.itemIndex!)
        updateContent('features', { items: next })
      }
      if (selected.meta.sectionId === 'stats') {
        const next = settings.content.stats.items.filter((_, idx) => idx !== selected.meta!.itemIndex!)
        updateContent('stats', { items: next })
      }
      setSelected(null)
      return
    }
    if (selected.kind === 'section' && selected.meta?.sectionId) {
      updateSection(selected.meta.sectionId, { enabled: false })
      setSelected(null)
      return
    }
    if (selected.kind === 'text' && selected.meta?.sectionId) {
      const id = selected.id
      if (id === 'hero.headline') updateContent('hero', { headline: '' })
      if (id === 'hero.subheadline') updateContent('hero', { subheadline: '' })
      if (id === 'hero.primaryCta') updateContent('hero', { primaryCtaText: '' })
      if (id === 'hero.secondaryCta') updateContent('hero', { secondaryCtaText: '' })
      if (id === 'courses.title') updateContent('courses', { title: '' })
      if (id === 'courses.subtitle') updateContent('courses', { subtitle: '' })
      if (id === 'features.title') updateContent('features', { title: '' })
      if (id === 'cta.headline') updateContent('cta', { headline: '' })
      if (id === 'cta.subheadline') updateContent('cta', { subheadline: '' })
      if (id === 'cta.button') updateContent('cta', { buttonText: '' })

      if (id.startsWith('courses.item.')) {
        const parts = id.split('.')
        const index = Number(parts[2])
        if (!Number.isNaN(index) && settings.content.courses.items[index]) {
          const next = [...settings.content.courses.items]
          if (parts[3] === 'title') next[index] = { ...next[index], title: '' }
          if (parts[3] === 'desc') next[index] = { ...next[index], description: '' }
          updateContent('courses', { items: next })
        }
      }

      if (id.startsWith('features.item.')) {
        const parts = id.split('.')
        const index = Number(parts[2])
        if (!Number.isNaN(index) && settings.content.features.items[index]) {
          const next = [...settings.content.features.items]
          if (parts[3] === 'title') next[index] = { ...next[index], title: '' }
          if (parts[3] === 'desc') next[index] = { ...next[index], description: '' }
          updateContent('features', { items: next })
        }
      }

      if (id.startsWith('stats.item.')) {
        const parts = id.split('.')
        const index = Number(parts[2])
        if (!Number.isNaN(index) && settings.content.stats.items[index]) {
          const next = [...settings.content.stats.items]
          if (parts[3] === 'value') next[index] = { ...next[index], value: '' }
          if (parts[3] === 'label') next[index] = { ...next[index], label: '' }
          updateContent('stats', { items: next })
        }
      }

      setSelected(null)
    }
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

  const allowCustomStyles = theme === 'system'
  const resolveThemeColor = (value: string, fallback: string) => (allowCustomStyles ? resolveColor(value, fallback) : fallback)

  const landingColors = useMemo(() => ({
    text: resolveThemeColor(settings.styles.textColor, 'var(--color-text)'),
    secondaryText: resolveThemeColor(settings.styles.secondaryTextColor, 'var(--color-text-secondary)'),
    heading: resolveThemeColor(settings.styles.headingColor, resolveThemeColor(settings.styles.textColor, 'var(--color-text)')),
    primary: resolveThemeColor(settings.styles.primaryColor, 'var(--color-primary)'),
    accent: resolveThemeColor(settings.styles.accentColor, 'var(--color-accent)')
  }), [settings.styles, allowCustomStyles])

  const layoutTone = settings.layoutPreset === 'minimal'
    ? 'minimal'
    : settings.layoutPreset === 'editorial'
      ? 'editorial'
      : settings.layoutPreset === 'classic'
        ? 'classic'
        : 'aurora'

  const sections = settings.sections.filter((section) => section.enabled)

  const pageStyle = {
    backgroundColor: resolveThemeColor(settings.styles.pageBackground, 'var(--color-background)'),
    color: landingColors.text,
    fontFamily: allowCustomStyles ? (settings.styles.fontFamily || undefined) : undefined,
    fontSize: allowCustomStyles && settings.styles.baseFontSize ? `${settings.styles.baseFontSize}px` : undefined
  } as React.CSSProperties

  const headingStyle = {
    color: landingColors.heading,
    fontFamily: allowCustomStyles ? (settings.styles.headingFontFamily || settings.styles.fontFamily || undefined) : undefined
  } as React.CSSProperties

  const heroHeadlineStyle = {
    ...headingStyle,
    fontSize: allowCustomStyles && settings.styles.heroHeadingSize ? `${settings.styles.heroHeadingSize}px` : undefined
  } as React.CSSProperties

  const sectionHeadingStyle = {
    ...headingStyle,
    fontSize: allowCustomStyles && settings.styles.sectionHeadingSize ? `${settings.styles.sectionHeadingSize}px` : undefined
  } as React.CSSProperties

  const applyElementStyle = (id: string, baseStyle?: React.CSSProperties): React.CSSProperties => {
    if (!allowCustomStyles) {
      return baseStyle || {}
    }
    const style = getElementStyle(id)
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

  const updateInlineSelection = () => {
    if (typeof window === 'undefined') return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setInlineToolbar((prev) => ({ ...prev, visible: false }))
      return
    }
    const range = selection.getRangeAt(0)
    if (range.collapsed) {
      setInlineToolbar((prev) => ({ ...prev, visible: false }))
      return
    }
    const container = range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement
    const editable = container?.closest('[contenteditable="true"]')
    if (!editable) {
      setInlineToolbar((prev) => ({ ...prev, visible: false }))
      return
    }
    const rect = range.getBoundingClientRect()
    inlineRangeRef.current = range
    setInlineToolbar({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      visible: true
    })
  }

  const applyInlineStyleToSelection = (style: Partial<CSSStyleDeclaration>) => {
    if (typeof window === 'undefined') return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (range.collapsed) return
    const container = range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement
    const editable = container?.closest('[contenteditable="true"]')
    if (!editable) return

    const wrapper = document.createElement('span')
    Object.assign(wrapper.style, style)
    const contents = range.extractContents()
    wrapper.appendChild(contents)
    range.insertNode(wrapper)
    selection.removeAllRanges()
    const newRange = document.createRange()
    newRange.selectNodeContents(wrapper)
    selection.addRange(newRange)
    updateInlineSelection()
  }

  const selectedBlock = selected?.kind === 'block' && selected.meta?.blockId
    ? findBlockById(settings.builder.blocks, selected.meta.blockId)
    : undefined

  const selectElement = (event: React.MouseEvent, target: SelectedTarget) => {
    event.stopPropagation()
    setSelected(target)
    setActiveAddTarget(null)
  }

  const selectableClass = (id: string) => (
    selected?.id === id
      ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white'
      : 'hover:ring-1 hover:ring-blue-300 hover:ring-offset-2 hover:ring-offset-white'
  )

  const renderHero = (layout: string) => {
    const isSplit = layout === 'split' || layoutTone === 'editorial'
    return (
      <section
        className={`mx-auto max-w-6xl py-24 sm:py-28 ${isSplit ? 'lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center' : ''} ${selectableClass('section.hero')}`}
        style={applyElementStyle('section.hero', { backgroundColor: resolveThemeColor(settings.styles.heroBackground, 'transparent') })}
        onClick={(event) => selectElement(event, { id: 'section.hero', kind: 'section', label: 'Hero Section', meta: { sectionId: 'hero' } })}
      >
        <div className={isSplit ? '' : 'text-center'}>
          <h1
            className={`font-bold tracking-tight sm:text-6xl ${selectableClass('hero.headline')}`}
            style={applyElementStyle('hero.headline', heroHeadlineStyle)}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('hero', { headline: event.currentTarget.innerText.trim() })}
            onKeyDown={stopEnter}
            onClick={(event) => selectElement(event, { id: 'hero.headline', kind: 'text', label: 'Hero Headline', meta: { sectionId: 'hero' } })}
          >
            {settings.content.hero.headline}{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {appName}
            </span>
          </h1>
          <p
            className={`mt-6 text-lg leading-8 ${selectableClass('hero.subheadline')}`}
            style={applyElementStyle('hero.subheadline', { color: landingColors.secondaryText })}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('hero', { subheadline: event.currentTarget.innerText.trim() })}
            onClick={(event) => selectElement(event, { id: 'hero.subheadline', kind: 'text', label: 'Hero Subheadline', meta: { sectionId: 'hero' } })}
          >
            {settings.content.hero.subheadline}
          </p>
          <div className={`mt-10 flex ${isSplit ? 'justify-start' : 'justify-center'} gap-4 flex-wrap`}>
            <Link
              href={settings.content.hero.primaryCtaUrl || '/auth/register'}
              className={`rounded-md text-md px-6 py-2 text-white transition-colors ${selectableClass('hero.primaryCta')}`}
              style={applyElementStyle('hero.primaryCta', { backgroundColor: landingColors.primary })}
              onClick={(event) => event.preventDefault()}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => updateContent('hero', { primaryCtaText: event.currentTarget.innerText.trim() })}
                onKeyDown={stopEnter}
                onClick={(event) => selectElement(event, { id: 'hero.primaryCta', kind: 'text', label: 'Primary CTA', meta: { sectionId: 'hero' } })}
              >
                {settings.content.hero.primaryCtaText}
              </span>
            </Link>
            <Link
              href={settings.content.hero.secondaryCtaUrl || '/auth/login'}
              className={`text-md font-semibold border px-6 py-2 rounded-md transition-colors ${selectableClass('hero.secondaryCta')}`}
              style={applyElementStyle('hero.secondaryCta', { color: landingColors.text, borderColor: landingColors.primary })}
              onClick={(event) => event.preventDefault()}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => updateContent('hero', { secondaryCtaText: event.currentTarget.innerText.trim() })}
                onKeyDown={stopEnter}
                onClick={(event) => selectElement(event, { id: 'hero.secondaryCta', kind: 'text', label: 'Secondary CTA', meta: { sectionId: 'hero' } })}
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
      <section
        className={`mx-auto max-w-7xl px-6 lg:px-8 py-16 ${selectableClass('section.courses')}`}
        style={applyElementStyle('section.courses', { backgroundColor: resolveThemeColor(settings.styles.coursesBackground, 'transparent') })}
        onClick={(event) => selectElement(event, { id: 'section.courses', kind: 'section', label: 'Courses Section', meta: { sectionId: 'courses' } })}
      >
        <div className="mx-auto lg:text-center">
          <span
            className="inline-block px-4 py-1 font-semibold mb-4 text-sm rounded-full border border-white/20"
            style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: landingColors.accent }}
          >
            * Trending Technologies
          </span>
          <p
            className={`mt-2 font-bold tracking-tight sm:text-4xl ${selectableClass('courses.title')}`}
            style={applyElementStyle('courses.title', sectionHeadingStyle)}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('courses', { title: event.currentTarget.innerText.trim() })}
            onKeyDown={stopEnter}
            onClick={(event) => selectElement(event, { id: 'courses.title', kind: 'text', label: 'Courses Title', meta: { sectionId: 'courses' } })}
          >
            {settings.content.courses.title}
          </p>
          <p
            className={`mt-4 text-lg ${selectableClass('courses.subtitle')}`}
            style={applyElementStyle('courses.subtitle', { color: landingColors.secondaryText })}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('courses', { subtitle: event.currentTarget.innerText.trim() })}
            onClick={(event) => selectElement(event, { id: 'courses.subtitle', kind: 'text', label: 'Courses Subtitle', meta: { sectionId: 'courses' } })}
          >
            {settings.content.courses.subtitle}
          </p>
        </div>
        <div className={`mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none ${gridCols}`}>
          {settings.content.courses.items.map((course, index) => (
            <div
              key={`${course.title}-${index}`}
              className={`relative overflow-hidden rounded-xl transition-all hover:shadow-md hover:-translate-y-1 ${cardLayout} ${selectableClass(`courses.item.${index}`)}`}
              style={applyElementStyle(`courses.item.${index}`, { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderWidth: '1px' })}
              onClick={(event) => selectElement(event, { id: `courses.item.${index}`, kind: 'item', label: `Course Item ${index + 1}`, meta: { sectionId: 'courses', itemIndex: index } })}
            >
              {selected?.id === `courses.item.${index}` && (
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full bg-white p-2 shadow-md"
                  onClick={(event) => {
                    event.stopPropagation()
                    deleteSelected()
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              )}
              <div className={`h-28 ${layout === 'list' ? 'md:w-40 md:flex-shrink-0 md:h-full' : ''} bg-gradient-to-r ${course.gradient} flex items-center justify-center`}>
                <span className="text-white text-sm font-semibold">Course</span>
              </div>
              <div className="p-6 space-y-2">
                <h3
                  className={`text-xl font-bold ${selectableClass(`courses.item.${index}.title`)}`}
                  style={applyElementStyle(`courses.item.${index}.title`, { color: landingColors.text })}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.courses.items]
                    next[index] = { ...course, title: event.currentTarget.innerText.trim() }
                    updateContent('courses', { items: next })
                  }}
                  onKeyDown={stopEnter}
                  onClick={(event) => selectElement(event, { id: `courses.item.${index}.title`, kind: 'text', label: `Course Title ${index + 1}`, meta: { sectionId: 'courses', itemIndex: index } })}
                >
                  {course.title}
                </h3>
                <p
                  className={selectableClass(`courses.item.${index}.desc`)}
                  style={applyElementStyle(`courses.item.${index}.desc`, { color: landingColors.secondaryText })}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.courses.items]
                    next[index] = { ...course, description: event.currentTarget.innerText.trim() }
                    updateContent('courses', { items: next })
                  }}
                  onClick={(event) => selectElement(event, { id: `courses.item.${index}.desc`, kind: 'text', label: `Course Description ${index + 1}`, meta: { sectionId: 'courses', itemIndex: index } })}
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
        className={`mx-auto max-w-7xl px-6 lg:px-8 py-20 rounded-2xl border ${selectableClass('section.features')}`}
        style={applyElementStyle('section.features', { backgroundColor: resolveThemeColor(settings.styles.featuresBackground, 'var(--color-surface)'), borderColor: 'var(--color-border)' })}
        onClick={(event) => selectElement(event, { id: 'section.features', kind: 'section', label: 'Features Section', meta: { sectionId: 'features' } })}
      >
        <div className="mx-auto max-w-2xl lg:text-center">
          <span
            className="inline-block px-4 py-1 font-semibold mb-4 text-sm rounded-full border border-white/20"
            style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: landingColors.accent }}
          >
            * Learn Better
          </span>
          <p
            className={`mt-2 font-bold tracking-tight sm:text-4xl ${selectableClass('features.title')}`}
            style={applyElementStyle('features.title', sectionHeadingStyle)}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('features', { title: event.currentTarget.innerText.trim() })}
            onKeyDown={stopEnter}
            onClick={(event) => selectElement(event, { id: 'features.title', kind: 'text', label: 'Features Title', meta: { sectionId: 'features' } })}
          >
            {settings.content.features.title}
          </p>
        </div>
        <div className={`mx-auto mt-12 max-w-2xl ${isSplit ? 'lg:grid lg:grid-cols-2 lg:gap-10 lg:max-w-5xl' : 'lg:max-w-none'}`}>
          <dl className={`grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 ${isList ? '' : 'lg:grid-cols-3'} ${isSplit ? 'lg:grid-cols-1' : ''}`}>
            {settings.content.features.items.map((feature, index) => (
              <div
                key={`${feature.title}-${index}`}
                className={`relative flex flex-col ${isList ? 'border-b pb-6' : ''} ${selectableClass(`features.item.${index}`)}`}
                style={isList ? applyElementStyle(`features.item.${index}`, { borderColor: 'var(--color-border)' }) : applyElementStyle(`features.item.${index}`)}
                onClick={(event) => selectElement(event, { id: `features.item.${index}`, kind: 'item', label: `Feature Item ${index + 1}`, meta: { sectionId: 'features', itemIndex: index } })}
              >
                {selected?.id === `features.item.${index}` && (
                  <button
                    type="button"
                    className="absolute right-0 top-0 rounded-full bg-white p-2 shadow-md"
                    onClick={(event) => {
                      event.stopPropagation()
                      deleteSelected()
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                )}
                <dt className="text-base font-semibold leading-7" style={applyElementStyle(`features.item.${index}.title`, { color: landingColors.text })}>
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: landingColors.primary }}>
                    <span className="text-white text-sm">★</span>
                  </div>
                  <span
                    className={selectableClass(`features.item.${index}.title`)}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => {
                      const next = [...settings.content.features.items]
                      next[index] = { ...feature, title: event.currentTarget.innerText.trim() }
                      updateContent('features', { items: next })
                    }}
                    onKeyDown={stopEnter}
                    onClick={(event) => selectElement(event, { id: `features.item.${index}.title`, kind: 'text', label: `Feature Title ${index + 1}`, meta: { sectionId: 'features', itemIndex: index } })}
                  >
                    {feature.title}
                  </span>
                </dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7" style={applyElementStyle(`features.item.${index}.desc`, { color: landingColors.secondaryText })}>
                  <p
                    className={`flex-auto ${selectableClass(`features.item.${index}.desc`)}`}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => {
                      const next = [...settings.content.features.items]
                      next[index] = { ...feature, description: event.currentTarget.innerText.trim() }
                      updateContent('features', { items: next })
                    }}
                    onClick={(event) => selectElement(event, { id: `features.item.${index}.desc`, kind: 'text', label: `Feature Description ${index + 1}`, meta: { sectionId: 'features', itemIndex: index } })}
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
        <section
          className={`mx-auto max-w-7xl px-6 lg:px-8 py-20 ${selectableClass('section.stats')}`}
          style={applyElementStyle('section.stats', { backgroundColor: resolveThemeColor(settings.styles.statsBackground, 'transparent') })}
          onClick={(event) => selectElement(event, { id: 'section.stats', kind: 'section', label: 'Stats Section', meta: { sectionId: 'stats' } })}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {settings.content.stats.items.map((stat, index) => (
              <div
                key={`${stat.label}-${index}`}
                className={`relative rounded-2xl border p-6 text-center ${selectableClass(`stats.item.${index}`)}`}
                style={applyElementStyle(`stats.item.${index}`, { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' })}
                onClick={(event) => selectElement(event, { id: `stats.item.${index}`, kind: 'item', label: `Stat ${index + 1}`, meta: { sectionId: 'stats', itemIndex: index } })}
              >
                {selected?.id === `stats.item.${index}` && (
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-full bg-white p-2 shadow-md"
                    onClick={(event) => {
                      event.stopPropagation()
                      deleteSelected()
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                )}
                <div
                  className={`text-3xl font-bold ${selectableClass(`stats.item.${index}.value`)}`}
                  style={applyElementStyle(`stats.item.${index}.value`, { color: landingColors.primary })}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...stat, value: event.currentTarget.innerText.trim() }
                    updateContent('stats', { items: next })
                  }}
                  onKeyDown={stopEnter}
                  onClick={(event) => selectElement(event, { id: `stats.item.${index}.value`, kind: 'text', label: `Stat Value ${index + 1}`, meta: { sectionId: 'stats', itemIndex: index } })}
                >
                  {stat.value}
                </div>
                <div
                  className={`mt-2 text-sm ${selectableClass(`stats.item.${index}.label`)}`}
                  style={applyElementStyle(`stats.item.${index}.label`, { color: landingColors.secondaryText })}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...stat, label: event.currentTarget.innerText.trim() }
                    updateContent('stats', { items: next })
                  }}
                  onKeyDown={stopEnter}
                  onClick={(event) => selectElement(event, { id: `stats.item.${index}.label`, kind: 'text', label: `Stat Label ${index + 1}`, meta: { sectionId: 'stats', itemIndex: index } })}
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
      <section
        className={`mx-auto max-w-7xl px-6 lg:px-8 py-20 ${selectableClass('section.stats')}`}
        style={applyElementStyle('section.stats', { backgroundColor: resolveThemeColor(settings.styles.statsBackground, 'transparent') })}
        onClick={(event) => selectElement(event, { id: 'section.stats', kind: 'section', label: 'Stats Section', meta: { sectionId: 'stats' } })}
      >
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
            {settings.content.stats.items.map((stat, index) => (
              <div
                key={`${stat.label}-${index}`}
                className={`relative mx-auto flex max-w-xs flex-col gap-y-4 ${selectableClass(`stats.item.${index}`)}`}
                style={applyElementStyle(`stats.item.${index}`)}
                onClick={(event) => selectElement(event, { id: `stats.item.${index}`, kind: 'item', label: `Stat ${index + 1}`, meta: { sectionId: 'stats', itemIndex: index } })}
              >
                {selected?.id === `stats.item.${index}` && (
                  <button
                    type="button"
                    className="absolute -right-2 -top-2 rounded-full bg-white p-2 shadow-md"
                    onClick={(event) => {
                      event.stopPropagation()
                      deleteSelected()
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                )}
                <dt
                  className={`text-4xl font-bold leading-9 tracking-tight ${selectableClass(`stats.item.${index}.value`)}`}
                  style={applyElementStyle(`stats.item.${index}.value`, { color: landingColors.primary })}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...stat, value: event.currentTarget.innerText.trim() }
                    updateContent('stats', { items: next })
                  }}
                  onKeyDown={stopEnter}
                  onClick={(event) => selectElement(event, { id: `stats.item.${index}.value`, kind: 'text', label: `Stat Value ${index + 1}`, meta: { sectionId: 'stats', itemIndex: index } })}
                >
                  {stat.value}
                </dt>
                <dd
                  className={`text-base leading-7 ${selectableClass(`stats.item.${index}.label`)}`}
                  style={applyElementStyle(`stats.item.${index}.label`, { color: landingColors.secondaryText })}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    const next = [...settings.content.stats.items]
                    next[index] = { ...stat, label: event.currentTarget.innerText.trim() }
                    updateContent('stats', { items: next })
                  }}
                  onKeyDown={stopEnter}
                  onClick={(event) => selectElement(event, { id: `stats.item.${index}.label`, kind: 'text', label: `Stat Label ${index + 1}`, meta: { sectionId: 'stats', itemIndex: index } })}
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
        <section
          className={`mx-auto max-w-6xl px-6 lg:px-8 mb-8 ${selectableClass('section.cta')}`}
          style={applyElementStyle('section.cta', { backgroundColor: resolveThemeColor(settings.styles.ctaBackground, 'transparent') })}
          onClick={(event) => selectElement(event, { id: 'section.cta', kind: 'section', label: 'CTA Section', meta: { sectionId: 'cta' } })}
        >
          <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <h2
              className={`text-3xl font-bold tracking-tight ${selectableClass('cta.headline')}`}
              style={applyElementStyle('cta.headline', { color: landingColors.text })}
              contentEditable
              suppressContentEditableWarning
              onBlur={(event) => updateContent('cta', { headline: event.currentTarget.innerText.trim() })}
              onKeyDown={stopEnter}
              onClick={(event) => selectElement(event, { id: 'cta.headline', kind: 'text', label: 'CTA Headline', meta: { sectionId: 'cta' } })}
            >
              {settings.content.cta.headline}
            </h2>
            <p
              className={`mt-4 text-lg leading-8 ${selectableClass('cta.subheadline')}`}
              style={applyElementStyle('cta.subheadline', { color: landingColors.secondaryText })}
              contentEditable
              suppressContentEditableWarning
              onBlur={(event) => updateContent('cta', { subheadline: event.currentTarget.innerText.trim() })}
              onClick={(event) => selectElement(event, { id: 'cta.subheadline', kind: 'text', label: 'CTA Subheadline', meta: { sectionId: 'cta' } })}
            >
              {settings.content.cta.subheadline}
            </p>
            <div className="mt-8">
              <Link
                href={settings.content.cta.buttonUrl || '/auth/register'}
                className={`rounded-md px-6 py-3 text-lg font-semibold text-white shadow-sm hover:opacity-90 transition-all ${selectableClass('cta.button')}`}
                style={applyElementStyle('cta.button', { backgroundColor: landingColors.primary })}
                onClick={(event) => event.preventDefault()}
              >
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => updateContent('cta', { buttonText: event.currentTarget.innerText.trim() })}
                  onKeyDown={stopEnter}
                  onClick={(event) => selectElement(event, { id: 'cta.button', kind: 'text', label: 'CTA Button', meta: { sectionId: 'cta' } })}
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
      <section
        className={`rounded-2xl shadow-xl mx-6 lg:mx-8 py-16 px-6 lg:px-8 mb-8 ${selectableClass('section.cta')}`}
        style={applyElementStyle('section.cta', { backgroundColor: resolveThemeColor(settings.styles.ctaBackground, landingColors.primary) })}
        onClick={(event) => selectElement(event, { id: 'section.cta', kind: 'section', label: 'CTA Section', meta: { sectionId: 'cta' } })}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className={`text-3xl font-bold tracking-tight text-white sm:text-4xl ${selectableClass('cta.headline')}`}
            style={applyElementStyle('cta.headline', { color: '#ffffff' })}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('cta', { headline: event.currentTarget.innerText.trim() })}
            onKeyDown={stopEnter}
            onClick={(event) => selectElement(event, { id: 'cta.headline', kind: 'text', label: 'CTA Headline', meta: { sectionId: 'cta' } })}
          >
            {settings.content.cta.headline}
          </h2>
          <p
            className={`mt-4 text-lg leading-8 text-white/80 ${selectableClass('cta.subheadline')}`}
            style={applyElementStyle('cta.subheadline', { color: 'rgba(255, 255, 255, 0.8)' })}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => updateContent('cta', { subheadline: event.currentTarget.innerText.trim() })}
            onClick={(event) => selectElement(event, { id: 'cta.subheadline', kind: 'text', label: 'CTA Subheadline', meta: { sectionId: 'cta' } })}
          >
            {settings.content.cta.subheadline}
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href={settings.content.cta.buttonUrl || '/auth/register'}
              className={`rounded-md bg-white px-6 py-3 text-lg font-semibold shadow-sm hover:bg-opacity-90 transition-all ${selectableClass('cta.button')}`}
              style={applyElementStyle('cta.button', { color: landingColors.primary })}
              onClick={(event) => event.preventDefault()}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => updateContent('cta', { buttonText: event.currentTarget.innerText.trim() })}
                onKeyDown={stopEnter}
                onClick={(event) => selectElement(event, { id: 'cta.button', kind: 'text', label: 'CTA Button', meta: { sectionId: 'cta' } })}
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

  const renderAddZone = (target: AddTarget, label: string) => {
    const isActive = target.scope === 'root'
      ? activeAddTarget?.scope === 'root'
      : activeAddTarget?.scope === 'column' && activeAddTarget.blockId === target.blockId && activeAddTarget.columnIndex === target.columnIndex
    return (
      <div className="relative mt-6">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setActiveAddTarget(target)
          }}
          className="w-full rounded-xl border border-dashed px-4 py-6 text-sm font-semibold text-blue-600 hover:bg-blue-50/60 transition"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> {label}
          </span>
        </button>
        {isActive && (
          <div className="absolute z-30 mt-2 w-full rounded-xl border bg-white p-3 shadow-xl" style={{ borderColor: 'var(--color-border)' }}>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button type="button" className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={() => addBuilderBlock(target, createBlock('text'))}>Text</button>
              <button type="button" className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={() => addBuilderBlock(target, createBlock('button'))}>Button</button>
              <button type="button" className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={() => addBuilderBlock(target, createBlock('image'))}>Image</button>
              <button type="button" className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={() => addBuilderBlock(target, createBlock('table'))}>Table</button>
              <button type="button" className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={() => addBuilderBlock(target, createBlock('columns'))}>Columns</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderInlineToolbar = () => {
    if (!inlineToolbar.visible) return null
    return (
      <div
        className="fixed z-50 -translate-x-1/2 rounded-xl border bg-white px-3 py-2 shadow-xl"
        style={{ left: inlineToolbar.x, top: inlineToolbar.y, borderColor: 'var(--color-border)' }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Color</span>
            <input
              type="color"
              className="h-6 w-8 rounded border"
              onChange={(event) => applyInlineStyleToSelection({ color: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Size</span>
            <input
              type="number"
              min={10}
              max={64}
              className="w-14 rounded border px-1 py-0.5 text-[10px]"
              onChange={(event) => applyInlineStyleToSelection({ fontSize: `${Number(event.target.value || 14)}px` })}
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Weight</span>
            <select
              className="rounded border px-1 py-0.5 text-[10px]"
              onChange={(event) => applyInlineStyleToSelection({ fontWeight: event.target.value as any })}
            >
              <option value="400">400</option>
              <option value="500">500</option>
              <option value="600">600</option>
              <option value="700">700</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Font</span>
            <input
              className="w-28 rounded border px-1 py-0.5 text-[10px]"
              placeholder="Font family"
              onChange={(event) => applyInlineStyleToSelection({ fontFamily: event.target.value })}
            />
          </label>
        </div>
      </div>
    )
  }

  const renderBuilderBlocks = (blocks: BuilderBlock[]) => {
    if (!blocks.length) {
      return (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          Your custom layout is empty. Add blocks below.
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {blocks.map((block) => {
          const isSelected = selected?.id === block.id
          const wrapperClass = `relative rounded-xl border border-transparent transition ${selectableClass(block.id)}`
          const wrapperStyle = applyElementStyle(block.id, { backgroundColor: 'transparent' })
          return (
            <div
              key={block.id}
              className={wrapperClass}
              style={wrapperStyle}
              onClick={(event) => selectElement(event, { id: block.id, kind: 'block', label: block.type === 'text' ? 'Text Block' : block.type === 'button' ? 'Button' : block.type === 'image' ? 'Image' : block.type === 'table' ? 'Table' : 'Columns', meta: { blockId: block.id } })}
            >
              {isSelected && (
                <button
                  type="button"
                  className="absolute -top-3 -right-3 rounded-full bg-white p-2 shadow-md"
                  onClick={(event) => {
                    event.stopPropagation()
                    deleteSelected()
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              )}
              {block.type === 'text' && (
                <p
                  className="text-base leading-7"
                  style={applyElementStyle(block.id, { color: landingColors.text })}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => updateBuilderBlock(block.id, { content: event.currentTarget.innerText.trim() } as BuilderBlock)}
                  onKeyDown={stopEnter}
                >
                  {block.content}
                </p>
              )}
              {block.type === 'button' && (
                <button
                  type="button"
                  className="inline-flex items-center rounded-md px-5 py-2 text-sm font-semibold text-white shadow-sm"
                  style={applyElementStyle(block.id, { backgroundColor: landingColors.primary, color: '#ffffff' })}
                >
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(event) => updateBuilderBlock(block.id, { text: event.currentTarget.innerText.trim() } as BuilderBlock)}
                    onKeyDown={stopEnter}
                  >
                    {block.text}
                  </span>
                </button>
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
                          <th key={`${block.id}-header-${index}`} className="px-4 py-2 font-semibold">
                            <span
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(event) => {
                                const next = [...block.headers]
                                next[index] = event.currentTarget.innerText.trim()
                                updateBuilderBlock(block.id, { headers: next } as BuilderBlock)
                              }}
                              onKeyDown={stopEnter}
                            >
                              {header}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, rowIndex) => (
                        <tr key={`${block.id}-row-${rowIndex}`} className="border-t">
                          {row.map((cell, cellIndex) => (
                            <td key={`${block.id}-cell-${rowIndex}-${cellIndex}`} className="px-4 py-3">
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(event) => {
                                  const nextRows = block.rows.map((r) => [...r])
                                  nextRows[rowIndex][cellIndex] = event.currentTarget.innerText.trim()
                                  updateBuilderBlock(block.id, { rows: nextRows } as BuilderBlock)
                                }}
                                onKeyDown={stopEnter}
                              >
                                {cell}
                              </span>
                            </td>
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
                    <div key={`${block.id}-col-${columnIndex}`} className="rounded-xl border border-dashed p-4" style={{ borderColor: 'var(--color-border)' }}>
                      {column.length ? renderBuilderBlocks(column) : (
                        <div className="text-xs text-center text-slate-500">Empty column</div>
                      )}
                      {renderAddZone({ scope: 'column', blockId: block.id, columnIndex }, 'Add to column')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
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

        {selected ? (
          <div className="mt-6 space-y-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600"
              onClick={() => setSelected(null)}
            >
              <span className="h-6 w-6 rounded-full border flex items-center justify-center">
                <ChevronLeft className="h-3 w-3" />
              </span>
              Back to editor
            </button>

            <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Selected: {selected.label}</div>
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Background</div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold">
                  {(['solid', 'transparent', 'gradient'] as const).map((mode) => {
                    const active = (getElementStyle(selected.id).backgroundType || 'solid') === mode
                    return (
                      <button
                        key={mode}
                        type="button"
                        className="rounded-lg border px-2 py-1.5"
                        style={{
                          borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                          backgroundColor: active ? 'rgba(59, 130, 246, 0.12)' : 'var(--color-background)',
                          color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)'
                        }}
                        onClick={() => updateElementStyle(selected.id, { backgroundType: mode })}
                      >
                        {mode === 'solid' ? 'Solid' : mode === 'transparent' ? 'Transparent' : 'Gradient'}
                      </button>
                    )
                  })}
                </div>
                {(getElementStyle(selected.id).backgroundType || 'solid') === 'solid' && (
                  <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Background Color
                    <input
                      type="color"
                      className="mt-1 w-full h-9 rounded-lg border"
                      value={getElementStyle(selected.id).backgroundColor || '#ffffff'}
                      onChange={(event) => updateElementStyle(selected.id, { backgroundColor: event.target.value })}
                    />
                  </label>
                )}
                {(getElementStyle(selected.id).backgroundType || 'solid') === 'gradient' && (
                  <div className="grid gap-3 grid-cols-2">
                    <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      From
                      <input
                        type="color"
                        className="mt-1 w-full h-9 rounded-lg border"
                        value={getElementStyle(selected.id).gradientFrom || '#60a5fa'}
                        onChange={(event) => updateElementStyle(selected.id, { gradientFrom: event.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      To
                      <input
                        type="color"
                        className="mt-1 w-full h-9 rounded-lg border"
                        value={getElementStyle(selected.id).gradientTo || '#a78bfa'}
                        onChange={(event) => updateElementStyle(selected.id, { gradientTo: event.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-medium col-span-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Angle
                      <input
                        type="number"
                        min={0}
                        max={360}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        value={getElementStyle(selected.id).gradientAngle ?? 135}
                        onChange={(event) => updateElementStyle(selected.id, { gradientAngle: Number(event.target.value || 135) })}
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="grid gap-3 grid-cols-2">
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Text Color
                  <input
                    type="color"
                    className="mt-1 w-full h-9 rounded-lg border"
                    value={getElementStyle(selected.id).textColor || '#0f172a'}
                    onChange={(event) => updateElementStyle(selected.id, { textColor: event.target.value })}
                  />
                </label>
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Background
                  <input
                    type="color"
                    className="mt-1 w-full h-9 rounded-lg border"
                    value={getElementStyle(selected.id).backgroundColor || '#ffffff'}
                    onChange={(event) => updateElementStyle(selected.id, { backgroundColor: event.target.value })}
                  />
                </label>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Font Size
                  <input
                    type="number"
                    min={10}
                    max={96}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={getElementStyle(selected.id).fontSize || 16}
                    onChange={(event) => updateElementStyle(selected.id, { fontSize: Number(event.target.value || 16) })}
                  />
                </label>
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Font Weight
                  <input
                    type="number"
                    min={300}
                    max={900}
                    step={100}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={getElementStyle(selected.id).fontWeight || 600}
                    onChange={(event) => updateElementStyle(selected.id, { fontWeight: Number(event.target.value || 600) })}
                  />
                </label>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Padding
                  <input
                    type="number"
                    min={0}
                    max={64}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={getElementStyle(selected.id).padding || 0}
                    onChange={(event) => updateElementStyle(selected.id, { padding: Number(event.target.value || 0) })}
                  />
                </label>
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Radius
                  <input
                    type="number"
                    min={0}
                    max={40}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={getElementStyle(selected.id).borderRadius || 0}
                    onChange={(event) => updateElementStyle(selected.id, { borderRadius: Number(event.target.value || 0) })}
                  />
                </label>
              </div>
              <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Text Align
                <select
                  className="mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                  value={getElementStyle(selected.id).textAlign || 'left'}
                  onChange={(event) => updateElementStyle(selected.id, { textAlign: event.target.value as ElementStyle['textAlign'] })}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>

            {selectedBlock?.type === 'button' && (
              <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Button URL
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={selectedBlock.url}
                  onChange={(event) => updateBuilderBlock(selectedBlock.id, { url: event.target.value } as BuilderBlock)}
                />
              </label>
            )}
            {selectedBlock?.type === 'image' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) updateImageFromFile(selectedBlock.id, file)
                    }}
                  />
                </label>
                <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Alt Text
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={selectedBlock.alt}
                    onChange={(event) => updateBuilderBlock(selectedBlock.id, { alt: event.target.value } as BuilderBlock)}
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-red-600"
              onClick={deleteSelected}
            >
              <Trash2 className="h-4 w-4" /> Delete Selected
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}

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

      <main
        className="overflow-y-auto"
        style={pageStyle}
        onMouseUp={() => setTimeout(updateInlineSelection, 0)}
        onKeyUp={() => setTimeout(updateInlineSelection, 0)}
        onClick={() => {
          setSelected(null)
          setActiveAddTarget(null)
          setInlineToolbar((prev) => ({ ...prev, visible: false }))
        }}
        onClickCapture={(event) => {
          const target = event.target as HTMLElement | null
          const link = target?.closest('a')
          if (link) {
            event.preventDefault()
          }
        }}
      >
        {renderInlineToolbar()}
        {settings.showHeader && (
          <header className="absolute inset-x-0 top-0 z-50">
            <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
              <div className="flex lg:flex-1">
                <div className="-m-1.5 p-1.5" />
              </div>
              <div className="flex lg:flex-1 items-center lg:justify-end space-x-4">
                <Link
                  href="/auth/login"
                  className="px-4 py-2 rounded-md text-sm transition-colors"
                  style={{ color: landingColors.text, backgroundColor: 'var(--color-secondary)', border: '1px solid var(--color-border)' }}
                  onClick={(event) => event.preventDefault()}
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2 rounded-md text-sm text-white transition-colors"
                  style={{ backgroundColor: landingColors.primary }}
                  onClick={(event) => event.preventDefault()}
                >
                  Get started
                </Link>
              </div>
            </nav>
          </header>
        )}

        <main className={`relative isolate px-6 pt-14 lg:px-8 pb-0`}>
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

          <section className="mx-auto max-w-6xl px-6 lg:px-8 pt-10 pb-0">
            <div className="mb-4 text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
              Custom Blocks
            </div>
            {renderBuilderBlocks(settings.builder.blocks)}
            {renderAddZone({ scope: 'root' }, 'Add new block')}
          </section>

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

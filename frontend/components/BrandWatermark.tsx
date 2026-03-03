'use client'

import Image from 'next/image'
import logo from '@/assets/logo_blue.png'
import { useSetup } from '@/components/providers/SetupProvider'

export default function BrandWatermark() {
  const { settings, branding } = useSetup()
  const showWatermark = Boolean(
    settings?.watermark?.forceVisible ?? branding?.showCoderCrafterWatermark ?? !branding?.whiteLabelEnabled
  )

  if (!showWatermark) return null

  return (
    <div
      className="fixed bottom-2 right-2 z-[9999] opacity-55 hover:opacity-80 transition-opacity pointer-events-none select-none"
      aria-hidden
      title="Powered by CoderCrafter"
    >
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-md border"
        style={{
          backgroundColor: 'rgba(255,255,255,0.78)',
          borderColor: 'var(--color-border)'
        }}
      >
        <Image src={logo} alt="CoderCrafter" width={16} height={16} />
        <span className="text-[10px] font-semibold tracking-wide" style={{ color: '#0F172A' }}>
          Powered by CoderCrafter
        </span>
      </div>
    </div>
  )
}

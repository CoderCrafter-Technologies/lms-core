'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export default function PasswordOtpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const queryEmail = String(searchParams.get('email') || '').trim()
    if (queryEmail) {
      setEmail(queryEmail)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('passwordOtpEmail', queryEmail)
      }
      return
    }

    if (typeof window !== 'undefined') {
      const cachedEmail = String(sessionStorage.getItem('passwordOtpEmail') || '').trim()
      if (cachedEmail) {
        setEmail(cachedEmail)
      }
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !otp || !newPassword) {
      toast.error('Email, OTP, and new password are required')
      return
    }

    try {
      setLoading(true)
      await api.verifyPasswordOtpAndSet({ email, otp, newPassword })
      toast.success('Password updated successfully. Please sign in.')
      router.replace('/auth/login')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-background)' }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border p-6 space-y-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Set New Password with OTP</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Use the OTP sent by your admin email request.
        </p>
        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-md border px-3 py-2"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="text"
          placeholder="6-digit OTP"
          className="w-full rounded-md border px-3 py-2"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          value={otp}
          maxLength={6}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        />
        <input
          type="password"
          placeholder="New password (min 8)"
          className="w-full rounded-md border px-3 py-2"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md px-4 py-2 text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
        <div className="text-center text-sm">
          <Link href="/auth/login" className="hover:underline" style={{ color: 'var(--color-primary)' }}>
            Back to login (to request a new OTP)
          </Link>
        </div>
      </form>
    </div>
  )
}

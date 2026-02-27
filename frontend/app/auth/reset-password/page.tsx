'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tokenFromQuery = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams])

  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (!tokenFromQuery && (!email.trim() || !otp.trim())) {
      toast.error('Email and OTP are required when reset token is not provided')
      return
    }

    setLoading(true)
    try {
      await api.resetPassword({
        token: tokenFromQuery || undefined,
        email: tokenFromQuery ? undefined : email.trim(),
        otp: tokenFromQuery ? undefined : otp.trim(),
        password
      })
      toast.success('Password reset successful. Please login.')
      router.replace('/auth/login')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg border border-gray-200">
      <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
      <p className="text-sm text-gray-600 mb-6">
        {tokenFromQuery
          ? 'Reset link verified. Set your new password.'
          : 'Use your email + OTP to set a new password.'}
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {!tokenFromQuery ? (
          <>
            <input
              type="email"
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md"
              placeholder="6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              required
            />
          </>
        ) : null}
        <input
          type="password"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
        >
          {loading ? 'Updating...' : 'Reset Password'}
        </button>
      </form>
      <div className="mt-4 text-sm text-center">
        <Link href="/auth/login" className="text-blue-600 hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  )
}


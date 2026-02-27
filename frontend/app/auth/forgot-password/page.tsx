'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.forgotPassword(email)
      toast.success('If your email exists, reset link and OTP were sent.')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to request password reset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg border border-gray-200">
      <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>
      <p className="text-sm text-gray-600 mb-6">
        Enter your email to receive both a reset link and OTP.
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          type="email"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
        >
          {loading ? 'Sending...' : 'Send Reset Link & OTP'}
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


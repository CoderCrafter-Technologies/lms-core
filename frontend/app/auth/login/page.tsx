'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../components/providers/AuthProvider'
import { useSetup } from '../../../components/providers/SetupProvider'
import { Spinner } from '../../../components/ui/Spinner'
import { toast } from 'react-hot-toast'
import logo from "@/assets/logo_blue.png"
import { getDashboardRouteForRole } from '@/lib/role-routing'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { login } = useAuth()
  const { branding } = useSetup()
  const router = useRouter()
  const appName = branding?.appName || 'Institute LMS'
  const brandLogo = branding?.logoUrl || logo.src

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const loggedInUser = await login(email, password)
      toast.success('Login successful!')
      router.replace(getDashboardRouteForRole(loggedInUser?.role || loggedInUser))
    } catch (error: any) {
      const requiresPasswordSetup =
        error?.code === 'PASSWORD_SETUP_REQUIRED' ||
        String(error?.message || '').toLowerCase().includes('password setup')

      if (requiresPasswordSetup) {
        toast.error('Password setup required. OTP sent to your email.')
        const otpEmail = String(error?.data?.email || email || '').trim()
        if (!otpEmail) {
          toast.error('Could not detect your email for OTP flow. Please enter your email and try again.')
          return
        }
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('passwordOtpEmail', otpEmail)
        }
        router.replace(`/auth/password-otp?email=${encodeURIComponent(otpEmail)}`)
        return
      }
      toast.error(error.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full border border-gray-200 px-6 py-10 rounded-xl shadow-lg space-y-8">
        <div>
          <Link href="/" className="flex justify-center">
            <span className="text-2xl flex items-center font-bold text-gradient gap-2">
              <img src={brandLogo} alt={`${appName} Logo`} className="h-10 w-auto object-contain" />
            </span>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to {appName}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Use your institute credentials to continue.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="form-input w-full rounded-md border border-gray-300 text-black"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="form-input w-full rounded-md border border-gray-300  text-black"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link href="/auth/forgot-password" className="font-medium text-[#0070DC] hover:text-[#0070DC]">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#0070DC] text-white rounded-md w-full py-2 text-base"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

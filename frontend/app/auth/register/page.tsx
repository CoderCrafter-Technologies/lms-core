'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../components/providers/AuthProvider'
import { useSetup } from '../../../components/providers/SetupProvider'
import { Spinner } from '../../../components/ui/Spinner'
import { api } from '../../../lib/api'
import { toast } from 'react-hot-toast'
import logo from "@/assets/logo_blue.png"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'STUDENT'
  })
  const [loading, setLoading] = useState(false)
  const [otp, setOtp] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  
  const { login } = useAuth()
  const { branding } = useSetup()
  const router = useRouter()
  const appName = branding?.appName || 'Institute LMS'
  const brandLogo = branding?.logoUrl || logo.src

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Validation
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      if (!otpSent) {
        const otpResponse = await api.requestRegistrationOtp(formData.email)
        const token = otpResponse?.data?.challengeToken
        if (!token) throw new Error('Failed to start OTP verification')
        setChallengeToken(token)
        setOtpSent(true)
        toast.success('OTP sent to your email. Enter it to complete registration.')
        return
      }

      if (!otp || otp.length !== 6) {
        toast.error('Enter the 6-digit OTP sent to your email')
        return
      }

      await api.verifyRegistrationOtp({
        challengeToken,
        otp,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role
      })
      await login(formData.email, formData.password)
      toast.success('Registration successful!')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(error.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full border border-gray-200 rounded-xl p-5 space-y-8">
        <div>
          <Link href="/" className="flex justify-center">
            <span className="text-2xl font-bold text-gradient">
              <img src={brandLogo} alt={`${appName} Logo`} className="h-10 w-auto object-contain" />
            </span>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Create your {appName} account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link href="/auth/login" className="font-medium text-[#0070DC] hover:text-[#0070DC]">
              sign in to your existing account
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="form-label">
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="form-input"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>
              
              <div>
                <label htmlFor="lastName" className="form-label">
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="form-input"
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>
            
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
                className="form-input"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="role" className="form-label">
                Role
              </label>
              <select
                id="role"
                name="role"
                className="form-input"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="form-input"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="form-label">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="form-input"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>

            {otpSent && (
              <div>
                <label htmlFor="otp" className="form-label">
                  Email OTP
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  className="form-input"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  maxLength={6}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#0070DC] text-white rounded-md  w-full py-3 text-base"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating account...
                </>
              ) : (
                otpSent ? 'Verify OTP & Create account' : 'Send OTP'
              )}
            </button>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>By creating an account, you agree to our Terms of Service and Privacy Policy.</p>
          </div>
        </form>
      </div>
    </div>
  )
}

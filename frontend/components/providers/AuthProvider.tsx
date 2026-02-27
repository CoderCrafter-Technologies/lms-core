'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '../../lib/api'
import { User } from '../../types'
import { isProtectedPath } from '../../lib/auth/jwt'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (userData: RegisterData) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname === '/setup' || !isProtectedPath(pathname)) {
      setLoading(false)
      return
    }
    setLoading(true)
    initializeAuth()
  }, [pathname])

  useEffect(() => {
    if (!loading && !user && pathname && isProtectedPath(pathname)) {
      router.replace('/auth/login')
    }
  }, [loading, user, pathname, router])

  const initializeAuth = async (): Promise<User | null> => {
    try {
      const response = await api.getProfile()
      const resolvedUser = response?.user || null
      setUser(resolvedUser)
      return resolvedUser
    } catch (error) {
      console.error('Auth initialization failed:', error)
      api.clearToken()
      setUser(null)
      if (pathname && isProtectedPath(pathname)) {
        router.replace('/auth/login')
      }
      return null
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login(email, password)
      const responseUser = response?.user || response?.data?.user || null

      if (responseUser) {
        setUser(responseUser)
        return responseUser
      }

      const profileUser = await initializeAuth()
      if (!profileUser) {
        throw new Error('Login succeeded but profile could not be loaded')
      }
      return profileUser
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const register = async (userData: RegisterData) => {
    try {
      // Note: Registration through admin panel only
      throw new Error('Registration not available. Please contact administrator.')
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }

  const refreshToken = async () => {
    try {
      // Token refresh handled automatically by API service
      await initializeAuth()
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
    }
  }

  const logout = () => {
    try {
      api.logout().catch(() => {
        // Client-side cleanup will still run
      })
      setUser(null)
      router.replace('/auth/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

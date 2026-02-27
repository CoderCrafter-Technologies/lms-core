'use client'

import { useAuth } from '../components/providers/AuthProvider'
import { useSetup } from '../components/providers/SetupProvider'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '../components/ui/Spinner'
import Link from 'next/link'
import logo from "@/assets/logo_blue.png"
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { getDashboardRouteForRole } from '@/lib/role-routing'

export default function HomePage() {
  const { user, loading } = useAuth()
  const { branding } = useSetup()
  const router = useRouter()
  const appName = branding?.appName || 'Institute LMS'
  const brandLogo = branding?.logoUrl || logo.src

  useEffect(() => {
    if (!loading && user) {
      router.replace(getDashboardRouteForRole(user.role || user))
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ backgroundColor: 'var(--color-background)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ backgroundColor: 'var(--color-background)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
              <img
                src={brandLogo}
                alt={`${appName} Logo`}
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>
            
          <div className="flex lg:flex-1 items-center lg:justify-end space-x-4">
            <Link 
              href="/auth/login" 
              className="px-4 py-2 rounded-md text-sm transition-colors"
              style={{ 
                color: 'var(--color-text)',
                backgroundColor: 'var(--color-secondary)',
                border: '1px solid var(--color-border)'
              }}
            >
              Sign in
            </Link>
            <Link 
              href="/auth/register" 
              className="px-4 py-2 rounded-md text-sm text-white transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative isolate px-6 pt-14 lg:px-8">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-blue-400 to-purple-500 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="mx-auto max-w-4xl py-32 sm:py-48 lg:py-56">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl" style={{ color: 'var(--color-text)' }}>
              Launch Your Tech Career with{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {appName}
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8" style={{ color: 'var(--color-text-secondary)' }}>
              Master in-demand technologies with industry experts. Our cutting-edge LMS platform helps you learn 
              Full Stack Development, DevOps, Mobile Development, and more through immersive, project-based learning.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link 
                href="/auth/login" 
                className="rounded-md text-md px-6 py-2 text-white transition-colors"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Sign In
              </Link>
              <Link 
                href="/auth/register" 
                className="text-lg font-semibold border px-6 py-2 rounded-md transition-colors"
                style={{ 
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-primary)'
                }}
              >
                Browse Courses <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Popular Courses Section */}
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
          <div className="mx-auto lg:text-center">
            <span className="inline-block px-4 py-1 font-semibold mb-4 text-sm rounded-full border border-white/20"
                  style={{ 
                    backgroundColor: 'rgba(147, 51, 234, 0.15)',
                    color: 'rgb(168, 85, 247)'
                  }}>
              ● Trending Technologies
            </span>
            <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
              Most Popular Courses
            </p>
            <p className="mt-4 text-lg" style={{ color: 'var(--color-text-secondary)' }}>
              Join thousands of students learning the most in-demand skills in the tech industry
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:mt-20 lg:mt-24 lg:max-w-none lg:grid-cols-4">
            {[
              { 
                gradient: 'from-blue-500 to-blue-700',
                title: 'Full Stack Development',
                description: 'Master MERN stack, React, Node.js and build real-world applications',
                icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4'
              },
              { 
                gradient: 'from-green-500 to-green-700',
                title: 'DevOps Engineering',
                description: 'Learn Docker, Kubernetes, AWS, CI/CD and infrastructure automation',
                icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2'
              },
              { 
                gradient: 'from-purple-500 to-purple-700',
                title: 'Mobile Development',
                description: 'Build iOS & Android apps with React Native, Flutter and Swift',
                icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'
              },
              { 
                gradient: 'from-red-500 to-red-700',
                title: 'Data Science & AI',
                description: 'Master Python, Machine Learning, TensorFlow and data visualization',
                icon: 'M13 10V3L4 14h7v7l9-11h-7z'
              }
            ].map((course, index) => (
              <div 
                key={index}
                className="flex flex-col overflow-hidden rounded-xl transition-all hover:shadow-md hover:-translate-y-1"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  borderWidth: '1px'
                }}
              >
                <div className={`h-32 bg-gradient-to-r ${course.gradient} flex items-center justify-center`}>
                  <svg className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={course.icon} />
                  </svg>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{course.title}</h3>
                  <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>{course.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link 
              href="/auth/register" 
              className="inline-flex items-center font-semibold hover:opacity-80 transition-opacity"
              style={{ color: 'var(--color-primary)' }}
            >
              View All Courses
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div 
          className="mx-auto max-w-7xl px-6 lg:px-8 py-24 rounded-2xl border"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)'
          }}
        >
          <div className="mx-auto max-w-2xl lg:text-center">
            <span className="inline-block px-4 py-1 font-semibold mb-4 text-sm rounded-full border border-white/20"
                  style={{ 
                    backgroundColor: 'rgba(147, 51, 234, 0.15)',
                    color: 'rgb(168, 85, 247)'
                  }}>
              ● Learn Better 
            </span>
            <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
              Why Choose {appName}?
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {[
                {
                  icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
                  title: 'Industry Expert Instructors',
                  description: 'Learn from professionals working at top tech companies with real-world experience.'
                },
                {
                  icon: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z',
                  title: 'Live Interactive Classes',
                  description: 'WebRTC-powered live sessions with code collaboration, whiteboard, and real-time doubt solving.'
                },
                {
                  icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
                  title: 'Career Support',
                  description: 'Resume building, mock interviews, and placement assistance to launch your tech career.'
                }
              ].map((feature, index) => (
                <div key={index} className="flex flex-col">
                  <dt className="text-base font-semibold leading-7" style={{ color: 'var(--color-text)' }}>
                    <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--color-primary)' }}>
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                      </svg>
                    </div>
                    {feature.title}
                  </dt>
                  <dd className="mt-1 flex flex-auto flex-col text-base leading-7" style={{ color: 'var(--color-text-secondary)' }}>
                    <p className="flex-auto">{feature.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
              {[
                { value: '5000+', label: 'Students Trained' },
                { value: '100+', label: 'Industry Experts' },
                { value: '85%', label: 'Placement Rate' },
                { value: '24/7', label: 'Mentor Support' }
              ].map((stat, index) => (
                <div key={index} className="mx-auto flex max-w-xs flex-col gap-y-4">
                  <dt className="text-4xl font-bold leading-9 tracking-tight" style={{ color: 'var(--color-primary)' }}>
                    {stat.value}
                  </dt>
                  <dd className="text-base leading-7" style={{ color: 'var(--color-text-secondary)' }}>
                    {stat.label}
                  </dd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div 
          className="rounded-2xl shadow-xl mx-6 lg:mx-8 py-16 px-6 lg:px-8 mb-24"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to launch your tech career?
            </h2>
            <p className="mt-4 text-lg leading-8 text-white/80">
              Join thousands of students who have transformed their careers with {appName}&apos;s industry-relevant courses.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link 
                href="/auth/register" 
                className="rounded-md bg-white px-6 py-3 text-lg font-semibold shadow-sm hover:bg-opacity-90 transition-all"
                style={{ color: 'var(--color-primary)' }}
              >
                Get Started Today
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
          <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-blue-400 to-purple-500 opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" />
        </div>
      </main>
    </div>
  )
}

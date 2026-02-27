'use client'

import Link from 'next/link'

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="text-2xl font-bold text-gradient">LMS Future-Proof</span>
            </Link>
          </div>
          <div className="flex lg:flex-1 lg:justify-end space-x-4">
            <Link href="/auth/login" className="btn-secondary">
              Sign in
            </Link>
            <Link href="/auth/register" className="btn-primary">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Demo Content */}
      <main className="relative isolate px-6 pt-24 lg:px-8">
        <div className="mx-auto max-w-4xl py-16 sm:py-24">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              LMS Demo & Features
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Explore the comprehensive features of our future-proof Learning Management System
            </p>
          </div>

          {/* Architecture Overview */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Architecture Overview</h2>
            <div className="grid gap-8 md:grid-cols-2">
              <div className="card">
                <div className="card-header">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Current: MongoDB</h3>
                </div>
                <div className="card-body">
                  <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                    <li>• Document-based storage for rapid prototyping</li>
                    <li>• Flexible schema for iterative development</li>
                    <li>• Easy to start with minimal setup</li>
                    <li>• Perfect for MVP and early stages</li>
                  </ul>
                </div>
              </div>
              
              <div className="card">
                <div className="card-header">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Future: PostgreSQL</h3>
                </div>
                <div className="card-body">
                  <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                    <li>• Relational structure for complex queries</li>
                    <li>• ACID compliance for data integrity</li>
                    <li>• Advanced indexing and performance</li>
                    <li>• Enterprise-grade scalability</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Core Features */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Core Features</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Role Management */}
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <h3 className="ml-4 text-lg font-semibold text-gray-900 dark:text-white">Role Management</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <li>• Admin: Full system control</li>
                    <li>• Manager: Custom permissions</li>
                    <li>• Instructor: Course & class management</li>
                    <li>• Student: Learning & participation</li>
                  </ul>
                </div>
              </div>

              {/* Live Classes */}
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <h3 className="ml-4 text-lg font-semibold text-gray-900 dark:text-white">Live Classes</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <li>• WebRTC video/audio</li>
                    <li>• Interactive whiteboard</li>
                    <li>• Screen sharing</li>
                    <li>• Real-time chat</li>
                    <li>• Class recordings</li>
                  </ul>
                </div>
              </div>

              {/* Course Management */}
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                    <h3 className="ml-4 text-lg font-semibold text-gray-900 dark:text-white">Course Management</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <li>• Course creation & editing</li>
                    <li>• Batch scheduling</li>
                    <li>• Content management</li>
                    <li>• Student enrollment</li>
                    <li>• Progress tracking</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Database Migration Strategy */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Migration Strategy</h2>
            <div className="card">
              <div className="card-body">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">1. Repository Pattern</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Database operations are abstracted through repository classes, making it easy to swap out the underlying database.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">2. Relational-Like Structure</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      MongoDB collections are designed to mirror SQL tables with foreign key references instead of embedded documents.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">3. Transaction Support</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Multi-document transactions in MongoDB prepare for ACID compliance in PostgreSQL.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">4. Schema Versioning</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Migration tracking and schema versions ensure smooth database transitions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Technology Stack */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Technology Stack</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="card">
                <div className="card-header">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Frontend</h3>
                </div>
                <div className="card-body">
                  <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                    <li>• Next.js 14 with App Router</li>
                    <li>• React 18 with TypeScript</li>
                    <li>• Tailwind CSS for styling</li>
                    <li>• Socket.io for real-time features</li>
                    <li>• Zustand for state management</li>
                  </ul>
                </div>
              </div>
              
              <div className="card">
                <div className="card-header">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Backend</h3>
                </div>
                <div className="card-body">
                  <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                    <li>• Node.js with Express.js</li>
                    <li>• MongoDB with Mongoose ODM</li>
                    <li>• JWT authentication</li>
                    <li>• Socket.io for WebRTC signaling</li>
                    <li>• Repository pattern for data access</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Demo Access */}
          <section className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Try the Demo</h2>
            <div className="card max-w-2xl mx-auto">
              <div className="card-body">
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Experience the LMS with pre-configured demo accounts for each role:
                </p>
                
                <div className="grid gap-4 sm:grid-cols-2 mb-6">
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900 dark:text-white">Admin Access</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Email: admin@lms.dev<br />
                      Password: Admin123!
                    </p>
                  </div>
                  
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900 dark:text-white">Student Access</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Email: student@lms.dev<br />
                      Password: Student123!
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
                  <Link href="/auth/login" className="btn-primary">
                    Login to Demo
                  </Link>
                  <Link href="/auth/register" className="btn-secondary">
                    Create Account
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
'use client'

import api from "@/lib/api"
import { useState } from 'react'

export default function TestPage() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const testLogin = async () => {
    setLoading(true)
    try {
      const data = await api.login('admin@lms.dev', 'Admin123!')
      setResult(`Success! Logged in as: ${data.user.firstName} ${data.user.lastName} (${data.user.role.displayName})`)
    } catch (error: any) {
      setResult(`Connection Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testHealth = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/health`)
      const data = await response.json()
      setResult(`Backend Health: ${data.status} - Database: ${data.database}`)
    } catch (error: any) {
      setResult(`Backend Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          LMS MongoDB Integration Test
        </h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Tests</h2>

          <div className="space-y-4">
            <button
              onClick={testHealth}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Backend Health'}
            </button>

            <button
              onClick={testLogin}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Admin Login'}
            </button>
          </div>

          {result && (
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-semibold mb-2">Result:</h3>
              <p className="text-sm font-mono">{result}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Demo Accounts</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-medium">Admin</h3>
              <p className="text-sm text-gray-600">admin@lms.dev / Admin123!</p>
            </div>
            <div>
              <h3 className="font-medium">Manager</h3>
              <p className="text-sm text-gray-600">manager@lms.dev / Manager123!</p>
            </div>
            <div>
              <h3 className="font-medium">Instructor</h3>
              <p className="text-sm text-gray-600">instructor@lms.dev / Instructor123!</p>
            </div>
            <div>
              <h3 className="font-medium">Student</h3>
              <p className="text-sm text-gray-600">student@lms.dev / Student123!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

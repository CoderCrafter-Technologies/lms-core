'use client'

import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import dynamic from 'next/dynamic'
import { getDashboardRouteForRole } from '@/lib/role-routing'

// Dynamic import to avoid SSR issues with WebRTC
const LiveClassRoom = dynamic(() => import('@/components/LiveClassRoom'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p>Loading live class...</p>
      </div>
    </div>
  )
})

export default function LiveClassPage() {
  const { enrollmentId, classId } = useParams()
  const normalizedEnrollmentId = Array.isArray(enrollmentId) ? enrollmentId[0] : enrollmentId
  const normalizedClassId = Array.isArray(classId) ? classId[0] : classId
  const { user } = useAuth()
  const router = useRouter()
  const dashboardRoute = getDashboardRouteForRole(user?.role || user)
  const [classData, setClassData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchClassData = async () => {
      try {
        const data = await api.getLiveClassById(normalizedClassId as string)
        setClassData(data.data)
      } catch (err) {
        console.error('Error fetching class data:', err)
        setError('Failed to load class data')
      } finally {
        setLoading(false)
      }
    }

    if (normalizedClassId && user) {
      fetchClassData()
    }
  }, [normalizedClassId, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p>Loading live class...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Error Loading Class</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => router.replace(dashboardRoute)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen">
      <LiveClassRoom
        classData={classData}
        user={user}
        enrollmentId={normalizedEnrollmentId as string}
        onLeave={() => router.replace(dashboardRoute)}
      />
    </div>
  )
}

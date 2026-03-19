'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { api } from '@/lib/api'
import { getDashboardRouteForRole } from '@/lib/role-routing'

export default function LiveClassPageRedirect() {
  const { classId } = useParams()
  const normalizedClassId = Array.isArray(classId) ? classId[0] : classId
  const { user } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const dashboardRoute = getDashboardRouteForRole(user?.role || user)

  useEffect(() => {
    const resolveAndRedirect = async () => {
      try {
        if (!normalizedClassId || !user) return

        const response = await api.getLiveClassById(normalizedClassId as string)
        const liveClass = response?.data
        const targetRoomId = liveClass?.roomId || liveClass?.id || liveClass?._id

        if (!targetRoomId) {
          throw new Error('Unable to resolve room for this class')
        }

        router.replace(`/classroom/${targetRoomId}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open live class'
        setError(message)
      }
    }

    resolveAndRedirect()
  }, [normalizedClassId, user, router])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Unable to Open Live Class</h2>
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
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4 mx-auto"></div>
        <p>Redirecting to classroom...</p>
      </div>
    </div>
  )
}

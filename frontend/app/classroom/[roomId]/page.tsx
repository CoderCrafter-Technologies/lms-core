// app/classroom/[roomId]/page.tsx
"use client"

import { useAuth } from "@/components/providers/AuthProvider"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { VideoCameraIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { toast } from "react-hot-toast"
import { useParams, useRouter } from "next/navigation"
import NewLiveClassRoom from "@/components/NewClassRoom"
import { api } from "@/lib/api"
import { getDashboardRouteForRole } from "@/lib/role-routing"

interface LiveClass {
  id: string
  title: string
  batchId: any
  instructorId: any
  scheduledStartTime: string
  scheduledEndTime: string
  status: string
  roomId: string
  description?: string
}

const TeamsLoadingScreen = ({ message, subMessage }: { message: string; subMessage?: string }) => (
  <div className="flex flex-col h-screen bg-gray-50">
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2">
        <VideoCameraIcon className="w-6 h-6 text-purple-600" />
        <span className="text-sm font-semibold text-gray-700">Microsoft Teams</span>
      </div>
    </div>
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="text-center max-w-md p-6">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <VideoCameraIcon className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">{message}</h2>
        {subMessage && <p className="text-gray-600">{subMessage}</p>}
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
        </div>
      </div>
    </div>
  </div>
)

const TeamsErrorScreen = ({
  error,
  onRetry,
  onDashboard,
}: { error: string; onRetry: () => void; onDashboard: () => void }) => {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <VideoCameraIcon className="w-6 h-6 text-purple-600" />
          <span className="text-sm font-semibold text-gray-700">Microsoft Teams</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center max-w-md p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={onRetry} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md">
              Try Again
            </Button>
            <Button onClick={onDashboard} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClassroomPage() {
  const { user, loading: authLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const roomId = params?.roomId as string
  const [selectedClass, setSelectedClass] = useState<LiveClass | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dashboardRoute = getDashboardRouteForRole(user?.role || user)

  const initializedRef = useRef(false)
  const dataFetchedRef = useRef(false)

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return

    // Prevent multiple executions
    if (initializedRef.current) return
    initializedRef.current = true

    const loadAndJoinClass = async () => {
      try {
        setLoading(true)

        if (dataFetchedRef.current) return
        dataFetchedRef.current = true

        if (!roomId) {
          throw new Error("Missing room ID")
        }

        // Check if user is authenticated
        if (!user) {
          router.replace("/auth/login")
          return
        }

        console.log("Fetching class details for room:", roomId)

        // Get token through auth service (also handles expiry)
        const token = api.getToken()

        if (!token) {
          router.replace("/auth/login")
          return
        }

        // 1. Fetch the class details
        const classData = await api.getLiveClassByRoom(roomId)
        const liveClass = classData.data

        if (!liveClass) {
          throw new Error("Invalid class data received from server")
        }

        // 2. Validate class timing
        const now = new Date()
        const classStart = new Date(liveClass.scheduledStartTime)
        const classEnd = new Date(liveClass.scheduledEndTime)
        const joinAllowedFrom = new Date(classStart.getTime() - 10 * 60 * 1000)

        if (now < joinAllowedFrom) {
          throw new Error("Class has not started yet. You can join 10 minutes before the scheduled time.")
        }

        if (now > classEnd) {
          throw new Error("This class has already ended.")
        }

        // 3. Set the class for joining
        setSelectedClass(liveClass)
      } catch (err) {
        console.error("Error joining class:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to join class"
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadAndJoinClass()
  }, [user, roomId, router, authLoading])

  const handleLeave = () => {
    setSelectedClass(null)
    router.replace(dashboardRoute)
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    dataFetchedRef.current = false
    initializedRef.current = false
  }

  const handleGoToDashboard = () => {
    router.replace(dashboardRoute)
  }

  // Show loading screens
  if (authLoading || loading) {
    return (
      <TeamsLoadingScreen
        message={authLoading ? "Checking authentication..." : "Joining classroom..."}
        subMessage="Please wait while we connect you"
      />
    )
  }

  // Show error screen
  if (error) {
    return <TeamsErrorScreen error={error} onRetry={handleRetry} onDashboard={handleGoToDashboard} />
  }

  // Show classroom when ready
  if (selectedClass && user) {
    return (
      <div className="overflow-hidden">
        <NewLiveClassRoom
          key={`live-class-${selectedClass.id}-${user.id}`}
          classData={selectedClass}
          user={user}
          enrollmentId=""
          onLeave={handleLeave}
        />
      </div>
    )
  }

  // Fallback - should not normally reach here
  return (
    <TeamsErrorScreen
      error="Unable to load classroom. Please try again."
      onRetry={handleRetry}
      onDashboard={handleGoToDashboard}
    />
  )
}

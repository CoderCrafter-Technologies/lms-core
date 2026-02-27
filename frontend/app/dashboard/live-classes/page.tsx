'use client'

import { useAuth } from '../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ClassCreationModal } from '@/components/modals/ClassCreationModal'
import { AlarmClock, CalendarDays, CircleCheckBig, Clock, Clock3, ContactRound, Headphones, Hourglass, Users, Video, MonitorUp } from 'lucide-react'

export default function LiveClassesPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('upcoming')
  const router = useRouter();
  const [showClassModal, setShowClassModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [completedClasses, setCompletedClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);

  const canCreateClass = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER'
  const isAdmin = user?.role.name === 'ADMIN' || user?.role.name === 'MANAGER';
  const isInstructor = user?.role?.name === 'INSTRUCTOR'

  const calculateDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  const handleClassCreated = (newClass: any) => {
    fetchAllClasses();
    setSelectedClass(null);
  }

  const fetchAllClasses = async () => {
    try {
      if (isInstructor) {
        const response = await api.getInstructorDashboard()
        const allClasses = response?.data?.classes || []
        const now = new Date()

        const liveData = allClasses.filter((cls: any) => {
          const startTime = new Date(cls.scheduledStartTime)
          const endTime = new Date(cls.scheduledEndTime)
          return startTime <= now && endTime >= now && cls.status !== 'ENDED' && cls.status !== 'CANCELLED'
        })

        const upcomingData = allClasses.filter((cls: any) => {
          const classDate = new Date(cls.scheduledStartTime)
          return classDate > now && cls.status === 'SCHEDULED'
        })

        const completedData = allClasses.filter((cls: any) => {
          const classEnd = new Date(cls.scheduledEndTime)
          return cls.status === 'ENDED' || classEnd < now
        })

        setUpcomingClasses(upcomingData)
        setLiveClasses(liveData)
        setCompletedClasses(completedData)

        if (activeTab === 'upcoming') setFilteredClasses(upcomingData)
        if (activeTab === 'live') setFilteredClasses(liveData)
        if (activeTab === 'completed') setFilteredClasses(completedData)
      } else if (!isAdmin) {
        const [upcomingData, liveData, completedData] = await Promise.all([
          fetchUpcomingClasses(),
          fetchLiveClasses(),
          fetchPastClasses()
        ]);

        setUpcomingClasses(upcomingData || []);
        setLiveClasses(liveData || []);
        setCompletedClasses(completedData || []);

        if (activeTab === 'upcoming') setFilteredClasses(upcomingData || []);
        if (activeTab === 'live') setFilteredClasses(liveData || []);
        if (activeTab === 'completed') setFilteredClasses(completedData || []);
      } else {
        const resdata = await api.getFilteredLiveClasses()
        const { upcomingClasses, ongoingClasses, pastClasses } = resdata?.data || {};

        const upcomingData = upcomingClasses || [];
        const liveData = ongoingClasses || [];
        const completedData = pastClasses || [];

        setUpcomingClasses(upcomingData);
        setLiveClasses(liveData);
        setCompletedClasses(completedData);

        if (activeTab === 'upcoming') setFilteredClasses(upcomingData);
        if (activeTab === 'live') setFilteredClasses(liveData);
        if (activeTab === 'completed') setFilteredClasses(completedData);
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
      setFilteredClasses([]);
    }
  };

  const fetchUpcomingClasses = async () => {
    try {
      const upcomingClassesRes = await api.getStudentUpcomingClasses()
      return upcomingClassesRes?.data || []
    } catch (error) {
      console.error("Error fetching upcoming classes:", error);
      return [];
    }
  }

  const fetchPastClasses = async () => {
    try {
      const pastClassesRes = await api.getStudentPastClasses()
      return pastClassesRes?.data || []
    } catch (error) {
      console.error("Error fetching past classes:", error);
      return [];
    }
  }

  const fetchLiveClasses = async () => {
    try {
      const liveClassesRes = await api.getStudentLiveClasses()
      return liveClassesRes?.data || []
    } catch (error) {
      console.error("Error fetching live classes:", error);
      return [];
    }
  }

  const calculateTotalHours = () => {
    const allClasses = [...upcomingClasses, ...liveClasses, ...completedClasses];
    let totalMs = 0;
    
    allClasses.forEach(classItem => {
      const start = new Date(classItem.scheduledStartTime).getTime();
      const end = new Date(classItem.scheduledEndTime).getTime();
      totalMs += (end - start);
    });
    
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    return hours;
  }

  useEffect(() => {
    fetchAllClasses();
  }, [router, isAdmin, isInstructor]);

  useEffect(() => {
    if (activeTab === 'upcoming') setFilteredClasses(upcomingClasses);
    if (activeTab === 'live') setFilteredClasses(liveClasses);
    if (activeTab === 'completed') setFilteredClasses(completedClasses);
  }, [activeTab, upcomingClasses, liveClasses, completedClasses]);

  // Stats data
  const stats = [
    { label: 'Live Now', value: liveClasses.length, icon: Video, borderColor: 'var(--color-error)', iconBg: 'var(--color-error-light)' },
    { label: 'Upcoming', value: upcomingClasses.length, icon: Clock, borderColor: 'var(--color-primary)', iconBg: 'var(--color-primary-light)' },
    { label: 'Completed', value: completedClasses.length, icon: CircleCheckBig, borderColor: 'var(--color-success)', iconBg: 'var(--color-success-light)' },
    { label: 'Total Hours', value: calculateTotalHours(), icon: Hourglass, borderColor: 'var(--color-purple-500)', iconBg: 'rgba(168, 85, 247, 0.15)' },
  ]

  const tabs = [
    { id: 'live', label: 'Live Now', icon: Video, count: liveClasses.length, color: 'var(--color-error)' },
    { id: 'upcoming', label: 'Upcoming', icon: Clock, count: upcomingClasses.length, color: 'var(--color-primary)' },
    { id: 'completed', label: 'Completed', icon: CircleCheckBig, count: completedClasses.length, color: 'var(--color-success)' },
  ]

  const features = [
    { icon: Video, title: 'HD Video', description: 'Crystal clear video quality' },
    { icon: Headphones, title: 'Audio', description: 'High-quality audio streaming' },
    { icon: MonitorUp, title: 'Screen Share', description: 'Share your screen with students' },
  ]

  return (
    <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mb-8 py-0 md:py-7 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              Live Classes 
            </h1>
            <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              {user?.role.name === 'STUDENT' 
                ? 'Join live classes and interactive sessions'
                : 'Manage and conduct live teaching sessions'
              }
            </p>
          </div>
          {canCreateClass && (
            <button 
              onClick={() => setShowClassModal(true)}
              className="px-4 py-2 text-sm md:text-md text-white rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }}
            >
              Schedule Class
            </button>
          )}
        </div>
      </div>

      {/* Live Class Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div 
              key={index}
              className="p-6 rounded-lg shadow-sm border-l-4"
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderLeftColor: stat.borderColor,
                borderTop: '1px solid var(--color-card-border)',
                borderRight: '1px solid var(--color-card-border)',
                borderBottom: '1px solid var(--color-card-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {stat.value}
                  </p>
                </div>
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: stat.iconBg }}
                >
                  <Icon className="w-6 h-6" style={{ color: stat.borderColor }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Class Tabs */}
      <div 
        className="rounded-lg border mb-8"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-card-border)'
        }}
      >
        <div className="border-b" style={{ borderColor: 'var(--color-card-border-inner)' }}>
          <nav className="flex flex-wrap sm:flex-nowrap overflow-x-auto px-4 sm:px-6 space-x-0 sm:space-x-8 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 py-4 px-2 sm:px-1 border-b-2 font-medium text-sm transition-colors`}
                  style={{
                    borderColor: activeTab === tab.id ? tab.color : 'transparent',
                    color: activeTab === tab.id ? tab.color : 'var(--color-text-secondary)'
                  }}
                >
                  <div className="flex items-center whitespace-nowrap">
                    <span className="mr-2">
                      <Icon className="w-4 h-4" />
                    </span>
                    {tab.label}
                    <span 
                      className="ml-2 py-0.5 px-2 rounded-full text-xs"
                      style={{ 
                        backgroundColor: 'var(--color-secondary)',
                        color: 'var(--color-text-secondary)'
                      }}
                    >
                      {tab.count}
                    </span>
                  </div>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Classes List */}
          {filteredClasses.length > 0 ? (
            <div className="space-y-4">
              {filteredClasses.map((classItem, index) => {
                const currentTab = tabs.find(t => t.id === activeTab)
                return (
                  <div
                    key={index}
                    className="border rounded-lg p-6 hover:shadow-md transition-all"
                    style={{ 
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface)'
                    }}
                  >
                    {/* Top row: status and course title */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 sm:gap-0">
                      <div className="flex items-center space-x-3">
                        <div 
                          className={`w-3 h-3 rounded-full ${activeTab === 'live' ? 'animate-pulse' : ''}`}
                          style={{ backgroundColor: currentTab?.color }}
                        ></div>
                        <span 
                          className="px-2 py-1 text-xs font-semibold rounded-full"
                          style={{ 
                            backgroundColor: `${currentTab?.color}20`,
                            color: currentTab?.color
                          }}
                        >
                          {activeTab.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                        {classItem.batchId?.courseId?.title || 'No course title'}
                      </span>
                    </div>

                    {/* Class title */}
                    <h3 className="text-lg font-semibold mb-2 truncate" style={{ color: 'var(--color-text)' }}>
                      {classItem.title}
                    </h3>

                    {/* Info grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      <div className="flex items-center truncate">
                        <span className="mr-2 flex-shrink-0">
                          <ContactRound className="w-4 h-4" />
                        </span>
                        <span className="truncate">
                          {classItem?.instructorId?.firstName + " " + classItem?.instructorId?.lastName || "No instructor"}
                        </span>
                      </div>
                      <div className="flex items-center truncate">
                        <span className="mr-2 flex-shrink-0">
                          <CalendarDays className="w-4 h-4" />
                        </span>
                        {format(new Date(classItem.scheduledStartTime), 'PP')}
                      </div>
                      <div className="flex items-center truncate">
                        <span className="mr-2 flex-shrink-0">
                          <AlarmClock className="w-4 h-4" />
                        </span>
                        {calculateDuration(classItem.scheduledStartTime, classItem.scheduledEndTime)}
                      </div>
                    </div>

                    {/* Bottom row: participants and actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                        <span className="flex items-center gap-2">
                          <Users className="w-4 h-4 flex-shrink-0" /> {classItem.stats?.totalParticipants || 0} participants
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {activeTab === 'live' && (
                          <button
                            onClick={() => router.push(`/classroom/${classItem.roomId}`)}
                            className="px-4 py-2 text-white rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--color-error)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-error-hover)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-error)'
                            }}
                          >
                            Join Live
                          </button>
                        )}
                        {activeTab === 'upcoming' && (
                          <button 
                            className="px-4 py-2 text-white rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
                            }}
                          >
                            Set Reminder
                          </button>
                        )}
                        {activeTab === 'completed' && (
                          <button 
                            className="px-4 py-2 text-white rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--color-success)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-success-hover)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-success)'
                            }}
                          >
                            View Recording
                          </button>
                        )}
                        {canCreateClass && (
                          <button
                            onClick={() => setSelectedClass(classItem)}
                            className="px-4 py-2 rounded-lg transition-colors"
                            style={{ 
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text)',
                              backgroundColor: 'transparent'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                              e.currentTarget.style.borderColor = 'var(--color-border-hover)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent'
                              e.currentTarget.style.borderColor = 'var(--color-border)'
                            }}
                          >
                            Manage
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl flex justify-center mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
                {activeTab === 'live' ? <Video className="w-16 h-16" /> : 
                 activeTab === 'upcoming' ? <Clock3 className="w-16 h-16" /> : 
                 <CircleCheckBig className="w-16 h-16" />}
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                {activeTab === 'live' ? 'No live classes' :
                 activeTab === 'upcoming' ? 'No upcoming classes' :
                 'No completed classes'}
              </h3>
              <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                {activeTab === 'live' 
                  ? 'No classes are currently live'
                  : activeTab === 'upcoming'
                  ? canCreateClass 
                    ? 'Schedule your first class to get started'
                    : 'No classes are scheduled yet'
                  : 'Completed classes will appear here'
                }
              </p>
              {canCreateClass && activeTab === 'upcoming' && (
                <button 
                  onClick={() => setShowClassModal(true)}
                  className="px-6 py-3 text-white rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary)'
                  }}
                >
                  Schedule First Class
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WebRTC Features Preview */}
      <div 
        className="rounded-lg border"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-card-border)'
        }}
      >
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-card-border-inner)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Live Class Features
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div 
                  key={index}
                  className="text-center p-4 flex flex-col justify-center items-center border rounded-lg"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="text-3xl mb-2" style={{ color: 'var(--color-primary)' }}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                    {feature.title}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {showClassModal && (
        <ClassCreationModal
          isOpen={showClassModal}
          onClose={() => setShowClassModal(false)}
          batchId=""
          batchName="Batch"
          onClassCreated={handleClassCreated}
        />
      )}
      
      {selectedClass && (
        <ClassCreationModal
          isOpen={!!selectedClass}
          onClose={() => setSelectedClass(null)}
          batchId={selectedClass.batchId?._id}
          batchName={selectedClass.batchId?.name}
          onClassCreated={handleClassCreated}
        />
      )}
    </div>
  )
}

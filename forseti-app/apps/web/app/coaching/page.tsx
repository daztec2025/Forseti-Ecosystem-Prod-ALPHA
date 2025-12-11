'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ProtectedRoute from '../components/ProtectedRoute'
import DashboardNav from '../components/DashboardNav'
import { api } from '../lib/api'
import { Drill, DrillType } from '../types/api'
import {
  Target,
  Clock,
  Star,
  Zap,
  TrendingUp,
  Timer,
  BarChart3,
  Gauge,
  ArrowUpRight,
  Wifi,
  Play,
  X,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react'

// Drill type definitions
const drillTypes = [
  {
    id: 'consistency_run' as DrillType,
    title: 'Consistency Run',
    description: 'Beat your total session time from before. Focus on maintaining consistent lap times across 5 laps.',
    icon: TrendingUp,
    xpReward: '50-150 XP',
    difficulty: 'Medium',
    avgImprovement: '2.3%',
    color: 'from-blue-500 to-cyan-500',
    laps: 5
  },
  {
    id: 'pb_quali' as DrillType,
    title: 'PB Quali Run',
    description: 'Beat your personal best in just 3 laps. Simulates the pressure of a qualifying session.',
    icon: Zap,
    xpReward: '75-200 XP',
    difficulty: 'Hard',
    avgImprovement: '0.8%',
    color: 'from-yellow-500 to-orange-500',
    laps: 3
  },
  {
    id: 'target_lap' as DrillType,
    title: 'Target Lap Time',
    description: 'Beat your best single lap time. A quick drill to push for that perfect lap.',
    icon: Target,
    xpReward: '25-125 XP',
    difficulty: 'Variable',
    avgImprovement: '1.5%',
    color: 'from-purple-500 to-pink-500',
    laps: 1
  }
]

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy':
      return 'text-green-400 bg-green-400/10'
    case 'Medium':
      return 'text-yellow-400 bg-yellow-400/10'
    case 'Hard':
      return 'text-orange-400 bg-orange-400/10'
    case 'Variable':
      return 'text-purple-400 bg-purple-400/10'
    default:
      return 'text-forseti-text-secondary bg-forseti-bg-elevated'
  }
}

// Format seconds to M:SS.mmm
function formatTime(seconds: number): string {
  if (!seconds) return '0:00.000'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function CoachingPageContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'drills'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null)
  const [drillHistory, setDrillHistory] = useState<Drill[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDrill, setSelectedDrill] = useState<DrillType | null>(null)
  const [showStartModal, setShowStartModal] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [isElectron, setIsElectron] = useState(false)
  const [currentSession, setCurrentSession] = useState<{ trackName: string; carName: string } | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Check if running in Electron and get iRacing status
  useEffect(() => {
    const electronAPI = (window as any).electronAPI
    setIsElectron(!!electronAPI)

    if (electronAPI) {
      // Get initial iRacing status
      electronAPI.getIRacingStatus().then((status: any) => {
        setIsConnected(status?.isConnected || false)
      })

      // Listen for status changes
      electronAPI.onIRacingStatusChanged((status: any) => {
        setIsConnected(status?.isConnected || false)
      })

      // Poll for session data when connected
      const pollSession = async () => {
        try {
          const response = await fetch('http://127.0.0.1:5555/session')
          if (response.ok) {
            const session = await response.json()
            if (session.trackName && session.carName) {
              setCurrentSession({
                trackName: session.trackName,
                carName: session.carName
              })
            }
          }
        } catch (e) {
          // Bridge not running or not connected
        }
      }

      // Poll immediately and then every 5 seconds
      pollSession()
      const interval = setInterval(pollSession, 5000)
      return () => clearInterval(interval)
    }
  }, [])

  // Fetch active drill and history on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [active, history] = await Promise.all([
          api.getActiveDrill(),
          api.getDrillHistory()
        ])
        setActiveDrill(active)
        setDrillHistory(history)
      } catch (error) {
        console.error('Failed to fetch drill data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    // Listen for drill completion from Electron
    if ((window as any).electronAPI?.onDrillComplete) {
      (window as any).electronAPI.onDrillComplete(async (data: any) => {
        // Call API to complete the drill
        try {
          const result = await api.completeDrill(data.drillId, data.actualTime, data.lapsCompleted)
          // Refresh data
          const [active, history] = await Promise.all([
            api.getActiveDrill(),
            api.getDrillHistory()
          ])
          setActiveDrill(active)
          setDrillHistory(history)
        } catch (error) {
          console.error('Failed to complete drill:', error)
        }
      })
    }

    // Listen for drill activation (when pending drill is activated by iRacing connection)
    if ((window as any).electronAPI?.onDrillActivated) {
      (window as any).electronAPI.onDrillActivated(async (drill: any) => {
        console.log('Drill activated:', drill)
        // Update the active drill state with the activated drill
        setActiveDrill(drill)
      })
    }
  }, [])

  const handleStartDrill = async (type: DrillType) => {
    setSelectedDrill(type)
    setShowStartModal(true)
    setStartError(null)
  }

  const confirmStartDrill = async () => {
    if (!selectedDrill) return

    try {
      // If connected to iRacing, use current session data
      // Otherwise, create a pending drill that will activate when iRacing connects
      const trackId = currentSession?.trackName
      const carId = currentSession?.carName

      const drill = await api.startDrill(selectedDrill, trackId, carId)
      setActiveDrill(drill)
      setShowStartModal(false)

      // Notify Electron to start tracking (if connected) or store pending drill
      if ((window as any).electronAPI?.startDrill) {
        (window as any).electronAPI.startDrill({
          id: drill.id,
          type: drill.type,
          targetTime: drill.targetTime,
          targetLaps: drill.targetLaps,
          trackId: drill.trackId,
          carId: drill.carId,
          status: drill.status
        })
      }
    } catch (error: any) {
      setStartError(error.message || 'Failed to start drill')
    }
  }

  const handleAbandonDrill = async () => {
    if (!activeDrill) return

    try {
      await api.abandonDrill(activeDrill.id)
      setActiveDrill(null)

      // Notify Electron
      if ((window as any).electronAPI?.abandonDrill) {
        (window as any).electronAPI.abandonDrill()
      }

      // Refresh history
      const history = await api.getDrillHistory()
      setDrillHistory(history)
    } catch (error) {
      console.error('Failed to abandon drill:', error)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-forseti-bg-primary">
        <DashboardNav />

        <div className="max-w-7xl mx-auto p-6">
          {/* Hero Banner */}
          <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-purple-500/30">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
            </div>

            <div className="relative p-8 md:p-12">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm font-semibold rounded-full flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" />
                      Coaching Drills
                    </span>
                    {!isElectron && (
                      <span className="px-3 py-1 bg-forseti-lime/20 text-forseti-lime text-xs font-medium rounded-full flex items-center gap-1">
                        <Wifi className="w-3 h-3" />
                        Requires Desktop App
                      </span>
                    )}
                  </div>

                  <h1 className="text-3xl md:text-4xl font-bold mb-3">
                    Structured Practice Drills
                  </h1>

                  <p className="text-forseti-text-secondary text-lg mb-6 max-w-2xl">
                    Improve your lap times through focused, measurable practice sessions. Track your progress and earn XP as you beat your personal bests.
                  </p>

                  <div className="flex flex-wrap items-center gap-4 mb-6">
                    <div className="flex items-center gap-2 text-forseti-text-secondary">
                      <Target className="w-4 h-4" />
                      <span>3 Drill Types</span>
                    </div>
                    <div className="flex items-center gap-2 text-forseti-text-secondary">
                      <BarChart3 className="w-4 h-4" />
                      <span>Real-time Delta Tracking</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-400">
                      <Star className="w-4 h-4" />
                      <span className="font-semibold">Up to 200 XP per session</span>
                    </div>
                  </div>

                  {activeDrill && (
                    <div className="bg-forseti-lime/10 border border-forseti-lime/30 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-forseti-lime text-sm font-semibold mb-1">Active Drill</p>
                          <p className="font-bold">{drillTypes.find(d => d.id === activeDrill.type)?.title}</p>
                          <p className="text-sm text-forseti-text-secondary">
                            Target: {formatTime(activeDrill.targetTime)} • {activeDrill.lapsCompleted}/{activeDrill.targetLaps} laps
                          </p>
                        </div>
                        <button
                          onClick={handleAbandonDrill}
                          className="px-3 py-1.5 bg-red-500/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          Abandon
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="hidden md:flex items-center justify-center">
                  <div className="w-32 h-32 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/20">
                    <Timer className="w-16 h-16 text-purple-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mb-6 border-b border-forseti-border">
            <button
              onClick={() => setActiveTab('drills')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'drills'
                  ? 'text-purple-400'
                  : 'text-forseti-text-secondary hover:text-white'
              }`}
            >
              Drills
              {activeTab === 'drills' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'history'
                  ? 'text-purple-400'
                  : 'text-forseti-text-secondary hover:text-white'
              }`}
            >
              History
              {activeTab === 'history' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
              )}
            </button>
          </div>

          {activeTab === 'drills' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {drillTypes.map((drill) => {
                const Icon = drill.icon
                const isActive = activeDrill?.type === drill.id
                return (
                  <div
                    key={drill.id}
                    className={`bg-forseti-bg-card rounded-xl border overflow-hidden transition-colors group ${
                      isActive
                        ? 'border-forseti-lime'
                        : 'border-forseti-border hover:border-purple-500/50'
                    }`}
                  >
                    <div className={`h-2 bg-gradient-to-r ${drill.color}`} />

                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${drill.color} flex items-center justify-center`}>
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getDifficultyColor(drill.difficulty)}`}>
                          {drill.difficulty}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors">
                        {drill.title}
                      </h3>
                      <p className="text-forseti-text-secondary text-sm mb-4">
                        {drill.description}
                      </p>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-forseti-bg-elevated rounded-lg p-3">
                          <p className="text-xs text-forseti-text-secondary mb-1">Laps</p>
                          <p className="font-semibold">{drill.laps}</p>
                        </div>
                        <div className="bg-forseti-bg-elevated rounded-lg p-3">
                          <p className="text-xs text-forseti-text-secondary mb-1">XP Reward</p>
                          <p className="font-semibold text-purple-400">{drill.xpReward}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-forseti-border mb-4">
                        <div className="flex items-center gap-1.5 text-forseti-text-secondary text-sm">
                          <ArrowUpRight className="w-4 h-4 text-green-400" />
                          <span>Avg {drill.avgImprovement}</span>
                        </div>
                      </div>

                      {isActive ? (
                        <div className="w-full py-3 rounded-lg bg-forseti-lime/20 text-forseti-lime text-sm text-center font-semibold">
                          {activeDrill?.status === 'pending' ? 'Pending - Waiting for iRacing' : 'In Progress'}
                        </div>
                      ) : activeDrill ? (
                        <div className="w-full py-3 rounded-lg bg-forseti-bg-elevated text-forseti-text-secondary text-sm text-center">
                          {activeDrill.status === 'pending' ? 'Complete pending drill first' : 'Complete active drill first'}
                        </div>
                      ) : isElectron ? (
                        <button
                          onClick={() => handleStartDrill(drill.id)}
                          className="w-full py-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Start Drill
                        </button>
                      ) : (
                        <div className="w-full py-3 rounded-lg bg-forseti-bg-elevated text-forseti-text-secondary text-sm text-center">
                          Available in Desktop App
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forseti-lime mx-auto mb-4"></div>
                  <p className="text-forseti-text-secondary">Loading history...</p>
                </div>
              ) : drillHistory.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-forseti-text-secondary mx-auto mb-4 opacity-50" />
                  <p className="text-forseti-text-secondary">
                    Your drill history will appear here after your first session.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {drillHistory.map((drill) => {
                    const drillType = drillTypes.find(d => d.id === drill.type)
                    const beatTarget = drill.delta !== null && drill.delta <= 0
                    return (
                      <div
                        key={drill.id}
                        className="bg-forseti-bg-card rounded-xl border border-forseti-border p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${drillType?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                              {drill.status === 'completed' && beatTarget ? (
                                <CheckCircle2 className="w-5 h-5 text-white" />
                              ) : drill.status === 'completed' ? (
                                <XCircle className="w-5 h-5 text-white" />
                              ) : (
                                <X className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold">{drillType?.title || drill.type}</p>
                              <p className="text-sm text-forseti-text-secondary">
                                {new Date(drill.createdAt).toLocaleDateString()} • {drill.trackId} • {drill.carId}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {drill.status === 'completed' ? (
                              <>
                                <p className={`font-bold ${beatTarget ? 'text-green-400' : 'text-red-400'}`}>
                                  {drill.delta !== null && (
                                    <>
                                      {drill.delta >= 0 ? '+' : ''}{drill.delta.toFixed(3)}s
                                    </>
                                  )}
                                </p>
                                <p className="text-sm text-purple-400 font-medium">
                                  +{drill.xpEarned} XP
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-forseti-text-secondary">Abandoned</p>
                            )}
                          </div>
                        </div>
                        {drill.status === 'completed' && drill.actualTime && (
                          <div className="mt-3 pt-3 border-t border-forseti-border flex items-center gap-6 text-sm">
                            <div>
                              <span className="text-forseti-text-secondary">Actual: </span>
                              <span className="font-mono">{formatTime(drill.actualTime)}</span>
                            </div>
                            <div>
                              <span className="text-forseti-text-secondary">Target: </span>
                              <span className="font-mono">{formatTime(drill.targetTime)}</span>
                            </div>
                            <div>
                              <span className="text-forseti-text-secondary">Laps: </span>
                              <span>{drill.lapsCompleted}/{drill.targetLaps}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Start Drill Modal */}
        {showStartModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowStartModal(false)} />
            <div className="relative w-full max-w-md mx-4 bg-forseti-bg-card border border-forseti-border rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Start Drill</h3>

              {startError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">{startError}</p>
                </div>
              )}

              {currentSession ? (
                <div className="mb-4 p-3 bg-forseti-bg-elevated rounded-lg">
                  <p className="text-xs text-forseti-text-secondary mb-1">Current Session</p>
                  <p className="font-semibold">{currentSession.trackName}</p>
                  <p className="text-sm text-forseti-text-secondary">{currentSession.carName}</p>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-400 mb-1">No iRacing Connection</p>
                  <p className="text-sm text-forseti-text-secondary">
                    The drill will be activated automatically when you connect to iRacing. Track and car will be detected from your session.
                  </p>
                </div>
              )}

              <p className="text-forseti-text-secondary mb-6">
                {currentSession
                  ? 'The drill will start tracking after you complete your next lap. Your target time will be based on your historical best for this track and car combination.'
                  : 'Once iRacing connects, the drill will automatically start tracking. Your target time will be calculated based on your historical best for the detected track and car.'}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowStartModal(false)}
                  className="flex-1 px-4 py-3 bg-forseti-bg-elevated text-forseti-text-primary rounded-lg font-semibold hover:bg-forseti-bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStartDrill}
                  className="flex-1 px-4 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors"
                >
                  Start Drill
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

// Loading fallback for Suspense
function CoachingLoading() {
  return (
    <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forseti-lime mx-auto mb-4"></div>
        <p className="text-forseti-text-secondary">Loading coaching drills...</p>
      </div>
    </div>
  )
}

// Main export wrapped in Suspense for Next.js 15 compatibility
export default function CoachingPage() {
  return (
    <Suspense fallback={<CoachingLoading />}>
      <CoachingPageContent />
    </Suspense>
  )
}

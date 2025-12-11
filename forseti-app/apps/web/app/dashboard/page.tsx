'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import DashboardNav from '../components/DashboardNav'
import CircularProgress from '../components/CircularProgress'
import ProtectedRoute from '../components/ProtectedRoute'
import ActivityCard from '../components/ActivityCard'
import OverlayControl from '../components/OverlayControl'
import RankBadge, { RankLevel } from '../components/RankBadge'
import FollowersModal from '../components/FollowersModal'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Check, User, Plus, Loader2, Trophy, Users } from 'lucide-react'
import { api } from '../lib/api'
import { calculateDriverScoresWithAnalysis, ActivityWithTelemetry } from '../utils/calculateDriverScores'

type FilterType = 'all' | 'my' | 'friends'

// Engagement point thresholds for each rank
const RANK_THRESHOLDS = {
  bronze: 0,
  silver: 100,
  gold: 300,
  platinum: 600
}

function calculateRankProgress(points: number, currentRank: RankLevel): number {
  const ranks: RankLevel[] = ['bronze', 'silver', 'gold', 'platinum']
  const currentIndex = ranks.indexOf(currentRank)

  // If platinum, always show 100%
  if (currentRank === 'platinum') return 100

  const currentThreshold = RANK_THRESHOLDS[currentRank]
  const nextRank = ranks[currentIndex + 1] as RankLevel
  const nextThreshold = RANK_THRESHOLDS[nextRank]

  const progress = ((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100
  return Math.min(Math.max(progress, 0), 100)
}

interface User {
  id: string
  name: string
  avatar?: string
}

interface Like {
  id: string
  userId: string
}

interface Comment {
  id: string
  userId: string
  text: string
  createdAt: string
  user: User
  likes: Like[]
}

interface Activity {
  id: string
  userId: string
  game: string
  duration: number
  performance: string
  date: string
  car?: string
  fastestLap?: string
  track?: string
  trackCondition?: string
  description?: string
  user: User
  comments: Comment[]
  likes: Like[]
  telemetry?: {
    lapData?: Array<{
      lapNumber: number
      lapTime: number
      lapTimeFormatted?: string
      telemetryPoints?: Array<{
        speed: number
        throttle: number
        brake: number
        steering: number
        gear: number
        rpm: number
      }>
    }>
    sessionData?: {
      trackName?: string
      carName?: string
      totalLaps?: number
      fastestLapTime?: number
    }
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [myActivities, setMyActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [showFollowersModal, setShowFollowersModal] = useState(false)
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers')
  const [metricsLoading, setMetricsLoading] = useState(true)

  // Calculate driver scores with detailed analysis from user's own activities
  const driverScoresWithAnalysis = useMemo(() => {
    return calculateDriverScoresWithAnalysis(myActivities as ActivityWithTelemetry[])
  }, [myActivities])

  const fetchActivities = async (currentFilter: FilterType = filter) => {
    try {
      setLoading(true)
      const data = await api.getActivities(currentFilter)
      setActivities(data)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }

  // Silent fetch used for small updates from child components (comments/likes)
  // so we don't show the main loading spinner and avoid UI flicker.
  const fetchActivitiesSilent = async (currentFilter: FilterType = filter) => {
    try {
      const data = await api.getActivities(currentFilter)
      setActivities(data)
    } catch (error) {
      console.error('Failed to fetch activities (silent):', error)
    }
  }

  // Fetch user's own activities with telemetry for score calculation
  const fetchMyActivities = async () => {
    try {
      setMetricsLoading(true)
      if (user?.id) {
        // Try to fetch with telemetry first, fall back to regular fetch
        try {
          const data = await api.getUserActivitiesWithTelemetry(user.id)
          setMyActivities(data)
        } catch {
          // Fallback to regular fetch if telemetry endpoint not available
          const data = await api.getUserActivities(user.id)
          setMyActivities(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch my activities:', error)
    } finally {
      setMetricsLoading(false)
    }
  }

  // Fetch follower/following counts
  const fetchRelationshipData = async () => {
    try {
      if (user?.id) {
        const relationship = await api.getRelationship(user.id)
        setFollowersCount(relationship.followersCount)
        setFollowingCount(relationship.followingCount)
      }
    } catch (error) {
      console.error('Failed to fetch relationship data:', error)
    }
  }

  const openFollowersModal = (type: 'followers' | 'following') => {
    setFollowersModalType(type)
    setShowFollowersModal(true)
  }

  useEffect(() => {
    if (user) {
      fetchActivities()
      fetchMyActivities()
      fetchRelationshipData()
    }
  }, [user, filter])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filterOptions = [
    { value: 'all' as FilterType, label: 'All Activities' },
    { value: 'my' as FilterType, label: 'My Activities' },
    { value: 'friends' as FilterType, label: 'Friends Activities' },
  ]

  const selectedFilter = filterOptions.find(opt => opt.value === filter)

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter)
    setDropdownOpen(false)
    fetchActivities(newFilter)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-forseti-bg-primary">
        <DashboardNav />

        <div className="flex">
          {/* Left Panel - User Profile & Metrics */}
          <div className="w-96 bg-forseti-bg-secondary border-r border-forseti-border p-6 space-y-6">
            {/* User Profile */}
            <div className="bg-forseti-bg-card rounded-xl p-6 text-center">
              <div className="mx-auto mb-4 flex justify-center">
                <RankBadge
                  rank={(user?.engagementLevel as RankLevel) || 'bronze'}
                  progress={calculateRankProgress(user?.engagementPoints || 0, user?.engagementLevel as RankLevel || 'bronze')}
                  size="large"
                >
                  <div className="w-full h-full bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-forseti-text-secondary" />
                    )}
                  </div>
                </RankBadge>
              </div>
              {user?.isPro && (
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-forseti-lime rounded-full mx-auto mb-4">
                  <Check className="w-4 h-4 text-forseti-text-inverse" />
                  <span className="text-sm font-bold text-forseti-text-inverse">Pro</span>
                </div>
              )}
              {!user?.isPro && <div className="h-7 mb-4"></div>}

              {/* Founding Driver Badge */}
              {user?.isFoundingDriver && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <img
                    src="/assets/founding_driver_badge.png"
                    alt="Founding Driver"
                    className="w-6 h-6 object-contain"
                  />
                  <span className="text-xs font-semibold text-forseti-lime">Founding Driver</span>
                </div>
              )}

              <h2 className="text-xl font-bold">{user?.name}</h2>
              {user?.username && (
                <p className="text-forseti-text-secondary text-sm mt-1">
                  @{user.username} <span className="text-forseti-text-secondary">(You)</span>
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-forseti-bg-card rounded-xl p-3 text-center">
                <Trophy className="w-5 h-5 text-forseti-lime mx-auto mb-1" />
                <p className="text-xl font-bold">{myActivities.length}</p>
                <p className="text-xs text-forseti-text-secondary">Activities</p>
              </div>
              <button
                onClick={() => openFollowersModal('followers')}
                className="bg-forseti-bg-card rounded-xl p-3 text-center hover:bg-forseti-bg-hover transition-colors"
              >
                <Users className="w-5 h-5 text-forseti-lime mx-auto mb-1" />
                <p className="text-xl font-bold">{followersCount}</p>
                <p className="text-xs text-forseti-text-secondary">Followers</p>
              </button>
              <button
                onClick={() => openFollowersModal('following')}
                className="bg-forseti-bg-card rounded-xl p-3 text-center hover:bg-forseti-bg-hover transition-colors"
              >
                <Users className="w-5 h-5 text-forseti-lime mx-auto mb-1" />
                <p className="text-xl font-bold">{followingCount}</p>
                <p className="text-xs text-forseti-text-secondary">Following</p>
              </button>
            </div>

            {/* Performance Metrics */}
            <div className="flex justify-between gap-4">
              <CircularProgress value={driverScoresWithAnalysis.consistency} label="Consistency" size={100} />
              <CircularProgress value={driverScoresWithAnalysis.efficiency} label="Efficiency" size={100} />
              <CircularProgress value={driverScoresWithAnalysis.technique} label="Technique" size={100} />
            </div>

            {/* Latest Activity */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Latest Activity</h3>
              {myActivities.length > 0 ? (
                <p className="text-xs text-forseti-text-secondary">
                  {myActivities[0].game} - {new Date(myActivities[0].date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              ) : (
                <p className="text-xs text-forseti-text-secondary">No activities yet</p>
              )}
            </div>

            {/* Training Log */}
            <button
              onClick={() => router.push('/coaching?tab=history')}
              className="w-full flex items-center justify-between p-3 bg-forseti-bg-card rounded-lg hover:bg-forseti-bg-hover transition-colors"
            >
              <span className="text-sm font-medium">Your Training Log</span>
              <ChevronRight className="w-4 h-4 text-forseti-text-secondary" />
            </button>
          </div>

          {/* Center Panel - Activity Feed */}
          <div className="flex-1 p-6">
            {/* Feed Header with Filter Dropdown */}
            <div className="flex items-center justify-between mb-6">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-forseti-bg-card rounded-lg border border-forseti-border hover:border-forseti-lime/50 transition-colors"
                >
                  <h1 className="text-xl font-bold">{selectedFilter?.label}</h1>
                  <ChevronDown className={`w-5 h-5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute top-full mt-2 left-0 w-64 bg-forseti-bg-card rounded-lg border border-forseti-border shadow-lg overflow-hidden z-10">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleFilterChange(option.value)}
                        className={`w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors ${
                          filter === option.value ? 'bg-forseti-bg-elevated text-forseti-lime' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{option.label}</span>
                          {filter === option.value && <Check className="w-4 h-4" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => router.push('/activities')}
                className="px-4 py-2 bg-forseti-lime text-forseti-text-inverse font-semibold rounded-lg hover:bg-forseti-lime-hover transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Activity
              </button>
            </div>

            {/* Activity Feed */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-forseti-lime" />
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-6">
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    // Update the specific activity in-place when child provides an authoritative object
                    onUpdate={(updated) => {
                      if (updated) {
                        setActivities(prev => prev.map(a => a.id === updated.id ? updated : a))
                      } else {
                        // Fallback: silent refetch
                        fetchActivitiesSilent()
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-forseti-bg-card rounded-xl p-12 text-center">
                <p className="text-forseti-text-secondary mb-4">
                  {filter === 'my' && 'No activities yet'}
                  {filter === 'friends' && 'No activities from friends yet'}
                  {filter === 'all' && 'No activities to display'}
                </p>
                {filter === 'my' && (
                  <button
                    onClick={() => router.push('/activities')}
                    className="px-6 py-3 bg-forseti-lime text-forseti-text-inverse font-semibold rounded-lg hover:bg-forseti-lime-hover transition-colors"
                  >
                    Log Your First Activity
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Reserved for future development */}
          <div className="w-24 bg-forseti-bg-secondary border-l border-forseti-border p-4">
          </div>
        </div>

        {/* Overlay Control (only visible in Electron) */}
        <OverlayControl />

        {/* Followers/Following Modal */}
        {user && (
          <FollowersModal
            isOpen={showFollowersModal}
            onClose={() => setShowFollowersModal(false)}
            userId={user.id}
            type={followersModalType}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}

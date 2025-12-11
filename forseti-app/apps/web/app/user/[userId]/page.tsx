'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { User, Calendar, Trophy, UserPlus, UserCheck, ArrowLeft, Check, Star, Users } from 'lucide-react'
import ProtectedRoute from '../../components/ProtectedRoute'
import DashboardNav from '../../components/DashboardNav'
import ActivityCard from '../../components/ActivityCard'
import RankBadge, { RankLevel } from '../../components/RankBadge'
import SubscriptionModal from '../../components/SubscriptionModal'
import UnsubscribeModal from '../../components/UnsubscribeModal'
import FollowersModal from '../../components/FollowersModal'
import { useAuth } from '../../context/AuthContext'
import { useSocial } from '../../context/SocialContext'
import { api } from '../../lib/api'
import CircularProgress from '../../components/CircularProgress'
import { calculateDriverScores } from '../../utils/calculateDriverScores'

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
  description?: string
  user: {
    id: string
    name: string
    avatar?: string
  }
  comments: any[]
  likes: any[]
}

interface UserProfile {
  id: string
  name: string
  username: string
  email: string
  avatar?: string
  bio?: string
  isPro?: boolean
  isFoundingDriver?: boolean
  engagementLevel?: string
  engagementPoints?: number
}

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

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const { followUser, unfollowUser, isFollowing, areFriends } = useSocial()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [showFollowersModal, setShowFollowersModal] = useState(false)
  const [followersModalType, setFollowersModalType] = useState<'followers' | 'following'>('followers')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false)

  const userId = params.userId as string

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // First resolve the user (by id or username) to get the canonical id
        const userProfile = await api.getUser(userId)
        setProfile(userProfile)

        // Use the canonical UUID id when fetching activities so the API
        // /api/activities/user/:userId receives an actual user id rather than a username
        const userActivities = await api.getUserActivities(userProfile.id)
        setActivities(userActivities)

        // Fetch relationship data (includes follower/following counts)
        const relationship = await api.getRelationship(userProfile.id)
        setFollowersCount(relationship.followersCount)
        setFollowingCount(relationship.followingCount)

        // Check subscription status if viewing a Pro driver's profile
        if (userProfile.isPro && currentUser?.id !== userProfile.id) {
          try {
            const subStatus = await api.checkSubscription(userProfile.id)
            setIsSubscribed(subStatus.isSubscribed)
          } catch (err) {
            // Ignore subscription check errors
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [userId])

  const handleFollow = async () => {
    if (!profile) return

    try {
      const targetId = profile.id
      if (isFollowing(targetId)) {
        await unfollowUser(targetId)
      } else {
        await followUser(targetId, profile.name)
      }
    } catch (error) {
      console.error('Follow action failed:', error)
    }
  }

  // Calculate stats from activities
  const totalActivities = activities.length
  const totalHours = Math.round(activities.reduce((sum, a) => sum + a.duration, 0) / 60)
  const avgPerformance = activities.length > 0
    ? Math.round(activities.reduce((sum, a) => {
        const perf = parseInt(a.performance.replace('%', ''))
        return sum + perf
      }, 0) / activities.length)
    : 0

  // Calculate driver performance scores
  const driverScores = calculateDriverScores(activities)

  const openFollowersModal = (type: 'followers' | 'following') => {
    setFollowersModalType(type)
    setShowFollowersModal(true)
  }

  const fetchActivities = async () => {
    try {
      const userActivities = await api.getUserActivities(userId)
      setActivities(userActivities)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-forseti-bg-primary">
          <DashboardNav />
          <div className="flex items-center justify-center h-96">
            <p className="text-forseti-text-secondary">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!profile) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-forseti-bg-primary">
          <DashboardNav />
          <div className="flex items-center justify-center h-96">
            <p className="text-forseti-text-secondary">User not found</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const isOwnProfile = currentUser?.id === profile.id

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-forseti-bg-primary">
        <DashboardNav />

        <div className="flex min-h-[calc(100vh-64px)]">
          {/* Left Panel - User Profile & Metrics */}
          <div className="w-96 bg-forseti-bg-secondary border-r border-forseti-border p-6 space-y-6 flex flex-col">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-forseti-text-secondary hover:text-forseti-lime transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>

            {/* User Profile */}
            <div className="bg-forseti-bg-card rounded-xl p-6 text-center">
              <div className="mx-auto mb-4 flex justify-center">
                <RankBadge
                  rank={(profile.engagementLevel as RankLevel) || 'bronze'}
                  progress={calculateRankProgress(profile.engagementPoints || 0, profile.engagementLevel as RankLevel || 'bronze')}
                  size="large"
                >
                  <div className="w-full h-full bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-forseti-text-secondary" />
                    )}
                  </div>
                </RankBadge>
              </div>
              {profile.isPro && (
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-forseti-lime rounded-full mx-auto mb-4">
                  <Check className="w-4 h-4 text-forseti-text-inverse" />
                  <span className="text-sm font-bold text-forseti-text-inverse">Pro</span>
                </div>
              )}
              {!profile.isPro && <div className="h-7 mb-4"></div>}

              {/* Founding Driver Badge */}
              {profile.isFoundingDriver && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <img
                    src="/assets/founding_driver_badge.png"
                    alt="Founding Driver"
                    className="w-6 h-6 object-contain"
                  />
                  <span className="text-xs font-semibold text-forseti-lime">Founding Driver</span>
                </div>
              )}

              {/* Subscribe Button for Pro Drivers */}
              {profile.isPro && !isOwnProfile && (
                isSubscribed ? (
                  <button
                    onClick={() => setShowUnsubscribeModal(true)}
                    className="w-full mb-4 px-4 py-2 bg-forseti-lime/20 text-forseti-lime font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500 border border-transparent transition-colors group"
                  >
                    <Check className="w-4 h-4 group-hover:hidden" />
                    <span className="group-hover:hidden">Subscribed</span>
                    <span className="hidden group-hover:inline">Unsubscribe</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSubscriptionModal(true)}
                    className="w-full mb-4 px-4 py-2 bg-gradient-to-r from-forseti-lime to-green-400 text-forseti-text-inverse font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Star className="w-4 h-4 fill-current" />
                    Subscribe
                  </button>
                )
              )}

              <h2 className="text-xl font-bold">{profile.name}</h2>
              {profile.username && (
                <p className="text-forseti-text-secondary text-sm mt-1">@{profile.username}</p>
              )}
              {profile.bio && (
                <p className="text-forseti-text-secondary text-sm mt-3">{profile.bio}</p>
              )}

              {/* Follow/Friend Button */}
              {!isOwnProfile && (
                <button
                  onClick={handleFollow}
                  className={`w-full mt-4 px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                areFriends(profile.id)
                ? 'bg-forseti-lime/20 text-forseti-lime hover:bg-forseti-lime/30'
                : isFollowing(profile.id)
                      ? 'bg-forseti-bg-elevated text-forseti-text-secondary hover:bg-forseti-bg-hover'
                      : 'bg-forseti-lime text-forseti-text-inverse hover:bg-forseti-lime-hover'
                  }`}
                >
                  {areFriends(profile.id) ? (
                    <>
                      <UserCheck className="w-5 h-5" />
                      Friends
                    </>
                  ) : isFollowing(profile.id) ? (
                    'Following'
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Follow
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-forseti-bg-card rounded-xl p-3 text-center">
                <Trophy className="w-5 h-5 text-forseti-lime mx-auto mb-1" />
                <p className="text-xl font-bold">{totalActivities}</p>
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

            {/* Performance Metrics - only visible on own profile */}
            {isOwnProfile && (
              <div className="flex justify-between gap-4">
                <CircularProgress value={driverScores.consistency} label="Consistency" size={100} />
                <CircularProgress value={driverScores.efficiency} label="Efficiency" size={100} />
                <CircularProgress value={driverScores.technique} label="Technique" size={100} />
              </div>
            )}
          </div>

          {/* Center Panel - Activity Feed */}
          <div className="flex-1 p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">{profile.name}'s Activities</h1>
            </div>

            {/* Activity Feed */}
            {activities.length === 0 ? (
              <div className="bg-forseti-bg-card rounded-xl p-12 text-center">
                <p className="text-forseti-text-secondary">No activities yet</p>
              </div>
            ) : (
              <div className="space-y-6">
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onUpdate={(updated) => {
                      if (updated) {
                        setActivities(prev => prev.map(a => a.id === updated.id ? updated : a))
                      } else {
                        fetchActivities()
                      }
                    }}
                    isProDriverSubscribed={profile.isPro && !isOwnProfile ? isSubscribed : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Panel - Teams (only on own profile) */}
          {isOwnProfile && (
            <div className="w-24 bg-forseti-bg-secondary border-l border-forseti-border p-4 flex flex-col items-center">
              <h2 className="text-xs font-bold mb-4 text-center">Teams</h2>
              <div className="space-y-3 flex flex-col items-center">
                {[1, 2, 3].map((team) => (
                  <div key={team} className="w-10 h-10 bg-forseti-bg-elevated rounded-full flex items-center justify-center">
                    <span className="text-sm">🎮</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Subscription Modal */}
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          driverName={profile.name}
          driverId={profile.id}
          onSubscribe={() => setIsSubscribed(true)}
        />

        {/* Unsubscribe Modal */}
        <UnsubscribeModal
          isOpen={showUnsubscribeModal}
          onClose={() => setShowUnsubscribeModal(false)}
          driverName={profile.name}
          driverId={profile.id}
          onUnsubscribe={() => setIsSubscribed(false)}
        />

        {/* Followers/Following Modal */}
        <FollowersModal
          isOpen={showFollowersModal}
          onClose={() => setShowFollowersModal(false)}
          userId={profile.id}
          type={followersModalType}
        />
      </div>
    </ProtectedRoute>
  )
}

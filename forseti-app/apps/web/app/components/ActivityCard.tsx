"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocial } from '../context/SocialContext'
import { ChevronDown, Eye, MessageSquare, Share2, User, Send, Heart, Trash2, Edit, Check, Lock, Thermometer, Sun, CloudRain, Download, BarChart3 } from 'lucide-react'
import { api } from '../lib/api'
import { formatMinutesToHMM, formatSecondsToHMM } from '../lib/format'
import { useRouter } from 'next/navigation'
import MentionInput from './MentionInput'
import ConfirmModal from './ConfirmModal'
import ShareModal from './ShareModal'
import MediaGallery from './MediaGallery'
import UserActivitySelectorModal from './UserActivitySelectorModal'
import { ActivityMedia } from '../types/api'

interface Track {
  id: string
  name: string
  location: string
  svgPath: string
  viewBox: string
}

const TRACKS: Track[] = [
  {
    id: 'silverstone-gp',
    name: 'Silverstone Grand Prix',
    location: 'United Kingdom',
    svgPath: 'M25.198 30.229c-0.31456 1.0094-0.61942 2.0209-0.91904 3.0341-7.834 29.626-14.076 59.7-19.349 89.878-2.535 14.71-1.4856 31.043 8.2385 43.106 10.041 12.782 21.82 24.306 34.577 34.354 5.1918 4.5054 12.826 4.0455 18.004-0.22327 6.4174-3.2681 10.111-11.816 5.677-18.13-5.8251-10.346-19.237-11.651-26.639-20.171-5.6049-6.4993 0.19048-15.56 6.5585-18.909 45.445-27.169 91.127-54.08 137.35-79.839 5.1495-2.9902 10.946-2.7674 16.099-0.0654 10.1 4.7029 20.624 10.845 26.727 20.5 0.0808 3.862-6.0487 2.961-8.6128 3.5071-8.2501 0.97774-17.512-2.1461-25.203 1.9076-4.99 4.9203-0.70564 12.71 0.60533 18.304 4.8212 16.032 13.674 31.093 14.992 47.993-0.24271 16.885-12.901 30.252-16.443 46.332-0.84301 13.01 8.7895 23.588 15.052 34.056 14.712 22.13 31.592 42.83 45.602 65.396 5.8177 10.093 14.253 22.064 27.225 21.989 11.47 0.59815 25.629-0.96669 32.419-11.47 3.6727-5.7698-0.13079-12.116-1.8021-17.732 2.7607-4.9306 10.108-5.2048 14.709-7.9877 20.668-8.6102 40.531-19.776 63.083-22.553 9.496-1.5148 20.474-3.8364 25.382-13.169 4.2381-8.1269 5.1636-18.83-1.0634-26.27-21.629-32.654-51.613-58.448-77.982-87.076-17.562-18.913-36.653-36.457-53.119-56.32-9.2011-11.84-6.159-30.331-18.353-40.334-7.1588-4.9033-16.375-4.6729-24.132-1.3651-9.4575 4.7376-20.293 1.5097-28.217-4.6666-8.7547-6.032-17.465-16.33-29.387-13.706-8.8381 1.3902-17.885 3.6991-26.562 0.60162-35.41-9.071-71.544-19.259-108.45-17.175-10.471 0.0557-19.533 7.548-22.868 17.252-1.2385 2.9204-2.2695 5.9229-3.2131 8.951z',
    viewBox: '0 0 425.69 327.11',
  },
  {
    id: 'silverstone-national',
    name: 'Silverstone National',
    location: 'United Kingdom',
    svgPath: 'M1750 2153 c-19 -2 -143 -12 -275 -24 -324 -27 -528 -54 -597 -78 -77 -26 -189 -100 -258 -169 -47 -48 -66 -80 -123 -204 -58 -126 -67 -154 -67 -203 0 -96 37 -135 128 -135 96 0 146 62 158 198 4 39 15 84 24 100 22 36 68 47 113 28 45 -19 636 -537 857 -752 197 -191 285 -246 391 -246 103 0 176 66 165 149 -7 56 -52 144 -77 150 -17 5 -19 15 -19 123 0 65 -5 164 -10 221 -22 222 -102 615 -140 689 -52 102 -159 163 -270 153z',
    viewBox: '400 0 2200 2900',
  },
  {
    id: 'brands-hatch',
    name: 'Brands Hatch',
    location: 'United Kingdom',
    svgPath: 'M269.362,381.152c-1.752,4.805-14.266,26.431-54.75,1.468  c-40.836-20.417-43.842-20.557-48.876-23.703c-5.034-3.147-26.641-16.012-40.904-32.514c-14.265-16.502-21.956-21.675-17.901-37.198  c4.056-15.523,26.989-28.318,30.625-30.907c3.637-2.587,37.619-28.109,37.619-28.109s14.403-13.005,3.635-28.248  c-10.767-15.244-29.507-4.895-29.507-4.895s-72.964,46.045-76.775,48.526c-9.265,6.258-23.712,19.891-27.466,48.537  c-2.588,19.753,6.874,49.39,35.018,68.094c5.104,3.006,143.34,75.937,143.34,75.937s38.598,23.493,77.335,13.284  c38.737-10.207,45.169-39.016,45.729-45.449c0.561-6.433-4.754-30.486-4.754-30.486l-27.27-139.705c0,0-11.748-30.207,33.981-33.982  c45.73-3.776,47.933-9.125,53.701-10.909c5.77-1.783,36.081-11.747,42.373-46.568c0,0,8.706-39.751,9.439-44.681  c0.734-4.929,3.356-43.212-27.06-69.014c0,0-27.06-22.025-58.525-15.313c-31.465,6.713-109.289,29.158-112.646,29.997  c-3.355,0.839-38.178,3.776-36.29,42.164c1.888,38.388,13.005,126.28,13.005,126.28s2.623,42.898,3.147,45.101  c0.524,2.203,6.607,33.667,14.473,45.1C257.93,315.389,276.703,361.015,269.362,381.152z',
    viewBox: '0 0 520 468',
  },
  {
    id: 'monza',
    name: 'Autodromo di Monza',
    location: 'Italy',
    svgPath: 'M4.1168 29.337c0.31529 7.0558 4.5029 17.045 11.051 32.041 5.5664 12.748 11.227 26.92 12.581 31.494l2.4617 8.3161 4.9113 1.8458c3.6733 1.3807 4.9623 2.4052 5.1167 4.0668 1.4707 15.824 14.607 90.607 17.266 98.292 13.174 38.07 37.939 53.878 83.405 53.242 8.5475-0.11959 15.777-0.10051 16.066 0.0419 0.89783 0.44296 16.804-3.6907 25.946-6.7417 10.262-3.4247 11.317-3.2977 11.731 1.404 0.4861 5.5195-10.851 4.979 107.36 5.1105 18.222 0.0203 53.258 0.31975 77.858 0.66418l44.727 0.62532 26.813-3.3104c41.557-5.1328 54.488-12.178 59.87-32.614 2.5346-9.6255 1.5217-13.709-5.1803-20.862-4.7926-5.1156-7.924-5.7604-29.609-6.1076-10.622-0.17006-56.324-0.87618-101.56-1.5688-104.09-1.5937-99.307-1.2621-104.12-7.2232-5.3784-6.6565-14.936-9.4315-25.946-7.532-8.6364 1.4899-5.0705 3.9952-35.389-24.849-88.19-83.874-79.74-74.371-119-133.8-13.676-20.684-10.76-19.425-35.3-15.25-38.153 6.49-51.665 9.267-51.063 22.737z',
    viewBox: '0 0 516.66 263.84',
  },
  {
    id: 'spa',
    name: 'Spa-Francorchamps',
    location: 'Belgium',
    svgPath: 'M4.447 290.28c0.13184 1.3988 0.74128 2.2328 1.7024 3.099 3.1469 2.8362 3.8732 2.3848 55.153-34.244 9.0175-6.4412 22.107-15.77 29.088-20.731 6.9814-4.9613 16.982-12.298 22.221-16.304 11.174-8.5434 12.382-8.6379 13.16-1.0174 0.54917 5.3802 2.4784 8.4052 5.1728 8.1124 2.8403-0.30871 42.138-7.3767 46.568-8.3756 7.9514-1.7928 19.679-6.7943 48.071-20.501 32.219-15.554 31.603-15.443 51.861-9.2555 43.482 13.281 49.67 17.893 74.11 55.221 24.907 38.042 51.388 59.761 81.957 67.22 23.646 5.77 29.868 2.9279 43.646-19.937 14.583-24.2 13.956-28.601-5.4188-38.008-42.141-20.461-41.397-19.922-42.514-30.746-0.47537-4.6053-0.14507-6.2471 1.9454-9.6576 5.1232-8.3583 5.3844-15.657 0.83218-23.295-4.202-7.0498-5.1079-7.4255-46.575-19.273-57.071-16.305-61.474-19.592-63.138-47.139-1.3409-22.191 2.522-26.753 28.962-34.216 38.939-10.991 52.214-15.463 71.271-24.002 27.146-12.163 25.84-12.368 39.668 6.2288 15.126 20.343 27.926 24.049 33.803 9.784 3.2206-7.8173 2.0733-9.7848-23.497-40.265-33.33-39.73-30.5-38.063-52.21-30.777-16.833 5.6483-18.917 5.4528-25.042-2.3521-3.4734-4.4259-7.0086-5.9408-12.528-5.3669-3.732 0.38809-9.7271 2.6943-72.638 27.956-113.06 45.398-110.63 44.288-129.17 59.016-30.773 24.434-45.366 34.512-52.808 36.471-17.988 4.7355-24.603 9.4903-30.154 21.676-3.8076 8.3581-9.6687 15.229-32.851 38.511-32.393 32.533-39.987 43.72-53.2 78.344-5.6978 14.931-7.7238 20.746-7.4337 23.823z',
    viewBox: '0 0 501.68 320.49',
  },
]

interface User {
  id: string
  name: string
  avatar?: string
  username?: string
  isPro?: boolean
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
  description?: string
  isPrivate?: boolean
  trackTemperature?: number
  airTemperature?: number
  trackCondition?: string
  setupFilename?: string
  setupPath?: string
  user: User
  comments: Comment[]
  likes: Like[]
  media?: ActivityMedia[]
  telemetry?: {
    id: string
    createdAt: string
  }
}

interface ActivityCardProps {
  activity: Activity
  // Parent can pass a callback which optionally receives an authoritative
  // updated Activity object. When provided we call onUpdate(updated) so the
  // parent can update its list in-place without toggling page-level loading.
  onUpdate?: (updated?: Activity) => void
  // Parent can pass subscription status for pro driver activities (e.g., when viewing a pro driver's profile)
  // This overrides the internal subscription check when provided
  isProDriverSubscribed?: boolean
}

export default function ActivityCard({ activity, onUpdate, isProDriverSubscribed }: ActivityCardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { refreshNotifications } = useSocial()
  // Keep local state in sync with incoming prop to avoid UI flicker when parent
  // re-fetches activities and passes a new object instance.
  const [comments, setComments] = useState<Comment[]>(activity.comments || [])
  const [likes, setLikes] = useState<Like[]>(activity.likes || [])

  // When the activity prop changes, replace local lists so the UI reflects server state.
  // This avoids a case where optimistic updates are overwritten by stale props.
  useEffect(() => {
    // If the parent passed a full activity with comments/likes arrays, use them.
    if (Array.isArray(activity.comments)) {
      setComments(activity.comments || [])
    } else {
      // If parent passed a sanitized DTO (no comments array) but there are comments
      // according to commentsCount, fetch the full activity to populate comments.
      const maybeCount = (activity as any).commentsCount
      if (typeof maybeCount === 'number' && maybeCount > 0) {
        let cancelled = false
        ;(async () => {
          try {
            const fresh = await api.getActivityById(activity.id)
            if (!cancelled) setComments(fresh.comments || [])
          } catch (e) {
            // ignore
          }
        })()
        return () => { cancelled = true }
      } else {
        // No comments present
        setComments([])
      }
    }

    if (Array.isArray(activity.likes)) {
      setLikes(activity.likes || [])
    } else {
      const maybeLikes = (activity as any).likesCount
      if (typeof maybeLikes === 'number') {
        // We don't need to fetch for likes only unless we need authoritative list
        // Keep local likes as-is (avoid clearing optimistic state)
      } else {
        setLikes([])
      }
    }
  }, [
    activity.id,
    // Use numeric primitives only so the dependency array length and types remain stable
    Array.isArray(activity.comments) ? activity.comments.length : 0,
    Array.isArray(activity.likes) ? activity.likes.length : 0,
    Number((activity as any).commentsCount || 0),
    Number((activity as any).likesCount || 0),
  ])
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [isLiked, setIsLiked] = useState(
    activity.likes?.some(like => like.userId === user?.id) || false
  )
  // Use parent-provided subscription status if available, otherwise fetch it
  const [isSubscribed, setIsSubscribed] = useState(isProDriverSubscribed ?? false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasMatchingActivities, setHasMatchingActivities] = useState<boolean | null>(null)
  const [matchingActivitiesLoading, setMatchingActivitiesLoading] = useState(false)
  const [showUserActivitySelector, setShowUserActivitySelector] = useState(false)

  // Check if user is subscribed to the activity owner (for setup downloads and telemetry access)
  useEffect(() => {
    // If parent already provided subscription status, use it
    if (isProDriverSubscribed !== undefined) {
      setIsSubscribed(isProDriverSubscribed)
      return
    }

    const ownActivity = user?.id === activity.userId
    if (!user || ownActivity) return

    // Check subscription if owner is a pro driver and has setup or telemetry
    const needsSubscriptionCheck = activity.user?.isPro && (activity.setupFilename || activity.telemetry)
    if (!needsSubscriptionCheck) return

    const checkSubscription = async () => {
      try {
        const subscriptions = await api.getSubscriptions()
        const subscribed = subscriptions.some((sub: any) => sub.driverId === activity.userId)
        setIsSubscribed(subscribed)
      } catch (error) {
        console.error('Failed to check subscription:', error)
      }
    }

    checkSubscription()
  }, [user, activity.userId, activity.setupFilename, activity.telemetry, activity.user?.isPro, isProDriverSubscribed])

  // Check if user has matching activities for telemetry comparison (same car/track)
  useEffect(() => {
    const ownActivity = user?.id === activity.userId
    // Only check for matching activities when viewing a subscribed pro driver's activity with telemetry
    if (!activity.user?.isPro || ownActivity || !isSubscribed || !activity.telemetry || !activity.car || !activity.track) {
      setHasMatchingActivities(null)
      return
    }

    const checkMatchingActivities = async () => {
      if (!user) return
      setMatchingActivitiesLoading(true)
      try {
        const myActivities = await api.getMyActivitiesFiltered(activity.car, activity.track)
        setHasMatchingActivities(myActivities.length > 0)
      } catch (error) {
        console.error('Failed to check matching activities:', error)
        setHasMatchingActivities(false)
      } finally {
        setMatchingActivitiesLoading(false)
      }
    }

    checkMatchingActivities()
  }, [user, activity.userId, activity.car, activity.track, activity.user?.isPro, isSubscribed, activity.telemetry])

  const handleDownloadSetup = async () => {
    if (!user || isDownloading) return

    setIsDownloading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/activities/${activity.id}/setup`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('forseti_token')}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to download setup')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = activity.setupFilename || 'setup.sto'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      console.error('Failed to download setup:', error)
      alert(error.message || 'Failed to download setup')
    } finally {
      setIsDownloading(false)
    }
  }

  // Note: Duration should always be stored in activity.duration (minutes).
  // We no longer rely on sessionStorage for duration display as it's not persistent.

  const handleAddComment = async (mentionedUserIds: string[]) => {
    if (!commentText.trim() || !user) return

    try {
      // Optimistically clear input and then sync server state
      const newComment = await api.addComment(activity.id, commentText, mentionedUserIds)
      setCommentText('')
      // Refresh notifications
      await refreshNotifications()

      // Fetch the authoritative activity and update local comments/likes
      try {
        const fresh = await api.getActivityById(activity.id)
        setComments(fresh.comments || [])
        setLikes(fresh.likes || [])
        setIsLiked(Boolean(fresh.likes?.some(l => l.userId === user.id)))
        if (onUpdate) onUpdate(fresh)
      } catch (err) {
        // If the single-activity fetch fails, fall back to appending the created comment
        setComments(prev => [...prev, newComment])
        if (onUpdate) onUpdate()
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  // Helper to parse @usernames from the comment text
  const parseMentionUsernames = (text: string) => {
    const mentionRegex = /@([\w-]+)/g
    const matches = text.matchAll(mentionRegex)
    return Array.from(matches, m => m[1] as string)
  }

  // When user clicks the Send button we need to resolve mentioned usernames to IDs
  const handleSendClick = async () => {
    if (!commentText.trim() || !user) return
    // Extract mentioned usernames and send them to the server. The server will
    // resolve usernames to canonical ids and create mention notifications.
    const usernames = parseMentionUsernames(commentText)
    await handleAddComment(usernames)
  }

  const handleLike = async () => {
    if (!user) return

    try {
      const result = await api.likeActivity(activity.id)
      const liked = result && (result as any).liked

      // Optimistically update UI then reconcile with server state
      setIsLiked(Boolean(liked))
      if (liked) {
        setLikes(prev => [...prev, { id: Date.now().toString(), userId: user.id }])
      } else {
        setLikes(prev => prev.filter(like => like.userId !== user.id))
      }

      await refreshNotifications()

      // Re-sync authoritative activity state to avoid being overwritten by parent list
      try {
        const fresh = await api.getActivityById(activity.id)
        setComments(fresh.comments || [])
        setLikes(fresh.likes || [])
        setIsLiked(Boolean(fresh.likes?.some(l => l.userId === user.id)))
        if (onUpdate) onUpdate(fresh)
      } catch (err) {
        // ignore fetch errors; keep optimistic state
        if (onUpdate) onUpdate()
      }
    } catch (error) {
      console.error('Failed to like activity:', error)
    }
  }

  const handleDelete = async () => {
    if (!user || user.id !== activity.userId) return
    // Open themed confirm modal
    setShowConfirm(true)
  }

  const handleEdit = () => {
    router.push(`/activities/edit/${activity.id}`)
  }

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const isOwnActivity = user?.id === activity.userId

  // Get track data
  const trackData = TRACKS.find(track => track.id === activity.track)

  // Check if full telemetry data is available from Forseti (needs all: car, fastest lap, and track)
  const hasFullTelemetry = !!(activity.car && activity.fastestLap && activity.track)

  return (
    <div className="bg-forseti-bg-card rounded-xl p-6 mb-6">
      <ConfirmModal
        isOpen={showConfirm}
        title="Delete activity"
        description="Are you sure you want to delete this activity? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => {
          setShowConfirm(false)
          try {
            await api.deleteActivity(activity.id)
            if (onUpdate) onUpdate()
          } catch (error) {
            console.error('Failed to delete activity:', error)
            alert('Failed to delete activity. Please try again.')
          }
        }}
        onCancel={() => setShowConfirm(false)}
      />
      <ShareModal isOpen={showShare} url={`${window.location.origin}/activities/${activity.id}`} onClose={() => setShowShare(false)} />
      <div className="flex items-start justify-between mb-4">
        <button
          onClick={() => {
            const target = activity.user?.id || activity.userId
            if (target === user?.id) {
              router.push('/dashboard')
            } else {
              router.push(`/user/${activity.user.username || activity.userId}`)
            }
          }}
          className="flex items-center gap-4 hover:opacity-80 transition-opacity text-left"
        >
          <div className="w-12 h-12 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden relative">
            {activity.user.avatar ? (
              <img src={activity.user.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-forseti-text-secondary" />
            )}
            {/* presence dot removed per user request */}
          </div>
          <div>
            <h3 className="font-bold">{activity.user.name}</h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-forseti-text-secondary">
                {formatDate(activity.date)}
              </p>
              {activity.isPrivate && (
                <span className="flex items-center gap-1 text-xs text-forseti-text-secondary bg-forseti-bg-elevated px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" />
                  Private
                </span>
              )}
            </div>
          </div>
        </button>
        {isOwnActivity && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors"
            >
              <ChevronDown className="w-5 h-5 text-forseti-text-secondary" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-forseti-bg-elevated border border-forseti-border rounded-lg shadow-lg overflow-hidden z-10">
                <button
                  onClick={() => {
                    handleEdit()
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Activity</span>
                </button>
                <button
                  onClick={() => {
                    handleDelete()
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors flex items-center gap-2 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Activity</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{trackData?.name || activity.track || activity.game}</h2>
      </div>

      {/* Description */}
      {activity.description && (
        <p className="text-forseti-text-secondary mb-4">{activity.description}</p>
      )}

      {/* Telemetry Analysis Button - show only on user's own activities with telemetry data */}
      {activity.telemetry && isOwnActivity && (
        <button
          onClick={() => router.push(`/analyst/${activity.id}`)}
          className="mb-4 flex items-center gap-1.5 bg-forseti-lime/10 border border-forseti-lime/20 rounded-full px-2.5 py-1 hover:bg-forseti-lime/20 transition-colors"
        >
          <div className="w-4 h-4 rounded-full bg-forseti-lime flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-forseti-bg-card stroke-[3]" />
          </div>
          <span className="text-xs font-medium text-forseti-lime">View Telemetry Analysis</span>
        </button>
      )}

      {/* Compare Telemetry Button - show on pro driver activities for subscribed users with matching car/track */}
      {activity.telemetry && activity.user?.isPro && !isOwnActivity && isSubscribed && activity.car && activity.track && (
        <div className="mb-4">
          {matchingActivitiesLoading ? (
            <button disabled className="flex items-center gap-1.5 bg-forseti-bg-elevated border border-forseti-border rounded-full px-2.5 py-1 opacity-50">
              <div className="w-3 h-3 border-t-2 border-blue-400 rounded-full animate-spin"></div>
              <span className="text-xs text-forseti-text-secondary">Checking your sessions...</span>
            </button>
          ) : hasMatchingActivities ? (
            <button
              onClick={() => setShowUserActivitySelector(true)}
              className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1 hover:bg-blue-500/20 transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-blue-400">Compare your Telemetry with PRO driver</span>
            </button>
          ) : hasMatchingActivities === false ? (
            <div
              className="flex items-center gap-1.5 bg-forseti-bg-elevated border border-forseti-border rounded-full px-2.5 py-1 opacity-50 cursor-not-allowed"
              title={`You have no sessions with ${activity.car} at ${activity.track}`}
            >
              <BarChart3 className="w-4 h-4 text-forseti-text-secondary" />
              <span className="text-xs text-forseti-text-secondary">No matching sessions to compare</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-wrap gap-8 mb-6">
        {activity.car && (
          <div>
            <p className="text-xs text-forseti-text-secondary mb-1">Car</p>
            <p className="text-xl font-bold">{activity.car}</p>
          </div>
        )}
        {activity.fastestLap && (
          <div>
            <p className="text-xs text-forseti-text-secondary mb-1">Fastest Lap</p>
            <p className="text-xl font-bold">{activity.fastestLap}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-forseti-text-secondary mb-1">Duration</p>
          <p className="text-xl font-bold">{
            // Display activity.duration (minutes) using H:MM format
            (typeof activity.duration === 'number' && !isNaN(activity.duration) && activity.duration > 0)
              ? formatMinutesToHMM(activity.duration)
              : '0m'
          }</p>
        </div>
        {/* Track Temperature */}
        {activity.trackTemperature != null && (
          <div>
            <p className="text-xs text-forseti-text-secondary mb-1">Track Temp</p>
            <div className="flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-forseti-text-secondary" />
              <p className="text-xl font-bold">{Math.round(activity.trackTemperature)}°C</p>
            </div>
          </div>
        )}
        {/* Air Temperature */}
        {activity.airTemperature != null && (
          <div>
            <p className="text-xs text-forseti-text-secondary mb-1">Air Temp</p>
            <div className="flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-forseti-text-secondary" />
              <p className="text-xl font-bold">{Math.round(activity.airTemperature)}°C</p>
            </div>
          </div>
        )}
        {/* Track Condition */}
        {activity.trackCondition && (
          <div>
            <p className="text-xs text-forseti-text-secondary mb-1">Condition</p>
            <div className="flex items-center gap-1.5">
              {activity.trackCondition === 'wet' ? (
                <CloudRain className="w-4 h-4 text-blue-400" />
              ) : (
                <Sun className="w-4 h-4 text-yellow-400" />
              )}
              <p className="text-xl font-bold capitalize">{activity.trackCondition}</p>
            </div>
          </div>
        )}
        {/* Performance metric intentionally hidden by user preference */}
      </div>

      {/* Setup Download Button */}
      {activity.setupFilename && (
        <div className="mb-4">
          {isOwnActivity ? (
            <button
              onClick={handleDownloadSetup}
              disabled={isDownloading}
              className="flex items-center gap-2 bg-forseti-bg-elevated border border-forseti-border rounded-lg px-3 py-2 hover:bg-forseti-bg-hover transition-colors text-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-forseti-lime" />
              <span>{isDownloading ? 'Downloading...' : `Download Setup (${activity.setupFilename})`}</span>
            </button>
          ) : isSubscribed ? (
            <button
              onClick={handleDownloadSetup}
              disabled={isDownloading}
              className="flex items-center gap-2 bg-forseti-lime/10 border border-forseti-lime/20 rounded-lg px-3 py-2 hover:bg-forseti-lime/20 transition-colors text-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-forseti-lime" />
              <span className="text-forseti-lime">{isDownloading ? 'Downloading...' : `Download Setup (${activity.setupFilename})`}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-forseti-bg-elevated border border-forseti-border rounded-lg px-3 py-2 text-sm text-forseti-text-secondary">
              <Lock className="w-4 h-4" />
              <span>Setup available for subscribers</span>
            </div>
          )}
        </div>
      )}

      {/* Track Visualization */}
      {trackData && (
        <div className="bg-forseti-bg-elevated rounded-lg p-8 mb-4 relative overflow-hidden">
          <div className="opacity-30">
            <svg className="w-full h-64" viewBox={trackData.viewBox}>
              <path
                d={trackData.svgPath}
                stroke="#666666"
                strokeWidth={trackData.id === 'silverstone-national' ? "16" : "2"}
                fill="none"
              />
            </svg>
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <svg className="w-full h-64" viewBox={trackData.viewBox}>
              <path
                d={trackData.svgPath}
                stroke="#B7FF00"
                strokeWidth={trackData.id === 'silverstone-national' ? "24" : "3"}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Media Gallery - Grid layout under track */}
      {activity.media && activity.media.length > 0 && (
        <MediaGallery media={activity.media} layout="grid" />
      )}

      {/* Actions */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-forseti-border">
        <button
          onClick={handleLike}
          className={`p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors flex items-center gap-2 ${
            isLiked ? 'text-red-500' : ''
          }`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : 'text-forseti-text-secondary'}`} />
          <span className="text-sm text-forseti-text-secondary">{likes.length}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors flex items-center gap-2"
        >
          <MessageSquare className="w-5 h-5 text-forseti-text-secondary" />
          <span className="text-sm text-forseti-text-secondary">{comments.length}</span>
        </button>
        <button onClick={() => setShowShare(true)} className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors">
          <Share2 className="w-5 h-5 text-forseti-text-secondary" />
        </button>
        {/* small Analyst action button removed — use the primary "View Telemetry Analysis" button above */}
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="space-y-4">
          {/* Existing Comments */}
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <button
                onClick={() => router.push(`/user/${comment.user?.username || comment.user?.id || comment.userId}`)}
                className="w-8 h-8 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                {comment.user.avatar ? (
                  <img src={comment.user.avatar} alt={comment.user.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-forseti-text-secondary" />
                )}
              </button>
              <div className="flex-1">
                <div className="bg-forseti-bg-elevated rounded-lg p-3">
                  <button
                    onClick={() => router.push(`/user/${comment.user?.username || comment.user?.id || comment.userId}`)}
                    className="font-semibold text-sm mb-1 hover:text-forseti-lime transition-colors"
                  >
                    {comment.user?.name || 'Unknown'}
                  </button>
                  <p className="text-sm text-forseti-text-primary">
                    {comment.text.split(/(@\w+)/g).map((part, i) => {
                      if (part.startsWith('@')) {
                        const username = part.slice(1)
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              // Navigate using username route — backend accepts username or id for user lookup
                              router.push(`/user/${username}`)
                            }}
                            className="text-forseti-lime hover:underline font-medium"
                          >
                            {part}
                          </button>
                        )
                      }
                      return part
                    })}
                  </p>
                </div>
                <p className="text-xs text-forseti-text-secondary mt-1 ml-3">
                  {formatTimestamp(comment.createdAt)}
                </p>
              </div>
            </div>
          ))}

          {/* Add Comment */}
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt="You" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-forseti-text-secondary" />
              )}
            </div>
            <div className="flex-1 flex gap-2 items-center">
              <div className="flex-1">
                <MentionInput
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={handleAddComment}
                  placeholder="Write a comment... (use @ to mention friends)"
                  className="w-full px-4 py-2 bg-forseti-bg-elevated rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors text-sm"
                />
              </div>
              <button
                onClick={handleSendClick}
                disabled={!commentText.trim()}
                className="px-4 py-2 bg-forseti-lime text-forseti-text-inverse rounded-lg hover:bg-forseti-lime-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Activity Selector Modal for Compare Telemetry */}
      {showUserActivitySelector && activity.car && activity.track && (
        <UserActivitySelectorModal
          isOpen={showUserActivitySelector}
          onClose={() => setShowUserActivitySelector(false)}
          onSelectActivity={(userActivityId) => {
            router.push(`/analyst/${userActivityId}?proRef=${activity.id}`)
          }}
          filterCar={activity.car}
          filterTrack={activity.track}
          proActivityId={activity.id}
          proDriverName={activity.user?.name}
        />
      )}
    </div>
  )
}

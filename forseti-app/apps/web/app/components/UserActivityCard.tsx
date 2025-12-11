'use client'

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocial } from '../context/SocialContext'
import { ChevronDown, Eye, MessageSquare, Share2, User, Send, MapPin, Heart } from 'lucide-react'
import { api } from '../lib/api'
import ConfirmModal from './ConfirmModal'
import ShareModal from './ShareModal'

interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  text: string
  timestamp: Date
}

interface Like {
  id: string
  userId: string
}

interface Activity {
  id: string
  userId: string
  track: string
  description: string
  timestamp: Date
}

const TRACK_NAMES: Record<string, string> = {
  silverstone: 'Silverstone',
  monza: 'Autodromo di Monza',
  spa: 'Spa-Francorchamps',
}

const TRACK_LOCATIONS: Record<string, string> = {
  silverstone: 'United Kingdom',
  monza: 'Italy',
  spa: 'Belgium',
}

const TRACK_SVGS: Record<string, { path: string; viewBox: string }> = {
  silverstone: {
    path: 'M25.198 30.229c-0.31456 1.0094-0.61942 2.0209-0.91904 3.0341-7.834 29.626-14.076 59.7-19.349 89.878-2.535 14.71-1.4856 31.043 8.2385 43.106 10.041 12.782 21.82 24.306 34.577 34.354 5.1918 4.5054 12.826 4.0455 18.004-0.22327 6.4174-3.2681 10.111-11.816 5.677-18.13-5.8251-10.346-19.237-11.651-26.639-20.171-5.6049-6.4993 0.19048-15.56 6.5585-18.909 45.445-27.169 91.127-54.08 137.35-79.839 5.1495-2.9902 10.946-2.7674 16.099-0.0654 10.1 4.7029 20.624 10.845 26.727 20.5 0.0808 3.862-6.0487 2.961-8.6128 3.5071-8.2501 0.97774-17.512-2.1461-25.203 1.9076-4.99 4.9203-0.70564 12.71 0.60533 18.304 4.8212 16.032 13.674 31.093 14.992 47.993-0.24271 16.885-12.901 30.252-16.443 46.332-0.84301 13.01 8.7895 23.588 15.052 34.056 14.712 22.13 31.592 42.83 45.602 65.396 5.8177 10.093 14.253 22.064 27.225 21.989 11.47 0.59815 25.629-0.96669 32.419-11.47 3.6727-5.7698-0.13079-12.116-1.8021-17.732 2.7607-4.9306 10.108-5.2048 14.709-7.9877 20.668-8.6102 40.531-19.776 63.083-22.553 9.496-1.5148 20.474-3.8364 25.382-13.169 4.2381-8.1269 5.1636-18.83-1.0634-26.27-21.629-32.654-51.613-58.448-77.982-87.076-17.562-18.913-36.653-36.457-53.119-56.32-9.2011-11.84-6.159-30.331-18.353-40.334-7.1588-4.9033-16.375-4.6729-24.132-1.3651-9.4575 4.7376-20.293 1.5097-28.217-4.6666-8.7547-6.032-17.465-16.33-29.387-13.706-8.8381 1.3902-17.885 3.6991-26.562 0.60162-35.41-9.071-71.544-19.259-108.45-17.175-10.471 0.0557-19.533 7.548-22.868 17.252-1.2385 2.9204-2.2695 5.9229-3.2131 8.951z',
    viewBox: '0 0 425.69 327.11',
  },
  monza: {
    path: 'M4.1168 29.337c0.31529 7.0558 4.5029 17.045 11.051 32.041 5.5664 12.748 11.227 26.92 12.581 31.494l2.4617 8.3161 4.9113 1.8458c3.6733 1.3807 4.9623 2.4052 5.1167 4.0668 1.4707 15.824 14.607 90.607 17.266 98.292 13.174 38.07 37.939 53.878 83.405 53.242 8.5475-0.11959 15.777-0.10051 16.066 0.0419 0.89783 0.44296 16.804-3.6907 25.946-6.7417 10.262-3.4247 11.317-3.2977 11.731 1.404 0.4861 5.5195-10.851 4.979 107.36 5.1105 18.222 0.0203 53.258 0.31975 77.858 0.66418l44.727 0.62532 26.813-3.3104c41.557-5.1328 54.488-12.178 59.87-32.614 2.5346-9.6255 1.5217-13.709-5.1803-20.862-4.7926-5.1156-7.924-5.7604-29.609-6.1076-10.622-0.17006-56.324-0.87618-101.56-1.5688-104.09-1.5937-99.307-1.2621-104.12-7.2232-5.3784-6.6565-14.936-9.4315-25.946-7.532-8.6364 1.4899-5.0705 3.9952-35.389-24.849-88.19-83.874-79.74-74.371-119-133.8-13.676-20.684-10.76-19.425-35.3-15.25-38.153 6.49-51.665 9.267-51.063 22.737z',
    viewBox: '0 0 516.66 263.84',
  },
  spa: {
    path: 'M4.447 290.28c0.13184 1.3988 0.74128 2.2328 1.7024 3.099 3.1469 2.8362 3.8732 2.3848 55.153-34.244 9.0175-6.4412 22.107-15.77 29.088-20.731 6.9814-4.9613 16.982-12.298 22.221-16.304 11.174-8.5434 12.382-8.6379 13.16-1.0174 0.54917 5.3802 2.4784 8.4052 5.1728 8.1124 2.8403-0.30871 42.138-7.3767 46.568-8.3756 7.9514-1.7928 19.679-6.7943 48.071-20.501 32.219-15.554 31.603-15.443 51.861-9.2555 43.482 13.281 49.67 17.893 74.11 55.221 24.907 38.042 51.388 59.761 81.957 67.22 23.646 5.77 29.868 2.9279 43.646-19.937 14.583-24.2 13.956-28.601-5.4188-38.008-42.141-20.461-41.397-19.922-42.514-30.746-0.47537-4.6053-0.14507-6.2471 1.9454-9.6576 5.1232-8.3583 5.3844-15.657 0.83218-23.295-4.202-7.0498-5.1079-7.4255-46.575-19.273-57.071-16.305-61.474-19.592-63.138-47.139-1.3409-22.191 2.522-26.753 28.962-34.216 38.939-10.991 52.214-15.463 71.271-24.002 27.146-12.163 25.84-12.368 39.668 6.2288 15.126 20.343 27.926 24.049 33.803 9.784 3.2206-7.8173 2.0733-9.7848-23.497-40.265-33.33-39.73-30.5-38.063-52.21-30.777-16.833 5.6483-18.917 5.4528-25.042-2.3521-3.4734-4.4259-7.0086-5.9408-12.528-5.3669-3.732 0.38809-9.7271 2.6943-72.638 27.956-113.06 45.398-110.63 44.288-129.17 59.016-30.773 24.434-45.366 34.512-52.808 36.471-17.988 4.7355-24.603 9.4903-30.154 21.676-3.8076 8.3581-9.6687 15.229-32.851 38.511-32.393 32.533-39.987 43.72-53.2 78.344-5.6978 14.931-7.7238 20.746-7.4337 23.823z',
    viewBox: '0 0 501.68 320.49',
  },
}

interface UserActivityCardProps {
  activity: Activity
}

export default function UserActivityCard({ activity }: UserActivityCardProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const { refreshNotifications } = useSocial()
  const [likes, setLikes] = useState<Like[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [showShare, setShowShare] = useState(false)

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return

    try {
      // Extract mention usernames and send them to the server; server will resolve to ids.
      const mentionRegex = /@([\w-]+)/g
  const mentionedUsernames = Array.from(commentText.matchAll(mentionRegex)).map(m => m[1]).filter(Boolean) as string[]

  const created = await api.addComment(activity.id, commentText, mentionedUsernames)
      setCommentText('')
      // Refresh notifications and fetch authoritative activity comments
      await refreshNotifications()
      try {
        const fresh = await api.getActivityById(activity.id)
        // Map server comment shape to local Comment type used here
        const mapped = (fresh.comments || []).map((c: any) => ({
          id: c.id,
          userId: c.userId,
          userName: c.user?.name || c.userName || 'Unknown',
          userAvatar: c.user?.avatar,
          text: c.text,
          timestamp: new Date(c.createdAt),
        }))
        setComments(mapped)
      } catch (e) {
        // Fallback: append the created comment returned by API
        setComments(prev => [...prev, {
          id: created.id,
          userId: created.userId || user.id,
          userName: created.user?.name || user.name,
          userAvatar: created.user?.avatar || user.avatar,
          text: created.text,
          timestamp: created.createdAt ? new Date(created.createdAt) : new Date(),
        }])
      }
    } catch (error) {
      console.error('Failed to add comment (dashboard):', error)
      alert('Failed to post comment. Please try again.')
    }
  }

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(new Date(date))
  }

  const handleLike = async () => {
    if (!user) return
    try {
      const result = await api.likeActivity(activity.id)
      const liked = result && (result as any).liked
      if (liked) {
        setLikes(prev => [...prev, { id: Date.now().toString(), userId: user.id }])
      } else {
        setLikes(prev => prev.filter(l => l.userId !== user.id))
      }
      await refreshNotifications()
      try {
        const fresh = await api.getActivityById(activity.id)
        const mapped = (fresh.comments || []).map((c: any) => ({ id: c.id, userId: c.userId, userName: c.user?.name || 'Unknown', userAvatar: c.user?.avatar, text: c.text, timestamp: new Date(c.createdAt) }))
        setComments(mapped)
        setLikes(fresh.likes || [])
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Failed to like activity (dashboard):', err)
    }
  }

  const trackSvg = TRACK_SVGS[activity.track]

  return (
    <div className="bg-forseti-bg-card rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden relative">
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-forseti-text-secondary" />
            )}
            {/* presence dot removed per user request */}
          </div>
          <div>
            <h3 className="font-bold">{user?.name}</h3>
            <p className="text-sm text-forseti-text-secondary flex items-center gap-1">
              {formatDateTime(activity.timestamp)} · <MapPin className="w-3 h-3" /> {TRACK_LOCATIONS[activity.track]}
            </p>
          </div>
        </div>
        <ChevronDown className="w-5 h-5 text-forseti-text-secondary" />
      </div>

      <h2 className="text-2xl font-bold mb-4">{TRACK_NAMES[activity.track]}</h2>

      {/* Description */}
      {activity.description && (
        <p className="mb-4 text-forseti-text-primary">{activity.description}</p>
      )}

      {/* Track Visualization */}
      {trackSvg && (
        <div className="bg-forseti-bg-elevated rounded-lg p-8 mb-4 relative overflow-hidden">
          <div className="flex items-center justify-center">
            <svg
              viewBox={trackSvg.viewBox}
              className="w-full h-64"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(183, 255, 0, 0.6))'
              }}
            >
              <path
                d={trackSvg.path}
                stroke="#B7FF00"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="flex items-center gap-2 text-xs text-forseti-text-secondary mb-4">
        <Eye className="w-4 h-4" />
        <p>Visible to your followers.</p>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-forseti-border">
        <ConfirmModal isOpen={showConfirm} title="Delete activity" description="Are you sure you want to delete this activity? This action cannot be undone." confirmLabel="Delete" cancelLabel="Cancel" onConfirm={async () => { setShowConfirm(false); try { await api.deleteActivity(activity.id); } catch (e) { console.error(e); alert('Failed to delete activity') } }} onCancel={() => setShowConfirm(false)} />
        <ShareModal isOpen={showShare} url={`${typeof window !== 'undefined' ? window.location.origin : ''}/activities/${activity.id}`} onClose={() => setShowShare(false)} />
        <button
          onClick={() => setShowComments(!showComments)}
          className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors flex items-center gap-2"
        >
          <MessageSquare className="w-5 h-5 text-forseti-text-secondary" />
          <span className="text-sm text-forseti-text-secondary">{comments.length}</span>
        </button>
        <button onClick={handleLike} className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors flex items-center gap-2">
          <Heart className="w-5 h-5 text-forseti-text-secondary" />
          <span className="text-sm text-forseti-text-secondary">{likes.length}</span>
        </button>
        <button onClick={() => setShowShare(true)} className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors">
          <Share2 className="w-5 h-5 text-forseti-text-secondary" />
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="space-y-4">
          {/* Existing Comments */}
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-8 h-8 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                {comment.userAvatar ? (
                  <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-forseti-text-secondary" />
                )}
              </div>
              <div className="flex-1">
                <div className="bg-forseti-bg-elevated rounded-lg p-3">
                  <p className="font-semibold text-sm mb-1">{comment.userName}</p>
                  <p className="text-sm text-forseti-text-primary">{comment.text}</p>
                </div>
                <p className="text-xs text-forseti-text-secondary mt-1 ml-3">
                  {formatTimestamp(comment.timestamp)}
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
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Write a comment..."
                className="flex-1 px-4 py-2 bg-forseti-bg-elevated rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors text-sm"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="px-4 py-2 bg-forseti-lime text-forseti-text-inverse rounded-lg hover:bg-forseti-lime-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

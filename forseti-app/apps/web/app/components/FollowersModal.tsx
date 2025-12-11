"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, User } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useSocial } from '../context/SocialContext'

interface UserItem {
  id: string
  name: string
  username: string
  avatar?: string
  engagementLevel?: string
  isPro?: boolean
}

interface FollowersModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  type: 'followers' | 'following'
}

export default function FollowersModal({ isOpen, onClose, userId, type }: FollowersModalProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { isFollowing, refreshSocialData } = useSocial()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!isOpen) return

    const fetchUsers = async () => {
      setLoading(true)
      try {
        const data = type === 'followers'
          ? await api.getFollowers(userId)
          : await api.getFollowing(userId)

        setUsers(data as UserItem[])

        // Initialize following states
        const states: Record<string, boolean> = {}
        data.forEach((u: UserItem) => {
          states[u.id] = isFollowing(u.id)
        })
        setFollowingStates(states)
      } catch (error) {
        console.error(`Failed to fetch ${type}:`, error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [isOpen, userId, type, isFollowing])

  const handleFollowToggle = async (targetUserId: string) => {
    try {
      if (followingStates[targetUserId]) {
        await api.unfollowUser(targetUserId)
        setFollowingStates(prev => ({ ...prev, [targetUserId]: false }))
      } else {
        await api.followUser(targetUserId)
        setFollowingStates(prev => ({ ...prev, [targetUserId]: true }))
      }
      refreshSocialData()
    } catch (error) {
      console.error('Failed to toggle follow:', error)
    }
  }

  const handleUserClick = (targetUserId: string, username: string) => {
    // Don't navigate if clicking on own profile
    if (user && targetUserId === user.id) return
    onClose()
    router.push(`/user/${username}`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-forseti-bg-card border border-forseti-border rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-forseti-border">
          <h3 className="text-lg font-bold">
            {type === 'followers' ? 'Followers' : 'Following'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-forseti-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-forseti-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forseti-lime"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-forseti-text-secondary">
              <User className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">
                {type === 'followers' ? 'No followers yet' : 'Not following anyone'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-forseti-border">
              {users.map((userItem) => {
                const isOwnProfile = user && userItem.id === user.id
                return (
                  <div
                    key={userItem.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-forseti-bg-hover transition-colors"
                  >
                    <button
                      onClick={() => handleUserClick(userItem.id, userItem.username)}
                      className={`flex items-center gap-3 flex-1 text-left ${isOwnProfile ? 'cursor-default' : ''}`}
                      disabled={isOwnProfile}
                    >
                      <div className="w-10 h-10 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                        {userItem.avatar ? (
                          <img
                            src={userItem.avatar}
                            alt={userItem.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-forseti-text-secondary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-forseti-text-primary">
                            {userItem.name}
                          </p>
                          {isOwnProfile && (
                            <span className="text-xs text-forseti-text-secondary">(You)</span>
                          )}
                          {userItem.isPro && (
                            <span className="px-1.5 py-0.5 text-xs font-bold bg-forseti-lime/20 text-forseti-lime rounded">
                              PRO
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-forseti-text-secondary">
                          @{userItem.username}
                        </p>
                      </div>
                    </button>

                    {/* Follow button - don't show for self */}
                    {user && userItem.id !== user.id && (
                      <button
                        onClick={() => handleFollowToggle(userItem.id)}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                          followingStates[userItem.id]
                            ? 'bg-forseti-bg-elevated border border-forseti-border text-forseti-text-primary hover:bg-forseti-bg-hover'
                            : 'bg-forseti-lime text-forseti-text-inverse hover:bg-forseti-lime-hover'
                        }`}
                      >
                        {followingStates[userItem.id] ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

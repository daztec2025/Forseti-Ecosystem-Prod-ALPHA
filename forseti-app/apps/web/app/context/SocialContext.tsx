'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'

export interface Notification {
  id: string
  type: string
  fromUserId?: string
  fromUserName?: string
  fromUserAvatar?: string
  message: string
  timestamp: Date
  read: boolean
  activityId?: string
}

interface User {
  id: string
  name: string
  avatar?: string
}

interface SocialContextType {
  following: User[]
  followers: User[]
  notifications: Notification[]
  followUser: (userId: string, displayName?: string) => Promise<void>
  unfollowUser: (userId: string) => Promise<void>
  isFollowing: (userId: string) => boolean
  isFollowedBy: (userId: string) => boolean
  areFriends: (userId: string) => boolean
  markNotificationRead: (notificationId: string) => Promise<void>
  clearAllNotifications: () => Promise<void>
  unreadCount: number
  refreshSocialData: () => Promise<void>
  refreshNotifications: () => Promise<void>
}

const SocialContext = createContext<SocialContextType | undefined>(undefined)

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [following, setFollowing] = useState<User[]>([])
  const [followers, setFollowers] = useState<User[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])

  const refreshSocialData = async () => {
    if (!user) return
    try {
      const data = await api.getSocialData()
      setFollowing(data.following || [])
      setFollowers(data.followers || [])
    } catch (error) {
      console.error('Failed to fetch social data:', error)
    }
  }

  const refreshNotifications = async () => {
    if (!user) return
    try {
      const data = await api.getNotifications()
      setNotifications(data.map((n: any) => ({
        ...n,
        timestamp: new Date(n.createdAt),
      })))
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }

  useEffect(() => {
    if (user) {
      refreshSocialData()
      refreshNotifications()
    }
  }, [user])

  const followUser = async (userId: string, displayName?: string) => {
    try {
      await api.followUser(userId)
      await refreshSocialData()
      await refreshNotifications() // Refresh to get friend notification if mutual
    } catch (error) {
      console.error('Follow failed:', error)
      throw error
    }
  }

  const unfollowUser = async (userId: string) => {
    try {
      await api.unfollowUser(userId)
      await refreshSocialData()
    } catch (error) {
      console.error('Unfollow failed:', error)
      throw error
    }
  }

  const isFollowing = (userId: string) => {
    return following.some(u => u.id === userId)
  }

  const isFollowedBy = (userId: string) => {
    return followers.some(u => u.id === userId)
  }

  const areFriends = (userId: string) => {
    return isFollowing(userId) && isFollowedBy(userId)
  }

  const markNotificationRead = async (notificationId: string) => {
    try {
      await api.markNotificationRead(notificationId)
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
    } catch (error) {
      console.error('Mark notification read failed:', error)
    }
  }

  const clearAllNotifications = async () => {
    try {
      // Mark all notifications as read
      await Promise.all(
        notifications.filter(n => !n.read).map(n => api.markNotificationRead(n.id))
      )
      // Update local state
      setNotifications(
        notifications.map((n) => ({ ...n, read: true }))
      )
    } catch (error) {
      console.error('Clear all notifications failed:', error)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <SocialContext.Provider
      value={{
        following,
        followers,
        notifications,
        followUser,
        unfollowUser,
        isFollowing,
        isFollowedBy,
        areFriends,
        markNotificationRead,
        clearAllNotifications,
        unreadCount,
        refreshSocialData,
        refreshNotifications,
      }}
    >
      {children}
    </SocialContext.Provider>
  )
}

export function useSocial() {
  const context = useContext(SocialContext)
  if (context === undefined) {
    throw new Error('useSocial must be used within a SocialProvider')
  }
  return context
}

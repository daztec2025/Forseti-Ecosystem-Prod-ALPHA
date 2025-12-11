'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, User, UserPlus, MessageSquare, Heart, X, AtSign } from 'lucide-react'
import { useSocial } from '../context/SocialContext'
import { useRouter } from 'next/navigation'

export default function NotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const { notifications, unreadCount, markNotificationRead, clearAllNotifications } = useSocial()
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <UserPlus className="w-4 h-4 text-forseti-lime" />
      case 'friend_accepted':
        return <UserPlus className="w-4 h-4 text-forseti-lime" />
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-blue-400" />
      case 'like':
        return <Heart className="w-4 h-4 text-red-400" />
      case 'mention':
        return <AtSign className="w-4 h-4 text-purple-400" />
      default:
        return <Bell className="w-4 h-4 text-forseti-text-secondary" />
    }
  }

  const handleNotificationClick = (notification: any) => {
    markNotificationRead(notification.id)

    // Navigate to the activity if it has an activityId
    if (notification.activityId) {
      setIsOpen(false)
      router.push(`/activity/${notification.activityId}`)
    }
  }

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors relative"
      >
        <Bell className="w-5 h-5 text-forseti-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-forseti-lime rounded-full"></span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-forseti-bg-card rounded-lg border border-forseti-border shadow-lg overflow-hidden z-50">
          {/* Header */}
          <div className="p-4 border-b border-forseti-border flex items-center justify-between">
            <h3 className="font-bold">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <>
                  <span className="text-xs text-forseti-lime">{unreadCount} new</span>
                  <button
                    onClick={clearAllNotifications}
                    className="text-xs text-forseti-text-secondary hover:text-forseti-lime transition-colors"
                  >
                    Clear All
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-forseti-text-secondary">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-b border-forseti-border hover:bg-forseti-bg-hover transition-colors cursor-pointer ${
                      !notification.read ? 'bg-forseti-lime/5' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="w-10 h-10 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                        {notification.fromUserAvatar ? (
                          <img
                            src={notification.fromUserAvatar}
                            alt={notification.fromUserName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-forseti-text-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-1">
                          {getNotificationIcon(notification.type)}
                          <p className="text-sm flex-1">
                            <span className="font-semibold">{notification.fromUserName}</span>{' '}
                            <span className="text-forseti-text-secondary">{notification.message}</span>
                          </p>
                        </div>
                        <p className="text-xs text-forseti-text-secondary">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-forseti-lime rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

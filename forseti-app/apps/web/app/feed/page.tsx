'use client'

import { useState, useEffect } from 'react'
import DashboardNav from '../components/DashboardNav'
import ActivityCard from '../components/ActivityCard'
import ProtectedRoute from '../components/ProtectedRoute'
import { api } from '../lib/api'
import { Loader2 } from 'lucide-react'

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
  description?: string
  user: User
  comments: Comment[]
  likes: Like[]
}

export default function FeedPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const data = await api.getActivities()
      setActivities(data)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }

  // Silent fetch to refresh child state without toggling the page loader
  const fetchActivitiesSilent = async () => {
    try {
      const data = await api.getActivities()
      setActivities(data)
    } catch (error) {
      console.error('Failed to fetch activities (silent):', error)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-forseti-bg-primary">
        <DashboardNav />

        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">Activity Feed</h1>

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
                  onUpdate={(updated) => {
                    if (updated) {
                      setActivities(prev => prev.map(a => a.id === updated.id ? updated : a))
                    } else {
                      fetchActivitiesSilent()
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="bg-forseti-bg-card rounded-xl p-12 text-center">
              <p className="text-forseti-text-secondary mb-4">
                No activities to display. Start logging your racing sessions!
              </p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

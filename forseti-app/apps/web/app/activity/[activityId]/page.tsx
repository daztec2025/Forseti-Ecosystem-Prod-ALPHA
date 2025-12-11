'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '../../lib/api'
import ActivityCard from '../../components/ActivityCard'
import { ArrowLeft } from 'lucide-react'

export default function ActivityPage() {
  const params = useParams()
  const router = useRouter()
  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const activityId = params.activityId as string
        const data = await api.getActivityById(activityId)
        setActivity(data)
      } catch (error) {
        console.error('Failed to fetch activity:', error)
      } finally {
        setLoading(false)
      }
    }

    if (params.activityId) {
      fetchActivity()
    }
  }, [params.activityId])

  if (loading) {
    return (
      <div className="min-h-screen bg-forseti-bg-primary p-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-forseti-text-secondary">Loading activity...</p>
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-forseti-bg-primary p-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2 text-forseti-text-secondary hover:text-forseti-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
          <p className="text-forseti-text-secondary">Activity not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forseti-bg-primary p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-forseti-text-secondary hover:text-forseti-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back
        </button>

        <ActivityCard
          activity={activity}
          onUpdate={() => {
            // Allow child to pass an authoritative activity; otherwise refresh
            api.getActivityById(params.activityId as string).then(setActivity)
          }}
        />
      </div>
    </div>
  )
}

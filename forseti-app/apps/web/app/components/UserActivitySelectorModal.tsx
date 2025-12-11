'use client'

import { useState, useEffect } from 'react'
import { X, Clock, Calendar, Car, MapPin } from 'lucide-react'
import { api } from '../lib/api'
import { Activity } from '../types/api'

interface UserActivitySelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectActivity: (activityId: string) => void
  filterCar: string
  filterTrack: string
  proActivityId: string
  proDriverName?: string
}

export default function UserActivitySelectorModal({
  isOpen,
  onClose,
  onSelectActivity,
  filterCar,
  filterTrack,
  proActivityId,
  proDriverName
}: UserActivitySelectorModalProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchActivities()
    }
  }, [isOpen, filterCar, filterTrack])

  const fetchActivities = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getMyActivitiesFiltered(filterCar, filterTrack)
      setActivities(data)
    } catch (err: any) {
      console.error('Failed to fetch user activities:', err)
      setError(err.message || 'Failed to fetch activities')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-forseti-bg-elevated border border-forseti-border rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-forseti-border">
          <div>
            <h2 className="text-lg font-bold text-forseti-text-primary">Select Your Session</h2>
            <p className="text-sm text-forseti-text-secondary mt-1">
              Choose one of your sessions to compare{proDriverName ? ` against ${proDriverName}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-forseti-text-secondary" />
          </button>
        </div>

        {/* Filter Info */}
        <div className="px-6 py-3 border-b border-forseti-border bg-forseti-bg-card/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-forseti-text-secondary" />
              <span className="text-sm text-forseti-text-primary">{filterCar}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-forseti-text-secondary" />
              <span className="text-sm text-forseti-text-primary">{filterTrack}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-forseti-lime"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={fetchActivities}
                className="mt-4 px-4 py-2 bg-forseti-bg-card text-forseti-text-primary text-sm rounded-lg hover:bg-forseti-bg-hover transition-colors"
              >
                Retry
              </button>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-forseti-text-secondary">
                No sessions found with this car/track combination
              </p>
              <p className="text-xs text-forseti-text-secondary mt-2">
                Complete a session with {filterCar} at {filterTrack} to enable comparison
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => {
                    onSelectActivity(activity.id)
                    onClose()
                  }}
                  className="w-full p-4 bg-forseti-bg-card border border-forseti-border rounded-lg hover:border-forseti-lime/50 hover:bg-forseti-bg-hover transition-colors text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 text-sm text-forseti-text-secondary">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {new Date(activity.date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        {activity.fastestLap && (
                          <span className="flex items-center gap-1.5 text-forseti-lime font-medium">
                            <Clock className="w-4 h-4" />
                            {activity.fastestLap}
                          </span>
                        )}
                      </div>
                      {activity.description && (
                        <p className="text-xs text-forseti-text-secondary mt-2 line-clamp-1">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-medium text-forseti-lime">Select</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-forseti-border">
          <p className="text-xs text-forseti-text-secondary text-center">
            {activities.length} matching {activities.length === 1 ? 'session' : 'sessions'} found
          </p>
        </div>
      </div>
    </div>
  )
}

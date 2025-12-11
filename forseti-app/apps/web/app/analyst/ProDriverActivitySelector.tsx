'use client'

import { useState, useEffect } from 'react'
import { X, User, Clock, Calendar } from 'lucide-react'
import { api } from '../lib/api'
import { ProDriverReferenceLap } from '../types/api'

interface ProDriverLapSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectLap: (lap: ProDriverReferenceLap) => void
  activityId: string
  currentCar?: string
  currentTrack?: string
}

export default function ProDriverActivitySelector({
  isOpen,
  onClose,
  onSelectLap,
  activityId,
  currentCar,
  currentTrack
}: ProDriverLapSelectorProps) {
  const [laps, setLaps] = useState<ProDriverReferenceLap[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && activityId) {
      fetchLaps()
    }
  }, [isOpen, activityId])

  const fetchLaps = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getReferenceLaps(activityId)
      // Sort by lap time (fastest first)
      const sortedLaps = [...data.proDriverLaps].sort((a, b) => a.lapTime - b.lapTime)
      setLaps(sortedLaps)
    } catch (err: any) {
      console.error('Failed to fetch PRO driver laps:', err)
      setError(err.message || 'Failed to fetch laps')
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
            <h2 className="text-lg font-bold text-forseti-text-primary">PRO Driver Laps</h2>
            <p className="text-sm text-forseti-text-secondary mt-1">
              Select a PRO driver lap to compare with your telemetry
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-forseti-text-secondary" />
          </button>
        </div>

        {/* Car/Track Info */}
        {currentCar && currentTrack && (
          <div className="px-6 py-3 border-b border-forseti-border">
            <p className="text-xs text-forseti-text-secondary">
              Showing laps with <span className="text-forseti-text-primary font-medium">{currentCar}</span> at <span className="text-forseti-text-primary font-medium">{currentTrack}</span>
            </p>
          </div>
        )}

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
                onClick={fetchLaps}
                className="mt-4 px-4 py-2 bg-forseti-bg-card text-forseti-text-primary text-sm rounded-lg hover:bg-forseti-bg-hover transition-colors"
              >
                Retry
              </button>
            </div>
          ) : laps.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-forseti-text-secondary">
                No PRO driver laps found for this car/track combination
              </p>
              <p className="text-xs text-forseti-text-secondary mt-2">
                Subscribe to PRO drivers to access their telemetry for comparison
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {laps.map((lap, idx) => (
                <button
                  key={`${lap.activityId}-${lap.lapNumber}`}
                  onClick={() => {
                    onSelectLap(lap)
                    onClose()
                  }}
                  className="w-full p-4 bg-forseti-bg-card border border-forseti-border rounded-lg hover:border-forseti-lime/50 hover:bg-forseti-bg-hover transition-colors text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Driver avatar */}
                      <div className="w-10 h-10 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                        {lap.driver?.avatar ? (
                          <img src={lap.driver.avatar} alt={lap.driver.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-forseti-text-secondary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-forseti-text-primary">{lap.driver?.name || 'Pro Driver'}</span>
                          <span className="text-xs bg-forseti-lime/20 text-forseti-lime px-2 py-0.5 rounded font-semibold">PRO</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-forseti-text-secondary">
                          <span>@{lap.driver?.username}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(lap.activityDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-forseti-lime" />
                        <span className="text-lg font-bold text-forseti-lime">{lap.lapTimeFormatted}</span>
                      </div>
                      <span className="text-xs text-forseti-text-secondary">Lap {lap.lapNumber}</span>
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
            {laps.length} {laps.length === 1 ? 'lap' : 'laps'} available from subscribed PRO drivers
          </p>
        </div>
      </div>
    </div>
  )
}

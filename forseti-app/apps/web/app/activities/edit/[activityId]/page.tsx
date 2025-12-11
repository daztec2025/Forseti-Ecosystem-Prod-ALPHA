'use client'

import { useAuth } from '../../../context/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, X, Video, Image as ImageIcon, Upload, Trash2, Droplets, Sun, Thermometer, Lock, Globe } from 'lucide-react'
import TrackSelector from '../../../components/TrackSelector'
import MediaUpload, { MediaFile } from '../../../components/MediaUpload'
import { api } from '../../../lib/api'
import { ActivityMedia } from '../../../types/api'
import { useState, useEffect } from 'react'

export default function EditActivityPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const activityId = params.activityId as string

  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [car, setCar] = useState('')
  const [fastestLap, setFastestLap] = useState('')
  const [duration, setDuration] = useState('60')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [existingMedia, setExistingMedia] = useState<ActivityMedia[]>([])
  const [mediaToDelete, setMediaToDelete] = useState<string[]>([])
  const [newMediaFiles, setNewMediaFiles] = useState<MediaFile[]>([])
  const [currentSetupFilename, setCurrentSetupFilename] = useState<string | null>(null)
  const [newSetupFile, setNewSetupFile] = useState<File | null>(null)
  const [deleteSetup, setDeleteSetup] = useState(false)
  const [trackCondition, setTrackCondition] = useState<'dry' | 'wet'>('dry')
  const [trackTemperature, setTrackTemperature] = useState<string>('')
  const [airTemperature, setAirTemperature] = useState<string>('')
  const [isPrivate, setIsPrivate] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const activities = await api.getActivities()
        const activity = activities.find((a: any) => a.id === activityId)

        if (!activity) {
          alert('Activity not found')
          router.push('/dashboard')
          return
        }

        setSelectedTrack(activity.track || activity.game)
        setDuration(activity.duration.toString())
        setCar(activity.car || '')
        setFastestLap(activity.fastestLap || '')
        setDescription(activity.description || '')
        setExistingMedia(activity.media || [])
        setCurrentSetupFilename(activity.setupFilename || null)
        setTrackCondition(activity.trackCondition === 'wet' ? 'wet' : 'dry')
        setTrackTemperature(activity.trackTemperature?.toString() || '')
        setAirTemperature(activity.airTemperature?.toString() || '')
        setIsPrivate(activity.isPrivate || false)
      } catch (error) {
        console.error('Failed to load activity:', error)
        alert('Failed to load activity')
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    if (activityId) {
      fetchActivity()
    }
  }, [activityId, router])

  const handleDeleteExistingMedia = (mediaId: string) => {
    setMediaToDelete(prev => [...prev, mediaId])
    setExistingMedia(prev => prev.filter(m => m.id !== mediaId))
  }

  // Calculate remaining slots for new media
  const remainingSlots = 5 - existingMedia.length

  const handleSaveActivity = async () => {
    if (!user || !selectedTrack) return

    setIsSaving(true)

    try {
      // Update activity details
      await api.updateActivity(activityId, {
        game: selectedTrack,
        duration: parseInt(duration) || 60,
        performance: '0%',
        track: selectedTrack,
        car: car || undefined,
        fastestLap: fastestLap || undefined,
        description: description || undefined,
        isPrivate,
        trackCondition,
        trackTemperature: trackTemperature ? parseFloat(trackTemperature) : undefined,
        airTemperature: airTemperature ? parseFloat(airTemperature) : undefined,
      })

      // Delete marked media
      for (const mediaId of mediaToDelete) {
        try {
          await api.deleteActivityMedia(activityId, mediaId)
        } catch (error) {
          console.error('Failed to delete media:', mediaId, error)
        }
      }

      // Upload new media
      if (newMediaFiles.length > 0) {
        try {
          const files = newMediaFiles.map(m => m.file)
          const durations = newMediaFiles.map(m => m.duration || 0)
          await api.uploadActivityMedia(activityId, files, durations)
        } catch (error) {
          console.error('Failed to upload new media:', error)
          alert('Activity updated but some media failed to upload.')
        }
      }

      // Handle setup file changes
      if (deleteSetup && currentSetupFilename) {
        try {
          await api.deleteActivitySetup(activityId)
        } catch (error) {
          console.error('Failed to delete setup:', error)
        }
      }

      if (newSetupFile) {
        try {
          await api.uploadActivitySetup(activityId, newSetupFile)
        } catch (error: any) {
          console.error('Failed to upload setup:', error)
          alert('Activity updated but setup file failed to upload: ' + error.message)
        }
      }

      // Clean up preview URLs
      newMediaFiles.forEach(m => URL.revokeObjectURL(m.preview))

      router.push('/dashboard')
    } catch (error) {
      console.error('Failed to update activity:', error)
      alert('Failed to update activity. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center">
        <p className="text-forseti-text-secondary">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forseti-bg-primary">
      {/* Header */}
      <div className="bg-forseti-bg-secondary border-b border-forseti-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Edit Activity</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-forseti-bg-card rounded-xl p-6 space-y-8">
          {/* Track Selection */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Select Track</h2>
            <TrackSelector
              selectedTrack={selectedTrack}
              onSelectTrack={setSelectedTrack}
            />
          </div>

          {/* Duration */}
          <div>
            <label htmlFor="duration" className="block text-lg font-semibold mb-2">
              Duration (minutes)
            </label>
            <input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              min="1"
              className="w-full px-4 py-3 bg-forseti-bg-elevated rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors"
            />
          </div>

          {/* Car & Fastest Lap */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="car" className="block text-lg font-semibold mb-2">
                Car <span className="text-sm text-forseti-text-secondary font-normal">(optional)</span>
              </label>
              <input
                id="car"
                type="text"
                value={car}
                onChange={(e) => setCar(e.target.value)}
                placeholder="e.g. Mercedes W14"
                className="w-full px-4 py-3 bg-forseti-bg-elevated rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors"
              />
            </div>
            <div>
              <label htmlFor="fastestLap" className="block text-lg font-semibold mb-2">
                Fastest Lap <span className="text-sm text-forseti-text-secondary font-normal">(optional)</span>
              </label>
              <input
                id="fastestLap"
                type="text"
                value={fastestLap}
                onChange={(e) => setFastestLap(e.target.value)}
                placeholder="e.g. 1:43.123"
                className="w-full px-4 py-3 bg-forseti-bg-elevated rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors"
              />
            </div>
          </div>

          {/* Track Conditions */}
          <div>
            <label className="block text-lg font-semibold mb-3">
              Track Conditions <span className="text-sm text-forseti-text-secondary font-normal">(optional)</span>
            </label>
            <div className="grid grid-cols-3 gap-4">
              {/* Wet/Dry Toggle */}
              <div>
                <label className="block text-sm text-forseti-text-secondary mb-2">Surface</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTrackCondition('dry')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      trackCondition === 'dry'
                        ? 'bg-forseti-lime/10 border-forseti-lime text-forseti-lime'
                        : 'bg-forseti-bg-elevated border-forseti-border text-forseti-text-secondary hover:border-forseti-text-secondary'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span className="font-medium">Dry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackCondition('wet')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      trackCondition === 'wet'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                        : 'bg-forseti-bg-elevated border-forseti-border text-forseti-text-secondary hover:border-forseti-text-secondary'
                    }`}
                  >
                    <Droplets className="w-4 h-4" />
                    <span className="font-medium">Wet</span>
                  </button>
                </div>
              </div>

              {/* Track Temperature */}
              <div>
                <label htmlFor="trackTemperature" className="block text-sm text-forseti-text-secondary mb-2">
                  Track Temp
                </label>
                <div className="relative">
                  <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forseti-text-secondary" />
                  <input
                    id="trackTemperature"
                    type="number"
                    value={trackTemperature}
                    onChange={(e) => setTrackTemperature(e.target.value)}
                    placeholder="25"
                    min="-20"
                    max="60"
                    className="w-full pl-10 pr-10 py-2 bg-forseti-bg-elevated rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-forseti-text-secondary text-sm">°C</span>
                </div>
              </div>

              {/* Air Temperature */}
              <div>
                <label htmlFor="airTemperature" className="block text-sm text-forseti-text-secondary mb-2">
                  Air Temp
                </label>
                <div className="relative">
                  <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forseti-text-secondary" />
                  <input
                    id="airTemperature"
                    type="number"
                    value={airTemperature}
                    onChange={(e) => setAirTemperature(e.target.value)}
                    placeholder="20"
                    min="-20"
                    max="50"
                    className="w-full pl-10 pr-10 py-2 bg-forseti-bg-elevated rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-forseti-text-secondary text-sm">°C</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-lg font-semibold mb-2">
              Description <span className="text-sm text-forseti-text-secondary font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about your session..."
              rows={4}
              className="w-full px-4 py-3 bg-forseti-bg-elevated rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors resize-none"
            />
          </div>

          {/* Setup File */}
          <div>
            <label className="block text-lg font-semibold mb-2">
              Car Setup <span className="text-sm text-forseti-text-secondary font-normal">(optional, .sto files only)</span>
            </label>

            {/* Current setup */}
            {currentSetupFilename && !deleteSetup && (
              <div className="mb-3 flex items-center justify-between bg-forseti-bg-elevated rounded-lg p-3 border border-forseti-border">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-forseti-lime" />
                  <span className="text-sm">{currentSetupFilename}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteSetup(true)}
                  className="p-1 hover:bg-forseti-bg-hover rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            )}

            {/* New setup file input */}
            {(deleteSetup || !currentSetupFilename) && (
              <div className="space-y-2">
                {newSetupFile ? (
                  <div className="flex items-center justify-between bg-forseti-bg-elevated rounded-lg p-3 border border-forseti-lime">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-forseti-lime" />
                      <span className="text-sm">{newSetupFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewSetupFile(null)}
                      className="p-1 hover:bg-forseti-bg-hover rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-forseti-text-secondary" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-forseti-border rounded-lg cursor-pointer hover:border-forseti-lime transition-colors">
                    <Upload className="w-5 h-5 text-forseti-text-secondary" />
                    <span className="text-sm text-forseti-text-secondary">Click to upload setup file</span>
                    <input
                      type="file"
                      accept=".sto"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (!file.name.toLowerCase().endsWith('.sto')) {
                            alert('Only iRacing setup files (.sto) are allowed')
                            return
                          }
                          setNewSetupFile(file)
                        }
                      }}
                    />
                  </label>
                )}

                {deleteSetup && currentSetupFilename && (
                  <button
                    type="button"
                    onClick={() => setDeleteSetup(false)}
                    className="text-sm text-forseti-text-secondary hover:text-forseti-text-primary"
                  >
                    Cancel removal
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Existing Media */}
          {existingMedia.length > 0 && (
            <div className="space-y-3">
              <label className="block text-lg font-semibold">
                Current Media
              </label>
              <div className="grid grid-cols-3 gap-3">
                {existingMedia.map((media) => (
                  <div key={media.id} className="relative group aspect-square">
                    {media.type === 'image' ? (
                      <img
                        src={`${API_URL}/uploads/media/${media.filename}`}
                        alt="Activity media"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <video
                          src={`${API_URL}/uploads/media/${media.filename}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        {media.duration && (
                          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                            {media.duration}s
                          </div>
                        )}
                        <Video className="absolute top-1 left-1 w-4 h-4 text-white drop-shadow" />
                      </div>
                    )}

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteExistingMedia(media.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>

                    {/* Type Icon */}
                    {media.type === 'image' && (
                      <ImageIcon className="absolute top-1 left-1 w-4 h-4 text-white drop-shadow" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Media */}
          {remainingSlots > 0 && (
            <MediaUpload
              files={newMediaFiles}
              onChange={setNewMediaFiles}
              maxFiles={remainingSlots}
              maxVideoSeconds={30}
            />
          )}

          {/* Privacy Toggle */}
          <div>
            <label className="block text-lg font-semibold mb-3">Visibility</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  !isPrivate
                    ? 'bg-forseti-lime/10 border-forseti-lime text-forseti-lime'
                    : 'bg-forseti-bg-elevated border-forseti-border text-forseti-text-secondary hover:border-forseti-text-secondary'
                }`}
              >
                <Globe className="w-5 h-5" />
                <span className="font-semibold">Public</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  isPrivate
                    ? 'bg-forseti-lime/10 border-forseti-lime text-forseti-lime'
                    : 'bg-forseti-bg-elevated border-forseti-border text-forseti-text-secondary hover:border-forseti-text-secondary'
                }`}
              >
                <Lock className="w-5 h-5" />
                <span className="font-semibold">Private</span>
              </button>
            </div>
            <p className="text-xs text-forseti-text-secondary mt-2">
              {isPrivate
                ? 'Only you can see this activity'
                : 'Your friends can see this activity in their feed'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => router.back()}
              className="flex-1 px-6 py-3 bg-forseti-bg-elevated rounded-lg hover:bg-forseti-bg-hover transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveActivity}
              disabled={!selectedTrack || isSaving}
              className="flex-1 px-6 py-3 bg-forseti-lime text-forseti-text-inverse rounded-lg hover:bg-forseti-lime-hover transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

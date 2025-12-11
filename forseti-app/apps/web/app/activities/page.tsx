'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Lock, Globe, Droplets, Sun, Thermometer } from 'lucide-react'
import TrackSelector from '../components/TrackSelector'
import MediaUpload, { MediaFile } from '../components/MediaUpload'
import SetupFileUpload, { SetupFile } from '../components/SetupFileUpload'
import { api } from '../lib/api'

function ActivitiesPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [car, setCar] = useState('')
  const [fastestLap, setFastestLap] = useState('')
  const [duration, setDuration] = useState('60')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [telemetryData, setTelemetryData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [trackCondition, setTrackCondition] = useState<'dry' | 'wet'>('dry')
  const [trackTemperature, setTrackTemperature] = useState<string>('')
  const [airTemperature, setAirTemperature] = useState<string>('')
  const [setupFile, setSetupFile] = useState<SetupFile | null>(null)

  // Pre-populate from URL parameters (from iRacing recording)
  useEffect(() => {
    console.log('Activities page loading, search params:', searchParams.toString())
    console.log('User authenticated:', !!user)

    const track = searchParams.get('track')
    const carParam = searchParams.get('car')
    const fastestLapParam = searchParams.get('fastestLap')
    const durationParam = searchParams.get('duration')
    const telemetryParam = searchParams.get('telemetry')

    if (track) {
      console.log('Setting track:', track)
      setSelectedTrack(track)
    }
    if (carParam) {
      console.log('Setting car:', carParam)
      setCar(carParam)
    }
    if (fastestLapParam) {
      console.log('Setting fastest lap:', fastestLapParam)
      setFastestLap(fastestLapParam)
    }
    if (durationParam) {
      console.log('Setting duration:', durationParam)
      setDuration(durationParam)
    }

    // If the Electron main process sent the full iRacing session payload via
    // IPC, NavigationHandler stores it in sessionStorage under
    // 'iracing_session_payload'. Prefer that over URL params (safer, avoids
    // URL length limits and decoding issues).
    let sessionPayloadRaw: string | null = null
    try {
      sessionPayloadRaw = sessionStorage.getItem('iracing_session_payload')
      if (sessionPayloadRaw) {
        console.log('[TELEMETRY] ✓ Found telemetry in sessionStorage, size:', (sessionPayloadRaw.length / 1024).toFixed(2), 'KB')
        // Clear the stored payload; we only want to consume it once
        sessionStorage.removeItem('iracing_session_payload')
      } else {
        console.log('[TELEMETRY] No telemetry in sessionStorage')
      }
    } catch (e) {
      console.error('[TELEMETRY] ✗ Error reading sessionStorage:', e)
      sessionPayloadRaw = null
    }

    const telemetrySource = sessionPayloadRaw || telemetryParam

    // Parse telemetry data if available. useSearchParams returns a decoded
    // value in Next; avoid blindly calling decodeURIComponent which can
    // throw for large/partially-encoded strings coming from Electron.
    if (telemetrySource) {
      console.log('[TELEMETRY] Attempting to parse telemetry data...')
      try {
        let parsed: any = null
        try {
          // Most common case: value is a plain JSON string
          parsed = JSON.parse(telemetrySource)
          console.log('[TELEMETRY] ✓ Telemetry parsed successfully (direct JSON)')
        } catch (e) {
          // Fallback: maybe it's percent-encoded
          parsed = JSON.parse(decodeURIComponent(telemetrySource))
          console.log('[TELEMETRY] ✓ Telemetry parsed successfully (decoded JSON)')
        }

        // Normalize a small summary used by the UI to avoid shape surprises
        const totalLaps = parsed.totalLaps || parsed.sessionData?.totalLaps || (parsed.lapData ? parsed.lapData.length : 0)
        const fastestLapObj = parsed.fastestLap || parsed.sessionData?.fastestLap || null
        const fastestLapTimeVal = parsed.sessionData?.fastestLapTime ?? parsed.fastestLapTime ?? null

        const normalize = {
          raw: parsed,
          totalLaps,
          // Keep both object and numeric forms available for downstream code
          fastestLap: fastestLapObj,
          fastestLapTime: typeof fastestLapTimeVal === 'number' ? fastestLapTimeVal : null,
        }

        console.log('[TELEMETRY] ============ TELEMETRY DATA NORMALIZED ============')
        console.log('[TELEMETRY] Track:', parsed.sessionData?.trackName)
        console.log('[TELEMETRY] Car:', parsed.sessionData?.carName)
        console.log('[TELEMETRY] Total laps:', totalLaps)
        console.log('[TELEMETRY] Lap data array length:', parsed.lapData?.length || 0)
        console.log('[TELEMETRY] Fastest lap time:', fastestLapTimeVal)
        console.log('[TELEMETRY] Session duration:', parsed.sessionData?.sessionDuration)

        setTelemetryData(normalize)
        // If the telemetry/session payload includes a session duration, prefill the duration input
        const parsedDuration = parsed.sessionData?.sessionDuration ?? parsed.sessionData?.duration ?? parsed.duration ?? null
        if (parsedDuration !== null && parsedDuration !== undefined) {
          try {
            // Ensure we store as string for the input field
            setDuration(String(parsedDuration))
            console.log('Prefilled duration from telemetry payload:', parsedDuration)
          } catch (e) {
            // ignore
          }
        }
        console.log('Telemetry data loaded (normalized):', normalize.totalLaps, 'laps')
        console.log('Telemetry data structure (raw keys):', Object.keys(parsed))

        // Auto-populate track conditions from telemetry
        const parsedCondition = parsed.sessionData?.trackCondition
        if (parsedCondition) {
          setTrackCondition(parsedCondition === 'wet' ? 'wet' : 'dry')
          console.log('[TELEMETRY] Auto-populated track condition:', parsedCondition)
        }

        const parsedTrackTemp = parsed.sessionData?.trackTemperature
        if (parsedTrackTemp !== null && parsedTrackTemp !== undefined) {
          setTrackTemperature(String(Math.round(parsedTrackTemp)))
          console.log('[TELEMETRY] Auto-populated track temperature:', parsedTrackTemp, '°C')
        }

        const parsedAirTemp = parsed.sessionData?.airTemperature
        if (parsedAirTemp !== null && parsedAirTemp !== undefined) {
          setAirTemperature(String(Math.round(parsedAirTemp)))
          console.log('[TELEMETRY] Auto-populated air temperature:', parsedAirTemp, '°C')
        }
      } catch (error) {
        console.error('Failed to parse telemetry data:', error)
        console.error('Raw telemetry param (truncated):', (telemetryParam || '').substring(0, 200) + '...')
      }
    }
    
    // Mark loading as complete
    setIsLoading(false)
  }, [searchParams, user])

  const handleSaveActivity = async () => {
    if (!user || !selectedTrack) return

    setIsSaving(true)

    try {
      // Determine duration to persist. Prefer duration found in the
      // telemetry/session payload (overlay) if present so the server record
      // matches the session time the overlay reported.
      const overlayDurationVal = telemetryData?.raw?.sessionData?.sessionDuration ?? telemetryData?.raw?.sessionData?.duration ?? telemetryData?.raw?.duration ?? null
      const savedDuration = overlayDurationVal !== null && overlayDurationVal !== undefined
        ? Number(overlayDurationVal)
        : (parseInt(duration) || 60)

      console.log('[TELEMETRY] ============ CREATING ACTIVITY ============')
      console.log('[TELEMETRY] Track:', selectedTrack)
      console.log('[TELEMETRY] Car:', car)
      console.log('[TELEMETRY] Fastest lap:', fastestLap)
      console.log('[TELEMETRY] Duration:', savedDuration, 'minutes')
      console.log('[TELEMETRY] Has telemetry data:', !!telemetryData)
      console.log('[TELEMETRY] Track condition:', trackCondition)
      console.log('[TELEMETRY] Track temperature:', trackTemperature)
      console.log('[TELEMETRY] Setup file:', setupFile?.name || 'none')

      if (telemetryData) {
        const payload = telemetryData.raw || telemetryData
        console.log('[TELEMETRY] Telemetry payload:')
        console.log('[TELEMETRY]   sessionData:', !!payload.sessionData)
        console.log('[TELEMETRY]   lapData array:', payload.lapData ? payload.lapData.length : 0, 'laps')
        console.log('[TELEMETRY]   Payload size:', JSON.stringify(payload).length, 'bytes')
      } else {
        console.log('[TELEMETRY] ⚠ NO TELEMETRY DATA - Activity will be saved without telemetry')
      }

      // Save activity to API with telemetry data
      const response = await api.createActivity({
        game: selectedTrack,
        duration: savedDuration,
        performance: '0%',
        date: new Date(),
        track: selectedTrack,
        car: car || undefined,
        fastestLap: fastestLap || undefined,
        description: description || undefined,
        isPrivate,
        trackCondition: trackCondition,
        trackTemperature: trackTemperature ? parseFloat(trackTemperature) : undefined,
        airTemperature: airTemperature ? parseFloat(airTemperature) : undefined,
        // If we've normalized telemetryData above, send the original raw payload
        telemetryData: telemetryData ? (telemetryData.raw || telemetryData) : undefined,
      })

      console.log('[TELEMETRY] ✓ Activity created successfully, ID:', response?.id)

      // Upload media files if any
      if (mediaFiles.length > 0 && response?.id) {
        console.log('[MEDIA] Uploading', mediaFiles.length, 'media files...')
        try {
          const files = mediaFiles.map(m => m.file)
          const durations = mediaFiles.map(m => m.duration || 0)
          await api.uploadActivityMedia(response.id, files, durations)
          console.log('[MEDIA] ✓ Media files uploaded successfully')
        } catch (mediaError) {
          console.error('[MEDIA] ✗ Failed to upload media:', mediaError)
          // Don't fail the whole operation, just warn
          alert('Activity saved but media upload failed. You can add media later.')
        }
      }

      // Upload setup file if any
      if (setupFile && response?.id) {
        console.log('[SETUP] Uploading setup file:', setupFile.name)
        try {
          await api.uploadActivitySetup(response.id, setupFile.file)
          console.log('[SETUP] ✓ Setup file uploaded successfully')
        } catch (setupError) {
          console.error('[SETUP] ✗ Failed to upload setup:', setupError)
          // Don't fail the whole operation, just warn
          alert('Activity saved but setup file upload failed. You can add it later.')
        }
      }

      // Clean up preview URLs
      mediaFiles.forEach(m => URL.revokeObjectURL(m.preview))

      // Reset form and redirect to dashboard
      setSelectedTrack(null)
      setCar('')
      setFastestLap('')
      setDuration('60')
      setDescription('')
      setTelemetryData(null)
      setMediaFiles([])
      setTrackCondition('dry')
      setTrackTemperature('')
      setAirTemperature('')
      setSetupFile(null)
      router.push('/dashboard')
    } catch (error) {
      console.error('[TELEMETRY] ✗ Failed to save activity:', error)
      alert('Failed to save activity. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forseti-lime mx-auto mb-4"></div>
          <p className="text-forseti-text-secondary">Loading activity data...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center">
        <div className="text-center">
          <p className="text-forseti-text-secondary">Please log in to add activities</p>
          <button 
            onClick={() => router.push('/login')}
            className="mt-4 px-6 py-2 bg-forseti-lime text-forseti-text-inverse rounded-lg hover:bg-forseti-lime-hover transition-colors"
          >
            Go to Login
          </button>
        </div>
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
            <h1 className="text-2xl font-bold">Add Activity</h1>
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
            {telemetryData && (trackTemperature || airTemperature || trackCondition !== 'dry') && (
              <p className="text-xs text-forseti-text-secondary mt-2">
                Auto-populated from iRacing telemetry
              </p>
            )}
          </div>

          {/* Car Setup File */}
          <SetupFileUpload
            file={setupFile}
            onChange={setSetupFile}
          />

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

          {/* Media Upload */}
          <MediaUpload
            files={mediaFiles}
            onChange={setMediaFiles}
            maxFiles={5}
            maxVideoSeconds={30}
          />

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

          {/* Telemetry Data Indicator */}
          {telemetryData && (
            <div className="bg-forseti-lime/10 border border-forseti-lime/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-forseti-lime rounded-full"></div>
                <p className="text-sm font-semibold text-forseti-lime">Telemetry Data Captured</p>
              </div>
                  <p className="text-xs text-forseti-text-secondary">
                    {telemetryData.totalLaps} laps recorded • Fastest lap: {telemetryData.fastestLap?.lapTimeFormatted || (telemetryData.fastestLapTime ? `${Math.floor(telemetryData.fastestLapTime/60)}:${(Math.floor(telemetryData.fastestLapTime%60)).toString().padStart(2,'0')}.${Math.floor((telemetryData.fastestLapTime%1)*1000).toString().padStart(3,'0')}` : 'N/A')}
                  </p>
            </div>
          )}

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
              {isSaving ? 'Saving...' : 'Save Activity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Loading fallback for Suspense
function ActivitiesLoading() {
  return (
    <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forseti-lime mx-auto mb-4"></div>
        <p className="text-forseti-text-secondary">Loading activity data...</p>
      </div>
    </div>
  )
}

// Main export wrapped in Suspense for Next.js 15 compatibility
export default function ActivitiesPage() {
  return (
    <Suspense fallback={<ActivitiesLoading />}>
      <ActivitiesPageContent />
    </Suspense>
  )
}

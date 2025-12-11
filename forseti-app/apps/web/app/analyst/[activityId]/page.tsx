'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, User, ChevronDown, Maximize2, X, Plus, Pencil, Trash2, StickyNote, Users } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, Label } from 'recharts'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import SectorBar from '../SectorBar'
import { getSectorConfig, TrackSectorConfig } from '../track-sectors'
import ProDriverActivitySelector from '../ProDriverActivitySelector'
import RaceEngineerChat from './RaceEngineerChat'

interface Track {
  id: string
  name: string
  location: string
}

const TRACKS: Track[] = [
  { id: 'silverstone', name: 'Silverstone', location: 'United Kingdom' },
  { id: 'brands-hatch', name: 'Brands Hatch', location: 'United Kingdom' },
  { id: 'monza', name: 'Autodromo di Monza', location: 'Italy' },
  { id: 'spa', name: 'Spa-Francorchamps', location: 'Belgium' },
]

interface TelemetryPoint {
  distance: number // Lap progress in meters
  time: number // Lap time in seconds
  timestamp: number // Raw timestamp in ms
  speed: number
  throttle: number
  brake: number
  steering: number
  gear: number | null
  rpm: number | null
}

interface TelemetryData {
  distance: number // Distance in meters
  time: number // Time in seconds
  userSpeed: number
  referenceSpeed: number
  userSteering: number
  referenceSteering: number
  userThrottle: number
  referenceThrottle: number
  userBrake: number
  referenceBrake: number
  userRpm: number
  referenceRpm: number
  delta: number // Time delta in seconds
}

interface ImprovementArea {
  startValue: number // distance or time at start
  endValue: number // distance or time at end
  type: 'braking' | 'acceleration'
  gainPotential: number // Estimated time gain in seconds
  description: string // What the driver should do
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
  telemetry?: {
    id: string
    createdAt: string
  }
  user: {
    id: string
    name: string
    avatar?: string
  }
}

interface AnalystNote {
  id: string
  activityId: string
  userId: string
  content: string
  createdAt: string
  updatedAt: string
}

// Isolated component to prevent parent re-renders during typing
function NoteInput({ onSave, onCancel }: { onSave: (content: string) => void, onCancel: () => void }) {
  const [content, setContent] = useState('')

  return (
    <div className="mb-4 space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a note about this session..."
        className="w-full px-3 py-2 bg-forseti-bg-elevated border border-forseti-border rounded-lg text-sm text-forseti-text-primary placeholder-forseti-text-secondary resize-none focus:outline-none focus:border-forseti-lime"
        rows={3}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (content.trim()) {
              onSave(content.trim())
            }
          }}
          disabled={!content.trim()}
          className="flex-1 px-3 py-1.5 bg-forseti-lime text-forseti-text-inverse text-sm font-semibold rounded-lg hover:bg-forseti-lime-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-forseti-bg-elevated text-forseti-text-secondary text-sm rounded-lg hover:bg-forseti-bg-hover transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// Isolated component for editing notes to prevent parent re-renders
function EditNoteInput({
  initialContent,
  onSave,
  onCancel
}: {
  initialContent: string
  onSave: (content: string) => void
  onCancel: () => void
}) {
  const [content, setContent] = useState(initialContent)

  return (
    <>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full px-2 py-1.5 bg-forseti-bg-card border border-forseti-border rounded text-sm text-forseti-text-primary resize-none focus:outline-none focus:border-forseti-lime"
        rows={3}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (content.trim()) {
              onSave(content.trim())
            }
          }}
          disabled={!content.trim()}
          className="flex-1 px-2 py-1 bg-forseti-lime text-forseti-text-inverse text-xs font-semibold rounded hover:bg-forseti-lime-hover transition-colors disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 bg-forseti-bg-card text-forseti-text-secondary text-xs rounded hover:bg-forseti-bg-hover transition-colors"
        >
          Cancel
        </button>
      </div>
    </>
  )
}

function AnalystPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const activityId = params.activityId as string
  const proRefActivityId = searchParams.get('proRef')
  const [activity, setActivity] = useState<Activity | null>(null)
  const [selectedChannel, setSelectedChannel] = useState('speed')
  const [loading, setLoading] = useState(true)
  const [telemetryData, setTelemetryData] = useState<TelemetryData[]>([])
  const [accessDenied, setAccessDenied] = useState(false)
  const [isActivityOwner, setIsActivityOwner] = useState(false) // Whether user owns this activity
  const [selectedLap, setSelectedLap] = useState(0) // Default to first lap (will be set to fastest)
  const [channelFilter, setChannelFilter] = useState<string>('all') // 'all', 'speed', 'steering', 'throttle'
  const [showChannelDropdown, setShowChannelDropdown] = useState(false)
  const [sessionLaps, setSessionLaps] = useState<any[]>([]) // Store all laps from session
  const [fastestLapIndex, setFastestLapIndex] = useState(0)
  const [referenceLaps, setReferenceLaps] = useState<any[]>([]) // Available reference laps
  const [proDriverLaps, setProDriverLaps] = useState<any[]>([]) // Pro driver reference laps
  const [selectedReferenceLap, setSelectedReferenceLap] = useState<any | null>(null) // Selected reference lap
  const [showReferenceDropdown, setShowReferenceDropdown] = useState(false)
  const [xAxisMode, setXAxisMode] = useState<'time' | 'distance'>('distance') // X-axis mode toggle
  const [sessionInfo, setSessionInfo] = useState<any>(null) // Session metadata (track length, etc.)
  const [telemetryDataByDistance, setTelemetryDataByDistance] = useState<TelemetryData[]>([]) // Data aligned by distance
  const [telemetryDataByTime, setTelemetryDataByTime] = useState<TelemetryData[]>([]) // Data aligned by time
  const [showCoachModal, setShowCoachModal] = useState(false) // Coach review modal
  const [isFullScreen, setIsFullScreen] = useState(false) // Full-screen analysis mode
  const [telemetryError, setTelemetryError] = useState<string | null>(null) // Telemetry error message
  const [showImprovementHighlights, setShowImprovementHighlights] = useState(false) // Toggle for improvement highlights
  const [improvementAreas, setImprovementAreas] = useState<ImprovementArea[]>([]) // Identified improvement areas
  const [hoveredArea, setHoveredArea] = useState<ImprovementArea | null>(null) // Currently hovered improvement area
  const [trackSectorConfig, setTrackSectorConfig] = useState<TrackSectorConfig | null>(null) // Track sector configuration
  const [currentPosition, setCurrentPosition] = useState(0) // Current position for sector bar (0.0 to 1.0)
  const [sectorTimes, setSectorTimes] = useState<{
    user: { sector: string; time: number }[]
    reference?: { sector: string; time: number }[]
  } | null>(null) // Calculated sector times

  // Notes state
  const [notes, setNotes] = useState<AnalystNote[]>([])
  const [proDriverNotes, setProDriverNotes] = useState<any[]>([]) // Pro driver notes
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [notesLoading, setNotesLoading] = useState(false)
  const [selectedProDriver, setSelectedProDriver] = useState<string>('all') // Filter for pro driver notes
  const [showProDriverDropdown, setShowProDriverDropdown] = useState(false)
  const [showProDriverActivitySelector, setShowProDriverActivitySelector] = useState(false) // Modal for browsing PRO driver activities

  // Calculate distance from speed integration with validation/normalization
  const calculateDistanceFromSpeed = (
    points: any[],
    expectedLapDistance?: number
  ): number[] => {
    const distances: number[] = []
    let cumulativeDistance = 0

    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        distances.push(0)
        continue
      }

      // Calculate time delta in seconds
      const currentTimestamp = points[i].timestamp || (i * 100)
      const prevTimestamp = points[i - 1].timestamp || ((i - 1) * 100)
      const deltaTimeMs = currentTimestamp - prevTimestamp
      const deltaTimeSec = deltaTimeMs / 1000

      // Speed is in m/s from iRacing
      const speedMs = points[i - 1].speed || 0

      // Distance = speed × time
      const deltaDistance = speedMs * deltaTimeSec
      cumulativeDistance += deltaDistance

      distances.push(cumulativeDistance)
    }

    // Apply normalization if expected lap distance is provided
    if (expectedLapDistance && expectedLapDistance > 0 && cumulativeDistance > 0) {
      const correctionFactor = expectedLapDistance / cumulativeDistance
      console.log('Distance normalization:', {
        calculated: cumulativeDistance.toFixed(2),
        expected: expectedLapDistance.toFixed(2),
        correctionFactor: correctionFactor.toFixed(4)
      })

      // Apply correction factor to all distances
      return distances.map(d => d * correctionFactor)
    }

    return distances
  }

  // Process real telemetry data from session for a specific lap
  // Returns both distance-aligned and time-aligned datasets
  const processLapTelemetryData = (lap: any, referenceLap?: any, sessionData?: any): { distanceData: TelemetryData[], timeData: TelemetryData[] } => {
    const telemetryPoints = lap?.telemetryPoints || []

    console.log('Processing lap telemetry data:', {
      lapNumber: lap?.lapNumber,
      lapTime: lap?.lapTime,
      telemetryPointsCount: telemetryPoints.length,
      hasReferenceLap: !!referenceLap
    })

    if (telemetryPoints.length === 0) {
      console.error('[TELEMETRY] ✗ NO TELEMETRY POINTS - Lap has no telemetry data')
      throw new Error('No telemetry data recorded for this lap')
    }

    // Get expected lap distance from session data
    const trackLength = sessionData?.trackLength || 0

    // Calculate distances from speed integration
    const userDistances = calculateDistanceFromSpeed(telemetryPoints, trackLength)

    // Use FULL RESOLUTION - no averaging!
    const userPoints: TelemetryPoint[] = telemetryPoints.map((point: any, idx: number) => {
      // Speed is in m/s from iRacing, convert to km/h for display
      const speed = (point.speed || 0) * 3.6
      const throttle = (point.throttle || 0) * 100
      const brake = (point.brake || 0) * 100
      const steering = point.steering || 0
      const gear = point.gear || null
      const rpm = point.rpm || null
      const timestamp = point.timestamp || point.timeMs || idx * 100

      return {
        distance: userDistances[idx], // Distance in meters from speed integration
        time: timestamp / 1000, // Time in seconds
        timestamp,
        speed,
        throttle,
        brake,
        steering,
        gear,
        rpm,
      }
    })

    // Get lap duration for normalization
    const lastTime = userPoints[userPoints.length - 1]?.time ?? 0
    const firstTimeRaw = userPoints[0]?.time ?? 0
    const lapDuration = lap?.lapTime || (lastTime - firstTimeRaw) || 90

    // Normalize time to start at 0
    const firstTime = userPoints[0]?.time || 0
    userPoints.forEach(point => {
      point.time = point.time - firstTime
    })

    // Use real reference lap if provided, otherwise no reference
    let referencePoints: TelemetryPoint[] | null = null
    if (referenceLap && referenceLap.telemetryPoints) {
      // Calculate distances for reference lap
      const refDistances = calculateDistanceFromSpeed(referenceLap.telemetryPoints, trackLength)

      // Process real reference lap telemetry
      referencePoints = referenceLap.telemetryPoints.map((point: any, idx: number) => {
        const speed = (point.speed || 0) * 3.6
        const throttle = (point.throttle || 0) * 100
        const brake = (point.brake || 0) * 100
        const steering = point.steering || 0
        const gear = point.gear || null
        const rpm = point.rpm || null
        const timestamp = point.timestamp || point.timeMs || idx * 100

        return {
          distance: refDistances[idx], // Distance in meters
          time: timestamp / 1000, // Time in seconds
          timestamp,
          speed,
          throttle,
          brake,
          steering,
          gear,
          rpm,
        }
      })

      // Normalize reference lap time to start at 0
      const refFirstTime = referencePoints[0]?.time || 0
      referencePoints.forEach(point => {
        point.time = point.time - refFirstTime
      })
    }

    const targetPoints = 500 // Number of uniform points

    // ============ DISTANCE-ALIGNED DATA ============
    // Use the minimum distance to avoid extrapolation
    const userMaxDistance = userPoints[userPoints.length - 1]?.distance || 1000
    const refMaxDistance = referencePoints ? (referencePoints[referencePoints.length - 1]?.distance || userMaxDistance) : userMaxDistance
    const commonMaxDistance = Math.min(userMaxDistance, refMaxDistance)

    // Resample user lap to uniform distance grid
    const resampledUserPointsByDistance = resampleToDistanceGrid(userPoints, targetPoints, commonMaxDistance)

    // Resample reference lap to the same distance grid (if exists)
    let resampledRefPointsByDistance: TelemetryPoint[] | null = null
    if (referencePoints) {
      resampledRefPointsByDistance = resampleToDistanceGrid(referencePoints, targetPoints, commonMaxDistance)
    }

    // Merge user and reference data for distance mode, calculate delta
    const distanceData: TelemetryData[] = []
    let cumulativeDeltaDistance = 0

    for (let i = 0; i < resampledUserPointsByDistance.length; i++) {
      const user = resampledUserPointsByDistance[i]
      const reference = resampledRefPointsByDistance ? resampledRefPointsByDistance[i] : null

      // Calculate instantaneous delta only if reference exists
      if (reference) {
        const speedDiff = (reference.speed - user.speed) / (user.speed || 1)
        cumulativeDeltaDistance += speedDiff * 0.01 // Accumulate delta over lap
      }

      distanceData.push({
        distance: user.distance, // Distance in meters (now uniform grid)
        time: user.time, // Time in seconds (varies)
        userSpeed: user.speed,
        referenceSpeed: reference ? reference.speed : 0,
        userSteering: user.steering,
        referenceSteering: reference ? reference.steering : 0,
        userThrottle: user.throttle,
        referenceThrottle: reference ? reference.throttle : 0,
        userBrake: user.brake,
        referenceBrake: reference ? reference.brake : 0,
        userRpm: user.rpm || 0,
        referenceRpm: reference ? (reference.rpm || 0) : 0,
        delta: reference ? cumulativeDeltaDistance : 0,
      })
    }

    // ============ TIME-ALIGNED DATA ============
    // Use the minimum time to avoid extrapolation
    const userMaxTime = userPoints[userPoints.length - 1]?.time || 90
    const refMaxTime = referencePoints ? (referencePoints[referencePoints.length - 1]?.time || userMaxTime) : userMaxTime
    const commonMaxTime = Math.min(userMaxTime, refMaxTime)

    // Resample user lap to uniform time grid
    const resampledUserPointsByTime = resampleToTimeGrid(userPoints, targetPoints, commonMaxTime)

    // Resample reference lap to the same time grid (if exists)
    let resampledRefPointsByTime: TelemetryPoint[] | null = null
    if (referencePoints) {
      resampledRefPointsByTime = resampleToTimeGrid(referencePoints, targetPoints, commonMaxTime)
    }

    // Merge user and reference data for time mode, calculate delta
    const timeData: TelemetryData[] = []
    let cumulativeDeltaTime = 0

    for (let i = 0; i < resampledUserPointsByTime.length; i++) {
      const user = resampledUserPointsByTime[i]
      const reference = resampledRefPointsByTime ? resampledRefPointsByTime[i] : null

      // Calculate instantaneous delta only if reference exists
      if (reference) {
        const speedDiff = (reference.speed - user.speed) / (user.speed || 1)
        cumulativeDeltaTime += speedDiff * 0.01 // Accumulate delta over lap
      }

      timeData.push({
        distance: user.distance, // Distance in meters (varies)
        time: user.time, // Time in seconds (now uniform grid)
        userSpeed: user.speed,
        referenceSpeed: reference ? reference.speed : 0,
        userSteering: user.steering,
        referenceSteering: reference ? reference.steering : 0,
        userThrottle: user.throttle,
        referenceThrottle: reference ? reference.throttle : 0,
        userBrake: user.brake,
        referenceBrake: reference ? reference.brake : 0,
        userRpm: user.rpm || 0,
        referenceRpm: reference ? (reference.rpm || 0) : 0,
        delta: reference ? cumulativeDeltaTime : 0,
      })
    }

    console.log('Processed telemetry:', {
      distancePoints: distanceData.length,
      timePoints: timeData.length,
      lapDuration: lapDuration.toFixed(2),
      maxDeltaDistance: Math.max(...distanceData.map(d => Math.abs(d.delta))).toFixed(3),
      maxDeltaTime: Math.max(...timeData.map(d => Math.abs(d.delta))).toFixed(3),
    })

    return { distanceData, timeData }
  }

  // Resample telemetry to a uniform distance grid
  // This ensures that both user and reference laps are sampled at the exact same distance points
  const resampleToDistanceGrid = (points: TelemetryPoint[], targetLength: number, maxDistance: number): TelemetryPoint[] => {
    if (points.length === 0) return []

    const resampled: TelemetryPoint[] = []

    for (let i = 0; i < targetLength; i++) {
      const progress = i / (targetLength - 1) // 0 to 1
      const targetDistance = progress * maxDistance // Uniform distance grid

      // Find the two points to interpolate between
      let idx = 0
      for (let j = 0; j < points.length - 1; j++) {
        if (points[j].distance <= targetDistance && points[j + 1].distance >= targetDistance) {
          idx = j
          break
        }
      }

      const p1 = points[idx]
      const p2 = points[Math.min(idx + 1, points.length - 1)]

      // Handle edge case where both points have same distance
      if (p1.distance === p2.distance) {
        resampled.push({ ...p1, distance: targetDistance })
        continue
      }

      // Linear interpolation
      const ratio = (targetDistance - p1.distance) / (p2.distance - p1.distance)
      resampled.push({
        distance: targetDistance, // Exact uniform grid distance
        time: p1.time + ratio * (p2.time - p1.time),
        timestamp: p1.timestamp + ratio * (p2.timestamp - p1.timestamp),
        speed: p1.speed + ratio * (p2.speed - p1.speed),
        throttle: p1.throttle + ratio * (p2.throttle - p1.throttle),
        brake: p1.brake + ratio * (p2.brake - p1.brake),
        steering: p1.steering + ratio * (p2.steering - p1.steering),
        gear: ratio < 0.5 ? p1.gear : p2.gear,
        rpm: p1.rpm && p2.rpm ? p1.rpm + ratio * (p2.rpm - p1.rpm) : p1.rpm || p2.rpm,
      })
    }

    return resampled
  }

  // Resample telemetry to a uniform time grid
  // This ensures that both user and reference laps are sampled at the exact same time points
  const resampleToTimeGrid = (points: TelemetryPoint[], targetLength: number, maxTime: number): TelemetryPoint[] => {
    if (points.length === 0) return []

    const resampled: TelemetryPoint[] = []

    for (let i = 0; i < targetLength; i++) {
      const progress = i / (targetLength - 1) // 0 to 1
      const targetTime = progress * maxTime // Uniform time grid

      // Find the two points to interpolate between
      let idx = 0
      for (let j = 0; j < points.length - 1; j++) {
        if (points[j].time <= targetTime && points[j + 1].time >= targetTime) {
          idx = j
          break
        }
      }

      const p1 = points[idx]
      const p2 = points[Math.min(idx + 1, points.length - 1)]

      // Handle edge case where both points have same time
      if (p1.time === p2.time) {
        resampled.push({ ...p1, time: targetTime })
        continue
      }

      // Linear interpolation
      const ratio = (targetTime - p1.time) / (p2.time - p1.time)
      resampled.push({
        distance: p1.distance + ratio * (p2.distance - p1.distance),
        time: targetTime, // Exact uniform grid time
        timestamp: p1.timestamp + ratio * (p2.timestamp - p1.timestamp),
        speed: p1.speed + ratio * (p2.speed - p1.speed),
        throttle: p1.throttle + ratio * (p2.throttle - p1.throttle),
        brake: p1.brake + ratio * (p2.brake - p1.brake),
        steering: p1.steering + ratio * (p2.steering - p1.steering),
        gear: ratio < 0.5 ? p1.gear : p2.gear,
        rpm: p1.rpm && p2.rpm ? p1.rpm + ratio * (p2.rpm - p1.rpm) : p1.rpm || p2.rpm,
      })
    }

    return resampled
  }

  // Legacy resample function (kept for backward compatibility)
  const resampleTelemetry = (points: TelemetryPoint[], targetLength: number): TelemetryPoint[] => {
    if (points.length === 0) return []
    const maxDistance = points[points.length - 1].distance
    return resampleToDistanceGrid(points, targetLength, maxDistance)
  }

  // Identify areas where the reference gains time through earlier braking or acceleration
  // Ultra-sensitive for Esports-level precision
  const identifyImprovementAreas = (data: TelemetryData[], xAxisMode: 'time' | 'distance'): ImprovementArea[] => {
    if (data.length === 0) {
      console.log('[IMPROVEMENT] No telemetry data available')
      return []
    }

    // STEP 1: Detect corners using brake telemetry
    const BRAKE_THRESHOLD = 10 // 10% brake application indicates a corner
    const MIN_CORNER_POINTS = 5 // Minimum points to be considered a corner
    const CORNER_GAP = 50 // Minimum points between corners

    interface Corner {
      startIndex: number
      endIndex: number
      centerIndex: number
      startValue: number
      endValue: number
    }

    const corners: Corner[] = []
    let inCorner = false
    let cornerStartIndex = 0

    for (let i = 0; i < data.length; i++) {
      const point = data[i]
      const brakeApplied = Math.max(point.userBrake, point.referenceBrake)

      if (!inCorner && brakeApplied > BRAKE_THRESHOLD) {
        // Start of a corner
        inCorner = true
        cornerStartIndex = i
      } else if (inCorner && brakeApplied < BRAKE_THRESHOLD) {
        // End of corner
        const cornerLength = i - cornerStartIndex
        if (cornerLength >= MIN_CORNER_POINTS) {
          // Valid corner detected
          const centerIndex = Math.floor((cornerStartIndex + i) / 2)
          corners.push({
            startIndex: cornerStartIndex,
            endIndex: i,
            centerIndex,
            startValue: xAxisMode === 'distance' ? data[cornerStartIndex].distance : data[cornerStartIndex].time,
            endValue: xAxisMode === 'distance' ? data[i].distance : data[i].time
          })
        }
        inCorner = false
      }
    }

    // Handle last corner if still in one
    if (inCorner && data.length - cornerStartIndex >= MIN_CORNER_POINTS) {
      const centerIndex = Math.floor((cornerStartIndex + data.length - 1) / 2)
      corners.push({
        startIndex: cornerStartIndex,
        endIndex: data.length - 1,
        centerIndex,
        startValue: xAxisMode === 'distance' ? data[cornerStartIndex].distance : data[cornerStartIndex].time,
        endValue: xAxisMode === 'distance' ? data[data.length - 1].distance : data[data.length - 1].time
      })
    }

    console.log(`[IMPROVEMENT] Detected ${corners.length} corners in the lap`)

    // STEP 2: Find improvement areas as before
    const areas: ImprovementArea[] = []
    const BRAKE_DIFFERENCE_THRESHOLD = 3 // Just 3% difference in brake application
    const THROTTLE_DIFFERENCE_THRESHOLD = 5 // Just 5% difference in throttle
    const SPEED_DIFFERENCE_THRESHOLD = 0.5 // 0.5 km/h speed difference (very sensitive)
    const MIN_POINTS = 2 // Just 2 consecutive points (ultra sensitive)
    const LOOKAHEAD_POINTS = 3 // Look ahead to detect early inputs

    let currentArea: {
      startIndex: number
      endIndex: number
      type: 'braking' | 'acceleration'
      maxDifference: number
      startDelta: number
      endDelta: number
    } | null = null

    for (let i = 0; i < data.length - LOOKAHEAD_POINTS; i++) {
      const point = data[i]

      // Look ahead to see if reference is about to brake/accelerate
      const nextPoints = data.slice(i, i + LOOKAHEAD_POINTS)

      // Detect early braking: Reference is braking or about to brake more than user
      const refBrakeAvg = nextPoints.reduce((sum, p) => sum + p.referenceBrake, 0) / LOOKAHEAD_POINTS
      const userBrakeAvg = nextPoints.reduce((sum, p) => sum + p.userBrake, 0) / LOOKAHEAD_POINTS
      const brakeDifference = refBrakeAvg - userBrakeAvg

      // Detect early acceleration: Reference is on throttle more than user
      const refThrottleAvg = nextPoints.reduce((sum, p) => sum + p.referenceThrottle, 0) / LOOKAHEAD_POINTS
      const userThrottleAvg = nextPoints.reduce((sum, p) => sum + p.userThrottle, 0) / LOOKAHEAD_POINTS
      const throttleDifference = refThrottleAvg - userThrottleAvg

      // Speed difference (reference maintaining more speed or losing less speed)
      const speedDifference = point.referenceSpeed - point.userSpeed

      const isEarlyBrakingOpportunity =
        brakeDifference > BRAKE_DIFFERENCE_THRESHOLD &&
        point.referenceSpeed > 30 && // Only in meaningful speed ranges
        point.userSpeed > 30

      const isEarlyAccelerationOpportunity =
        throttleDifference > THROTTLE_DIFFERENCE_THRESHOLD &&
        userBrakeAvg < 5 && // User not actively braking
        point.referenceSpeed > 0 &&
        speedDifference > -10 // Not when user is way faster

      if (isEarlyBrakingOpportunity || isEarlyAccelerationOpportunity) {
        if (!currentArea) {
          // Start new improvement area
          currentArea = {
            startIndex: i,
            endIndex: i,
            type: isEarlyBrakingOpportunity ? 'braking' : 'acceleration',
            maxDifference: isEarlyBrakingOpportunity ? brakeDifference : throttleDifference,
            startDelta: point.delta,
            endDelta: point.delta,
          }
        } else if (
          (isEarlyBrakingOpportunity && currentArea.type === 'braking') ||
          (isEarlyAccelerationOpportunity && currentArea.type === 'acceleration')
        ) {
          // Extend current area (same type)
          currentArea.endIndex = i
          currentArea.maxDifference = Math.max(
            currentArea.maxDifference,
            isEarlyBrakingOpportunity ? brakeDifference : throttleDifference
          )
          currentArea.endDelta = point.delta
        } else {
          // Type changed, save current area if significant
          if (currentArea.endIndex - currentArea.startIndex >= MIN_POINTS) {
            const startPoint = data[currentArea.startIndex]
            const endPoint = data[currentArea.endIndex]

            // Calculate actual time gain: look ahead to see the benefit of the earlier input
            // The benefit shows up 50-100m after the zone (through the corner/onto the straight)
            const LOOKAHEAD_FOR_GAIN = 50 // Look 50 points ahead to see the real benefit
            const lookAheadIndex = Math.min(currentArea.endIndex + LOOKAHEAD_FOR_GAIN, data.length - 1)
            const lookAheadPoint = data[lookAheadIndex]

            // The gain is the delta improvement from the end of the zone to after the maneuver completes
            // If delta gets better (more negative), that's the time gained
            const gainPotential = Math.max(0, currentArea.endDelta - lookAheadPoint.delta)

            // Generate driver-focused coaching advice
            let description = ''
            if (currentArea.type === 'braking') {
              // Analyze braking pattern to give specific advice
              const brakePressureDiff = currentArea.maxDifference
              const distanceEarlier = xAxisMode === 'distance'
                ? (endPoint.distance - startPoint.distance)
                : ((endPoint.time - startPoint.time) * ((startPoint.userSpeed + endPoint.userSpeed) / 2) / 3.6)

              if (brakePressureDiff > 15) {
                description = "You're braking too hard here. Aim for a softer, more progressive brake."
              } else if (distanceEarlier < 5) {
                description = "Braking too late here. Try going in earlier to carry more speed through."
              } else {
                description = "Work on your trail braking - ease off the brake smoother through the corner."
              }
            } else {
              // Acceleration coaching
              const throttleDiff = currentArea.maxDifference
              const exitSpeedDiff = endPoint.referenceSpeed - endPoint.userSpeed

              if (exitSpeedDiff > 5) {
                description = "Entry speed too high. Focus on exit and try looking up earlier."
              } else if (throttleDiff > 20) {
                description = "You can be more aggressive on the throttle here - get on the power earlier."
              } else {
                description = "Focus on your exit - squeeze the throttle progressively as you unwind the wheel."
              }
            }

            areas.push({
              startValue: xAxisMode === 'distance' ? startPoint.distance : startPoint.time,
              endValue: xAxisMode === 'distance' ? endPoint.distance : endPoint.time,
              type: currentArea.type,
              gainPotential,
              description,
            })
          }
          // Start new area with different type
          currentArea = {
            startIndex: i,
            endIndex: i,
            type: isEarlyBrakingOpportunity ? 'braking' : 'acceleration',
            maxDifference: isEarlyBrakingOpportunity ? brakeDifference : throttleDifference,
            startDelta: point.delta,
            endDelta: point.delta,
          }
        }
      } else {
        // No improvement opportunity at this point
        if (currentArea && currentArea.endIndex - currentArea.startIndex >= MIN_POINTS) {
          const startPoint = data[currentArea.startIndex]
          const endPoint = data[currentArea.endIndex]

          // Calculate actual time gain: look ahead to see the benefit
          const LOOKAHEAD_FOR_GAIN = 50
          const lookAheadIndex = Math.min(currentArea.endIndex + LOOKAHEAD_FOR_GAIN, data.length - 1)
          const lookAheadPoint = data[lookAheadIndex]
          const gainPotential = Math.max(0, currentArea.endDelta - lookAheadPoint.delta)

          // Generate driver-focused coaching advice
          let description = ''
          if (currentArea.type === 'braking') {
            const brakePressureDiff = currentArea.maxDifference
            const distanceEarlier = xAxisMode === 'distance'
              ? (endPoint.distance - startPoint.distance)
              : ((endPoint.time - startPoint.time) * ((startPoint.userSpeed + endPoint.userSpeed) / 2) / 3.6)

            if (brakePressureDiff > 15) {
              description = "You're braking too hard here. Aim for a softer, more progressive brake."
            } else if (distanceEarlier < 5) {
              description = "Braking too late here. Try going in earlier to carry more speed through."
            } else {
              description = "Work on your trail braking - ease off the brake smoother through the corner."
            }
          } else {
            const throttleDiff = currentArea.maxDifference
            const exitSpeedDiff = endPoint.referenceSpeed - endPoint.userSpeed

            if (exitSpeedDiff > 5) {
              description = "Entry speed too high. Focus on exit and try looking up earlier."
            } else if (throttleDiff > 20) {
              description = "You can be more aggressive on the throttle here - get on the power earlier."
            } else {
              description = "Focus on your exit - squeeze the throttle progressively as you unwind the wheel."
            }
          }

          areas.push({
            startValue: xAxisMode === 'distance' ? startPoint.distance : startPoint.time,
            endValue: xAxisMode === 'distance' ? endPoint.distance : endPoint.time,
            type: currentArea.type,
            gainPotential,
            description,
          })
        }
        currentArea = null
      }
    }

    // Don't forget the last area
    if (currentArea && currentArea.endIndex - currentArea.startIndex >= MIN_POINTS) {
      const startPoint = data[currentArea.startIndex]
      const endPoint = data[currentArea.endIndex]

      // Calculate actual time gain: look ahead to see the benefit
      const LOOKAHEAD_FOR_GAIN = 50
      const lookAheadIndex = Math.min(currentArea.endIndex + LOOKAHEAD_FOR_GAIN, data.length - 1)
      const lookAheadPoint = data[lookAheadIndex]
      const gainPotential = Math.max(0, currentArea.endDelta - lookAheadPoint.delta)

      // Generate driver-focused coaching advice
      let description = ''
      if (currentArea.type === 'braking') {
        const brakePressureDiff = currentArea.maxDifference
        const distanceEarlier = xAxisMode === 'distance'
          ? (endPoint.distance - startPoint.distance)
          : ((endPoint.time - startPoint.time) * ((startPoint.userSpeed + endPoint.userSpeed) / 2) / 3.6)

        if (brakePressureDiff > 15) {
          description = "You're braking too hard here. Aim for a softer, more progressive brake."
        } else if (distanceEarlier < 5) {
          description = "Braking too late here. Try going in earlier to carry more speed through."
        } else {
          description = "Work on your trail braking - ease off the brake smoother through the corner."
        }
      } else {
        const throttleDiff = currentArea.maxDifference
        const exitSpeedDiff = endPoint.referenceSpeed - endPoint.userSpeed

        if (exitSpeedDiff > 5) {
          description = "Entry speed too high. Focus on exit and try looking up earlier."
        } else if (throttleDiff > 20) {
          description = "You can be more aggressive on the throttle here - get on the power earlier."
        } else {
          description = "Focus on your exit - squeeze the throttle progressively as you unwind the wheel."
        }
      }

      areas.push({
        startValue: xAxisMode === 'distance' ? startPoint.distance : startPoint.time,
        endValue: xAxisMode === 'distance' ? endPoint.distance : endPoint.time,
        type: currentArea.type,
        gainPotential,
        description,
      })
    }

    // STEP 3: Group improvement areas by corner and keep only the best one per corner
    interface AreaWithCorner extends ImprovementArea {
      cornerIndex: number
      areaIndex: number
    }

    // Assign each improvement area to its nearest corner
    const areasWithCorners: AreaWithCorner[] = areas.map((area, areaIndex) => {
      // Find the center point of the improvement area
      const areaCenter = (area.startValue + area.endValue) / 2

      // Find the closest corner to this improvement area
      let closestCornerIndex = -1
      let minDistance = Infinity

      corners.forEach((corner, cornerIndex) => {
        const cornerCenter = (corner.startValue + corner.endValue) / 2
        const distance = Math.abs(cornerCenter - areaCenter)

        if (distance < minDistance) {
          minDistance = distance
          closestCornerIndex = cornerIndex
        }
      })

      return {
        ...area,
        cornerIndex: closestCornerIndex,
        areaIndex
      }
    })

    // Group by corner and keep only the best suggestion per corner
    const cornerGroups = new Map<number, AreaWithCorner[]>()
    areasWithCorners.forEach(area => {
      if (!cornerGroups.has(area.cornerIndex)) {
        cornerGroups.set(area.cornerIndex, [])
      }
      cornerGroups.get(area.cornerIndex)!.push(area)
    })

    // For each corner, pick the suggestion with the highest gain potential
    const topAreas: ImprovementArea[] = []
    cornerGroups.forEach((areasInCorner, cornerIndex) => {
      // Sort by gain potential and take the best one
      const bestArea = areasInCorner.sort((a, b) => b.gainPotential - a.gainPotential)[0]
      topAreas.push({
        startValue: bestArea.startValue,
        endValue: bestArea.endValue,
        type: bestArea.type,
        gainPotential: bestArea.gainPotential,
        description: bestArea.description
      })
    })

    // Sort final results by gain potential for display
    topAreas.sort((a, b) => b.gainPotential - a.gainPotential)

    console.log(`[IMPROVEMENT] ========================================`)
    console.log(`[IMPROVEMENT] Analysis complete for ${xAxisMode} mode`)
    console.log(`[IMPROVEMENT] Data points analyzed: ${data.length}`)
    console.log(`[IMPROVEMENT] Corners detected: ${corners.length}`)
    console.log(`[IMPROVEMENT] Found ${areas.length} improvement areas total`)
    console.log(`[IMPROVEMENT] Showing best suggestion per corner (${topAreas.length} suggestions):`)
    topAreas.forEach((area, idx) => {
      console.log(`[IMPROVEMENT]   ${idx + 1}. ${area.type.toUpperCase()} (Gain: ${area.gainPotential.toFixed(3)}s): ${area.description}`)
    })
    console.log(`[IMPROVEMENT] ========================================`)
    return topAreas
  }

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        console.log('[TELEMETRY] ============ ANALYST: FETCHING ACTIVITY ============')
        console.log('[TELEMETRY] Activity ID:', activityId)
        console.log('[TELEMETRY] User ID:', user?.id)

        const data = await api.getActivityById(activityId)

        console.log('[TELEMETRY] ✓ Activity fetched')
        console.log('[TELEMETRY] Activity owner:', data.userId)
        console.log('[TELEMETRY] Has telemetry record:', !!data.telemetry)

        // Check if the current user owns this activity or is subscribed to the pro driver
        const isOwner = user && data.userId === user.id
        let hasAccess = isOwner

        if (!isOwner && data.user?.isPro) {
          // Check if user is subscribed to this pro driver
          try {
            const subscriptionStatus = await api.checkSubscription(data.userId)
            hasAccess = subscriptionStatus.isSubscribed
            console.log('[TELEMETRY] Subscription check:', subscriptionStatus.isSubscribed ? '✓ Subscribed' : '✗ Not subscribed')
          } catch (error) {
            console.log('[TELEMETRY] Subscription check failed:', error)
          }
        }

        if (!hasAccess) {
          console.log('[TELEMETRY] ✗ Access denied - user does not own this activity and is not subscribed')
          setAccessDenied(true)
          setLoading(false)
          return
        }

        console.log('[TELEMETRY] ✓ Access granted -', isOwner ? 'owner' : 'subscribed to pro driver')

        setIsActivityOwner(isOwner)
        setActivity(data)

        // Check if telemetry data is available
        if (data.telemetry && data.telemetry.id) {
          console.log('[TELEMETRY] Telemetry record exists, ID:', data.telemetry.id)
          console.log('[TELEMETRY] Fetching full telemetry data...')

          try {
            // Fetch telemetry data, reference laps, and pro driver notes in parallel
            // Only fetch analyst notes if user owns the activity
            const [telemetryResponse, referenceLapsData, proNotesData, analystNotesData] = await Promise.all([
              api.getTelemetryData(activityId),
              api.getReferenceLaps(activityId).catch(() => ({ userLaps: [], proDriverLaps: [] })),
              api.getProDriverNotes(activityId).catch(() => []),
              isOwner ? api.getAnalystNotes(activityId).catch(() => []) : Promise.resolve([])
            ])
            const sessionData = telemetryResponse

            console.log('[TELEMETRY] ============ TELEMETRY DATA RECEIVED ============')
            console.log('[TELEMETRY] Session data:', sessionData.sessionData)
            console.log('[TELEMETRY] Lap data array length:', sessionData.lapData?.length || 0)
            console.log('[TELEMETRY] User reference laps available:', referenceLapsData.userLaps?.length || 0)
            console.log('[TELEMETRY] Pro driver laps available:', referenceLapsData.proDriverLaps?.length || 0)
            console.log('[TELEMETRY] Pro driver notes available:', proNotesData.length)
            if (isOwner) console.log('[TELEMETRY] Analyst notes available:', analystNotesData.length)

            // Store session info (track length, etc.)
            setSessionInfo(sessionData.sessionData)

            // Store reference laps (user laps and pro driver laps)
            setReferenceLaps(referenceLapsData.userLaps || [])
            setProDriverLaps(referenceLapsData.proDriverLaps || [])

            // Store pro driver notes
            setProDriverNotes(proNotesData)

            // Store analyst notes
            setNotes(analystNotesData)

            // Store all laps, but filter out sighting lap (lap 0) and invalid laps
            if (sessionData.lapData && sessionData.lapData.length > 0) {
              console.log('[TELEMETRY] Raw lap data before filtering:')
              sessionData.lapData.forEach((lap: any, idx: number) => {
                console.log(`[TELEMETRY]   Lap ${lap.lapNumber}: ${lap.lapTime}s (${lap.telemetryPoints?.length || 0} points) - isSightingLap:`, lap.isSightingLap)
              })

              // Filter out sighting lap and laps with no valid time
              const validLaps = sessionData.lapData.filter((lap: any) =>
                lap.lapNumber > 0 && lap.lapTime > 0 && !lap.isSightingLap
              )

              console.log('[TELEMETRY] ============ LAP FILTERING ============')
              console.log('[TELEMETRY] Total laps in data:', sessionData.lapData.length)
              console.log('[TELEMETRY] Valid laps after filtering:', validLaps.length)
              console.log('[TELEMETRY] Valid laps:', validLaps.map((l: any) => ({
                lapNumber: l.lapNumber,
                lapTime: l.lapTime,
                formatted: l.lapTimeFormatted,
                points: l.telemetryPoints?.length || 0
              })))

              if (validLaps.length === 0) {
                console.error('[TELEMETRY] ✗ NO VALID LAPS AFTER FILTERING')
                console.error('[TELEMETRY] All laps were filtered out (either lap 0, invalid time, or marked as sighting lap)')
                setTelemetryError('Error with data recording: No valid laps found in this session. All laps were either incomplete or invalid.')
                setLoading(false)
                return
              } else {
                setSessionLaps(validLaps)

                // Find the fastest lap
                let fastestIdx = 0
                let fastestTime = validLaps[0]?.lapTime || Infinity
                validLaps.forEach((lap: any, idx: number) => {
                  if (lap.lapTime > 0 && lap.lapTime < fastestTime) {
                    fastestTime = lap.lapTime
                    fastestIdx = idx
                  }
                })

                console.log('[TELEMETRY] ✓ Fastest lap:', validLaps[fastestIdx].lapNumber, '-', validLaps[fastestIdx].lapTimeFormatted, '(index:', fastestIdx + ')')

                setFastestLapIndex(fastestIdx)
                setSelectedLap(fastestIdx)

                // Process the fastest lap initially (with no reference lap yet)
                const { distanceData, timeData } = processLapTelemetryData(validLaps[fastestIdx], null, sessionData.sessionData)
                setTelemetryDataByDistance(distanceData)
                setTelemetryDataByTime(timeData)
                setTelemetryData(distanceData) // Keep for backwards compatibility
                console.log('[TELEMETRY] ✓ Real telemetry data loaded and processed')
              }
            } else {
              console.error('[TELEMETRY] ✗ NO LAP DATA - lapData array is empty or missing')
              setTelemetryError('Error with data recording: Session has no lap data. The telemetry may not have been captured correctly.')
              setLoading(false)
              return
            }
          } catch (error) {
            console.error('[TELEMETRY] ✗ Failed to fetch telemetry data:', error)
            console.error('[TELEMETRY] Error details:', error instanceof Error ? error.message : 'Unknown error')
            setTelemetryError('Error with data recording: Failed to load telemetry data from the server. Please try again.')
            setLoading(false)
            return
          }
        } else {
          console.error('[TELEMETRY] ✗ NO TELEMETRY RECORD - Activity has no telemetry attached')
          console.error('[TELEMETRY] This means the activity was not created with telemetry data')
          setTelemetryError('Error with data recording: This activity has no telemetry data attached. Make sure iRacing recording was active during the session.')
          setLoading(false)
          return
        }
      } catch (error) {
        console.error('[TELEMETRY] ✗ Failed to fetch activity:', error)
        console.error('[TELEMETRY] Error details:', error instanceof Error ? error.message : 'Unknown error')
        setTelemetryError('Error with data recording: Failed to load activity data from the server. Please try again.')
        setLoading(false)
        return
      }
      setLoading(false)
    }

    if (user) {
      fetchActivity()
    } else {
      setLoading(false)
    }
  }, [activityId, user?.id])

  // Auto-load pro driver reference lap when proRef query param is present
  useEffect(() => {
    if (!proRefActivityId || sessionLaps.length === 0 || selectedReferenceLap) {
      return
    }

    const loadProDriverReferenceLap = async () => {
      try {
        console.log('[TELEMETRY] ============ AUTO-LOADING PRO DRIVER REFERENCE LAP ============')
        console.log('[TELEMETRY] Pro activity ID:', proRefActivityId)

        // Fetch the pro driver's activity
        const proActivity = await api.getActivityById(proRefActivityId)
        console.log('[TELEMETRY] Pro activity loaded:', proActivity.user?.name)

        // Fetch the pro driver's telemetry
        const proTelemetry = await api.getTelemetryData(proRefActivityId)
        console.log('[TELEMETRY] Pro telemetry loaded, laps:', proTelemetry.lapData?.length || 0)

        if (proTelemetry.lapData && proTelemetry.lapData.length > 0) {
          // Filter to valid laps
          const validLaps = proTelemetry.lapData.filter((lap: any) =>
            lap.lapNumber > 0 && lap.lapTime > 0 && !lap.isSightingLap
          )

          if (validLaps.length > 0) {
            // Find fastest lap
            let fastestLap = validLaps[0]
            for (const lap of validLaps) {
              if (lap.lapTime > 0 && lap.lapTime < fastestLap.lapTime) {
                fastestLap = lap
              }
            }

            console.log('[TELEMETRY] ✓ Selected pro driver fastest lap:', fastestLap.lapNumber, '-', fastestLap.lapTimeFormatted)

            // Set as reference lap
            setSelectedReferenceLap({
              activityId: proRefActivityId,
              lapNumber: fastestLap.lapNumber,
              lapTime: fastestLap.lapTime,
              lapTimeFormatted: fastestLap.lapTimeFormatted,
              telemetryPoints: fastestLap.telemetryPoints,
              activityDate: proActivity.date,
              isProDriverLap: true,
              driver: proActivity.user
            })
          } else {
            console.error('[TELEMETRY] ✗ No valid laps found in pro driver session')
          }
        } else {
          console.error('[TELEMETRY] ✗ Pro driver session has no lap data')
        }
      } catch (error) {
        console.error('[TELEMETRY] ✗ Failed to load pro driver reference lap:', error)
      }
    }

    loadProDriverReferenceLap()
  }, [proRefActivityId, sessionLaps.length, selectedReferenceLap])

  // Update telemetry data when selected lap or reference lap changes
  // Using useMemo instead of useEffect to avoid infinite update loops
  const processedTelemetryData = useMemo(() => {
    if (sessionLaps.length > 0 && selectedLap >= 0 && selectedLap < sessionLaps.length) {
      return processLapTelemetryData(sessionLaps[selectedLap], selectedReferenceLap, sessionInfo)
    }
    return { distanceData: [], timeData: [] }
  }, [selectedLap, sessionLaps, selectedReferenceLap, sessionInfo])

  // Update state from memoized data
  useEffect(() => {
    setTelemetryDataByDistance(processedTelemetryData.distanceData)
    setTelemetryDataByTime(processedTelemetryData.timeData)
    setTelemetryData(processedTelemetryData.distanceData)
  }, [processedTelemetryData])

  // Update improvement areas when telemetry data or x-axis mode changes
  useEffect(() => {
    if (selectedReferenceLap) {
      const currentData = xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime
      const areas = identifyImprovementAreas(currentData, xAxisMode)
      setImprovementAreas(areas)
    } else {
      setImprovementAreas([])
    }
  }, [telemetryDataByDistance, telemetryDataByTime, xAxisMode, selectedReferenceLap])

  // Load track sector configuration when activity is loaded
  useEffect(() => {
    if (activity?.track) {
      const config = getSectorConfig(activity.track)
      setTrackSectorConfig(config)
      console.log('[SECTORS] Loaded sector config for track:', activity.track, config)
    }
  }, [activity])

  // Calculate sector times when telemetry data changes
  useEffect(() => {
    if (!trackSectorConfig || telemetryDataByDistance.length === 0) {
      setSectorTimes(null)
      return
    }

    // Get total lap distance from session info or calculate from data
    const totalDistance = sessionInfo?.trackLength || telemetryDataByDistance[telemetryDataByDistance.length - 1]?.distance || 1000

    // Calculate sector times for user lap
    const userSectorTimes: { sector: string; time: number }[] = []

    trackSectorConfig.sectors.forEach((sector) => {
      // Find first point at or after sector start
      const startPoint = telemetryDataByDistance.find(d => (d.distance / totalDistance) >= sector.start)
      // Find first point at or after sector end
      const endPoint = telemetryDataByDistance.find(d => (d.distance / totalDistance) >= sector.end)

      if (startPoint && endPoint) {
        const sectorTime = endPoint.time - startPoint.time
        userSectorTimes.push({
          sector: sector.name,
          time: Math.max(0, sectorTime), // Ensure non-negative
        })
      } else {
        userSectorTimes.push({
          sector: sector.name,
          time: 0,
        })
      }
    })

    // TODO: Calculate reference sector times if reference lap is selected
    // For now, just set user times
    setSectorTimes({ user: userSectorTimes })

    console.log('[SECTORS] Calculated sector times:', userSectorTimes)
  }, [trackSectorConfig, telemetryDataByDistance, sessionInfo])


  // Note handling functions
  const handleAddNote = useCallback(async (content: string) => {
    if (!content.trim()) return

    try {
      const note = await api.createAnalystNote(activityId, content.trim())
      setNotes(prev => [note, ...prev])
      setShowNoteInput(false)
    } catch (error) {
      console.error('Failed to add note:', error)
    }
  }, [activityId])

  const handleUpdateNote = useCallback(async (noteId: string, content: string) => {
    if (!content.trim()) return

    try {
      const note = await api.updateAnalystNote(noteId, content.trim())
      setNotes(prev => prev.map(n => n.id === noteId ? note : n))
      setEditingNoteId(null)
    } catch (error) {
      console.error('Failed to update note:', error)
    }
  }, [])

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      await api.deleteAnalystNote(noteId)
      setNotes(prev => prev.filter(note => note.id !== noteId))
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }, [])

  const startEditNote = useCallback((note: AnalystNote) => {
    setEditingNoteId(note.id)
  }, [])

  const cancelEditNote = useCallback(() => {
    setEditingNoteId(null)
  }, [])

  // Helper function to format lap time
  const formatLapTime = useCallback((seconds: number): string => {
    if (!seconds || seconds === 0) return '--:--:---'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${mins}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`
  }, [])

  // Handle Race Engineer chat messages
  const handleRaceEngineerMessage = useCallback(async (
    message: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> => {
    try {
      console.log('[RACE ENGINEER] Sending message:', message)

      const response = await api.chatWithRaceEngineer(
        message,
        conversationHistory,
        {
          track: activity?.track,
          car: activity?.car,
          fastestLap: activity?.fastestLap,
          selectedLap: selectedLap,
          referenceLap: selectedReferenceLap,
          isProDriverReference: proDriverLaps.length > 0 && selectedReferenceLap !== null,
          proDriverName: proDriverLaps.length > 0 ? 'Pro Driver' : undefined,
          lapCount: sessionLaps.length,
          improvementAreas: improvementAreas.length
        }
      )

      console.log('[RACE ENGINEER] Response received')
      return response.response

    } catch (error) {
      console.error('[RACE ENGINEER] Error:', error)
      throw error
    }
  }, [activity, selectedLap, selectedReferenceLap, proDriverLaps, sessionLaps, improvementAreas])

  // Handle chart mouse movement to update sector bar position
  const handleChartMouseMove = useCallback((data: any) => {
    if (!data || !data.activePayload || !data.activePayload[0]) {
      return
    }

    const activeData = data.activePayload[0].payload
    const totalDistance = sessionInfo?.trackLength || telemetryDataByDistance[telemetryDataByDistance.length - 1]?.distance || 1000

    if (xAxisMode === 'distance') {
      // Calculate lapDistPct from distance
      const lapDistPct = activeData.distance / totalDistance
      setCurrentPosition(Math.max(0, Math.min(1, lapDistPct))) // Clamp between 0 and 1
    } else {
      // For time mode, we need to find the corresponding distance
      // Find the telemetry point with matching time
      const matchingPoint = telemetryDataByDistance.find(d => Math.abs(d.time - activeData.time) < 0.1)
      if (matchingPoint) {
        const lapDistPct = matchingPoint.distance / totalDistance
        setCurrentPosition(Math.max(0, Math.min(1, lapDistPct)))
      }
    }
  }, [sessionInfo, telemetryDataByDistance, xAxisMode])

  // Custom tooltip that shows improvement area information
  // chartType: which chart is this tooltip for (to filter relevant improvements)
  // showSuggestion: whether to show the improvement suggestion (only on primary charts)
  const CustomTooltip = ({ active, payload, label, chartType, showSuggestion = false }: any) => {
    if (!active || !payload || payload.length === 0) return null

    // Check if we're hovering DIRECTLY over an improvement area
    // Use a smaller tolerance to be more precise
    const currentValue = xAxisMode === 'distance' ? label : label
    const TOLERANCE = 0.1 // Very small tolerance for precision

    // Only check for improvement areas if showSuggestion is true
    let area = null
    if (showSuggestion) {
      // Filter areas based on chart type
      let relevantAreas = improvementAreas
      if (chartType === 'brake') {
        relevantAreas = improvementAreas.filter(a => a.type === 'braking')
      } else if (chartType === 'throttle') {
        relevantAreas = improvementAreas.filter(a => a.type === 'acceleration')
      } else if (chartType === 'throttle-brake') {
        relevantAreas = improvementAreas // Show both since chart has both traces
      } else if (chartType === 'speed') {
        relevantAreas = improvementAreas // Show both braking and acceleration on speed
      } else if (chartType === 'steering' || chartType === 'delta') {
        relevantAreas = improvementAreas // Show all for these charts
      }

      area = relevantAreas.find(
        (a) => currentValue >= (a.startValue - TOLERANCE) && currentValue <= (a.endValue + TOLERANCE)
      )
    }

    return (
      <div
        className="bg-forseti-bg-elevated border border-forseti-border rounded-lg p-3 shadow-lg"
        style={{ maxWidth: '300px' }}
      >
        {/* Regular tooltip content */}
        <p className="text-xs text-forseti-text-secondary mb-2">
          {xAxisMode === 'distance' ? `${label.toFixed(0)}m` : `${label.toFixed(2)}s`}
        </p>
        {payload.map((entry: any, index: number) => {
          const name = entry.name || ''
          const nameLower = name.toLowerCase()
          const dataKey = entry.dataKey ? String(entry.dataKey) : ''
          const dataKeyLower = dataKey.toLowerCase()

          // Determine the unit based on the chart type or data key
          let unit = '%'
          let decimals = 1

          if (chartType === 'speed' || dataKeyLower.includes('speed')) {
            unit = ' km/h'
            decimals = 1
          } else if (chartType === 'rpm' || dataKeyLower.includes('rpm')) {
            unit = ' RPM'
            decimals = 0
          } else if (chartType === 'delta' || dataKeyLower.includes('delta')) {
            unit = 's'
            decimals = 3
          } else if (dataKeyLower.includes('gear')) {
            unit = ''
            decimals = 0
          } else if (dataKeyLower.includes('steering')) {
            unit = '°'
            decimals = 1
          }

          return (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(decimals)}{unit}
            </p>
          )
        })}

        {/* Show improvement area info ONLY if hovering directly over one */}
        {showImprovementHighlights && area && (
          <div className={`mt-3 pt-3 border-t ${area.type === 'braking' ? 'border-[#FF6B6B]' : 'border-[#4ECDC4]'}`}>
            <p className={`text-sm font-bold flex items-center gap-2 ${area.type === 'braking' ? 'text-[#FF6B6B]' : 'text-[#4ECDC4]'}`}>
              <img src="/assets/level-badges/Platinum.png" alt="AI Coaching Tip" className="w-4 h-4" />
              AI Coaching Tip
            </p>
            <p className="text-xs text-forseti-text-primary mt-1">
              {area.description}
            </p>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-forseti-bg-main flex items-center justify-center">
        <div className="text-forseti-text-secondary">Loading...</div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-forseti-bg-main flex flex-col items-center justify-center gap-4">
        <div className="text-forseti-text-primary text-xl font-bold">Access Denied</div>
        <div className="text-forseti-text-secondary text-center max-w-md">
          You can only view telemetry analysis for your own activities.
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-3 bg-forseti-lime text-forseti-bg-main rounded-lg font-bold hover:bg-forseti-lime-hover transition-colors"
        >
          Go Back
        </button>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-forseti-bg-main flex items-center justify-center">
        <div className="text-forseti-text-secondary">Activity not found</div>
      </div>
    )
  }

  const channels = [
    { id: 'speed', label: 'Speed' },
    { id: 'steering', label: 'Steering Angle' },
    { id: 'throttle', label: 'Throttle / Brake' },
  ]

  return (
    <div className="min-h-screen bg-forseti-bg-main">
      {/* Left Sidebar */}
      <div className="fixed left-0 top-0 h-full w-80 bg-forseti-bg-card border-r border-forseti-border flex flex-col">
        {/* Fixed Header */}
        <div className="p-6 pb-4 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-forseti-text-secondary hover:text-forseti-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          className="flex-1 overflow-y-auto px-6 pb-8"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent'
          }}
        >
          {/* Activity Info */}
          <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden">
              {activity.user.avatar ? (
                <img src={activity.user.avatar} alt={activity.user.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-forseti-text-secondary" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-forseti-text-primary">{activity.user.name}</h3>
              <p className="text-sm text-forseti-text-secondary">
                {new Date(activity.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-forseti-bg-elevated rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-forseti-text-secondary mb-1">Track</p>
                <p className="text-base font-bold text-forseti-text-primary">
                  {TRACKS.find(t => t.id === activity.track)?.name || activity.track || 'Unknown Track'}
                </p>
              </div>
              {activity.car && (
                <div>
                  <p className="text-xs text-forseti-text-secondary mb-1">Car</p>
                  <p className="text-base font-semibold text-forseti-text-primary">
                    {activity.car}
                  </p>
                </div>
              )}
              {activity.duration && (
                <div>
                  <p className="text-xs text-forseti-text-secondary mb-1">Session Duration</p>
                  <p className="text-base font-semibold text-forseti-text-primary">
                    {activity.duration} minutes
                  </p>
                </div>
              )}
            </div>

            {sessionLaps.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-forseti-text-secondary font-semibold">Session Laps</p>
                {sessionLaps.map((lap, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedLap(idx)}
                    className={`w-full text-left rounded-lg p-3 transition-colors ${
                      selectedLap === idx ? 'bg-forseti-bg-elevated' : 'hover:bg-forseti-bg-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-forseti-text-secondary mb-1">
                          Lap {lap.lapNumber || idx + 1}
                          {idx === fastestLapIndex && ' (Fastest)'}
                        </p>
                        <p className={`${selectedLap === idx ? 'font-bold' : ''} text-forseti-text-primary`}>
                          {lap.lapTimeFormatted || formatLapTime(lap.lapTime)}
                        </p>
                      </div>
                      {idx === fastestLapIndex && (
                        <div className="w-2 h-2 bg-forseti-lime rounded-full"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : activity.fastestLap ? (
              <div className="text-left rounded-lg p-3">
                <p className="text-xs text-forseti-text-secondary mb-1">Fastest Lap</p>
                <p className="font-bold text-forseti-text-primary">{activity.fastestLap}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Notes Section - Only show for activity owner */}
        {isActivityOwner && (
        <div className="border-t border-forseti-border pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-forseti-text-secondary" />
              <p className="text-xs text-forseti-text-secondary font-semibold">MY NOTES</p>
            </div>
            <button
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="p-1 text-forseti-text-secondary hover:text-forseti-lime transition-colors"
              title="Add note"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add Note Input */}
          {showNoteInput && (
            <NoteInput
              onSave={handleAddNote}
              onCancel={() => setShowNoteInput(false)}
            />
          )}

          {/* Notes List */}
          <div className="space-y-3">
            {notesLoading ? (
              <p className="text-xs text-forseti-text-secondary text-center py-2">Loading notes...</p>
            ) : notes.length === 0 ? (
              <p className="text-xs text-forseti-text-secondary text-center py-2">
                No notes yet. Click + to add one.
              </p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-forseti-bg-elevated rounded-lg p-3 space-y-2"
                >
                  {editingNoteId === note.id ? (
                    <EditNoteInput
                      initialContent={note.content}
                      onSave={(content) => handleUpdateNote(note.id, content)}
                      onCancel={cancelEditNote}
                    />
                  ) : (
                    <>
                      <p className="text-sm text-forseti-text-primary whitespace-pre-wrap break-words">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-forseti-text-secondary">
                          {new Date(note.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditNote(note)}
                            className="p-1 text-forseti-text-secondary hover:text-forseti-lime transition-colors"
                            title="Edit note"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 text-forseti-text-secondary hover:text-red-500 transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {/* Pro Driver Notes Section */}
        <div className="border-t border-forseti-border pt-6">
          <div className="mb-4">
            {/* Title Row */}
            <div className="flex items-center gap-2 mb-3">
              <StickyNote className="w-4 h-4 text-forseti-lime" />
              <p className="text-xs text-forseti-lime font-semibold">SUBSCRIBED DRIVER NOTES</p>
              <img
                src="/assets/level-badges/Platinum.png"
                alt="Platinum"
                className="w-4 h-4 object-contain"
                title="Premium Feature"
              />
            </div>

            {/* Driver Filter - Horizontal Layout */}
            {(() => {
              // Get unique drivers from notes
              const uniqueDrivers = Array.from(
                new Map(proDriverNotes.map(n => [n.user?.id, n.user])).values()
              ).filter(Boolean)

              if (uniqueDrivers.length > 0) {
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedProDriver('all')}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                        selectedProDriver === 'all'
                          ? 'bg-forseti-lime text-forseti-text-inverse'
                          : 'bg-forseti-bg-elevated text-forseti-text-primary hover:bg-forseti-bg-hover border border-forseti-border'
                      }`}
                    >
                      All ({proDriverNotes.length})
                    </button>
                    {uniqueDrivers.map((driver: any) => {
                      const driverNoteCount = proDriverNotes.filter(n => n.user?.id === driver.id).length
                      return (
                        <button
                          key={driver.id}
                          onClick={() => setSelectedProDriver(driver.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors ${
                            selectedProDriver === driver.id
                              ? 'bg-forseti-lime text-forseti-text-inverse'
                              : 'bg-forseti-bg-elevated text-forseti-text-primary hover:bg-forseti-bg-hover border border-forseti-border'
                          }`}
                        >
                          <div className="w-4 h-4 bg-forseti-bg-card rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                            {driver.avatar ? (
                              <img src={driver.avatar} alt={driver.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-2.5 h-2.5 text-forseti-text-secondary" />
                            )}
                          </div>
                          <span>{driver.name}</span>
                          <span className="opacity-70">({driverNoteCount})</span>
                        </button>
                      )
                    })}
                  </div>
                )
              }
              return null
            })()}
          </div>

          {proDriverNotes.length === 0 ? (
            <p className="text-xs text-forseti-text-secondary text-center py-3 bg-forseti-bg-elevated rounded-lg">
              No subscribed driver notes for this car/track combo.
            </p>
          ) : (
            <div className="space-y-3">
              {proDriverNotes
                .filter(note => selectedProDriver === 'all' || note.user?.id === selectedProDriver)
                .map((note) => (
                <div
                  key={note.id}
                  className="bg-gradient-to-r from-forseti-lime/5 to-green-400/5 border border-forseti-lime/20 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                      {note.user?.avatar ? (
                        <img src={note.user.avatar} alt={note.user.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3 h-3 text-forseti-text-secondary" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-forseti-lime">
                      {note.user?.name || 'Pro Driver'}
                    </span>
                  </div>
                  <p className="text-sm text-forseti-text-primary whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                  <p className="text-xs text-forseti-text-secondary">
                    {new Date(note.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-80 p-8">
        <div className="mb-8">
          <div className="flex flex-col gap-3 mb-6">
            {/* First row: Logo and main action buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-shrink-0 self-center">
                <img src="/Forseti-logo.png" alt="Forseti" className="h-6" />
                <h1 className="text-xl font-bold text-forseti-lime">Analyst</h1>
              </div>
              <div className="flex items-center gap-2 xl:gap-3 flex-wrap justify-end">
                {/* Coach Review Button */}
                <button
                  onClick={() => setShowCoachModal(true)}
                  className="px-3 xl:px-4 py-2 bg-forseti-lime text-forseti-text-inverse rounded-lg font-semibold hover:bg-forseti-lime-hover transition-colors whitespace-nowrap text-sm xl:text-base"
                >
                  Coach Review
                </button>
                {/* Full Screen Analysis Button */}
                <button
                  onClick={() => setIsFullScreen(true)}
                  className="px-3 xl:px-4 py-2 bg-forseti-bg-elevated border border-forseti-border text-forseti-text-primary rounded-lg font-semibold hover:bg-forseti-bg-hover transition-colors flex items-center gap-2 whitespace-nowrap text-sm xl:text-base"
                >
                  <Maximize2 className="w-4 h-4 flex-shrink-0" />
                  Full Screen Analysis
                </button>
                {/* Reference Lap Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowReferenceDropdown(!showReferenceDropdown)}
                  className="px-3 xl:px-4 py-2 bg-forseti-bg-card border border-forseti-border rounded-lg flex items-center gap-2 hover:bg-forseti-bg-hover transition-colors whitespace-nowrap text-sm xl:text-base"
                >
                  <span className="text-forseti-text-primary">
                    {selectedReferenceLap
                      ? `Ref: ${selectedReferenceLap.lapTimeFormatted}`
                      : 'Reference: None'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-forseti-text-secondary flex-shrink-0" />
                </button>
                {showReferenceDropdown && (
                  <div className="absolute left-0 mt-2 w-72 max-h-80 overflow-y-auto bg-forseti-bg-elevated border border-forseti-border rounded-lg shadow-lg z-20">
                    {/* None option */}
                    <button
                      onClick={() => {
                        setSelectedReferenceLap(null)
                        setShowReferenceDropdown(false)
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors border-b border-forseti-border ${
                        !selectedReferenceLap ? 'bg-forseti-bg-hover' : ''
                      }`}
                    >
                      <span className="text-sm text-forseti-text-primary font-medium">None</span>
                      <p className="text-xs text-forseti-text-secondary mt-1">No reference lap</p>
                    </button>

                    {/* Current Session Laps */}
                    {sessionLaps.length > 1 && (
                      <>
                        <div className="px-4 py-2 bg-forseti-bg-card border-b border-forseti-border">
                          <span className="text-xs text-forseti-text-secondary font-semibold">THIS SESSION</span>
                        </div>
                        {sessionLaps.map((lap, idx) => {
                          // Create a unique key for current session laps
                          const isCurrentLap = idx === selectedLap
                          const isSelected = selectedReferenceLap?.activityId === activityId && selectedReferenceLap?.lapNumber === lap.lapNumber
                          const isFastest = idx === fastestLapIndex

                          return (
                            <button
                              key={`current-${lap.lapNumber}`}
                              onClick={() => {
                                // Set reference lap with current activity ID
                                setSelectedReferenceLap({
                                  activityId: activityId,
                                  lapNumber: lap.lapNumber,
                                  lapTime: lap.lapTime,
                                  lapTimeFormatted: lap.lapTimeFormatted,
                                  telemetryPoints: lap.telemetryPoints,
                                  activityDate: activity?.date || new Date().toISOString()
                                })
                                setShowReferenceDropdown(false)
                              }}
                              disabled={isCurrentLap}
                              className={`w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors border-b border-forseti-border last:border-b-0 ${
                                isSelected ? 'bg-forseti-bg-hover' : ''
                              } ${isCurrentLap ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-forseti-text-primary">{lap.lapTimeFormatted || formatLapTime(lap.lapTime)}</p>
                                    {isFastest && (
                                      <span className="text-xs text-forseti-lime font-semibold">FASTEST</span>
                                    )}
                                    {isCurrentLap && (
                                      <span className="text-xs text-forseti-text-secondary font-semibold">(VIEWING)</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-forseti-text-secondary mt-1">
                                    Lap {lap.lapNumber}
                                  </p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </>
                    )}

                    {/* Reference laps from previous sessions - Always show this section */}
                    <div className="px-4 py-2 bg-forseti-bg-card border-t border-forseti-border">
                      <span className="text-xs text-forseti-text-secondary font-semibold">PREVIOUS SESSIONS (FASTEST FIRST)</span>
                    </div>
                    {referenceLaps.length > 0 ? (
                      <>
                        {referenceLaps.map((refLap, idx) => (
                          <button
                            key={`${refLap.activityId}-${refLap.lapNumber}`}
                            onClick={() => {
                              setSelectedReferenceLap(refLap)
                              setShowReferenceDropdown(false)
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors border-b border-forseti-border last:border-b-0 ${
                              selectedReferenceLap?.activityId === refLap.activityId && selectedReferenceLap?.lapNumber === refLap.lapNumber ? 'bg-forseti-bg-hover' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-forseti-text-primary">{refLap.lapTimeFormatted}</p>
                                  {idx === 0 && (
                                    <span className="text-xs text-forseti-lime font-semibold">PB</span>
                                  )}
                                </div>
                                <p className="text-xs text-forseti-text-secondary mt-1">
                                  {new Date(refLap.activityDate).toLocaleDateString()} • Lap {refLap.lapNumber}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-forseti-text-secondary">No previous sessions available</p>
                        <p className="text-xs text-forseti-text-secondary mt-2">This is your first session with this car/track</p>
                      </div>
                    )}

                    {/* Pro Driver Laps */}
                    {proDriverLaps.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-gradient-to-r from-forseti-lime/20 to-green-400/20 border-t border-forseti-border">
                          <span className="text-xs text-forseti-lime font-semibold">PRO DRIVERS</span>
                        </div>
                        {proDriverLaps.map((refLap, idx) => (
                          <button
                            key={`pro-${refLap.activityId}-${refLap.lapNumber}`}
                            onClick={() => {
                              setSelectedReferenceLap(refLap)
                              setShowReferenceDropdown(false)
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors border-b border-forseti-border last:border-b-0 ${
                              selectedReferenceLap?.activityId === refLap.activityId && selectedReferenceLap?.lapNumber === refLap.lapNumber ? 'bg-forseti-bg-hover' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {/* Driver avatar */}
                                <div className="w-6 h-6 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {refLap.driver?.avatar ? (
                                    <img src={refLap.driver.avatar} alt={refLap.driver.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-3 h-3 text-forseti-text-secondary" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-forseti-text-primary">{refLap.lapTimeFormatted}</p>
                                    <span className="text-xs text-forseti-lime font-semibold">PRO</span>
                                  </div>
                                  <p className="text-xs text-forseti-text-secondary mt-1">
                                    {refLap.driver?.name || 'Pro Driver'} • {new Date(refLap.activityDate).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* X-axis mode toggle */}
              <div className="flex items-center gap-1 xl:gap-2 px-2 xl:px-3 py-2 bg-forseti-bg-card border border-forseti-border rounded-lg whitespace-nowrap">
                <span className="text-xs xl:text-sm text-forseti-text-secondary">X-Axis:</span>
                <button
                  onClick={() => setXAxisMode('time')}
                  className={`px-2 xl:px-3 py-1 rounded text-xs xl:text-sm font-medium transition-colors ${
                    xAxisMode === 'time'
                      ? 'bg-forseti-lime text-forseti-bg-card'
                      : 'text-forseti-text-secondary hover:text-forseti-text-primary'
                  }`}
                >
                  Time
                </button>
                <button
                  onClick={() => setXAxisMode('distance')}
                  className={`px-2 xl:px-3 py-1 rounded text-xs xl:text-sm font-medium transition-colors ${
                    xAxisMode === 'distance'
                      ? 'bg-forseti-lime text-forseti-bg-card'
                      : 'text-forseti-text-secondary hover:text-forseti-text-primary'
                  }`}
                >
                  Distance
                </button>
              </div>
              </div>
            </div>
            {/* Second row: PRO Drivers, Apex AI, Channel filter */}
            <div className="flex items-center justify-end gap-2 xl:gap-3">
              {/* PRO Driver Activities Button */}
              <button
                onClick={() => setShowProDriverActivitySelector(true)}
                className="px-3 xl:px-4 py-2 bg-gradient-to-r from-forseti-lime/20 to-green-400/20 border border-forseti-lime/50 text-forseti-lime rounded-lg font-semibold hover:from-forseti-lime/30 hover:to-green-400/30 transition-colors flex items-center gap-2 whitespace-nowrap text-sm xl:text-base"
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                PRO Drivers
              </button>
              {/* Apex AI Insights toggle */}
              <div className="flex items-center gap-1 xl:gap-2 px-2 xl:px-3 py-2 bg-forseti-bg-card border border-forseti-border rounded-lg whitespace-nowrap">
                <button
                  onClick={() => setShowImprovementHighlights(!showImprovementHighlights)}
                  disabled={!selectedReferenceLap}
                  className={`px-2 xl:px-3 py-1 rounded text-xs xl:text-sm font-medium transition-colors whitespace-nowrap ${
                    showImprovementHighlights
                      ? 'bg-forseti-lime text-forseti-bg-card'
                      : 'text-forseti-text-secondary hover:text-forseti-text-primary'
                  } ${!selectedReferenceLap ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={!selectedReferenceLap ? 'Select a reference lap first' : ''}
                >
                  Apex AI Insights {showImprovementHighlights ? 'ON' : 'OFF'}
                </button>
                {showImprovementHighlights && (
                  <span className={`text-xs font-semibold ${improvementAreas.length > 0 ? 'text-forseti-lime' : 'text-forseti-text-secondary'}`}>
                    {improvementAreas.length} {improvementAreas.length === 1 ? 'tip' : 'tips'}
                  </span>
                )}
              </div>

              {/* Channel filter dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowChannelDropdown(!showChannelDropdown)}
                  className="px-3 xl:px-4 py-2 bg-forseti-bg-card border border-forseti-border rounded-lg flex items-center gap-2 hover:bg-forseti-bg-hover transition-colors whitespace-nowrap text-sm xl:text-base"
                >
                  <span className="text-forseti-text-primary">
                    {channelFilter === 'all' ? 'All channels' :
                     channelFilter === 'delta' ? 'Delta Time' :
                     channelFilter === 'speed' ? 'Speed' :
                     channelFilter === 'steering' ? 'Steering Angle' :
                     'Throttle / Brake'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-forseti-text-secondary" />
                </button>
              {showChannelDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-forseti-bg-elevated border border-forseti-border rounded-lg shadow-lg overflow-hidden z-10">
                  <button
                    onClick={() => {
                      setChannelFilter('all')
                      setShowChannelDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors"
                  >
                    All channels
                  </button>
                  <button
                    onClick={() => {
                      setChannelFilter('delta')
                      setShowChannelDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors"
                  >
                    Delta Time
                  </button>
                  <button
                    onClick={() => {
                      setChannelFilter('speed')
                      setShowChannelDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors"
                  >
                    Speed
                  </button>
                  <button
                    onClick={() => {
                      setChannelFilter('steering')
                      setShowChannelDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors"
                  >
                    Steering Angle
                  </button>
                  <button
                    onClick={() => {
                      setChannelFilter('throttle')
                      setShowChannelDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-forseti-bg-hover transition-colors"
                  >
                    Throttle / Brake
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-6">
          {/* Delta Time Chart */}
          {(channelFilter === 'all' || channelFilter === 'delta') && (
          <div className="bg-forseti-bg-card rounded-lg p-6">
            <h3 className="text-xl font-bold text-forseti-text-primary mb-4">Delta Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime} syncId="telemetry">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                  label={{
                    value: xAxisMode === 'distance' ? 'Distance (m)' : 'Lap Time (s)',
                    position: 'insideBottom',
                    offset: -5
                  }}
                  stroke="#666"
                  tickFormatter={(value) => xAxisMode === 'distance' ? `${value.toFixed(0)}m` : `${value.toFixed(1)}s`}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  stroke="#666"
                  label={{ value: 'Delta (s)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <Tooltip content={<CustomTooltip chartType="delta" showSuggestion={false} />} />
                <Legend wrapperStyle={{ marginTop: '20px' }} />
                {/* Improvement area highlights - show all */}
                {showImprovementHighlights && improvementAreas.map((area, idx) => (
                  <ReferenceArea
                    key={`delta-improvement-${idx}`}
                    x1={area.startValue}
                    x2={area.endValue}
                    fill={area.type === 'braking' ? '#FF6B6B' : '#4ECDC4'}
                    fillOpacity={0.15}
                    strokeOpacity={0}
                  />
                ))}
                {/* Reference line at zero */}
                <Line
                  type="monotone"
                  dataKey={() => 0}
                  stroke="#444444"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Even"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="delta"
                  stroke="#B7FF00"
                  strokeWidth={3}
                  name="Your Delta"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-forseti-text-secondary mt-2">
              Positive = losing time to reference | Negative = gaining time on reference
              {showImprovementHighlights && improvementAreas.length > 0 && (
                <span className="ml-4">
                  <span className="inline-block w-3 h-3 bg-[#FF6B6B] opacity-30 mr-1"></span>
                  Earlier braking
                  <span className="inline-block w-3 h-3 bg-[#4ECDC4] opacity-30 ml-3 mr-1"></span>
                  Earlier acceleration
                </span>
              )}
            </p>
          </div>
          )}

          {/* Speed Chart */}
          {(channelFilter === 'all' || channelFilter === 'speed') && (
          <div className="bg-forseti-bg-card rounded-lg p-6">
            <h3 className="text-xl font-bold text-forseti-text-primary mb-4">Speed</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime} syncId="telemetry">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                  label={{
                    value: xAxisMode === 'distance' ? 'Distance (m)' : 'Lap Time (s)',
                    position: 'insideBottom',
                    offset: -5
                  }}
                  stroke="#666"
                  tickFormatter={(value) => xAxisMode === 'distance' ? `${value.toFixed(0)}m` : `${value.toFixed(1)}s`}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  stroke="#666"
                  label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip chartType="speed" showSuggestion={true} />} />
                <Legend wrapperStyle={{ marginTop: '20px' }} />
                {/* Improvement area highlights - show both braking and acceleration */}
                {showImprovementHighlights && improvementAreas.map((area, idx) => (
                  <ReferenceArea
                    key={`speed-improvement-${idx}`}
                    x1={area.startValue}
                    x2={area.endValue}
                    fill={area.type === 'braking' ? '#FF6B6B' : '#4ECDC4'}
                    fillOpacity={0.15}
                    strokeOpacity={0}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="referenceSpeed"
                  stroke="#999999"
                  strokeWidth={2}
                  name="Reference Lap"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="userSpeed"
                  stroke="#B7FF00"
                  strokeWidth={3}
                  name="Your Lap"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}

          {/* Throttle & Brake Chart (Stacked) */}
          {(channelFilter === 'all' || channelFilter === 'throttle') && (
          <div className="bg-forseti-bg-card rounded-lg p-6">
            <h3 className="text-xl font-bold text-forseti-text-primary mb-4">Throttle & Brake</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime} syncId="telemetry">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                  label={{
                    value: xAxisMode === 'distance' ? 'Distance (m)' : 'Lap Time (s)',
                    position: 'insideBottom',
                    offset: -5
                  }}
                  stroke="#666"
                  tickFormatter={(value) => xAxisMode === 'distance' ? `${value.toFixed(0)}m` : `${value.toFixed(1)}s`}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  stroke="#666"
                  label={{ value: 'Input (%)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip content={<CustomTooltip chartType="throttle-brake" showSuggestion={true} />} />
                <Legend wrapperStyle={{ marginTop: '20px' }} />
                {/* Improvement area highlights - show both types since chart has both throttle and brake */}
                {showImprovementHighlights && improvementAreas.map((area, idx) => (
                  <ReferenceArea
                    key={`throttle-improvement-${idx}`}
                    x1={area.startValue}
                    x2={area.endValue}
                    fill={area.type === 'braking' ? '#FF6B6B' : '#4ECDC4'}
                    fillOpacity={0.15}
                    strokeOpacity={0}
                  />
                ))}
                {/* User traces */}
                <Line
                  type="monotone"
                  dataKey="userThrottle"
                  stroke="#00FF00"
                  strokeWidth={2}
                  name="Your Throttle"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="userBrake"
                  stroke="#FF0000"
                  strokeWidth={2}
                  name="Your Brake"
                  dot={false}
                />
                {/* Reference traces (dimmer) */}
                <Line
                  type="monotone"
                  dataKey="referenceThrottle"
                  stroke="#33AA33"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="Ref Throttle"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="referenceBrake"
                  stroke="#AA3333"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="Ref Brake"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}

          {/* Steering Angle Chart */}
          {(channelFilter === 'all' || channelFilter === 'steering') && (
          <div className="bg-forseti-bg-card rounded-lg p-6">
            <h3 className="text-xl font-bold text-forseti-text-primary mb-4">Steering Angle</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime} syncId="telemetry">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                  label={{
                    value: xAxisMode === 'distance' ? 'Distance (m)' : 'Lap Time (s)',
                    position: 'insideBottom',
                    offset: -5
                  }}
                  stroke="#666"
                  tickFormatter={(value) => xAxisMode === 'distance' ? `${value.toFixed(0)}m` : `${value.toFixed(1)}s`}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  stroke="#666"
                  label={{ value: 'Steering Angle (°)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip chartType="steering" showSuggestion={false} />} />
                <Legend wrapperStyle={{ marginTop: '20px' }} />
                {/* Improvement area highlights - show all */}
                {showImprovementHighlights && improvementAreas.map((area, idx) => (
                  <ReferenceArea
                    key={`steering-improvement-${idx}`}
                    x1={area.startValue}
                    x2={area.endValue}
                    fill={area.type === 'braking' ? '#FF6B6B' : '#4ECDC4'}
                    fillOpacity={0.15}
                    strokeOpacity={0}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="referenceSteering"
                  stroke="#999999"
                  strokeWidth={2}
                  name="Reference Lap"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="userSteering"
                  stroke="#9B8B5F"
                  strokeWidth={3}
                  name="Your Lap"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}

        </div>
      </div>

      {/* Coach Review Modal */}
      {showCoachModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowCoachModal(false)}
        >
          <div
            className="bg-forseti-bg-card border border-forseti-border rounded-xl p-8 max-w-md w-full mx-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowCoachModal(false)}
              className="absolute top-4 right-4 text-forseti-text-secondary hover:text-forseti-text-primary transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="text-center">
              <h1 className="text-4xl font-bold text-forseti-lime mb-2">ThePaddock</h1>
              <p className="text-forseti-text-secondary mb-6">by Forseti</p>

              <p className="text-forseti-text-primary mb-6">
                Connect with expert racing coaches to analyze your telemetry and improve your performance.
              </p>

              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).electron?.openExternal) {
                    (window as any).electron.openExternal('https://thepaddock.io/')
                  } else {
                    // Fallback for non-Electron environments
                    window.open('https://thepaddock.io/', '_blank')
                  }
                  setShowCoachModal(false)
                }}
                className="w-full px-6 py-3 bg-forseti-lime text-forseti-text-inverse rounded-lg font-bold hover:bg-forseti-lime-hover transition-colors mb-4"
              >
                Visit ThePaddock
              </button>

              <p className="text-xs text-forseti-text-muted">Opens in your browser</p>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Analysis Mode */}
      {isFullScreen && (
        <div className="fixed inset-0 bg-forseti-bg-primary z-50 overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-forseti-bg-secondary border-b border-forseti-border p-2 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <img src="/Forseti-logo.png" alt="Forseti" className="h-6" />
                <h1 className="text-xl font-bold text-forseti-lime">Analyst</h1>
              </div>
              <div className="text-sm text-forseti-text-secondary">
                {activity?.track} • Lap {sessionLaps[selectedLap]?.lapNumber || selectedLap + 1}
              </div>
            </div>
            <button
              onClick={() => setIsFullScreen(false)}
              className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Sector Bar */}
          {trackSectorConfig && sectorTimes && (
            <SectorBar
              trackConfig={trackSectorConfig}
              currentPosition={currentPosition}
              xAxisMode={xAxisMode}
              sectorTimes={sectorTimes}
              showTimes={true}
            />
          )}

          {/* Stacked Charts */}
          <div className="p-1">
            {/* Speed */}
            <div className="bg-forseti-bg-card border border-forseti-border rounded-lg p-1.5 mb-0.5">
              <h3 className="text-xs font-bold mb-0">Speed (km/h)</h3>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart
                  data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime}
                  syncId="fullscreen"
                  onMouseMove={handleChartMouseMove}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                    stroke="#666"
                    tick={false}
                    axisLine={false}
                    height={0}
                  />
                  <YAxis stroke="#666" width={45} tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip chartType="speed" showSuggestion={true} />} />
                  {showImprovementHighlights && improvementAreas.map((area, idx) => (
                    <ReferenceArea key={`fs-speed-${idx}`} x1={area.startValue} x2={area.endValue} fill={area.type === 'braking' ? '#FF6B6B' : '#4ECDC4'} fillOpacity={0.15} strokeOpacity={0} />
                  ))}
                  <Line type="monotone" dataKey="referenceSpeed" stroke="#999999" strokeWidth={2} name="Reference" dot={false} />
                  <Line type="monotone" dataKey="userSpeed" stroke="#B7FF00" strokeWidth={2} name="Your Lap" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* RPM */}
            <div className="bg-forseti-bg-card border border-forseti-border rounded-lg p-1.5 mb-0.5">
              <h3 className="text-xs font-bold mb-0">RPM</h3>
              <ResponsiveContainer width="100%" height={125}>
                <LineChart data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime} syncId="fullscreen">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                    stroke="#666"
                    tick={false}
                    axisLine={false}
                    height={0}
                  />
                  <YAxis stroke="#666" width={45} domain={[0, 'auto']} tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    labelFormatter={(value) => xAxisMode === 'distance' ? `${Number(value).toFixed(2)}m` : `${Number(value).toFixed(2)}s`}
                    formatter={(value: any) => [`${value.toFixed(0)} rpm`, '']}
                  />
                  <Line type="monotone" dataKey="referenceRpm" stroke="#999999" strokeWidth={2} name="Reference" dot={false} />
                  <Line type="monotone" dataKey="userRpm" stroke="#B7FF00" strokeWidth={2} name="Your Lap" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Throttle */}
            <div className="bg-forseti-bg-card border border-forseti-border rounded-lg p-1.5 mb-0.5">
              <h3 className="text-xs font-bold mb-0">Throttle (%)</h3>
              <ResponsiveContainer width="100%" height={125}>
                <LineChart data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime} syncId="fullscreen">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                    stroke="#666"
                    tick={false}
                    axisLine={false}
                    height={0}
                  />
                  <YAxis stroke="#666" width={45} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip chartType="throttle" showSuggestion={true} />} />
                  {showImprovementHighlights && improvementAreas.filter(a => a.type === 'acceleration').map((area, idx) => (
                    <ReferenceArea key={`fs-throttle-${idx}`} x1={area.startValue} x2={area.endValue} fill='#4ECDC4' fillOpacity={0.15} strokeOpacity={0} />
                  ))}
                  <Line type="monotone" dataKey="referenceThrottle" stroke="#999999" strokeWidth={2} name="Reference" dot={false} />
                  <Line type="monotone" dataKey="userThrottle" stroke="#00FF00" strokeWidth={2} name="Your Lap" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Brake */}
            <div className="bg-forseti-bg-card border border-forseti-border rounded-lg p-1.5 mb-0.5">
              <h3 className="text-xs font-bold mb-0">Brake (%)</h3>
              <ResponsiveContainer width="100%" height={125}>
                <LineChart data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime} syncId="fullscreen">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                    stroke="#666"
                    tick={false}
                    axisLine={false}
                    height={0}
                  />
                  <YAxis stroke="#666" width={45} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip chartType="brake" showSuggestion={true} />} />
                  {showImprovementHighlights && improvementAreas.filter(a => a.type === 'braking').map((area, idx) => (
                    <ReferenceArea key={`fs-brake-${idx}`} x1={area.startValue} x2={area.endValue} fill='#FF6B6B' fillOpacity={0.15} strokeOpacity={0} />
                  ))}
                  <Line type="monotone" dataKey="referenceBrake" stroke="#999999" strokeWidth={2} name="Reference" dot={false} />
                  <Line type="monotone" dataKey="userBrake" stroke="#FF0000" strokeWidth={2} name="Your Lap" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Steering Angle */}
            <div className="bg-forseti-bg-card border border-forseti-border rounded-lg p-1.5 mb-0.5">
              <h3 className="text-xs font-bold mb-0">Steering Angle (°)</h3>
              <ResponsiveContainer width="100%" height={125}>
                <LineChart data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime} syncId="fullscreen">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                    stroke="#666"
                    tick={false}
                    axisLine={false}
                    height={0}
                  />
                  <YAxis stroke="#666" width={45} tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip chartType="steering" showSuggestion={false} />} />
                  {showImprovementHighlights && improvementAreas.map((area, idx) => (
                    <ReferenceArea key={`fs-steering-${idx}`} x1={area.startValue} x2={area.endValue} fill={area.type === 'braking' ? '#FF6B6B' : '#4ECDC4'} fillOpacity={0.15} strokeOpacity={0} />
                  ))}
                  <Line type="monotone" dataKey="referenceSteering" stroke="#999999" strokeWidth={2} name="Reference" dot={false} />
                  <Line type="monotone" dataKey="userSteering" stroke="#9B8B5F" strokeWidth={2} name="Your Lap" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Delta Time */}
            <div className="bg-forseti-bg-card border border-forseti-border rounded-lg p-1.5 mb-0.5">
              <h3 className="text-xs font-bold mb-0">Delta Time (s)</h3>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={xAxisMode === 'distance' ? telemetryDataByDistance : telemetryDataByTime} syncId="fullscreen">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey={xAxisMode === 'distance' ? 'distance' : 'time'}
                    label={{
                      value: xAxisMode === 'distance' ? 'Distance (m)' : 'Lap Time (s)',
                      position: 'insideBottom',
                      offset: -5,
                      style: { fill: '#666', fontSize: 11 }
                    }}
                    stroke="#666"
                    tick={{ fill: '#666', fontSize: 11 }}
                    tickFormatter={(value) => xAxisMode === 'distance' ? `${Math.round(value)}m` : `${value.toFixed(1)}s`}
                  />
                  <YAxis stroke="#666" width={45} tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip chartType="delta" showSuggestion={false} />} />
                  {showImprovementHighlights && improvementAreas.map((area, idx) => (
                    <ReferenceArea key={`fs-delta-${idx}`} x1={area.startValue} x2={area.endValue} fill={area.type === 'braking' ? '#FF6B6B' : '#4ECDC4'} fillOpacity={0.15} strokeOpacity={0} />
                  ))}
                  <Line type="monotone" dataKey={() => 0} stroke="#444444" strokeWidth={1} strokeDasharray="5 5" name="Even" dot={false} />
                  <Line type="monotone" dataKey="delta" stroke="#B7FF00" strokeWidth={2} name="Your Delta" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* PRO Driver Lap Selector Modal */}
      <ProDriverActivitySelector
        isOpen={showProDriverActivitySelector}
        onClose={() => setShowProDriverActivitySelector(false)}
        onSelectLap={(lap) => {
          setSelectedReferenceLap(lap)
        }}
        activityId={activityId}
        currentCar={activity?.car}
        currentTrack={activity?.track}
      />

      {/* Telemetry Error Modal */}
      {telemetryError && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-forseti-bg-card border border-forseti-border rounded-xl p-8 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-forseti-error/20 rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-forseti-error" />
              </div>
              <h2 className="text-xl font-bold text-forseti-text-primary">Telemetry Error</h2>
            </div>
            <p className="text-forseti-text-secondary mb-6 leading-relaxed">
              {telemetryError}
            </p>
            <button
              onClick={() => router.back()}
              className="w-full px-6 py-3 bg-forseti-lime text-forseti-text-inverse rounded-lg font-semibold hover:bg-forseti-lime-hover transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* Race Engineer AI Chatbot */}
      <RaceEngineerChat
        sessionContext={{
          track: activity?.track,
          car: activity?.car,
          fastestLap: activity?.fastestLap,
          selectedLap: selectedLap,
          referenceLap: selectedReferenceLap,
          isProDriverReference: proDriverLaps.length > 0 && selectedReferenceLap !== null,
          proDriverName: proDriverLaps.length > 0 ? 'Pro Driver' : undefined,
          lapCount: sessionLaps.length,
          improvementAreas: improvementAreas.length
        }}
        onSendMessage={handleRaceEngineerMessage}
      />
    </div>
  )
}

// Loading fallback for Suspense
function AnalystLoading() {
  return (
    <div className="min-h-screen bg-forseti-bg-main flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forseti-lime mx-auto mb-4"></div>
        <p className="text-forseti-text-secondary">Loading analyst view...</p>
      </div>
    </div>
  )
}

// Main export wrapped in Suspense for Next.js 15 compatibility
export default function AnalystPage() {
  return (
    <Suspense fallback={<AnalystLoading />}>
      <AnalystPageContent />
    </Suspense>
  )
}

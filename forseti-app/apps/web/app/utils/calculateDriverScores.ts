/**
 * Calculate gamified driver performance scores from activities
 * Enhanced with telemetry analysis for more accurate metrics
 */

// Base activity interface
interface Activity {
  id: string
  duration: number
  performance: string
  track?: string
  car?: string
  date: string
  trackCondition?: string
}

// Telemetry point structure
interface TelemetryPoint {
  speed: number
  throttle: number
  brake: number
  steering: number
  gear: number
  rpm: number
}

// Lap data with telemetry
interface LapData {
  lapNumber: number
  lapTime: number
  lapTimeFormatted?: string
  telemetryPoints?: TelemetryPoint[]
}

// Activity with optional telemetry data
export interface ActivityWithTelemetry extends Activity {
  telemetry?: {
    lapData?: LapData[]
    sessionData?: {
      trackName?: string
      carName?: string
      totalLaps?: number
      fastestLapTime?: number
    }
  }
}

// Basic driver scores
export interface DriverScores {
  consistency: number  // 0-100
  efficiency: number   // 0-100
  technique: number    // 0-100
}

// Detailed analysis for each metric
export interface ConsistencyAnalysis {
  performanceStdDev: number
  lapTimeStdDev: number | null
  lapTimeMean: number | null
  trackVariance: Map<string, number>
  conditionComparison: { dry: number; wet: number } | null
  hasTelemetryData: boolean
  activitiesCount: number
  factors: string[]
}

export interface EfficiencyAnalysis {
  weightedPerformance: number
  avgDuration: number
  totalDuration: number
  throttleSmoothness: number | null
  brakingConsistency: number | null
  steeringSmoothness: number | null
  sessionImprovement: boolean
  improvementRate: number | null
  factors: string[]
}

export interface TechniqueAnalysis {
  topPerformanceAvg: number
  uniqueTrackCount: number
  hasImprovementTrend: boolean
  recentAvg: number
  olderAvg: number
  brakingScore: number | null
  lineConsistency: number | null
  throttleControl: number | null
  gearOptimization: number | null
  factors: string[]
}

// Full scores with detailed analysis
export interface DriverScoresWithAnalysis {
  consistency: number
  efficiency: number
  technique: number
  analysis: {
    consistency: ConsistencyAnalysis
    efficiency: EfficiencyAnalysis
    technique: TechniqueAnalysis
  }
}

/**
 * Parse performance string (e.g., "85%") to number
 */
function parsePerformance(perf: string): number {
  return parseInt(perf.replace('%', '')) || 0
}

/**
 * Calculate standard deviation of an array of numbers
 */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length

  return Math.sqrt(avgSquaredDiff)
}

/**
 * Calculate mean of an array of numbers
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Analyze lap time consistency from telemetry data
 */
function analyzeLapTimeConsistency(activities: ActivityWithTelemetry[]): { stdDev: number | null; mean: number | null } {
  const allLapTimes: number[] = []

  for (const activity of activities) {
    if (activity.telemetry?.lapData) {
      for (const lap of activity.telemetry.lapData) {
        // Only include valid lap times (> 0 and reasonable, skip outlaps/inlaps)
        if (lap.lapTime > 0 && lap.lapNumber > 0) {
          allLapTimes.push(lap.lapTime)
        }
      }
    }
  }

  if (allLapTimes.length < 2) {
    return { stdDev: null, mean: null }
  }

  return {
    stdDev: standardDeviation(allLapTimes),
    mean: mean(allLapTimes)
  }
}

/**
 * Analyze throttle smoothness from telemetry points
 * Lower jitter = higher smoothness score
 */
function analyzeThrottleSmoothness(activities: ActivityWithTelemetry[]): number | null {
  const throttleChanges: number[] = []

  for (const activity of activities) {
    if (activity.telemetry?.lapData) {
      for (const lap of activity.telemetry.lapData) {
        if (lap.telemetryPoints && lap.telemetryPoints.length > 1) {
          for (let i = 1; i < lap.telemetryPoints.length; i++) {
            const delta = Math.abs(
              lap.telemetryPoints[i].throttle - lap.telemetryPoints[i - 1].throttle
            )
            throttleChanges.push(delta)
          }
        }
      }
    }
  }

  if (throttleChanges.length < 10) return null

  // Calculate average throttle change rate
  const avgChange = mean(throttleChanges)
  // Scale: 0 change = 100, 50+ avg change = 0
  const smoothness = Math.max(0, Math.min(100, 100 - (avgChange * 2)))

  return Math.round(smoothness)
}

/**
 * Analyze braking consistency - how consistent brake application is across laps
 */
function analyzeBrakingConsistency(activities: ActivityWithTelemetry[]): number | null {
  const brakingPatterns: number[][] = []

  for (const activity of activities) {
    if (activity.telemetry?.lapData) {
      for (const lap of activity.telemetry.lapData) {
        if (lap.telemetryPoints && lap.telemetryPoints.length > 0) {
          // Extract brake values for this lap
          const brakeValues = lap.telemetryPoints.map(p => p.brake)
          brakingPatterns.push(brakeValues)
        }
      }
    }
  }

  if (brakingPatterns.length < 2) return null

  // Compare brake application patterns between laps
  // Calculate variance in brake values at similar points
  const minLength = Math.min(...brakingPatterns.map(p => p.length))
  if (minLength < 10) return null

  let totalVariance = 0
  const samplePoints = Math.min(100, minLength)

  for (let i = 0; i < samplePoints; i++) {
    const pointIndex = Math.floor((i / samplePoints) * minLength)
    const valuesAtPoint = brakingPatterns.map(pattern => pattern[pointIndex] || 0)
    totalVariance += standardDeviation(valuesAtPoint)
  }

  const avgVariance = totalVariance / samplePoints
  // Scale: 0 variance = 100, 30+ variance = 0
  const consistency = Math.max(0, Math.min(100, 100 - (avgVariance * 3.33)))

  return Math.round(consistency)
}

/**
 * Analyze steering smoothness - how smooth steering inputs are
 */
function analyzeSteeringSmoothness(activities: ActivityWithTelemetry[]): number | null {
  const steeringChanges: number[] = []

  for (const activity of activities) {
    if (activity.telemetry?.lapData) {
      for (const lap of activity.telemetry.lapData) {
        if (lap.telemetryPoints && lap.telemetryPoints.length > 1) {
          for (let i = 1; i < lap.telemetryPoints.length; i++) {
            const delta = Math.abs(
              lap.telemetryPoints[i].steering - lap.telemetryPoints[i - 1].steering
            )
            steeringChanges.push(delta)
          }
        }
      }
    }
  }

  if (steeringChanges.length < 10) return null

  const avgChange = mean(steeringChanges)
  // Scale: 0 change = 100, higher values = lower score
  // Steering changes more than throttle, so use gentler scaling
  const smoothness = Math.max(0, Math.min(100, 100 - (avgChange * 1.5)))

  return Math.round(smoothness)
}

/**
 * Analyze racing line consistency from steering at apex points
 */
function analyzeLineConsistency(activities: ActivityWithTelemetry[]): number | null {
  const apexSteeringValues: number[] = []

  for (const activity of activities) {
    if (activity.telemetry?.lapData) {
      for (const lap of activity.telemetry.lapData) {
        if (lap.telemetryPoints && lap.telemetryPoints.length > 10) {
          // Find potential apex points (where steering angle is highest/lowest)
          const steeringValues = lap.telemetryPoints.map(p => Math.abs(p.steering))
          const maxSteering = Math.max(...steeringValues)

          // Sample steering at peak points
          for (let i = 1; i < lap.telemetryPoints.length - 1; i++) {
            const current = Math.abs(lap.telemetryPoints[i].steering)
            const prev = Math.abs(lap.telemetryPoints[i - 1].steering)
            const next = Math.abs(lap.telemetryPoints[i + 1].steering)

            // Is this a local maximum (apex)?
            if (current > prev && current > next && current > maxSteering * 0.7) {
              apexSteeringValues.push(current)
            }
          }
        }
      }
    }
  }

  if (apexSteeringValues.length < 3) return null

  const stdDev = standardDeviation(apexSteeringValues)
  const avgApex = mean(apexSteeringValues)

  // Calculate coefficient of variation
  const cv = avgApex > 0 ? (stdDev / avgApex) * 100 : 100

  // Lower CV = more consistent lines, score 0-100
  const consistency = Math.max(0, Math.min(100, 100 - (cv * 2)))

  return Math.round(consistency)
}

/**
 * Analyze throttle control on corner exit (progressive vs abrupt)
 */
function analyzeThrottleControl(activities: ActivityWithTelemetry[]): number | null {
  const throttleApplicationRates: number[] = []

  for (const activity of activities) {
    if (activity.telemetry?.lapData) {
      for (const lap of activity.telemetry.lapData) {
        if (lap.telemetryPoints && lap.telemetryPoints.length > 5) {
          // Find throttle application zones (where throttle goes from low to high)
          for (let i = 3; i < lap.telemetryPoints.length; i++) {
            const current = lap.telemetryPoints[i].throttle
            const prev3 = lap.telemetryPoints[i - 3].throttle

            // Detect corner exit (throttle increasing significantly)
            if (current > prev3 + 30 && prev3 < 30) {
              // Calculate how quickly throttle was applied
              const rate = (current - prev3) / 3
              throttleApplicationRates.push(rate)
            }
          }
        }
      }
    }
  }

  if (throttleApplicationRates.length < 3) return null

  const avgRate = mean(throttleApplicationRates)

  // Progressive application (rate ~20-30) is ideal
  // Too slow (<10) or too fast (>40) is less optimal
  const idealRate = 25
  const deviation = Math.abs(avgRate - idealRate)

  const control = Math.max(0, Math.min(100, 100 - (deviation * 2.5)))

  return Math.round(control)
}

/**
 * Analyze gear usage optimization
 */
function analyzeGearOptimization(activities: ActivityWithTelemetry[]): number | null {
  const gearRpmPairs: { gear: number; rpm: number }[] = []

  for (const activity of activities) {
    if (activity.telemetry?.lapData) {
      for (const lap of activity.telemetry.lapData) {
        if (lap.telemetryPoints) {
          for (const point of lap.telemetryPoints) {
            if (point.gear > 0) {
              gearRpmPairs.push({ gear: point.gear, rpm: point.rpm })
            }
          }
        }
      }
    }
  }

  if (gearRpmPairs.length < 100) return null

  // Calculate average RPM per gear
  const gearRpms: Map<number, number[]> = new Map()
  for (const { gear, rpm } of gearRpmPairs) {
    if (!gearRpms.has(gear)) gearRpms.set(gear, [])
    gearRpms.get(gear)!.push(rpm)
  }

  // Check if driver uses optimal RPM range in each gear
  let optimalCount = 0
  let totalPoints = 0

  for (const [, rpms] of gearRpms) {
    const avgRpm = mean(rpms)
    // Consider 6000-8500 RPM as optimal range (can vary by car)
    for (const rpm of rpms) {
      totalPoints++
      if (rpm >= 5000 && rpm <= 9000) optimalCount++
    }
  }

  if (totalPoints === 0) return null

  return Math.round((optimalCount / totalPoints) * 100)
}

/**
 * Check if session shows improvement in lap times
 */
function analyzeSessionImprovement(activities: ActivityWithTelemetry[]): { improved: boolean; rate: number | null } {
  for (const activity of activities) {
    if (activity.telemetry?.lapData && activity.telemetry.lapData.length >= 5) {
      const lapTimes = activity.telemetry.lapData
        .filter(l => l.lapTime > 0 && l.lapNumber > 0)
        .sort((a, b) => a.lapNumber - b.lapNumber)
        .map(l => l.lapTime)

      if (lapTimes.length >= 5) {
        const first3Avg = mean(lapTimes.slice(0, 3))
        const last3Avg = mean(lapTimes.slice(-3))

        if (last3Avg < first3Avg) {
          const improvementRate = ((first3Avg - last3Avg) / first3Avg) * 100
          return { improved: true, rate: improvementRate }
        }
      }
    }
  }

  return { improved: false, rate: null }
}

/**
 * Calculate track-specific performance variance
 */
function calculateTrackVariance(activities: Activity[]): Map<string, number> {
  const trackPerformances: Map<string, number[]> = new Map()

  for (const activity of activities) {
    if (activity.track) {
      if (!trackPerformances.has(activity.track)) {
        trackPerformances.set(activity.track, [])
      }
      trackPerformances.get(activity.track)!.push(parsePerformance(activity.performance))
    }
  }

  const trackVariance: Map<string, number> = new Map()
  for (const [track, performances] of trackPerformances) {
    if (performances.length >= 2) {
      trackVariance.set(track, standardDeviation(performances))
    }
  }

  return trackVariance
}

/**
 * Compare dry vs wet performance
 */
function analyzeConditionPerformance(activities: Activity[]): { dry: number; wet: number } | null {
  const dryPerformances: number[] = []
  const wetPerformances: number[] = []

  for (const activity of activities) {
    const perf = parsePerformance(activity.performance)
    if (activity.trackCondition === 'wet') {
      wetPerformances.push(perf)
    } else if (activity.trackCondition === 'dry' || !activity.trackCondition) {
      dryPerformances.push(perf)
    }
  }

  if (dryPerformances.length >= 2 && wetPerformances.length >= 2) {
    return {
      dry: mean(dryPerformances),
      wet: mean(wetPerformances)
    }
  }

  return null
}

/**
 * Calculate Enhanced Consistency Score (0-100)
 */
function calculateConsistencyWithAnalysis(activities: ActivityWithTelemetry[]): { score: number; analysis: ConsistencyAnalysis } {
  const analysis: ConsistencyAnalysis = {
    performanceStdDev: 0,
    lapTimeStdDev: null,
    lapTimeMean: null,
    trackVariance: new Map(),
    conditionComparison: null,
    hasTelemetryData: false,
    activitiesCount: activities.length,
    factors: []
  }

  if (activities.length < 2) {
    analysis.factors.push('Not enough activities for consistency calculation')
    return { score: activities.length === 1 ? 50 : 0, analysis }
  }

  // Base calculation: performance std dev
  const performances = activities.map(a => parsePerformance(a.performance))
  const perfStdDev = standardDeviation(performances)
  analysis.performanceStdDev = perfStdDev

  const maxStdDev = 30
  let baseScore = Math.max(0, 100 - (perfStdDev / maxStdDev * 100))
  analysis.factors.push(`Base performance variance: ${perfStdDev.toFixed(1)}%`)

  // Telemetry bonus: lap time consistency
  const lapTimeAnalysis = analyzeLapTimeConsistency(activities)
  if (lapTimeAnalysis.stdDev !== null && lapTimeAnalysis.mean !== null) {
    analysis.hasTelemetryData = true
    analysis.lapTimeStdDev = lapTimeAnalysis.stdDev
    analysis.lapTimeMean = lapTimeAnalysis.mean

    // If lap time stdDev < 2% of mean, add bonus
    const lapTimeCV = (lapTimeAnalysis.stdDev / lapTimeAnalysis.mean) * 100
    if (lapTimeCV < 2) {
      baseScore += 10
      analysis.factors.push(`Excellent lap time consistency (+10): ${lapTimeCV.toFixed(2)}% variation`)
    } else if (lapTimeCV < 5) {
      baseScore += 5
      analysis.factors.push(`Good lap time consistency (+5): ${lapTimeCV.toFixed(2)}% variation`)
    } else {
      analysis.factors.push(`Lap time variation: ${lapTimeCV.toFixed(2)}%`)
    }
  }

  // Track-specific variance
  analysis.trackVariance = calculateTrackVariance(activities)
  const trackVariances = Array.from(analysis.trackVariance.values())
  if (trackVariances.length >= 2) {
    const avgTrackVariance = mean(trackVariances)
    if (avgTrackVariance < 10) {
      baseScore += 5
      analysis.factors.push(`Multi-track stability (+5): avg ${avgTrackVariance.toFixed(1)}% variance`)
    }
  }

  // Condition adaptability
  analysis.conditionComparison = analyzeConditionPerformance(activities)
  if (analysis.conditionComparison) {
    const gap = Math.abs(analysis.conditionComparison.dry - analysis.conditionComparison.wet)
    if (gap < 15) {
      baseScore += 5
      analysis.factors.push(`Condition adaptability (+5): ${gap.toFixed(1)}% dry/wet gap`)
    } else {
      analysis.factors.push(`Dry/wet performance gap: ${gap.toFixed(1)}%`)
    }
  }

  return { score: Math.round(Math.min(100, baseScore)), analysis }
}

/**
 * Calculate Enhanced Efficiency Score (0-100)
 */
function calculateEfficiencyWithAnalysis(activities: ActivityWithTelemetry[]): { score: number; analysis: EfficiencyAnalysis } {
  const analysis: EfficiencyAnalysis = {
    weightedPerformance: 0,
    avgDuration: 0,
    totalDuration: 0,
    throttleSmoothness: null,
    brakingConsistency: null,
    steeringSmoothness: null,
    sessionImprovement: false,
    improvementRate: null,
    factors: []
  }

  if (activities.length === 0) {
    analysis.factors.push('No activities recorded')
    return { score: 0, analysis }
  }

  // Base calculation: weighted performance by duration
  let totalWeightedPerformance = 0
  let totalDuration = 0

  for (const activity of activities) {
    const perf = parsePerformance(activity.performance)
    const duration = activity.duration || 1
    totalWeightedPerformance += perf * duration
    totalDuration += duration
  }

  if (totalDuration === 0) {
    analysis.factors.push('No session duration recorded')
    return { score: 0, analysis }
  }

  analysis.weightedPerformance = totalWeightedPerformance / totalDuration
  analysis.avgDuration = totalDuration / activities.length
  analysis.totalDuration = totalDuration

  let baseScore = Math.min(100, analysis.weightedPerformance)
  analysis.factors.push(`Weighted performance: ${analysis.weightedPerformance.toFixed(1)}%`)

  // Telemetry analysis bonuses
  const throttleSmoothness = analyzeThrottleSmoothness(activities)
  if (throttleSmoothness !== null) {
    analysis.throttleSmoothness = throttleSmoothness
    if (throttleSmoothness >= 70) {
      baseScore += 5
      analysis.factors.push(`Smooth throttle application (+5): ${throttleSmoothness}%`)
    } else {
      analysis.factors.push(`Throttle smoothness: ${throttleSmoothness}%`)
    }
  }

  const brakingConsistency = analyzeBrakingConsistency(activities)
  if (brakingConsistency !== null) {
    analysis.brakingConsistency = brakingConsistency
    if (brakingConsistency >= 70) {
      baseScore += 5
      analysis.factors.push(`Consistent braking (+5): ${brakingConsistency}%`)
    } else {
      analysis.factors.push(`Braking consistency: ${brakingConsistency}%`)
    }
  }

  const steeringSmoothness = analyzeSteeringSmoothness(activities)
  if (steeringSmoothness !== null) {
    analysis.steeringSmoothness = steeringSmoothness
    if (steeringSmoothness >= 70) {
      baseScore += 5
      analysis.factors.push(`Smooth steering inputs (+5): ${steeringSmoothness}%`)
    } else {
      analysis.factors.push(`Steering smoothness: ${steeringSmoothness}%`)
    }
  }

  // Session improvement analysis
  const improvementAnalysis = analyzeSessionImprovement(activities)
  analysis.sessionImprovement = improvementAnalysis.improved
  analysis.improvementRate = improvementAnalysis.rate

  if (improvementAnalysis.improved && improvementAnalysis.rate !== null) {
    baseScore += 5
    analysis.factors.push(`Session improvement (+5): ${improvementAnalysis.rate.toFixed(1)}% faster by end`)
  }

  return { score: Math.round(Math.min(100, baseScore)), analysis }
}

/**
 * Calculate Enhanced Technique Score (0-100)
 */
function calculateTechniqueWithAnalysis(activities: ActivityWithTelemetry[]): { score: number; analysis: TechniqueAnalysis } {
  const analysis: TechniqueAnalysis = {
    topPerformanceAvg: 0,
    uniqueTrackCount: 0,
    hasImprovementTrend: false,
    recentAvg: 0,
    olderAvg: 0,
    brakingScore: null,
    lineConsistency: null,
    throttleControl: null,
    gearOptimization: null,
    factors: []
  }

  if (activities.length === 0) {
    analysis.factors.push('No activities recorded')
    return { score: 0, analysis }
  }

  const performances = activities.map(a => parsePerformance(a.performance))

  // Base score: average of top 25% performances
  const sortedPerfs = [...performances].sort((a, b) => b - a)
  const topCount = Math.max(1, Math.ceil(sortedPerfs.length * 0.25))
  const topPerformances = sortedPerfs.slice(0, topCount)
  let baseScore = topPerformances.reduce((sum, val) => sum + val, 0) / topPerformances.length

  analysis.topPerformanceAvg = baseScore
  analysis.factors.push(`Top 25% performance: ${baseScore.toFixed(1)}%`)

  // Track diversity bonus
  const uniqueTracks = new Set(activities.filter(a => a.track).map(a => a.track))
  analysis.uniqueTrackCount = uniqueTracks.size

  if (uniqueTracks.size >= 5) {
    baseScore += 5
    analysis.factors.push(`Track diversity (+5): ${uniqueTracks.size} tracks`)
  } else if (uniqueTracks.size >= 3) {
    baseScore += 2
    analysis.factors.push(`Track diversity (+2): ${uniqueTracks.size} tracks`)
  } else {
    analysis.factors.push(`Tracks driven: ${uniqueTracks.size}`)
  }

  // Improvement trend bonus
  if (activities.length >= 4) {
    const sortedByDate = [...activities].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    const halfPoint = Math.floor(sortedByDate.length / 2)
    const recentActivities = sortedByDate.slice(0, halfPoint)
    const olderActivities = sortedByDate.slice(halfPoint)

    analysis.recentAvg = recentActivities.reduce((sum, a) => sum + parsePerformance(a.performance), 0) / recentActivities.length
    analysis.olderAvg = olderActivities.reduce((sum, a) => sum + parsePerformance(a.performance), 0) / olderActivities.length

    if (analysis.recentAvg > analysis.olderAvg) {
      analysis.hasImprovementTrend = true
      baseScore += 5
      const improvement = analysis.recentAvg - analysis.olderAvg
      analysis.factors.push(`Improvement trend (+5): +${improvement.toFixed(1)}% recent vs older`)
    } else {
      analysis.factors.push(`Performance trend: ${(analysis.recentAvg - analysis.olderAvg).toFixed(1)}%`)
    }
  }

  // Telemetry-based technique analysis
  const lineConsistency = analyzeLineConsistency(activities)
  if (lineConsistency !== null) {
    analysis.lineConsistency = lineConsistency
    if (lineConsistency >= 70) {
      baseScore += 5
      analysis.factors.push(`Consistent racing lines (+5): ${lineConsistency}%`)
    } else {
      analysis.factors.push(`Racing line consistency: ${lineConsistency}%`)
    }
  }

  const throttleControl = analyzeThrottleControl(activities)
  if (throttleControl !== null) {
    analysis.throttleControl = throttleControl
    if (throttleControl >= 70) {
      baseScore += 5
      analysis.factors.push(`Progressive throttle control (+5): ${throttleControl}%`)
    } else {
      analysis.factors.push(`Throttle control: ${throttleControl}%`)
    }
  }

  const gearOptimization = analyzeGearOptimization(activities)
  if (gearOptimization !== null) {
    analysis.gearOptimization = gearOptimization
    if (gearOptimization >= 80) {
      baseScore += 3
      analysis.factors.push(`Optimal gear usage (+3): ${gearOptimization}%`)
    } else {
      analysis.factors.push(`Gear optimization: ${gearOptimization}%`)
    }
  }

  // Calculate braking score from braking consistency if available
  const brakingConsistency = analyzeBrakingConsistency(activities)
  if (brakingConsistency !== null) {
    analysis.brakingScore = brakingConsistency
  }

  return { score: Math.round(Math.min(100, baseScore)), analysis }
}

/**
 * Calculate all three driver performance scores (basic version)
 * Maintained for backwards compatibility
 */
export function calculateDriverScores(activities: Activity[]): DriverScores {
  // Convert to ActivityWithTelemetry (without telemetry data)
  const activitiesWithTelemetry = activities as ActivityWithTelemetry[]

  return {
    consistency: calculateConsistencyWithAnalysis(activitiesWithTelemetry).score,
    efficiency: calculateEfficiencyWithAnalysis(activitiesWithTelemetry).score,
    technique: calculateTechniqueWithAnalysis(activitiesWithTelemetry).score
  }
}

/**
 * Calculate all three driver performance scores with detailed analysis
 * Use this version when you need insight into why scores are what they are
 */
export function calculateDriverScoresWithAnalysis(activities: ActivityWithTelemetry[]): DriverScoresWithAnalysis {
  const consistencyResult = calculateConsistencyWithAnalysis(activities)
  const efficiencyResult = calculateEfficiencyWithAnalysis(activities)
  const techniqueResult = calculateTechniqueWithAnalysis(activities)

  return {
    consistency: consistencyResult.score,
    efficiency: efficiencyResult.score,
    technique: techniqueResult.score,
    analysis: {
      consistency: consistencyResult.analysis,
      efficiency: efficiencyResult.analysis,
      technique: techniqueResult.analysis
    }
  }
}

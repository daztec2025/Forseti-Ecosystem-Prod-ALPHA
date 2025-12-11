/**
 * Generate personalized performance recommendations based on driver analysis
 * Uses metric scores and detailed analysis to provide actionable coaching insights
 */

import {
  DriverScoresWithAnalysis,
  ConsistencyAnalysis,
  EfficiencyAnalysis,
  TechniqueAnalysis,
  ActivityWithTelemetry
} from './calculateDriverScores'

export interface PerformanceInsight {
  id: string
  category: 'consistency' | 'efficiency' | 'technique'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  recommendation: string
  dataPoints?: {
    currentValue: number
    targetValue?: number
    metric?: string
    unit?: string
  }
  telemetryBased: boolean
}

interface RecommendationContext {
  activities: ActivityWithTelemetry[]
  scores: DriverScoresWithAnalysis
}

/**
 * Get priority based on score
 */
function getPriorityFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score < 40) return 'high'
  if (score < 70) return 'medium'
  return 'low'
}

/**
 * Format seconds to lap time string
 */
function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3)
  return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : `${secs}s`
}

/**
 * Generate consistency-related recommendations
 */
function generateConsistencyRecommendations(
  score: number,
  analysis: ConsistencyAnalysis,
  activities: ActivityWithTelemetry[]
): PerformanceInsight[] {
  const insights: PerformanceInsight[] = []
  const priority = getPriorityFromScore(score)

  // Edge case: Not enough activities
  if (analysis.activitiesCount < 2) {
    insights.push({
      id: 'consistency-build-baseline',
      category: 'consistency',
      priority: 'medium',
      title: 'Build Your Baseline',
      description: 'You need at least 2-3 sessions to establish a consistency baseline.',
      recommendation: 'Log more driving sessions to start tracking your consistency patterns. Focus on completing full sessions without distractions.',
      telemetryBased: false
    })
    return insights
  }

  // High performance variance
  if (analysis.performanceStdDev > 15 && priority === 'high') {
    insights.push({
      id: 'consistency-high-variance',
      category: 'consistency',
      priority: 'high',
      title: 'High Performance Variance',
      description: `Your performance varies by ${analysis.performanceStdDev.toFixed(1)}% between sessions. This makes lap times unpredictable.`,
      recommendation: 'Focus on repeatable corner entry speeds and consistent braking points. Start with one track and master it before moving to others.',
      dataPoints: {
        currentValue: analysis.performanceStdDev,
        targetValue: 10,
        metric: 'Performance variance',
        unit: '%'
      },
      telemetryBased: false
    })
  }

  // Lap time consistency (telemetry-based)
  if (analysis.hasTelemetryData && analysis.lapTimeStdDev !== null && analysis.lapTimeMean !== null) {
    const lapTimeCV = (analysis.lapTimeStdDev / analysis.lapTimeMean) * 100

    if (lapTimeCV > 5) {
      insights.push({
        id: 'consistency-lap-time-variance',
        category: 'consistency',
        priority: lapTimeCV > 10 ? 'high' : 'medium',
        title: 'Lap Time Fluctuation',
        description: `Your lap times vary by ${lapTimeCV.toFixed(1)}% on average (${formatLapTime(analysis.lapTimeStdDev)} standard deviation).`,
        recommendation: 'Target lap time variation under 2%. Use reference points for braking and turn-in to hit consistent marks every lap.',
        dataPoints: {
          currentValue: lapTimeCV,
          targetValue: 2,
          metric: 'Lap time variation',
          unit: '%'
        },
        telemetryBased: true
      })
    } else if (lapTimeCV <= 2) {
      insights.push({
        id: 'consistency-excellent-lap-times',
        category: 'consistency',
        priority: 'low',
        title: 'Excellent Lap Consistency',
        description: `Your lap time variation of ${lapTimeCV.toFixed(2)}% is professional-level consistency.`,
        recommendation: 'Maintain this consistency while gradually pushing for faster times. Your repeatable technique is a strong foundation.',
        dataPoints: {
          currentValue: lapTimeCV,
          metric: 'Lap time variation',
          unit: '%'
        },
        telemetryBased: true
      })
    }
  } else if (!analysis.hasTelemetryData && activities.length >= 3) {
    // No telemetry suggestion
    insights.push({
      id: 'consistency-enable-telemetry',
      category: 'consistency',
      priority: 'medium',
      title: 'Enable Telemetry Tracking',
      description: 'Telemetry data provides deeper insight into your lap-by-lap consistency.',
      recommendation: 'Use the Forseti overlay during your sessions to capture detailed telemetry. This unlocks precise lap time analysis and driving input tracking.',
      telemetryBased: false
    })
  }

  // Track-specific inconsistency
  const trackVarianceEntries = Array.from(analysis.trackVariance.entries())
  const inconsistentTracks = trackVarianceEntries.filter(([, variance]) => variance > 15)

  if (inconsistentTracks.length > 0) {
    const worstTrack = inconsistentTracks.sort((a, b) => b[1] - a[1])[0]
    insights.push({
      id: 'consistency-track-specific',
      category: 'consistency',
      priority: 'medium',
      title: 'Track-Specific Inconsistency',
      description: `Your performance on ${worstTrack[0]} varies by ${worstTrack[1].toFixed(1)}%, more than other tracks.`,
      recommendation: `Spend focused practice time on ${worstTrack[0]}. Learn the racing line for each corner and establish consistent reference points.`,
      dataPoints: {
        currentValue: worstTrack[1],
        targetValue: 10,
        metric: `${worstTrack[0]} variance`,
        unit: '%'
      },
      telemetryBased: false
    })
  }

  // Condition adaptability
  if (analysis.conditionComparison) {
    const gap = Math.abs(analysis.conditionComparison.dry - analysis.conditionComparison.wet)
    if (gap > 20) {
      insights.push({
        id: 'consistency-wet-conditions',
        category: 'consistency',
        priority: 'medium',
        title: 'Wet Weather Adaptation',
        description: `Your performance drops ${gap.toFixed(1)}% in wet conditions compared to dry.`,
        recommendation: 'Practice in wet conditions more frequently. Focus on smoother inputs and earlier braking. The racing line changes in the wet - avoid painted surfaces and kerbs.',
        dataPoints: {
          currentValue: analysis.conditionComparison.wet,
          targetValue: analysis.conditionComparison.dry - 10,
          metric: 'Wet performance',
          unit: '%'
        },
        telemetryBased: false
      })
    }
  }

  // Excellent consistency
  if (score >= 85 && insights.length === 0) {
    insights.push({
      id: 'consistency-excellent',
      category: 'consistency',
      priority: 'low',
      title: 'Outstanding Consistency',
      description: 'Your consistency score of ' + score + ' indicates highly repeatable performance.',
      recommendation: 'Your consistency is a major strength. Consider challenging yourself with new tracks or cars while maintaining this discipline.',
      telemetryBased: false
    })
  }

  return insights
}

/**
 * Generate efficiency-related recommendations
 */
function generateEfficiencyRecommendations(
  score: number,
  analysis: EfficiencyAnalysis,
  activities: ActivityWithTelemetry[]
): PerformanceInsight[] {
  const insights: PerformanceInsight[] = []
  const priority = getPriorityFromScore(score)

  // Short session duration
  if (analysis.avgDuration < 20) {
    insights.push({
      id: 'efficiency-session-duration',
      category: 'efficiency',
      priority: priority === 'high' ? 'high' : 'medium',
      title: 'Extend Session Duration',
      description: `Your sessions average ${analysis.avgDuration.toFixed(0)} minutes. Longer sessions build race-length stamina.`,
      recommendation: 'Aim for 30-45 minute sessions to develop endurance and mental focus. This simulates race conditions better than short stints.',
      dataPoints: {
        currentValue: analysis.avgDuration,
        targetValue: 30,
        metric: 'Average session',
        unit: 'min'
      },
      telemetryBased: false
    })
  }

  // Throttle smoothness (telemetry-based)
  if (analysis.throttleSmoothness !== null && analysis.throttleSmoothness < 70) {
    insights.push({
      id: 'efficiency-throttle-smoothness',
      category: 'efficiency',
      priority: analysis.throttleSmoothness < 50 ? 'high' : 'medium',
      title: 'Throttle Application',
      description: `Your throttle inputs show ${100 - analysis.throttleSmoothness}% jitter. Smooth throttle prevents wheelspin and improves traction.`,
      recommendation: 'Practice progressive throttle application on corner exit. Squeeze the throttle gradually rather than stabbing it. This is especially important in high-power cars.',
      dataPoints: {
        currentValue: analysis.throttleSmoothness,
        targetValue: 80,
        metric: 'Throttle smoothness',
        unit: '%'
      },
      telemetryBased: true
    })
  }

  // Braking consistency (telemetry-based)
  if (analysis.brakingConsistency !== null && analysis.brakingConsistency < 70) {
    insights.push({
      id: 'efficiency-braking-consistency',
      category: 'efficiency',
      priority: analysis.brakingConsistency < 50 ? 'high' : 'medium',
      title: 'Braking Points',
      description: `Your braking zones vary ${100 - analysis.brakingConsistency}% across laps. Consistent braking improves lap time predictability.`,
      recommendation: 'Use visual reference points for braking (distance markers, kerbs, shadows). Brake at the same point every lap until it becomes automatic.',
      dataPoints: {
        currentValue: analysis.brakingConsistency,
        targetValue: 80,
        metric: 'Braking consistency',
        unit: '%'
      },
      telemetryBased: true
    })
  }

  // Steering smoothness (telemetry-based)
  if (analysis.steeringSmoothness !== null && analysis.steeringSmoothness < 60) {
    insights.push({
      id: 'efficiency-steering-smoothness',
      category: 'efficiency',
      priority: 'medium',
      title: 'Steering Inputs',
      description: `Your steering shows oscillation patterns that may be scrubbing speed through corners.`,
      recommendation: 'Focus on smooth, single steering inputs. Avoid sawing at the wheel. Look further ahead - this naturally smooths your inputs.',
      dataPoints: {
        currentValue: analysis.steeringSmoothness,
        targetValue: 75,
        metric: 'Steering smoothness',
        unit: '%'
      },
      telemetryBased: true
    })
  }

  // Session improvement
  if (analysis.sessionImprovement && analysis.improvementRate !== null) {
    insights.push({
      id: 'efficiency-session-improvement',
      category: 'efficiency',
      priority: 'low',
      title: 'Strong Session Progression',
      description: `You improved ${analysis.improvementRate.toFixed(1)}% within your sessions, showing good adaptation.`,
      recommendation: 'Your ability to improve during sessions is excellent. Continue this approach and track which changes lead to the biggest gains.',
      dataPoints: {
        currentValue: analysis.improvementRate,
        metric: 'Session improvement',
        unit: '%'
      },
      telemetryBased: true
    })
  } else if (!analysis.sessionImprovement && analysis.totalDuration > 60) {
    insights.push({
      id: 'efficiency-no-improvement',
      category: 'efficiency',
      priority: 'medium',
      title: 'Session Fatigue Pattern',
      description: 'Your lap times tend to plateau or increase during longer sessions.',
      recommendation: 'Consider scheduled breaks every 20-30 minutes to maintain focus. Review your fastest laps at the end of sessions to understand what changed.',
      telemetryBased: true
    })
  }

  // Excellent efficiency
  if (score >= 85 && insights.length === 0) {
    insights.push({
      id: 'efficiency-excellent',
      category: 'efficiency',
      priority: 'low',
      title: 'Excellent Efficiency',
      description: `Your efficiency score of ${score} shows optimal use of practice time.`,
      recommendation: 'Your driving efficiency is excellent. Focus on maintaining this while pushing for faster absolute pace.',
      telemetryBased: false
    })
  }

  return insights
}

/**
 * Generate technique-related recommendations
 */
function generateTechniqueRecommendations(
  score: number,
  analysis: TechniqueAnalysis,
  activities: ActivityWithTelemetry[]
): PerformanceInsight[] {
  const insights: PerformanceInsight[] = []
  const priority = getPriorityFromScore(score)

  // Track diversity
  if (analysis.uniqueTrackCount < 3) {
    insights.push({
      id: 'technique-track-variety',
      category: 'technique',
      priority: 'medium',
      title: 'Track Variety',
      description: `You've driven ${analysis.uniqueTrackCount} track${analysis.uniqueTrackCount === 1 ? '' : 's'}. Expanding to 5+ tracks develops adaptable fundamentals.`,
      recommendation: 'Each new track teaches different corner types and requires adapting your technique. Try circuits with varied layouts - some with fast sweepers, others with tight hairpins.',
      dataPoints: {
        currentValue: analysis.uniqueTrackCount,
        targetValue: 5,
        metric: 'Tracks driven',
        unit: ''
      },
      telemetryBased: false
    })
  }

  // Improvement trend
  if (!analysis.hasImprovementTrend && activities.length >= 4) {
    const trendDelta = analysis.recentAvg - analysis.olderAvg
    insights.push({
      id: 'technique-plateau',
      category: 'technique',
      priority: 'medium',
      title: 'Plateau Detected',
      description: `Recent sessions (${analysis.recentAvg.toFixed(1)}%) match your older performance (${analysis.olderAvg.toFixed(1)}%).`,
      recommendation: 'Try new practice approaches: focus on specific corners, study faster drivers, or use reference laps. Sometimes a break helps you return with fresh perspective.',
      dataPoints: {
        currentValue: trendDelta,
        metric: 'Recent vs older',
        unit: '%'
      },
      telemetryBased: false
    })
  } else if (analysis.hasImprovementTrend) {
    insights.push({
      id: 'technique-improving',
      category: 'technique',
      priority: 'low',
      title: 'Positive Trajectory',
      description: `Your recent sessions are ${(analysis.recentAvg - analysis.olderAvg).toFixed(1)}% better than earlier ones.`,
      recommendation: 'Keep refining your approach. Document what changes led to improvements so you can replicate them.',
      dataPoints: {
        currentValue: analysis.recentAvg - analysis.olderAvg,
        metric: 'Improvement',
        unit: '%'
      },
      telemetryBased: false
    })
  }

  // Racing line consistency (telemetry-based)
  if (analysis.lineConsistency !== null && analysis.lineConsistency < 70) {
    insights.push({
      id: 'technique-racing-line',
      category: 'technique',
      priority: analysis.lineConsistency < 50 ? 'high' : 'medium',
      title: 'Racing Line Consistency',
      description: `Your apex steering varies by ${(100 - analysis.lineConsistency)}%. Consistent lines are faster and more predictable.`,
      recommendation: 'Focus on hitting the same apex point every lap. Use visual references like kerbs or track markings. Look through the corner to where you want to go.',
      dataPoints: {
        currentValue: analysis.lineConsistency,
        targetValue: 80,
        metric: 'Line consistency',
        unit: '%'
      },
      telemetryBased: true
    })
  }

  // Throttle control on exit (telemetry-based)
  if (analysis.throttleControl !== null && analysis.throttleControl < 70) {
    const isAbrupt = analysis.throttleControl < 50
    insights.push({
      id: 'technique-corner-exit',
      category: 'technique',
      priority: isAbrupt ? 'high' : 'medium',
      title: 'Corner Exit Technique',
      description: `Your throttle application is ${isAbrupt ? 'abrupt' : 'inconsistent'} on corner exit, which can cause wheelspin or understeer.`,
      recommendation: 'Practice progressive throttle application. Start with light throttle at apex and gradually increase to 100% as you unwind steering. The goal is to be at full throttle when the wheel is straight.',
      dataPoints: {
        currentValue: analysis.throttleControl,
        targetValue: 80,
        metric: 'Throttle control',
        unit: '%'
      },
      telemetryBased: true
    })
  }

  // Gear optimization (telemetry-based)
  if (analysis.gearOptimization !== null && analysis.gearOptimization < 70) {
    insights.push({
      id: 'technique-gear-usage',
      category: 'technique',
      priority: 'medium',
      title: 'Gear Selection',
      description: `Your gear usage is ${analysis.gearOptimization}% optimal. Incorrect gears cost time and affect car balance.`,
      recommendation: 'Ensure you\'re in the correct gear for each corner. Being in too high a gear bogs the engine; too low causes over-revving. Listen to the engine and watch the RPM.',
      dataPoints: {
        currentValue: analysis.gearOptimization,
        targetValue: 85,
        metric: 'Gear optimization',
        unit: '%'
      },
      telemetryBased: true
    })
  }

  // Braking technique (telemetry-based)
  if (analysis.brakingScore !== null && analysis.brakingScore < 60) {
    insights.push({
      id: 'technique-braking',
      category: 'technique',
      priority: 'high',
      title: 'Braking Technique',
      description: 'Your braking patterns show room for improvement in consistency and threshold braking.',
      recommendation: 'Practice threshold braking: maximum brake pressure initially, then gradually release as you approach the apex. This is called trail braking and helps rotate the car.',
      dataPoints: {
        currentValue: analysis.brakingScore,
        targetValue: 75,
        metric: 'Braking score',
        unit: '%'
      },
      telemetryBased: true
    })
  }

  // Top performance insight
  if (analysis.topPerformanceAvg < 60 && priority === 'high') {
    insights.push({
      id: 'technique-peak-performance',
      category: 'technique',
      priority: 'high',
      title: 'Peak Performance Gap',
      description: `Your best sessions average ${analysis.topPerformanceAvg.toFixed(1)}%. There's room to improve your ceiling.`,
      recommendation: 'Focus on one aspect at a time: braking points, corner entry speed, or throttle application. Master each before combining them.',
      dataPoints: {
        currentValue: analysis.topPerformanceAvg,
        targetValue: 75,
        metric: 'Top performance',
        unit: '%'
      },
      telemetryBased: false
    })
  }

  // Excellent technique
  if (score >= 85 && insights.length === 0) {
    insights.push({
      id: 'technique-excellent',
      category: 'technique',
      priority: 'low',
      title: 'Strong Fundamentals',
      description: `Your technique score of ${score} indicates well-developed driving skills.`,
      recommendation: 'Your fundamentals are solid. Focus on marginal gains and consider specialized coaching to find the final percentages.',
      telemetryBased: false
    })
  }

  return insights
}

/**
 * Generate edge case recommendations for new/limited users
 */
function generateEdgeCaseRecommendations(activities: ActivityWithTelemetry[]): PerformanceInsight[] {
  if (activities.length === 0) {
    return [{
      id: 'edge-no-activities',
      category: 'technique',
      priority: 'high',
      title: 'Get Started',
      description: 'No activities recorded yet.',
      recommendation: 'Log your first sim racing session to receive personalized coaching recommendations. Track your practice sessions to build your driver profile.',
      telemetryBased: false
    }]
  }

  if (activities.length === 1) {
    return [{
      id: 'edge-single-activity',
      category: 'consistency',
      priority: 'medium',
      title: 'Building Your Profile',
      description: 'One session recorded. More data unlocks better insights.',
      recommendation: 'Log 2-3 more sessions to generate meaningful recommendations. Try to drive the same track/car combination to establish a baseline.',
      telemetryBased: false
    }]
  }

  return []
}

/**
 * Sort insights by priority and category
 */
function sortInsights(insights: PerformanceInsight[]): PerformanceInsight[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const categoryOrder = { technique: 0, consistency: 1, efficiency: 2 }

  return insights.sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff

    // Then by category
    return categoryOrder[a.category] - categoryOrder[b.category]
  })
}

/**
 * Check if all scores are excellent
 */
function checkExcellentPerformance(scores: DriverScoresWithAnalysis): PerformanceInsight | null {
  if (scores.consistency >= 85 && scores.efficiency >= 85 && scores.technique >= 85) {
    return {
      id: 'all-excellent',
      category: 'technique',
      priority: 'low',
      title: 'Outstanding Performance',
      description: `All metrics are in the top tier (Consistency: ${scores.consistency}, Efficiency: ${scores.efficiency}, Technique: ${scores.technique}).`,
      recommendation: 'Consider competitive racing, time trials, or coaching others. You could also explore different cars or disciplines to expand your skills.',
      telemetryBased: false
    }
  }
  return null
}

/**
 * Main function to generate all recommendations
 */
export function generateRecommendations(context: RecommendationContext): PerformanceInsight[] {
  const { activities, scores } = context

  // Handle edge cases first
  const edgeCaseInsights = generateEdgeCaseRecommendations(activities)
  if (edgeCaseInsights.length > 0 && activities.length < 2) {
    return edgeCaseInsights
  }

  // Generate category-specific recommendations
  const consistencyInsights = generateConsistencyRecommendations(
    scores.consistency,
    scores.analysis.consistency,
    activities
  )

  const efficiencyInsights = generateEfficiencyRecommendations(
    scores.efficiency,
    scores.analysis.efficiency,
    activities
  )

  const techniqueInsights = generateTechniqueRecommendations(
    scores.technique,
    scores.analysis.technique,
    activities
  )

  // Combine all insights
  let allInsights = [
    ...consistencyInsights,
    ...efficiencyInsights,
    ...techniqueInsights
  ]

  // Check for excellent performance across all metrics
  const excellentInsight = checkExcellentPerformance(scores)
  if (excellentInsight && allInsights.filter(i => i.priority !== 'low').length === 0) {
    allInsights = [excellentInsight, ...allInsights]
  }

  // Sort and return
  return sortInsights(allInsights)
}

/**
 * Get the top N recommendations (most important ones)
 */
export function getTopRecommendations(
  context: RecommendationContext,
  count: number = 3
): PerformanceInsight[] {
  const allRecommendations = generateRecommendations(context)
  return allRecommendations.slice(0, count)
}

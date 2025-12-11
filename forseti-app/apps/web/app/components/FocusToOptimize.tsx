'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Target, TrendingUp, Gauge, Zap, AlertCircle, CheckCircle } from 'lucide-react'
import { PerformanceInsight } from '../utils/generateRecommendations'

interface FocusToOptimizeProps {
  insights: PerformanceInsight[]
  isLoading?: boolean
}

export default function FocusToOptimize({ insights, isLoading = false }: FocusToOptimizeProps) {
  const [expanded, setExpanded] = useState(false)

  // Category icons mapping
  const categoryIcons = {
    consistency: TrendingUp,
    efficiency: Gauge,
    technique: Target
  }

  // Priority styling
  const priorityStyles = {
    high: {
      border: 'border-red-500/30',
      bg: 'bg-red-500/5',
      badge: 'bg-red-500/20 text-red-400',
      icon: 'text-red-400'
    },
    medium: {
      border: 'border-yellow-500/30',
      bg: 'bg-yellow-500/5',
      badge: 'bg-yellow-500/20 text-yellow-400',
      icon: 'text-yellow-400'
    },
    low: {
      border: 'border-forseti-lime/30',
      bg: 'bg-forseti-lime/5',
      badge: 'bg-forseti-lime/20 text-forseti-lime',
      icon: 'text-forseti-lime'
    }
  }

  // Priority labels
  const priorityLabels = {
    high: 'Priority',
    medium: 'Recommended',
    low: 'Fine-tuning'
  }

  // Show top 3 insights in the concise view
  const topInsights = insights.slice(0, 3)

  if (isLoading) {
    return (
      <div className="bg-forseti-bg-card rounded-xl p-4 border border-forseti-lime/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-forseti-lime">Focus to Optimise</h3>
          <ChevronDown className="w-4 h-4 text-forseti-lime" />
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-forseti-bg-elevated rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="bg-forseti-bg-card rounded-xl p-4 border border-forseti-lime/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-forseti-lime">Focus to Optimise</h3>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-forseti-bg-elevated text-forseti-text-secondary">
          <CheckCircle className="w-5 h-5 text-forseti-lime flex-shrink-0" />
          <p className="text-xs">Log more activities to receive personalized recommendations.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-forseti-bg-card rounded-xl p-4 border border-forseti-lime/20">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-semibold text-forseti-lime">Focus to Optimise</h3>
        <div className="flex items-center gap-2">
          {insights.filter(i => i.priority === 'high').length > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="w-3 h-3" />
              {insights.filter(i => i.priority === 'high').length}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-forseti-lime" />
          ) : (
            <ChevronDown className="w-4 h-4 text-forseti-lime" />
          )}
        </div>
      </div>

      {/* Concise View (default) - just show top items as compact list */}
      {!expanded && (
        <div className="mt-3 space-y-1.5">
          {topInsights.map((insight) => {
            const Icon = categoryIcons[insight.category]
            const styles = priorityStyles[insight.priority]

            return (
              <div
                key={insight.id}
                className="flex items-center gap-2 py-1"
              >
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${styles.icon}`} />
                <span className="text-xs text-forseti-text-primary truncate flex-1">
                  {insight.title}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${styles.badge} flex-shrink-0`}>
                  {priorityLabels[insight.priority]}
                </span>
              </div>
            )
          })}
          {insights.length > 3 && (
            <p className="text-[10px] text-forseti-text-secondary pt-1">
              +{insights.length - 3} more
            </p>
          )}
        </div>
      )}

      {/* Expanded View - full details */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {insights.map((insight) => {
            const Icon = categoryIcons[insight.category]
            const styles = priorityStyles[insight.priority]

            return (
              <div
                key={insight.id}
                className={`p-3 rounded-lg border ${styles.border} ${styles.bg}`}
              >
                {/* Insight Header */}
                <div className="flex items-start gap-2 mb-2">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.icon}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-forseti-text-primary">
                        {insight.title}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${styles.badge}`}>
                        {priorityLabels[insight.priority]}
                      </span>
                      {insight.telemetryBased && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                          <Zap className="w-2.5 h-2.5 inline mr-0.5" />
                          Telemetry
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-forseti-text-secondary mb-2 ml-6">
                  {insight.description}
                </p>

                {/* Data Points */}
                {insight.dataPoints && (
                  <div className="flex items-center gap-3 mb-2 ml-6">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-forseti-text-secondary">Current:</span>
                      <span className={`font-medium ${styles.icon}`}>
                        {typeof insight.dataPoints.currentValue === 'number'
                          ? insight.dataPoints.currentValue.toFixed(1)
                          : insight.dataPoints.currentValue}
                        {insight.dataPoints.unit}
                      </span>
                    </div>
                    {insight.dataPoints.targetValue !== undefined && (
                      <>
                        <span className="text-forseti-text-secondary text-xs">→</span>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-forseti-text-secondary">Target:</span>
                          <span className="font-medium text-forseti-lime">
                            {insight.dataPoints.targetValue}
                            {insight.dataPoints.unit}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Recommendation */}
                <div className="ml-6 p-2 rounded bg-forseti-bg-elevated/50">
                  <p className="text-xs text-forseti-text-primary">
                    <span className="text-forseti-lime font-medium">Tip: </span>
                    {insight.recommendation}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

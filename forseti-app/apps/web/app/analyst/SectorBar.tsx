'use client'

import React from 'react'
import { TrackSectorConfig, SectorConfig } from './track-sectors'

interface SectorBarProps {
  trackConfig: TrackSectorConfig
  currentPosition: number // Current lapDistPct (0.0 to 1.0)
  xAxisMode: 'distance' | 'time'
  sectorTimes?: {
    user: { sector: string; time: number }[]
    reference?: { sector: string; time: number }[]
  }
  showTimes?: boolean // Whether to show sector times
}

export default function SectorBar({
  trackConfig,
  currentPosition,
  xAxisMode,
  sectorTimes,
  showTimes = true,
}: SectorBarProps) {
  return (
    <div className="w-full bg-forseti-bg-card border-b border-forseti-border">
      {/* Sector visualization bar */}
      <div className="relative h-6 flex">
        {trackConfig.sectors.map((sector, idx) => {
          const width = ((sector.end - sector.start) * 100).toFixed(2)
          const isActive = currentPosition >= sector.start && currentPosition < sector.end

          return (
            <div
              key={idx}
              className="relative flex flex-col items-center justify-center border-r border-forseti-bg-main transition-all"
              style={{
                width: `${width}%`,
                backgroundColor: sector.color,
              }}
            >
              {/* Sector label */}
              <span className="text-xs font-bold text-forseti-bg-main px-2 truncate">
                {sector.name}
              </span>
            </div>
          )
        })}

        {/* Current position indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all duration-100"
          style={{
            left: `${(currentPosition * 100).toFixed(2)}%`,
            zIndex: 10,
          }}
        >
          {/* Triangle marker at top */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white"></div>
          </div>
        </div>
      </div>

      {/* Sector times below the colored bar */}
      {showTimes && sectorTimes && (
        <div className="flex h-5 bg-forseti-bg-elevated">
          {trackConfig.sectors.map((sector, idx) => {
            const width = ((sector.end - sector.start) * 100).toFixed(2)
            const userTime = sectorTimes.user[idx]
            const refTime = sectorTimes?.reference?.[idx]
            const delta = refTime ? userTime.time - refTime.time : null

            return (
              <div
                key={idx}
                className="flex items-center justify-center border-r border-forseti-bg-main"
                style={{ width: `${width}%` }}
              >
                {userTime && (
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-forseti-text-primary font-mono">
                      {userTime.time.toFixed(3)}s
                    </span>
                    {delta !== null && (
                      <span
                        className={`font-mono ${
                          delta < 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {delta < 0 ? '' : '+'}
                        {delta.toFixed(3)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Track sector configurations
// Sectors are defined by lapDistPct (0.0 to 1.0) boundaries
// Based on lap time thirds for optimal sector balance

export interface SectorConfig {
  name: string
  start: number // lapDistPct
  end: number // lapDistPct
  color: string // Hex color for visualization
}

export interface TrackSectorConfig {
  trackName: string
  trackId: string
  sectors: SectorConfig[]
}

// Sector colors for visual distinction
const SECTOR_COLORS = {
  sector1: '#FF6B6B', // Red
  sector2: '#4ECDC4', // Teal
  sector3: '#FFD93D', // Yellow/Gold
}

export const TRACK_SECTORS: Record<string, TrackSectorConfig> = {
  'silverstone-national': {
    trackName: 'Silverstone National',
    trackId: 'silverstone-national',
    sectors: [
      {
        name: 'Sector 1',
        start: 0.0,
        end: 0.335, // Approximately 33.5% - covers Copse to Maggots
        color: SECTOR_COLORS.sector1,
      },
      {
        name: 'Sector 2',
        start: 0.335,
        end: 0.670, // Approximately 67.0% - covers Becketts complex through Brooklands
        color: SECTOR_COLORS.sector2,
      },
      {
        name: 'Sector 3',
        start: 0.670,
        end: 1.0, // Final 33% - covers Luffield to finish line
        color: SECTOR_COLORS.sector3,
      },
    ],
  },
}

/**
 * Get sector configuration for a specific track
 */
export function getSectorConfig(trackName: string): TrackSectorConfig | null {
  // Normalize track name (lowercase, remove spaces/dashes for matching)
  const normalizedInput = trackName.toLowerCase().replace(/[\s-]/g, '')

  // Try exact match first
  if (TRACK_SECTORS[trackName.toLowerCase()]) {
    return TRACK_SECTORS[trackName.toLowerCase()]
  }

  // Try normalized match
  for (const [key, config] of Object.entries(TRACK_SECTORS)) {
    const normalizedKey = key.toLowerCase().replace(/[\s-]/g, '')
    if (normalizedInput.includes(normalizedKey) || normalizedKey.includes(normalizedInput)) {
      return config
    }
  }

  return null
}

/**
 * Determine which sector a given lapDistPct falls into
 */
export function getSectorAtPosition(
  lapDistPct: number,
  trackConfig: TrackSectorConfig
): SectorConfig | null {
  return trackConfig.sectors.find(
    sector => lapDistPct >= sector.start && lapDistPct < sector.end
  ) || null
}

/**
 * Calculate sector times from telemetry data
 */
export function calculateSectorTimes(
  telemetryData: any[],
  trackConfig: TrackSectorConfig,
  distanceMode: 'distance' | 'time' = 'distance'
): { sector: string; time: number; color: string }[] {
  const sectorTimes: { sector: string; time: number; color: string }[] = []

  for (const sector of trackConfig.sectors) {
    // Find data points at sector boundaries
    const startPoint = telemetryData.find(d => {
      const value = distanceMode === 'distance' ? d.distance / d.totalDistance : d.time
      return value >= sector.start
    })

    const endPoint = telemetryData.find(d => {
      const value = distanceMode === 'distance' ? d.distance / d.totalDistance : d.time
      return value >= sector.end
    })

    if (startPoint && endPoint) {
      const sectorTime = endPoint.time - startPoint.time
      sectorTimes.push({
        sector: sector.name,
        time: sectorTime,
        color: sector.color,
      })
    }
  }

  return sectorTimes
}

/**
 * @fileoverview Rank Badge Component
 *
 * Displays a user's engagement rank with a visual progress indicator.
 * Used throughout the application to show user status and progression.
 *
 * @module components/RankBadge
 */

'use client'

/**
 * User engagement rank levels
 *
 * Ranks are earned through platform engagement:
 * - Bronze: 0-99 points
 * - Silver: 100-299 points
 * - Gold: 300-599 points
 * - Platinum: 600+ points
 *
 * @typedef {'bronze' | 'silver' | 'gold' | 'platinum'} RankLevel
 */
export type RankLevel = 'bronze' | 'silver' | 'gold' | 'platinum'

/**
 * Props for the RankBadge component
 *
 * @interface RankBadgeProps
 * @property {RankLevel} rank - Current rank level to display
 * @property {number} progress - Progress towards next rank (0-100)
 * @property {'small' | 'medium' | 'large'} [size='medium'] - Badge size variant
 * @property {boolean} [showProgress=true] - Whether to show progress ring
 * @property {React.ReactNode} [children] - Content to display inside badge (e.g., avatar)
 */
interface RankBadgeProps {
  rank: RankLevel
  progress: number // 0-100
  size?: 'small' | 'medium' | 'large'
  showProgress?: boolean
  children?: React.ReactNode
}

const rankConfig = {
  bronze: {
    color: '#3B82F6', // Blue
    badgeImage: '/assets/level-badges/Bronze.png',
    label: 'Bronze'
  },
  silver: {
    color: '#9CA3AF', // Gray
    badgeImage: '/assets/level-badges/Silver.png',
    label: 'Silver'
  },
  gold: {
    color: '#F59E0B', // Amber/Gold
    badgeImage: '/assets/level-badges/Gold.png',
    label: 'Gold'
  },
  platinum: {
    color: '#B7FF00', // Forseti Lime
    badgeImage: '/assets/level-badges/Platinum.png',
    label: 'Platinum'
  }
}

const sizeConfig = {
  small: {
    container: 'w-16 h-16',
    profile: 'w-14 h-14',
    badge: 'w-10 h-10',
    strokeWidth: 1.5,
    badgeOffset: 'left-1/2 -translate-x-1/2',
    badgeTop: 'calc(100% - 23px)',
    progressRadius: 30
  },
  medium: {
    container: 'w-24 h-24',
    profile: 'w-20 h-20',
    badge: 'w-10 h-10',
    strokeWidth: 2,
    badgeOffset: 'left-1/2 -translate-x-1/2',
    badgeTop: 'calc(100% - 23px)',
    progressRadius: 46
  },
  large: {
    container: 'w-32 h-32',
    profile: 'w-28 h-28',
    badge: 'w-10 h-10',
    strokeWidth: 2.5,
    badgeOffset: 'left-1/2 -translate-x-1/2',
    badgeTop: 'calc(100% - 23px)',
    progressRadius: 62
  }
}

/**
 * Rank Badge Component
 *
 * Displays a circular badge with rank-colored progress ring and badge icon.
 * Typically wraps a user's avatar to show their engagement level at a glance.
 *
 * @component
 * @example
 * // Basic usage with avatar
 * <RankBadge rank="gold" progress={75}>
 *   <img src="/avatar.jpg" className="rounded-full" />
 * </RankBadge>
 *
 * @example
 * // Small badge without progress ring
 * <RankBadge rank="platinum" progress={100} size="small" showProgress={false}>
 *   <UserAvatar user={user} />
 * </RankBadge>
 */
export default function RankBadge({
  rank,
  progress = 0,
  size = 'medium',
  showProgress = true,
  children
}: RankBadgeProps) {
  // Ensure valid rank and size with fallbacks to prevent undefined errors
  const validRank = rank && rankConfig[rank] ? rank : 'bronze'
  const validSize = size && sizeConfig[size] ? size : 'medium'

  const config = rankConfig[validRank]
  const sizing = sizeConfig[validSize]

  // Calculate circle properties
  const radius = sizing.progressRadius
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative inline-block">
      <div className={`relative ${sizing.container}`}>
        {/* Progress Circle */}
        {showProgress && (
          <svg
            className="absolute inset-0 -rotate-90"
            width="100%"
            height="100%"
          >
            {/* Background circle */}
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              fill="none"
              stroke="#1a1a1a"
              strokeWidth={sizing.strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              fill="none"
              stroke={config.color}
              strokeWidth={sizing.strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
        )}

        {/* Profile Picture Container */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={sizing.profile}>
            {children}
          </div>
        </div>

        {/* Rank Badge */}
        <div className={`absolute ${sizing.badgeOffset} ${sizing.badge} z-10`} style={{ top: sizing.badgeTop }}>
          <img
            src={config.badgeImage}
            alt={`${config.label} rank`}
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  )
}

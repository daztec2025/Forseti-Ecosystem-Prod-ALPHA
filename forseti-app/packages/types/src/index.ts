// User types
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

// Activity types
export interface Activity {
  id: string
  userId: string
  user: User
  game: string // e.g., "Mustang GT3", "League of Legends", etc.
  timestamp: Date
  location?: string // e.g., "Silverstone, United Kingdom"
  metrics: ActivityMetrics
  trackData?: TrackData
  visibility: 'public' | 'private'
  notes?: string
}

export interface ActivityMetrics {
  currentFastest?: string // e.g., "1:28:00"
  optimalLap?: string // e.g., "1:25:00"
  yourTime?: string // e.g., "1:35:00"
  // Additional game-specific metrics
  [key: string]: any
}

export interface TrackData {
  svg: string // Path to SVG or SVG data
  telemetry?: number[][] // Track overlay coordinates
  sectors?: SectorData[]
}

export interface SectorData {
  id: string
  name: string
  time: string
  optimal: string
}

// Performance metrics types
export interface PerformanceMetrics {
  userId: string
  consistency: number // 0-100
  efficiency: number // 0-100
  technique: number // 0-100
  updatedAt: Date
}

export interface PerformanceInsight {
  id: string
  category: 'consistency' | 'efficiency' | 'technique'
  title: string
  description: string
  recommendation: string
  priority: 'low' | 'medium' | 'high'
}

// Team types
export interface Team {
  id: string
  name: string
  avatar?: string
  members: TeamMember[]
  createdAt: Date
}

export interface TeamMember {
  id: string
  userId: string
  user: User
  teamId: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'inactive'
  joinedAt: Date
}

// Dashboard types
export interface DashboardData {
  user: User
  performanceMetrics: PerformanceMetrics
  recentActivities: Activity[]
  insights: PerformanceInsight[]
  teams: Team[]
}

// Coaching types
export interface CoachingSession {
  id: string
  userId: string
  coachId?: string
  activityId?: string
  notes: string
  focusAreas: string[]
  createdAt: Date
  updatedAt: Date
}

export interface CoachingDrill {
  id: string
  name: string
  description: string
  targetMetric: 'consistency' | 'efficiency' | 'technique'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  duration?: number // in minutes
}

// Challenge types
export interface Challenge {
  id: string
  title: string
  description: string
  game: string
  startDate: Date
  endDate: Date
  participants: User[]
  leaderboard: LeaderboardEntry[]
  rules: ChallengeRule[]
  prizes?: string[]
}

export interface ChallengeRule {
  id: string
  description: string
  metric: string
  target?: number
}

// Leaderboard types
export interface Leaderboard {
  id: string
  name: string
  game: string
  type: 'global' | 'regional' | 'team' | 'friends'
  period: 'daily' | 'weekly' | 'monthly' | 'all-time'
  entries: LeaderboardEntry[]
  updatedAt: Date
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  user: User
  score: number
  metric: string
  change?: number // Change in rank from previous period
}

// Auth types
export interface AuthResponse {
  user: User
  token: string
  expiresAt: Date
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupCredentials {
  email: string
  password: string
  name: string
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

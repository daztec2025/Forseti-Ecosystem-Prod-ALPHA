// API Types and Interfaces for Forseti

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  bio?: string;
  isPro: boolean;
  isFoundingDriver: boolean;
  membershipTier: 'member' | 'apex' | 'analyst';
  engagementLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
  engagementPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  userId: string;
  game: string;
  duration: number;
  performance: string;
  date: string;
  car?: string;
  fastestLap?: string;
  track?: string;
  description?: string;
  isPrivate?: boolean;
  trackTemperature?: number;
  trackCondition?: string;
  airTemperature?: number;
  setupFilename?: string;
  setupPath?: string;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatar' | 'isPro'>;
  comments: Comment[];
  likes: Like[];
  media?: ActivityMedia[];
  telemetry?: {
    id: string;
    createdAt: string;
  };
}

export interface Comment {
  id: string;
  activityId: string;
  userId: string;
  text: string;
  mentionedUsers?: string;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
  likes: Like[];
}

export interface Like {
  id: string;
  userId: string;
  activityId?: string;
  commentId?: string;
  createdAt: string;
}

export interface ActivityMedia {
  id: string;
  activityId: string;
  type: 'image' | 'video';
  filename: string;
  mimeType: string;
  size: number;
  duration?: number; // video duration in seconds
  order: number;
  createdAt: string;
  url?: string; // computed URL for frontend display
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  fromUserId?: string;
  fromUserName?: string;
  activityId?: string;
  read: boolean;
  createdAt: string;
}

export interface TelemetryData {
  id: string;
  activityId: string;
  sessionData: {
    trackName: string;
    carName: string;
    sessionType: string;
    totalLaps: number;
    fastestLapTime: number;
    sessionDuration: number;
  };
  lapData: Array<{
    lapNumber: number;
    lapTime: number;
    lapTimeFormatted: string;
    telemetryPoints: Array<{
      timestamp: number;
      sessionTime: number;
      speed: number;
      throttle: number;
      brake: number;
      steering: number;
      gear: number;
      rpm: number;
      lap: number;
      lapTime: number;
    }>;
  }>;
  referenceLap?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
  follower: Pick<User, 'id' | 'name' | 'avatar'>;
  following: Pick<User, 'id' | 'name' | 'avatar'>;
}

// API Request/Response Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  username: string;
}

export interface CreateActivityRequest {
  game: string;
  duration: number;
  performance: string;
  date: Date;
  car?: string;
  fastestLap?: string;
  track?: string;
  description?: string;
  isPrivate?: boolean;
  trackTemperature?: number;
  trackCondition?: string;
  airTemperature?: number;
  telemetryData?: {
    sessionData: any;
    lapData: any[];
    referenceLap?: any;
  };
}

export interface UpdateActivityRequest {
  game?: string;
  duration?: number;
  performance?: string;
  date?: Date;
  car?: string;
  fastestLap?: string;
  track?: string;
  description?: string;
  isPrivate?: boolean;
  trackTemperature?: number;
  trackCondition?: string;
  airTemperature?: number;
  telemetryData?: {
    sessionData: any;
    lapData: any[];
    referenceLap?: any;
  };
}

export interface UpdateProfileRequest {
  name?: string;
  avatar?: string;
  bio?: string;
}

export interface AddCommentRequest {
  text: string;
  mentionedUsers?: string[];
}

// API Response Types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
  details?: any;
}

// Subscription Types
export interface DriverSubscription {
  id: string;
  subscriberId: string;
  driverId: string;
  status: 'active' | 'cancelled' | 'expired';
  createdAt: string;
  updatedAt: string;
  driver: Pick<User, 'id' | 'name' | 'username' | 'avatar' | 'isPro'>;
}

export interface ProDriverReferenceLap {
  activityId: string;
  activityTitle?: string;
  activityDate: string;
  lapNumber: number;
  lapTime: number;
  lapTimeFormatted: string;
  telemetryDataId: string;
  trackName: string;
  carName: string;
  telemetryPoints: any[];
  driver: Pick<User, 'id' | 'name' | 'username' | 'avatar'>;
  isProDriverLap: true;
}

export interface ProDriverActivity {
  id: string;
  title: string;
  date: string;
  car: string;
  track: string;
  description?: string;
  user: Pick<User, 'id' | 'name' | 'username' | 'avatar' | 'isPro'>;
  hasTelemetry: boolean;
  bestLapTime: number | null;
  bestLapTimeFormatted: string | null;
}

export interface ReferenceLapsResponse {
  userLaps: Array<{
    activityId: string;
    activityDate: string;
    lapNumber: number;
    lapTime: number;
    lapTimeFormatted: string;
    telemetryDataId: string;
    trackName: string;
    carName: string;
    telemetryPoints: any[];
  }>;
  proDriverLaps: ProDriverReferenceLap[];
}

export interface ProDriverNote {
  id: string;
  activityId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: Pick<User, 'id' | 'name' | 'username' | 'avatar'>;
  activity: {
    id: string;
    date: string;
    track: string;
    car: string;
  };
}

// Leaderboard Types
export interface LeaderboardEntry {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  isPro: boolean;
  engagementLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
  stats: {
    activities: number;
    hours: number;
    avgPerformance: number;
    combinedScore: number;
  };
}

// Drill Types
export type DrillType = 'consistency_run' | 'pb_quali' | 'target_lap';
export type DrillStatus = 'pending' | 'active' | 'completed' | 'abandoned';

export interface Drill {
  id: string;
  userId: string;
  type: DrillType;
  trackId?: string;    // Optional for pending drills
  carId?: string;      // Optional for pending drills
  targetTime?: number; // Optional - calculated when activated
  targetLaps: number;
  xpReward: number;
  status: DrillStatus;
  createdAt: string;
  completedAt?: string;
  actualTime?: number;
  delta?: number;
  lapsCompleted: number;
  xpEarned?: number;
}

export interface DrillTargetTimeResponse {
  targetTime: number;
  laps: number;
  lapTimes: number[];
  hasHistory: boolean;
}

export interface DrillCompleteResponse {
  drill: Drill;
  xpEarned: number;
  newPoints: number;
  newLevel: string;
  beatTarget: boolean;
}

export interface StartDrillRequest {
  type: DrillType;
  trackId: string;
  carId: string;
}

/**
 * @fileoverview Telemetry Data Type Definitions
 *
 * This module defines all TypeScript interfaces and types used throughout
 * the telemetry recording and analysis system. These types ensure type safety
 * when capturing, storing, and analyzing racing telemetry data.
 *
 * @module telemetry-recorder/types
 */

/**
 * Single telemetry data point captured from the racing simulation
 *
 * Contains all relevant car state information at a specific moment in time,
 * including position, orientation, velocities, and driver inputs.
 *
 * @interface TelemetryPoint
 *
 * @property {number} timestamp - Unix timestamp in milliseconds when data was captured
 * @property {number} sessionTime - In-game session time in seconds
 *
 * @property {number} lat - Latitude position on track
 * @property {number} lon - Longitude position on track
 * @property {number} alt - Altitude/elevation in meters
 * @property {number} yaw - Rotation around vertical axis (radians)
 * @property {number} pitch - Rotation around lateral axis (radians)
 * @property {number} roll - Rotation around longitudinal axis (radians)
 *
 * @property {number} speed - Current speed in m/s
 * @property {number} velocityX - Lateral velocity component
 * @property {number} velocityY - Vertical velocity component
 * @property {number} velocityZ - Longitudinal velocity component
 *
 * @property {number} throttle - Throttle position (0-1)
 * @property {number} brake - Brake pressure (0-1)
 * @property {number} clutch - Clutch position (0-1)
 * @property {number} steering - Steering wheel angle in radians
 * @property {number} gear - Current gear (-1=reverse, 0=neutral, 1-7=forward)
 * @property {number} rpm - Engine revolutions per minute
 *
 * @property {number} lapDistPct - Progress through current lap (0-1)
 * @property {number} lap - Current lap number
 * @property {number} lapTime - Current lap elapsed time in seconds
 */
export interface TelemetryPoint {
  timestamp: number;
  sessionTime: number;

  // Position and orientation
  lat: number;
  lon: number;
  alt: number;
  yaw: number;
  pitch: number;
  roll: number;

  // Velocities
  speed: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;

  // Car control
  throttle: number;
  brake: number;
  clutch: number;
  steering: number;
  gear: number;
  rpm: number;

  // Track position
  lapDistPct: number;
  lap: number;
  lapTime: number;

  // Additional data (optional)
  [key: string]: any;
}

/**
 * Complete lap data including timing and telemetry points
 *
 * @interface LapData
 *
 * @property {number} lapNumber - Sequential lap number in the session
 * @property {number} lapTime - Total lap time in seconds
 * @property {string} lapTimeFormatted - Lap time formatted as MM:SS.mmm
 * @property {number} [sector1Time] - First sector time in seconds
 * @property {number} [sector2Time] - Second sector time in seconds
 * @property {number} [sector3Time] - Third sector time in seconds
 * @property {TelemetryPoint[]} telemetryPoints - Array of telemetry data points for this lap
 * @property {boolean} isValid - Whether the lap counts (no cutting, etc.)
 * @property {boolean} isPersonalBest - Whether this is the fastest lap in the session
 */
export interface LapData {
  lapNumber: number;
  lapTime: number;
  lapTimeFormatted: string;
  sector1Time?: number;
  sector2Time?: number;
  sector3Time?: number;
  telemetryPoints: TelemetryPoint[];
  isValid: boolean;
  isPersonalBest: boolean;
}

/**
 * Complete session data including all laps and metadata
 *
 * @interface SessionData
 *
 * @property {string} sessionId - Unique identifier for this recording session
 * @property {string} sessionType - Type of session (Practice, Qualify, Race)
 * @property {string} trackName - Display name of the track
 * @property {number} trackId - Internal track identifier from the sim
 * @property {string} carName - Display name of the car
 * @property {number} carId - Internal car identifier from the sim
 * @property {string} driverName - Name of the driver
 * @property {number} startTime - Unix timestamp when session started
 * @property {number} [endTime] - Unix timestamp when session ended
 * @property {LapData[]} laps - Array of all recorded laps
 * @property {any} sessionInfo - Raw session info from the sim
 * @property {LapData} [fastestLap] - Reference to the fastest lap in session
 * @property {number} [averageLapTime] - Average lap time across valid laps
 * @property {number} totalLaps - Total number of completed laps
 */
export interface SessionData {
  sessionId: string;
  sessionType: string;
  trackName: string;
  trackId: number;
  carName: string;
  carId: number;
  driverName: string;
  startTime: number;
  endTime?: number;

  laps: LapData[];

  // Session info
  sessionInfo: any;

  // Statistics
  fastestLap?: LapData;
  averageLapTime?: number;
  totalLaps: number;
}

/**
 * Configuration options for the telemetry recorder
 *
 * @interface RecordingOptions
 *
 * @property {number} [telemetryUpdateInterval=100] - Milliseconds between telemetry samples (default: 100ms = 10Hz)
 * @property {number} [sessionInfoUpdateInterval=2000] - Milliseconds between session info updates
 * @property {boolean} [recordTelemetry=true] - Whether to record telemetry data points
 * @property {string[]} [telemetryFields] - Specific telemetry fields to record (default: all common fields)
 * @property {string} [outputDirectory='./recordings'] - Directory to save session recordings
 */
export interface RecordingOptions {
  telemetryUpdateInterval?: number;
  sessionInfoUpdateInterval?: number;
  recordTelemetry?: boolean;
  telemetryFields?: string[];
  outputDirectory?: string;
}

/**
 * Current status of the telemetry recorder
 *
 * @interface RecorderStatus
 *
 * @property {boolean} isConnected - Whether connected to the racing simulation
 * @property {boolean} isRecording - Whether actively recording telemetry
 * @property {SessionData} [currentSession] - Current session data if active
 * @property {number} [currentLap] - Current lap number
 * @property {number} recordedLaps - Total laps recorded in current session
 * @property {number} dataPoints - Total telemetry points recorded
 */
export interface RecorderStatus {
  isConnected: boolean;
  isRecording: boolean;
  currentSession?: SessionData;
  currentLap?: number;
  recordedLaps: number;
  dataPoints: number;
}

/**
 * Events emitted by the telemetry recorder
 *
 * @enum {string} RecordingEvent
 *
 * @property {string} CONNECTED - Emitted when connected to the simulation
 * @property {string} DISCONNECTED - Emitted when disconnected from the simulation
 * @property {string} SESSION_START - Emitted when a new session begins
 * @property {string} SESSION_END - Emitted when a session ends
 * @property {string} LAP_COMPLETE - Emitted when a lap is completed
 * @property {string} TELEMETRY - Emitted on each telemetry update
 * @property {string} ERROR - Emitted when an error occurs
 */
export enum RecordingEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  SESSION_START = 'sessionStart',
  SESSION_END = 'sessionEnd',
  LAP_COMPLETE = 'lapComplete',
  TELEMETRY = 'telemetry',
  ERROR = 'error'
}

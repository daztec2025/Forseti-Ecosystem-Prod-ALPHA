import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import {
  TelemetryPoint,
  LapData,
  SessionData,
  RecordingOptions,
  RecorderStatus,
  RecordingEvent
} from './types';

/**
 * iRacing Telemetry Recorder
 *
 * Records telemetry data from iRacing sessions including:
 * - Live telemetry data (position, speed, inputs, etc.)
 * - Lap times and sector splits
 * - Session information
 * - Track and car details
 */
export class IRacingRecorder extends EventEmitter {
  private irsdk: any;
  private iracing: any;
  private options: Required<RecordingOptions>;
  private currentSession: SessionData | null = null;
  private currentLap: LapData | null = null;
  private isRecording = false;
  private lastLapNum = 0;
  private dataPointsCount = 0;

  constructor(options: RecordingOptions = {}) {
    super();

    this.options = {
      telemetryUpdateInterval: options.telemetryUpdateInterval || 100, // 10 Hz
      sessionInfoUpdateInterval: options.sessionInfoUpdateInterval || 2000,
      recordTelemetry: options.recordTelemetry !== false,
      telemetryFields: options.telemetryFields || this.getDefaultTelemetryFields(),
      outputDirectory: options.outputDirectory || './recordings'
    };

    // Ensure output directory exists
    if (!fs.existsSync(this.options.outputDirectory)) {
      fs.mkdirSync(this.options.outputDirectory, { recursive: true });
    }
  }

  /**
   * Initialize connection to iRacing
   */
  async init(): Promise<void> {
    try {
      // Dynamically import irsdk
      this.irsdk = require('node-irsdk');

      this.irsdk.init({
        telemetryUpdateInterval: this.options.telemetryUpdateInterval,
        sessionInfoUpdateInterval: this.options.sessionInfoUpdateInterval
      });

      this.iracing = this.irsdk.getInstance();

      this.setupEventHandlers();

      this.emit(RecordingEvent.CONNECTED);
    } catch (error) {
      this.emit(RecordingEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Setup event handlers for iRacing SDK
   */
  private setupEventHandlers(): void {
    this.iracing.on('Connected', () => {
      console.log('Connected to iRacing');
      this.emit(RecordingEvent.CONNECTED);
    });

    this.iracing.on('Disconnected', () => {
      console.log('Disconnected from iRacing');
      this.stopRecording();
      this.emit(RecordingEvent.DISCONNECTED);
    });

    this.iracing.on('SessionInfo', (data: any) => {
      this.handleSessionInfo(data);
    });

    this.iracing.on('Telemetry', (data: any) => {
      if (this.isRecording) {
        this.handleTelemetry(data);
      }
    });
  }

  /**
   * Handle session info updates
   */
  private handleSessionInfo(data: any): void {
    if (!this.currentSession && data.data && data.data.WeekendInfo) {
      // New session started
      this.startSession(data);
    }

    // Update session info
    if (this.currentSession) {
      this.currentSession.sessionInfo = data;
    }
  }

  /**
   * Start a new recording session
   */
  private startSession(sessionInfo: any): void {
    const weekendInfo = sessionInfo.data.WeekendInfo;
    const driverInfo = sessionInfo.data.DriverInfo;
    const drivers = driverInfo.Drivers || [];
    const playerDriver = drivers.find((d: any) => d.CarIdx === driverInfo.DriverCarIdx);

    this.currentSession = {
      sessionId: `iracing-${Date.now()}`,
      sessionType: weekendInfo.SessionType || 'Unknown',
      trackName: weekendInfo.TrackDisplayName || weekendInfo.TrackName || 'Unknown',
      trackId: weekendInfo.TrackID || 0,
      carName: playerDriver?.CarScreenName || 'Unknown',
      carId: playerDriver?.CarID || 0,
      driverName: driverInfo.Drivers[driverInfo.DriverCarIdx]?.UserName || 'Unknown',
      startTime: Date.now(),
      laps: [],
      sessionInfo: sessionInfo,
      totalLaps: 0
    };

    console.log(`Session started: ${this.currentSession.trackName} - ${this.currentSession.carName}`);
    this.emit(RecordingEvent.SESSION_START, this.currentSession);
  }

  /**
   * Handle incoming telemetry data
   */
  private handleTelemetry(data: any): void {
    if (!this.currentSession || !data.values) return;

    const lapNum = data.values.Lap || 0;

    // Check if we're on a new lap
    if (lapNum !== this.lastLapNum && this.lastLapNum > 0) {
      this.completeLap();
    }

    // Start new lap if needed
    if (!this.currentLap) {
      this.startLap(lapNum);
    }

    // Record telemetry point
    if (this.options.recordTelemetry && this.currentLap) {
      const telemetryPoint = this.extractTelemetryPoint(data.values);
      this.currentLap.telemetryPoints.push(telemetryPoint);
      this.dataPointsCount++;
    }

    this.lastLapNum = lapNum;
  }

  /**
   * Start recording a new lap
   */
  private startLap(lapNum: number): void {
    this.currentLap = {
      lapNumber: lapNum,
      lapTime: 0,
      lapTimeFormatted: '00:00.000',
      telemetryPoints: [],
      isValid: true,
      isPersonalBest: false
    };
  }

  /**
   * Complete current lap
   */
  private completeLap(): void {
    if (!this.currentLap || !this.currentSession) return;

    // Get lap time from last telemetry point
    const lastPoint = this.currentLap.telemetryPoints[this.currentLap.telemetryPoints.length - 1];
    if (lastPoint) {
      this.currentLap.lapTime = lastPoint.lapTime;
      this.currentLap.lapTimeFormatted = this.formatLapTime(lastPoint.lapTime);
    }

    // Check if it's a personal best
    if (!this.currentSession.fastestLap || this.currentLap.lapTime < this.currentSession.fastestLap.lapTime) {
      this.currentSession.fastestLap = this.currentLap;
      this.currentLap.isPersonalBest = true;
    }

    // Add to session
    this.currentSession.laps.push(this.currentLap);
    this.currentSession.totalLaps++;

    console.log(`Lap ${this.currentLap.lapNumber} completed: ${this.currentLap.lapTimeFormatted}`);
    this.emit(RecordingEvent.LAP_COMPLETE, this.currentLap);

    this.currentLap = null;
  }

  /**
   * Extract telemetry point from raw data
   */
  private extractTelemetryPoint(data: any): TelemetryPoint {
    return {
      timestamp: Date.now(),
      sessionTime: data.SessionTime || 0,
      lat: data.Lat || 0,
      lon: data.Lon || 0,
      alt: data.Alt || 0,
      yaw: data.Yaw || 0,
      pitch: data.Pitch || 0,
      roll: data.Roll || 0,
      speed: data.Speed || 0,
      velocityX: data.VelocityX || 0,
      velocityY: data.VelocityY || 0,
      velocityZ: data.VelocityZ || 0,
      throttle: data.Throttle || 0,
      brake: data.Brake || 0,
      clutch: data.Clutch || 0,
      steering: data.SteeringWheelAngle || 0,
      gear: data.Gear || 0,
      rpm: data.RPM || 0,
      lapDistPct: data.LapDistPct || 0,
      lap: data.Lap || 0,
      lapTime: data.LapCurrentLapTime || 0
    };
  }

  /**
   * Format lap time in MM:SS.mmm
   */
  private formatLapTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Get default telemetry fields to record
   */
  private getDefaultTelemetryFields(): string[] {
    return [
      'Speed', 'Throttle', 'Brake', 'Clutch', 'SteeringWheelAngle',
      'Gear', 'RPM', 'Lat', 'Lon', 'Alt', 'Yaw', 'Pitch', 'Roll',
      'VelocityX', 'VelocityY', 'VelocityZ', 'LapDistPct', 'Lap', 'LapCurrentLapTime'
    ];
  }

  /**
   * Start recording
   */
  startRecording(): void {
    this.isRecording = true;
    console.log('Recording started');
  }

  /**
   * Stop recording and save session
   */
  stopRecording(): void {
    this.isRecording = false;

    if (this.currentSession) {
      // Complete any ongoing lap
      if (this.currentLap) {
        this.completeLap();
      }

      this.currentSession.endTime = Date.now();

      // Calculate average lap time
      const validLaps = this.currentSession.laps.filter(l => l.isValid);
      if (validLaps.length > 0) {
        this.currentSession.averageLapTime = validLaps.reduce((sum, lap) => sum + lap.lapTime, 0) / validLaps.length;
      }

      this.saveSession(this.currentSession);
      this.emit(RecordingEvent.SESSION_END, this.currentSession);

      console.log(`Session ended: ${this.currentSession.totalLaps} laps recorded`);

      this.currentSession = null;
    }

    this.lastLapNum = 0;
    this.dataPointsCount = 0;
  }

  /**
   * Save session data to file
   */
  private saveSession(session: SessionData): void {
    const fileName = `${session.sessionId}.json`;
    const filePath = path.join(this.options.outputDirectory, fileName);

    try {
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
      console.log(`Session saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to save session:', error);
      this.emit(RecordingEvent.ERROR, error);
    }
  }

  /**
   * Get current recorder status
   */
  getStatus(): RecorderStatus {
    return {
      isConnected: this.iracing !== null,
      isRecording: this.isRecording,
      currentSession: this.currentSession || undefined,
      currentLap: this.currentLap?.lapNumber,
      recordedLaps: this.currentSession?.totalLaps || 0,
      dataPoints: this.dataPointsCount
    };
  }

  /**
   * Cleanup and disconnect
   */
  disconnect(): void {
    if (this.isRecording) {
      this.stopRecording();
    }

    // Clean up iRacing SDK
    if (this.iracing) {
      this.iracing.removeAllListeners();
    }
  }
}

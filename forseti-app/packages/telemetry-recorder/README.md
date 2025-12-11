# Forseti Telemetry Recorder

A telemetry recording package for sim racing games, starting with iRacing support.

## Features

- **Real-time telemetry recording** - Capture car position, speed, inputs, and more
- **Session management** - Track entire racing sessions with automatic lap detection
- **Lap analytics** - Record lap times, sector splits, and identify personal bests
- **Flexible data export** - Save sessions as JSON for analysis
- **Event-driven architecture** - React to session events in real-time

## Installation

```bash
npm install @repo/telemetry-recorder
```

## Usage

### Basic Example

```typescript
import { IRacingRecorder, RecordingEvent } from '@repo/telemetry-recorder';

// Create recorder instance
const recorder = new IRacingRecorder({
  telemetryUpdateInterval: 100, // Update every 100ms (10 Hz)
  outputDirectory: './recordings'
});

// Listen for events
recorder.on(RecordingEvent.CONNECTED, () => {
  console.log('Connected to iRacing');
  recorder.startRecording();
});

recorder.on(RecordingEvent.LAP_COMPLETE, (lap) => {
  console.log(`Lap ${lap.lapNumber}: ${lap.lapTimeFormatted}`);
});

recorder.on(RecordingEvent.SESSION_END, (session) => {
  console.log(`Session complete: ${session.totalLaps} laps`);
  console.log(`Fastest lap: ${session.fastestLap?.lapTimeFormatted}`);
});

// Initialize connection
await recorder.init();
```

### Advanced Options

```typescript
const recorder = new IRacingRecorder({
  telemetryUpdateInterval: 50,      // 20 Hz for high-frequency data
  sessionInfoUpdateInterval: 2000,  // Check session info every 2s
  recordTelemetry: true,             // Record full telemetry data
  telemetryFields: [                 // Custom fields to record
    'Speed', 'Throttle', 'Brake', 'Steering',
    'Lat', 'Lon', 'LapDistPct'
  ],
  outputDirectory: './my-recordings'
});
```

## Events

- `connected` - Connected to iRacing
- `disconnected` - Disconnected from iRacing
- `sessionStart` - New session started
- `sessionEnd` - Session ended, data saved
- `lapComplete` - Lap completed
- `telemetry` - Telemetry data received
- `error` - Error occurred

## Data Structure

### SessionData
```typescript
{
  sessionId: string;
  sessionType: string;
  trackName: string;
  carName: string;
  driverName: string;
  startTime: number;
  endTime?: number;
  laps: LapData[];
  fastestLap?: LapData;
  averageLapTime?: number;
  totalLaps: number;
}
```

### LapData
```typescript
{
  lapNumber: number;
  lapTime: number;
  lapTimeFormatted: string;
  telemetryPoints: TelemetryPoint[];
  isValid: boolean;
  isPersonalBest: boolean;
}
```

### TelemetryPoint
```typescript
{
  timestamp: number;
  sessionTime: number;
  lat: number;
  lon: number;
  speed: number;
  throttle: number;
  brake: number;
  steering: number;
  gear: number;
  rpm: number;
  // ... and more
}
```

## Methods

### `init(): Promise<void>`
Initialize connection to iRacing.

### `startRecording(): void`
Start recording telemetry data.

### `stopRecording(): void`
Stop recording and save session data.

### `getStatus(): RecorderStatus`
Get current recorder status.

### `disconnect(): void`
Cleanup and disconnect from iRacing.

## Future Support

This package is designed to be extensible. Future versions will support:
- Assetto Corsa
- Assetto Corsa Competizione
- rFactor 2
- And more sim racing titles

## License

MIT

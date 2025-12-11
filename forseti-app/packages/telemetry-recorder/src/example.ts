/**
 * Example usage of the iRacing Telemetry Recorder
 *
 * Run this script while iRacing is running to record a session.
 */

import { IRacingRecorder, RecordingEvent, SessionData, LapData } from './index';

// Create recorder with custom options
const recorder = new IRacingRecorder({
  telemetryUpdateInterval: 100,     // 10 Hz - good balance of detail and performance
  sessionInfoUpdateInterval: 2000,   // Check session info every 2 seconds
  recordTelemetry: true,              // Record full telemetry data
  outputDirectory: './recordings'     // Save recordings here
});

// Event handlers
recorder.on(RecordingEvent.CONNECTED, () => {
  console.log('\n✅ Connected to iRacing!');
  console.log('Starting recording...\n');
  recorder.startRecording();
});

recorder.on(RecordingEvent.DISCONNECTED, () => {
  console.log('\n❌ Disconnected from iRacing');
  console.log('Recording stopped.\n');
});

recorder.on(RecordingEvent.SESSION_START, (session: SessionData) => {
  console.log('\n🏁 Session Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Track: ${session.trackName}`);
  console.log(`Car: ${session.carName}`);
  console.log(`Driver: ${session.driverName}`);
  console.log(`Session Type: ${session.sessionType}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

recorder.on(RecordingEvent.LAP_COMPLETE, (lap: LapData) => {
  const pbIndicator = lap.isPersonalBest ? '🏆 PB!' : '';
  console.log(`Lap ${lap.lapNumber}: ${lap.lapTimeFormatted} ${pbIndicator}`);
  console.log(`  Telemetry points: ${lap.telemetryPoints.length}`);
});

recorder.on(RecordingEvent.SESSION_END, (session: SessionData) => {
  console.log('\n🏁 Session Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Laps: ${session.totalLaps}`);

  if (session.fastestLap) {
    console.log(`Fastest Lap: ${session.fastestLap.lapTimeFormatted} (Lap ${session.fastestLap.lapNumber})`);
  }

  if (session.averageLapTime) {
    const avgTime = recorder['formatLapTime'](session.averageLapTime);
    console.log(`Average Lap Time: ${avgTime}`);
  }

  const duration = session.endTime && session.startTime
    ? Math.round((session.endTime - session.startTime) / 1000 / 60)
    : 0;
  console.log(`Session Duration: ${duration} minutes`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

recorder.on(RecordingEvent.ERROR, (error: Error) => {
  console.error('❌ Error:', error.message);
});

// Status monitoring (every 10 seconds)
setInterval(() => {
  const status = recorder.getStatus();
  if (status.isRecording && status.currentLap !== undefined) {
    console.log(`📊 Status: Lap ${status.currentLap}, ${status.dataPoints} data points recorded`);
  }
}, 10000);

// Initialize and start
console.log('🎮 Forseti Telemetry Recorder - iRacing');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Waiting for iRacing...\n');

recorder.init().catch((error) => {
  console.error('Failed to initialize recorder:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down...');
  recorder.disconnect();
  process.exit(0);
});

'use client'

import { useState, useEffect } from 'react';
import { useOverlay } from '../hooks/useOverlay';
import { Play, Square, Wifi, WifiOff } from 'lucide-react';

declare global {
  interface Window {
    electronAPI?: {
      getSettings: () => Promise<{ autoRecordOnTrack: boolean }>;
      setSetting: (key: string, value: any) => void;
    };
  }
}

/**
 * Component to control the iRacing recording
 */
export default function OverlayControl() {
  const { startRecording, stopRecording, isElectron, iRacingStatus } = useOverlay();
  const [autoRecord, setAutoRecord] = useState(true);

  // Load settings on mount
  useEffect(() => {
    if (isElectron && window.electronAPI?.getSettings) {
      window.electronAPI.getSettings().then((settings) => {
        setAutoRecord(settings.autoRecordOnTrack);
      }).catch((err) => {
        console.error('Failed to load settings:', err);
      });
    }
  }, [isElectron]);

  if (!isElectron) {
    return null; // Only show in Electron app
  }

  const handleToggleRecording = () => {
    if (iRacingStatus.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleAutoRecordToggle = () => {
    const newValue = !autoRecord;
    setAutoRecord(newValue);
    if (window.electronAPI?.setSetting) {
      window.electronAPI.setSetting('autoRecordOnTrack', newValue);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 bg-forseti-bg-card border border-forseti-border rounded-xl p-4 shadow-lg z-50">
      <h3 className="text-sm font-semibold mb-3">iRacing Recording</h3>

      <div className="flex flex-col gap-3">
        {/* Connection Status */}
        <div className="flex items-center gap-2 px-3 py-2 bg-forseti-bg-elevated rounded-lg">
          {iRacingStatus.isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-forseti-lime" />
              <span className="text-xs text-forseti-text-primary">iRacing Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-forseti-text-secondary" />
              <span className="text-xs text-forseti-text-secondary">iRacing Not Running</span>
            </>
          )}
        </div>

        {/* Auto-record Toggle */}
        <button
          onClick={handleAutoRecordToggle}
          className="flex items-center justify-between px-3 py-2 bg-forseti-bg-elevated rounded-lg hover:bg-forseti-bg-hover transition-colors"
        >
          <span className="text-xs text-forseti-text-primary">Auto-record</span>
          <div
            className={`relative w-9 h-5 rounded-full transition-colors ${
              autoRecord ? 'bg-forseti-lime' : 'bg-forseti-border'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                autoRecord ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </div>
        </button>

        {/* Recording Button */}
        <button
          onClick={handleToggleRecording}
          disabled={!iRacingStatus.isConnected}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
            iRacingStatus.isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-forseti-lime hover:bg-forseti-lime-hover text-forseti-text-inverse'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {iRacingStatus.isRecording ? (
            <>
              <Square className="w-4 h-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start Recording
            </>
          )}
        </button>

        {/* Status Message */}
        {!iRacingStatus.isConnected && (
          <p className="text-xs text-forseti-text-secondary text-center">
            Launch iRacing to start recording
          </p>
        )}
        {iRacingStatus.isRecording && (
          <p className="text-xs text-forseti-lime text-center">
            ● Recording telemetry data
          </p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useCallback, useState } from 'react';

interface RecordingStatus {
  isRecording: boolean;
  sessionName?: string;
  currentLap?: number;
}

interface IRacingStatus {
  isConnected: boolean;
  isRecording: boolean;
}

/**
 * Hook to control the iRacing overlay
 */
export function useOverlay() {
  const isElectron = typeof window !== 'undefined' && (window as any).electron?.isElectron;
  const [iRacingStatus, setIRacingStatus] = useState<IRacingStatus>({
    isConnected: false,
    isRecording: false
  });

  useEffect(() => {
    if (isElectron && (window as any).electronAPI) {
      // Get initial status
      (window as any).electronAPI.getIRacingStatus().then((status: IRacingStatus) => {
        setIRacingStatus(status);
      });

      // Listen for status changes
      (window as any).electronAPI.onIRacingStatusChanged((status: IRacingStatus) => {
        setIRacingStatus(status);
      });
    }
  }, [isElectron]);

  const showOverlay = useCallback(() => {
    if (isElectron) {
      (window as any).electron.send('show-overlay');
    }
  }, [isElectron]);

  const hideOverlay = useCallback(() => {
    if (isElectron) {
      (window as any).electron.send('hide-overlay');
    }
  }, [isElectron]);

  const updateStatus = useCallback((status: RecordingStatus) => {
    if (isElectron) {
      (window as any).electron.send('update-overlay-status', status);
    }
  }, [isElectron]);

  const startRecording = useCallback(() => {
    if (isElectron && (window as any).electronAPI) {
      (window as any).electronAPI.startRecording();
    }
  }, [isElectron]);

  const stopRecording = useCallback(() => {
    if (isElectron && (window as any).electronAPI) {
      (window as any).electronAPI.stopRecording();
    }
  }, [isElectron]);

  return {
    showOverlay,
    hideOverlay,
    updateStatus,
    startRecording,
    stopRecording,
    isElectron,
    iRacingStatus
  };
}

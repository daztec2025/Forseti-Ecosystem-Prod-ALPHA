/**
 * @fileoverview Electron Preload Script
 *
 * Security-critical preload script that creates a safe bridge between
 * the main process and renderer process. Uses contextBridge to expose
 * only specific, validated IPC channels to the web content.
 *
 * This file runs before web content loads but has access to Node.js APIs.
 * It acts as a secure bridge, preventing the renderer from having direct
 * access to Node.js or Electron's internal APIs.
 *
 * Exposed APIs:
 * - window.electron: Main window controls and navigation
 * - window.electronAPI: iRacing recording controls and telemetry events
 *
 * @module electron/preload
 * @security This file is security-critical. Only expose validated channels.
 */

const { contextBridge, ipcRenderer } = require('electron')

/**
 * Main window API exposed to renderer
 *
 * Provides safe access to window controls, navigation, and communication
 * with the main process. All channels are validated against a whitelist.
 *
 * @namespace window.electron
 * @property {Function} send - Send messages to main process (validated channels only)
 * @property {Function} openExternal - Open URL in system default browser
 * @property {Function} receive - Register listeners for main process messages
 * @property {string} platform - Current platform (win32, darwin, linux)
 * @property {boolean} isElectron - Always true, indicates Electron environment
 */
contextBridge.exposeInMainWorld('electron', {
  // Send messages to main process
  send: (channel, data) => {
    const validChannels = [
      'navigate',
      'window-minimize',
      'window-maximize',
      'window-close',
      'show-overlay',
      'hide-overlay',
      'update-overlay-status',
      'start-iracing-recording',
      'stop-iracing-recording',
      'open-external-url'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  // Open URL in external browser
  openExternal: (url) => {
    ipcRenderer.send('open-external-url', url)
  },
  // Receive messages from main process
  receive: (channel, func) => {
    const validChannels = ['navigate']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    }
  },
  // Platform information
  platform: process.platform,
  // Check if running in Electron
  isElectron: true,
})

/**
 * iRacing and overlay API exposed to renderer
 *
 * Provides access to iRacing recording controls, telemetry streaming,
 * overlay management, and application settings. Used by both the main
 * window and the overlay window.
 *
 * @namespace window.electronAPI
 * @property {Function} onRecordingStatus - Listen for recording status updates
 * @property {Function} onTelemetryUpdate - Listen for live telemetry data
 * @property {Function} onIRacingStatusChanged - Listen for connection changes
 * @property {Function} onIRacingSession - Receive complete session data
 * @property {Function} onIRacingSessionFile - Receive session file path
 * @property {Function} invokeReadFile - Read file contents from main
 * @property {Function} getIRacingStatus - Query current recording status
 * @property {Function} startRecording - Start telemetry recording
 * @property {Function} stopRecording - Stop telemetry recording
 * @property {Function} setClickable - Toggle overlay click-through
 * @property {Function} getSettings - Get application settings
 * @property {Function} setSetting - Update a setting value
 */
contextBridge.exposeInMainWorld('electronAPI', {
  onRecordingStatus: (callback) => {
    ipcRenderer.on('recording-status', (event, status) => callback(status))
  },
  onTelemetryUpdate: (callback) => {
    ipcRenderer.on('telemetry-update', (event, telemetry) => callback(telemetry))
  },
  onIRacingStatusChanged: (callback) => {
    ipcRenderer.on('iracing-status-changed', (event, status) => callback(status))
  },
  // Receive full iRacing session telemetry payload (sent after navigation)
  onIRacingSession: (callback) => {
    ipcRenderer.on('iracing-session', (event, session) => callback(session))
  },
  // A file path may be sent instead when telemetry is large; notify renderer
  // and let it request the contents via invokeReadFile for safety.
  onIRacingSessionFile: (callback) => {
    ipcRenderer.on('iracing-session-file', (event, filePath) => callback(filePath))
  },
  // Read file contents from main via an invoke — main should validate path
  invokeReadFile: (filePath) => ipcRenderer.invoke('read-temp-file', filePath),
  getIRacingStatus: () => {
    return ipcRenderer.invoke('get-iracing-status')
  },
  startRecording: () => {
    ipcRenderer.send('start-iracing-recording')
  },
  stopRecording: () => {
    ipcRenderer.send('stop-iracing-recording')
  },
  setClickable: (clickable) => {
    ipcRenderer.send('overlay-set-clickable', clickable)
  },
  // Settings
  getSettings: () => {
    return ipcRenderer.invoke('get-settings')
  },
  setSetting: (key, value) => {
    ipcRenderer.send('set-setting', key, value)
  },

  // Drill controls
  startDrill: (drillData) => {
    ipcRenderer.send('start-drill', drillData)
  },
  getActiveDrill: () => {
    return ipcRenderer.invoke('get-active-drill')
  },
  abandonDrill: () => {
    ipcRenderer.send('abandon-drill')
  },
  onDrillUpdate: (callback) => {
    ipcRenderer.on('drill-update', (event, data) => callback(data))
  },
  onDrillComplete: (callback) => {
    ipcRenderer.on('drill-complete', (event, data) => callback(data))
  },
  onDrillActivated: (callback) => {
    ipcRenderer.on('drill-activated', (event, data) => callback(data))
  },

  // Auto-update controls
  checkForUpdates: () => {
    return ipcRenderer.invoke('check-for-updates')
  },
  quitAndInstall: () => {
    ipcRenderer.send('quit-and-install')
  },
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version')
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data))
  },
  onShowNotification: (callback) => {
    ipcRenderer.on('show-notification', (event, data) => callback(data))
  },

  // Python/iRacing bridge status
  getPythonStatus: () => {
    return ipcRenderer.invoke('get-python-status')
  },
  onPythonStatus: (callback) => {
    ipcRenderer.on('python-status', (event, status) => callback(status))
  },
  retryPythonDetection: () => {
    ipcRenderer.send('retry-python-detection')
  },
  openPythonInstall: () => {
    ipcRenderer.send('open-python-install')
  }
})

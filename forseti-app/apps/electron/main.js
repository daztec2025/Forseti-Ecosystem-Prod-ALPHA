/**
 * @fileoverview Forseti Electron Desktop Application
 *
 * Main process file for the Forseti desktop application. Handles window management,
 * system tray integration, IPC communication, and iRacing telemetry recording.
 *
 * Features:
 * - Main application window with Next.js web content
 * - System tray integration for background operation
 * - In-game overlay for recording status display
 * - iRacing Python bridge management
 * - Auto-recording when user goes on track
 * - Session and telemetry data collection
 * - IPC handlers for renderer process communication
 *
 * Architecture:
 * - Main Window: Loads the Next.js web application
 * - Overlay Window: Transparent, always-on-top recording status
 * - Python Bridge: Spawns forseti-iracing-bridge service for telemetry
 * - System Tray: Provides background access to app features
 *
 * @module electron/main
 * @requires electron
 * @requires auto-launch - Automatic startup on Windows boot
 * @requires electron-store - Persistent settings storage
 *
 * @author Forseti Development Team
 * @version 1.0.0
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, globalShortcut, shell, dialog } = require('electron')
const path = require('path')
const AutoLaunch = require('auto-launch')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')

// Configure logging for auto-updater
log.transports.file.level = 'info'
autoUpdater.logger = log

// Configure auto-updater settings
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowDowngrade = false

// Determine if running in development
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// API URL configuration - uses Azure Container Apps in production
const API_URL = process.env.FORSETI_API_URL || (isDev
  ? 'http://localhost:4000'
  : 'https://forseti-api.icyfield-da5f7469.uksouth.azurecontainerapps.io')

// Web app URL - uses Azure Container Apps in production
const WEB_APP_URL = process.env.FORSETI_WEB_URL || (isDev
  ? 'http://localhost:3000'
  : 'https://forseti-web.icyfield-da5f7469.uksouth.azurecontainerapps.io')

// electron-store is ESM-only, use dynamic import
let store = null

/**
 * Initialize the electron-store for persistent settings
 *
 * @async
 * @function initStore
 * @returns {Promise<void>}
 */
async function initStore() {
  const { default: Store } = await import('electron-store')
  store = new Store({
    defaults: {
      autoRecordOnTrack: true
    }
  })
}

let mainWindow = null
let tray = null
let overlayWindow = null
let overlayCreationInProgress = false // Lock to prevent duplicate overlay creation
let iRacingRecorder = null
let recordingStatus = {
  isRecording: false,
  isConnected: false
}

// Session data collected during recording
let sessionData = {
  trackName: null,
  carName: null,
  fastestLap: 0,
  duration: 0,
  startTime: null,
  laps: [],
  currentLap: null,
  trackTemperature: null,
  airTemperature: null,
  trackCondition: null
}

// Configure auto-launch for Windows
const forsetiAutoLauncher = new AutoLaunch({
  name: 'Forseti',
  path: app.getPath('exe'),
})

// Enable auto-launch on first run (production only)
if (!isDev) {
  forsetiAutoLauncher.isEnabled().then((isEnabled) => {
    if (!isEnabled) {
      forsetiAutoLauncher.enable()
    }
  }).catch((err) => {
    console.error('Auto-launch setup error:', err)
  })
}

/**
 * Create the main application window
 *
 * Creates a frameless window that loads the Next.js web application.
 * In development, loads from localhost:3000; in production, loads from the Forseti URL.
 * Configures window to hide to tray instead of closing.
 *
 * @function createWindow
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: isDev
      ? path.join(__dirname, 'icon.ico')
      : path.join(process.resourcesPath, 'icon.ico'),
    frame: false,
    transparent: false,
    autoHideMenuBar: true,
  })

  // Load the Next.js app from configured URL
  console.log('Loading web app from:', WEB_APP_URL)
  mainWindow.loadURL(WEB_APP_URL)

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

/**
 * Setup Inter-Process Communication handlers
 *
 * Registers all IPC handlers for communication between the main process
 * and renderer processes. Handles window controls, overlay management,
 * iRacing controls, settings persistence, and external URL opening.
 *
 * IPC Channels:
 * - window-minimize/maximize/close: Window control
 * - show-overlay/hide-overlay: Overlay visibility
 * - start/stop-iracing-recording: Recording control
 * - get-iracing-status: Current status query
 * - get-settings/set-setting: Settings management
 * - open-external-url: Open URLs in default browser
 *
 * @function setupIPCHandlers
 */
function setupIPCHandlers() {
  // Window control handlers
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize()
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close()
  })

  // Overlay control handlers
  ipcMain.on('show-overlay', () => {
    if (!overlayWindow) {
      createOverlay()
    } else {
      // Force reload the overlay to show latest design
      overlayWindow.webContents.reloadIgnoringCache()
      
  // Re-assert topmost state and show without stealing focus
  reassertOverlayTopmost()
    }
  })

  ipcMain.on('hide-overlay', () => {
    if (overlayWindow) overlayWindow.hide()
  })

  ipcMain.on('update-overlay-status', (event, status) => {
    if (overlayWindow) {
      overlayWindow.webContents.send('recording-status', status)
    }
  })

  // iRacing control handlers
  ipcMain.on('start-iracing-recording', () => {
    startIRacingRecording()
  })

  ipcMain.on('stop-iracing-recording', () => {
    stopIRacingRecording()
  })

  ipcMain.handle('get-iracing-status', () => {
    return recordingStatus
  })

  // Settings handlers
  ipcMain.handle('get-settings', () => {
    return {
      autoRecordOnTrack: store.get('autoRecordOnTrack', true)
    }
  })

  ipcMain.on('set-setting', (event, key, value) => {
    store.set(key, value)
  })

  // Overlay clickable handler
  ipcMain.on('overlay-set-clickable', (event, clickable) => {
    if (overlayWindow) {
      overlayWindow.setIgnoreMouseEvents(!clickable, { forward: true })
    }
  })

  // Open external URL in default browser
  ipcMain.on('open-external-url', (event, url) => {
    if (url && typeof url === 'string') {
      shell.openExternal(url)
    }
  })

  // Drill control handlers
  ipcMain.on('start-drill', (event, drillData) => {
    console.log('[DRILL] Starting drill:', drillData)
    activeDrill = drillData

    // If the drill is pending (no track/car yet), just store it
    // It will be activated when iRacing connects
    if (drillData.status === 'pending') {
      console.log('[DRILL] Drill is pending - will activate when iRacing connects')
      // Send pending state to overlay if it exists
      if (overlayWindow) {
        overlayWindow.webContents.send('drill-update', {
          active: true,
          pending: true,
          type: activeDrill.type,
          targetLaps: activeDrill.targetLaps,
          lapsCompleted: 0,
          totalTime: 0
        })
      }
      return
    }

    // Active drill - initialize progress tracking
    drillProgress = {
      lapsCompleted: 0,
      lapTimes: [],
      totalTime: 0,
      startLapNumber: lastLapNumber + 1  // Will start counting from next lap
    }

    // Send initial drill state to overlay
    if (overlayWindow) {
      overlayWindow.webContents.send('drill-update', {
        active: true,
        pending: false,
        type: activeDrill.type,
        targetTime: activeDrill.targetTime,
        targetLaps: activeDrill.targetLaps,
        lapsCompleted: 0,
        totalTime: 0,
        delta: 0
      })
    }
  })

  ipcMain.handle('get-active-drill', () => {
    if (!activeDrill) return null
    return {
      ...activeDrill,
      progress: drillProgress
    }
  })

  ipcMain.on('abandon-drill', () => {
    console.log('[DRILL] Abandoning drill')
    activeDrill = null
    drillProgress = {
      lapsCompleted: 0,
      lapTimes: [],
      totalTime: 0,
      startLapNumber: 0
    }

    // Stop real-time delta updates
    stopDrillDeltaUpdates()

    // Notify overlay
    if (overlayWindow) {
      overlayWindow.webContents.send('drill-update', { active: false })
    }
  })

  // Auto-update manual controls
  ipcMain.handle('check-for-updates', async () => {
    if (isDev) return { status: 'dev-mode' }
    try {
      const result = await autoUpdater.checkForUpdates()
      return { status: 'checked', updateInfo: result?.updateInfo }
    } catch (error) {
      return { status: 'error', message: error.message }
    }
  })

  ipcMain.on('quit-and-install', () => {
    app.isQuitting = true
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // Python/iRacing bridge status handlers
  ipcMain.handle('get-python-status', () => {
    return getPythonStatus()
  })

  ipcMain.on('retry-python-detection', async () => {
    console.log('Manual Python detection retry requested')
    const pythonPath = findPythonPath()
    if (pythonPath && verifyPythonWorks(pythonPath)) {
      console.log('Python found on manual retry!')
      pythonStatus.available = true
      pythonStatus.path = pythonPath
      pythonStatus.error = null

      if (mainWindow) {
        mainWindow.webContents.send('python-status', {
          available: true,
          path: pythonPath
        })
      }

      // Initialize iRacing if not already running
      if (!pythonBridgeProcess) {
        await initializeIRacing()
      }
    } else {
      // Still not available, log silently
      console.log('Python still not available after manual retry')
    }
  })

  ipcMain.on('open-python-install', () => {
    const MICROSOFT_STORE_PYTHON_URL = 'ms-windows-store://pdp/?productid=9PJPW5LDXLZ5'
    shell.openExternal(MICROSOFT_STORE_PYTHON_URL)
    startPythonRetryInterval()
  })
}

/**
 * Create the in-game overlay window
 *
 * Creates a transparent, always-on-top window positioned in the top-right
 * corner of the screen. Designed to display over fullscreen games without
 * stealing focus. Click-through by default to not interfere with gameplay.
 *
 * @function createOverlay
 */
function createOverlay() {
  // Prevent duplicate overlay creation
  if (overlayCreationInProgress || overlayWindow) {
    return
  }
  overlayCreationInProgress = true

  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  overlayWindow = new BrowserWindow({
    width: 350,
    height: 320,
    x: width - 370,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    hasShadow: false,
    acceptFirstMouse: true,
    enableLargerThanScreen: true,
    show: false, // Don't show initially
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  // Set the window to be click-through except for the buttons
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  // Configure overlay for fullscreen compatibility
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  
  // Force the overlay to stay above fullscreen applications
  overlayWindow.setFullScreenable(false)
  
  // Load overlay HTML with cache busting
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html')).then(() => {
    // Clear creation lock
    overlayCreationInProgress = false

    // Clear cache and reload to ensure fresh content
    overlayWindow.webContents.session.clearCache()

    // Show the window after loading without stealing focus
    if (typeof overlayWindow.showInactive === 'function') overlayWindow.showInactive()
    else overlayWindow.show()

    // Re-assert topmost state to increase chance of being above fullscreen games
    reassertOverlayTopmost()
  }).catch(() => {
    // Clear lock on error too
    overlayCreationInProgress = false
  })

  // DevTools disabled for overlay to prevent black text appearing over the overlay
  // if (isDev) {
  //   overlayWindow.webContents.openDevTools({ mode: 'detach' })
  // }

  overlayWindow.on('closed', () => {
    overlayWindow = null
    overlayCreationInProgress = false // Clear lock when window is closed
    if (overlayReassertInterval) {
      clearInterval(overlayReassertInterval)
      overlayReassertInterval = null
    }
  })
}

function reassertOverlayTopmost() {
  if (!overlayWindow) return

  // Apply topmost settings once - avoid aggressive repeated manipulation
  // which can interfere with Windows Explorer and DWM
  const applyTopmost = () => {
    if (!overlayWindow) return
    try {
      // Set alwaysOnTop once with screen-saver level (highest priority)
      overlayWindow.setAlwaysOnTop(true, 'screen-saver')
      overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

      if (typeof overlayWindow.showInactive === 'function') overlayWindow.showInactive()
    } catch (e) {
      // ignore errors - best-effort
    }
  }

  // Run once immediately
  applyTopmost()

  // Clear any existing interval to prevent accumulation
  if (overlayReassertInterval) {
    clearInterval(overlayReassertInterval)
    overlayReassertInterval = null
  }

  // Only reassert periodically at a much lower frequency (every 10 seconds)
  // and without position manipulation to avoid Explorer interference
  overlayReassertInterval = setInterval(() => {
    if (!overlayWindow) {
      clearInterval(overlayReassertInterval)
      overlayReassertInterval = null
      return
    }
    // Simple reapply without position nudging
    try {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver')
    } catch (e) {
      // ignore
    }
  }, 10000) // Every 10 seconds instead of 1.5 seconds
}

function createTray() {
  const iconPath = isDev
    ? path.join(__dirname, 'icon.ico')
    : path.join(process.resourcesPath, 'icon.ico')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Forseti',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
        } else {
          createWindow()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.webContents.send('navigate', '/dashboard')
        }
      }
    },
    {
      label: 'Profile',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.webContents.send('navigate', '/profile')
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('Forseti')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
      }
    } else {
      createWindow()
    }
  })
}

// iRacing Python bridge service
const { spawn, execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
let pythonBridgeProcess = null
let telemetryPollInterval = null
let statusCheckInterval = null
let fastestLapTime = 0
let lastLapNumber = 0
let wasOnTrack = false
let autoStartAttempted = false
let overlayReassertInterval = null
let drillDeltaUpdateInterval = null  // For real-time delta updates every 5 seconds
let pythonStatus = {
  available: false,
  path: null,
  bridgeRunning: false,
  error: null
}
let pythonRetryInterval = null  // Interval to retry Python detection after install prompt
let pythonInstallWindow = null  // Custom branded Python install prompt window

// Drill tracking state
let activeDrill = null  // { id, type, targetTime, targetLaps, trackId, carId }
let drillProgress = {
  lapsCompleted: 0,
  lapTimes: [],
  totalTime: 0,
  startLapNumber: 0  // The lap number when drill started
}

/**
 * Initialize the iRacing Python bridge service
 *
 * Spawns the forseti-iracing-bridge Python service as a child process
 * and begins polling for connection status and telemetry data.
 * Automatically shows/hides overlay based on iRacing connection state.
 *
 * @async
 * @function initializeIRacing
 * @returns {Promise<void>}
 */
/**
 * Find Python executable
 * In production, uses bundled Python embed; in development, searches system
 */
function findPythonPath() {
  // In production, use bundled Python
  if (!isDev) {
    const bundledPython = path.join(process.resourcesPath, 'python-embed', 'python.exe')
    if (fs.existsSync(bundledPython)) {
      console.log(`Using bundled Python at: ${bundledPython}`)
      return bundledPython
    }
    console.warn('Bundled Python not found, falling back to system Python')
  }

  // Development mode or fallback: search for system Python
  const { execSync } = require('child_process')

  // Check common Python executable names
  const pythonNames = ['python', 'python3', 'py']

  for (const pyName of pythonNames) {
    try {
      // Use 'where' on Windows to find Python
      const result = execSync(`where ${pyName}`, { encoding: 'utf8', timeout: 5000 })
      const paths = result.trim().split('\n')
      if (paths.length > 0 && paths[0]) {
        console.log(`Found Python at: ${paths[0].trim()}`)
        return paths[0].trim()
      }
    } catch (e) {
      // Continue to next option
    }
  }

  // Fallback to common Windows Python locations
  const commonPaths = [
    'C:\\Python310\\python.exe',
    'C:\\Python311\\python.exe',
    'C:\\Python312\\python.exe',
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python310\\python.exe`,
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python311\\python.exe`,
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python312\\python.exe`,
  ]

  for (const pyPath of commonPaths) {
    if (fs.existsSync(pyPath)) {
      console.log(`Found Python at: ${pyPath}`)
      return pyPath
    }
  }

  // If all else fails, just try 'python' and hope it's in PATH
  return 'python'
}

/**
 * Get the path to the iRacing bridge directory
 * Handles both development and production (packaged) paths
 */
function getBridgePath() {
  if (isDev) {
    return path.join(__dirname, '../../../forseti-iracing-bridge')
  }
  // In production, the bridge is in resources/forseti-iracing-bridge
  return path.join(process.resourcesPath, 'forseti-iracing-bridge')
}

/**
 * Verify that Python is actually executable and working
 * @param {string} pythonPath - Path to Python executable
 * @returns {boolean} - True if Python works
 */
function verifyPythonWorks(pythonPath) {
  try {
    // Try to run a simple Python command
    execSync(`"${pythonPath}" -c "print('ok')"`, {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true
    })
    return true
  } catch (e) {
    console.error('Python verification failed:', e.message)
    return false
  }
}

/**
 * Show custom Forseti-branded dialog prompting user to install Python
 * Creates a custom BrowserWindow with branded styling
 */
async function showPythonInstallPrompt() {
  // Don't show multiple prompts
  if (pythonInstallWindow) {
    pythonInstallWindow.focus()
    return
  }

  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  pythonInstallWindow = new BrowserWindow({
    width: 380,
    height: 160,
    x: Math.round((width - 380) / 2),
    y: Math.round((height - 160) / 2),
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#0A0A0A',
    show: false,
    parent: mainWindow || undefined,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  pythonInstallWindow.loadFile(path.join(__dirname, 'python-install-prompt.html'))

  pythonInstallWindow.once('ready-to-show', () => {
    pythonInstallWindow.show()
  })

  pythonInstallWindow.on('closed', () => {
    pythonInstallWindow = null
  })

  // Notify renderer about Python status
  if (mainWindow) {
    mainWindow.webContents.send('python-status', {
      available: false,
      error: 'Python not installed',
      installPromptShown: true
    })
  }
}

/**
 * Handle user choice from Python install prompt
 */
function handlePythonInstallChoice(choice) {
  const MICROSOFT_STORE_PYTHON_URL = 'ms-windows-store://pdp/?productid=9PJPW5LDXLZ5'  // Python 3.12
  const PYTHON_ORG_URL = 'https://www.python.org/downloads/'

  switch (choice) {
    case 'ms-store':
      shell.openExternal(MICROSOFT_STORE_PYTHON_URL)
      startPythonRetryInterval()
      break
    case 'python-org':
      shell.openExternal(PYTHON_ORG_URL)
      startPythonRetryInterval()
      break
    case 'later':
    case 'close':
      // User chose to skip - don't start retry interval
      break
  }

  // Close the prompt window
  if (pythonInstallWindow) {
    pythonInstallWindow.close()
    pythonInstallWindow = null
  }
}

// IPC handler for Python install prompt choices
ipcMain.on('python-install-choice', (event, choice) => {
  handlePythonInstallChoice(choice)
})

/**
 * Start interval to retry Python detection after user was prompted to install
 * Checks every 30 seconds for 10 minutes
 */
function startPythonRetryInterval() {
  // Clear any existing interval
  if (pythonRetryInterval) {
    clearInterval(pythonRetryInterval)
  }

  let retryCount = 0
  const maxRetries = 20  // 20 * 30 seconds = 10 minutes

  console.log('Starting Python detection retry interval...')

  pythonRetryInterval = setInterval(async () => {
    retryCount++
    console.log(`Python detection retry ${retryCount}/${maxRetries}...`)

    // Try to find Python again
    const pythonPath = findPythonPath()
    if (pythonPath && verifyPythonWorks(pythonPath)) {
      console.log('Python detected! Initializing iRacing bridge...')
      clearInterval(pythonRetryInterval)
      pythonRetryInterval = null

      // Update status and initialize
      pythonStatus.available = true
      pythonStatus.path = pythonPath
      pythonStatus.error = null

      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('python-status', {
          available: true,
          path: pythonPath
        })
        mainWindow.webContents.send('show-notification', {
          type: 'success',
          title: 'Python Detected',
          message: 'iRacing integration is now available. Connecting...'
        })
      }

      // Initialize iRacing bridge
      await initializeIRacing()
    } else if (retryCount >= maxRetries) {
      console.log('Python detection retry timeout reached')
      clearInterval(pythonRetryInterval)
      pythonRetryInterval = null
    }
  }, 30000)  // Every 30 seconds
}

/**
 * Stop Python retry interval
 */
function stopPythonRetryInterval() {
  if (pythonRetryInterval) {
    clearInterval(pythonRetryInterval)
    pythonRetryInterval = null
  }
}

/**
 * Get current Python/bridge status
 * @returns {Object} Current status
 */
function getPythonStatus() {
  return {
    ...pythonStatus,
    bridgeRunning: pythonBridgeProcess !== null
  }
}

async function initializeIRacing() {
  try {
    const pythonPath = findPythonPath()
    const bridgeDir = getBridgePath()
    const bridgePath = path.join(bridgeDir, 'main.py')

    console.log('Starting iRacing Python bridge service...')
    console.log('Python path:', pythonPath)
    console.log('Bridge dir:', bridgeDir)
    console.log('Bridge path:', bridgePath)
    console.log('Python exists:', fs.existsSync(pythonPath))
    console.log('Bridge exists:', fs.existsSync(bridgePath))

    // Check if Python exists and actually works
    const pythonExists = fs.existsSync(pythonPath)
    const pythonWorks = pythonExists && verifyPythonWorks(pythonPath)

    if (!pythonExists || !pythonWorks) {
      console.error('Python not found or not working at:', pythonPath)
      pythonStatus.available = false
      pythonStatus.path = null
      pythonStatus.error = 'Python not installed or not working'

      // Show simple install prompt dialog
      await showPythonInstallPrompt()
      return
    }

    // Python is available and working
    pythonStatus.available = true
    pythonStatus.path = pythonPath
    pythonStatus.error = null

    // Notify renderer that Python is available
    if (mainWindow) {
      mainWindow.webContents.send('python-status', {
        available: true,
        path: pythonPath
      })
    }

    // Check if bridge exists
    if (!fs.existsSync(bridgePath)) {
      console.error('iRacing bridge not found at:', bridgePath)
      pythonStatus.error = 'iRacing bridge script not found'
      return
    }

    pythonBridgeProcess = spawn(pythonPath, [bridgePath], {
      cwd: bridgeDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    pythonBridgeProcess.stdout.on('data', (data) => {
      console.log(`iRacing Bridge: ${data.toString().trim()}`)
    })

    pythonBridgeProcess.stderr.on('data', (data) => {
      console.error(`iRacing Bridge Error: ${data.toString().trim()}`)
    })

    pythonBridgeProcess.on('error', (error) => {
      console.error('Failed to start iRacing Bridge:', error.message)
      pythonBridgeProcess = null
    })

    pythonBridgeProcess.on('close', (code) => {
      console.log(`iRacing Bridge process exited with code ${code}`)
      pythonBridgeProcess = null
      stopPollingTelemetry()
    })

    // Wait for service to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Start polling for connection status and telemetry
    startPollingTelemetry()

    console.log('iRacing Python bridge initialized')

  } catch (error) {
    console.error('Failed to initialize iRacing Python bridge:', error.message)
  }
}

/**
 * Activate a pending drill when iRacing connects
 * Fetches session data and calls the API to activate the drill
 */
async function activatePendingDrill() {
  if (!activeDrill || activeDrill.status !== 'pending') return

  console.log('[DRILL] Activating pending drill...')

  try {
    // Get session data from iRacing bridge
    const sessionResponse = await fetch('http://127.0.0.1:5555/session')
    const session = await sessionResponse.json()

    if (!session.trackName || !session.carName) {
      console.log('[DRILL] No track/car data yet - will retry')
      // Retry after a short delay
      setTimeout(activatePendingDrill, 2000)
      return
    }

    console.log(`[DRILL] Session detected: ${session.trackName} / ${session.carName}`)

    // Get auth token from main window
    if (!mainWindow) {
      console.error('[DRILL] No main window - cannot activate drill')
      return
    }

    const token = await mainWindow.webContents.executeJavaScript(
      'localStorage.getItem("forseti_token")'
    ).catch(() => null)

    if (!token) {
      console.error('[DRILL] No auth token - cannot activate drill')
      return
    }

    // Call API to activate the drill
    const activateResponse = await fetch(`${API_URL}/api/drills/${activeDrill.id}/activate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        trackId: session.trackName,
        carId: session.carName
      })
    })

    if (!activateResponse.ok) {
      const error = await activateResponse.json()
      console.error('[DRILL] Failed to activate drill:', error)
      return
    }

    const updatedDrill = await activateResponse.json()
    console.log('[DRILL] Drill activated:', updatedDrill)

    // Update local drill state
    activeDrill = {
      ...activeDrill,
      ...updatedDrill,
      status: 'active'
    }

    // Initialize drill progress tracking
    drillProgress = {
      lapsCompleted: 0,
      lapTimes: [],
      totalTime: 0,
      startLapNumber: lastLapNumber + 1
    }

    // Notify overlay
    if (overlayWindow) {
      overlayWindow.webContents.send('drill-update', {
        active: true,
        pending: false,
        type: activeDrill.type,
        targetTime: activeDrill.targetTime,
        targetLaps: activeDrill.targetLaps,
        lapsCompleted: 0,
        totalTime: 0,
        delta: 0
      })
    }

    // Notify renderer that drill was activated
    if (mainWindow) {
      mainWindow.webContents.send('drill-activated', activeDrill)
    }

  } catch (error) {
    console.error('[DRILL] Error activating pending drill:', error)
    // Retry after a delay
    setTimeout(activatePendingDrill, 3000)
  }
}

async function startPollingTelemetry() {
  // Clear any existing intervals first
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval)
    statusCheckInterval = null
  }
  if (telemetryPollInterval) {
    clearInterval(telemetryPollInterval)
    telemetryPollInterval = null
  }

  // Poll for status every 3 seconds (reduced from 2 for less overhead)
  statusCheckInterval = setInterval(async () => {
    try {
      const response = await fetch('http://127.0.0.1:5555/status')
      const status = await response.json()

      const wasConnected = recordingStatus.isConnected
      recordingStatus.isConnected = status.connected

      // Connection state changed
      if (status.connected && !wasConnected) {
        console.log('iRacing connected - showing overlay')

        // Show overlay when iRacing connects
        if (!overlayWindow) {
          createOverlay()
        } else {
          overlayWindow.setAlwaysOnTop(true, 'screen-saver')
          overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
          overlayWindow.show()
          reassertOverlayTopmost()
        }

        // Reset auto-start flag when first connecting
        autoStartAttempted = false

        // Check for pending drill and activate it
        if (activeDrill && activeDrill.status === 'pending') {
          activatePendingDrill()
        }

        if (mainWindow) {
          mainWindow.webContents.send('iracing-status-changed', recordingStatus)
        }
      } else if (!status.connected && wasConnected) {
        console.log('iRacing disconnected - closing overlay')

        // Auto-stop recording if it's running
        if (recordingStatus.isRecording) {
          stopIRacingRecording()
        }

        recordingStatus.isRecording = false

        // Close the overlay window completely instead of just hiding it
        if (overlayWindow) {
          overlayWindow.close()
          overlayWindow = null
        }

        // Clear the reassert interval
        if (overlayReassertInterval) {
          clearInterval(overlayReassertInterval)
          overlayReassertInterval = null
        }

        if (mainWindow) {
          mainWindow.webContents.send('iracing-status-changed', recordingStatus)
        }
      }

    } catch (error) {
      // Service not responding
      if (recordingStatus.isConnected) {
        recordingStatus.isConnected = false
        recordingStatus.isRecording = false
        if (mainWindow) {
          mainWindow.webContents.send('iracing-status-changed', recordingStatus)
        }
      }
    }
  }, 3000)

  // Poll for telemetry (10 times per second for accurate data capture)
  telemetryPollInterval = setInterval(async () => {
    // Always poll if connected to detect when user goes on track
    if (!recordingStatus.isConnected) return

    try {
      const response = await fetch('http://127.0.0.1:5555/telemetry')
      const telemetry = await response.json()

      // Auto-start recording when user goes on track (first time only, and only if logged in and auto-record enabled)
      if (telemetry.isOnTrack && !wasOnTrack && !recordingStatus.isRecording && !autoStartAttempted) {
        // Check if auto-record is enabled
        const autoRecordEnabled = store.get('autoRecordOnTrack', true)

        if (autoRecordEnabled) {
          // Check if user is logged in by checking for token in main window
          if (mainWindow && mainWindow.webContents) {
            const isLoggedIn = await mainWindow.webContents.executeJavaScript(
              'localStorage.getItem("forseti_token") !== null'
            ).catch(() => false)

            if (isLoggedIn) {
              console.log('User entered track - auto-starting recording')
              autoStartAttempted = true
              startIRacingRecording()
            } else {
              console.log('User not logged in - skipping auto-start recording')
            }
          }
        } else {
          console.log('Auto-record disabled - skipping auto-start recording')
          autoStartAttempted = true // Prevent repeated checks
        }
      }

      // Track on-track status
      wasOnTrack = telemetry.isOnTrack

      // Only record telemetry if actually recording
      if (!recordingStatus.isRecording) return

      // Check if we're on a new lap (ignore lap 0 which is the sighting/out lap)
      if (telemetry.lapNumber > 0 && telemetry.lapNumber !== lastLapNumber) {
        // Complete previous lap if exists and it's not the sighting lap
        if (sessionData.currentLap && sessionData.currentLap.lapNumber > 0 && sessionData.currentLap.telemetryPoints.length > 0) {
          // Get lap time from iRacing telemetry
          const lapTime = telemetry.lapLastLapTime || 0

          // Only update lap time if we have a valid value
          if (lapTime > 0) {
            sessionData.currentLap.lapTime = lapTime
            sessionData.currentLap.lapTimeFormatted = formatLapTime(lapTime)

            // Check if it's the fastest lap (only count valid racing laps, not sighting lap)
            if (fastestLapTime === 0 || lapTime < fastestLapTime) {
              fastestLapTime = lapTime
              sessionData.fastestLap = lapTime
            }
          } else {
            // If iRacing didn't provide lap time, calculate from telemetry points
            const points = sessionData.currentLap.telemetryPoints
            if (points.length > 1) {
              const firstPoint = points[0]
              const lastPoint = points[points.length - 1]
              const calculatedTime = (lastPoint.timestamp - firstPoint.timestamp) / 1000

              if (calculatedTime > 0) {
                sessionData.currentLap.lapTime = calculatedTime
                sessionData.currentLap.lapTimeFormatted = formatLapTime(calculatedTime)

                if (fastestLapTime === 0 || calculatedTime < fastestLapTime) {
                  fastestLapTime = calculatedTime
                  sessionData.fastestLap = calculatedTime
                }
              }
            }
          }

          // Only add completed laps that have valid lap times (excludes sighting lap)
          console.log('[TELEMETRY] ✓ Lap completed:', sessionData.currentLap.lapNumber, '-', sessionData.currentLap.lapTimeFormatted, '(' + sessionData.currentLap.telemetryPoints.length + ' points)')
          sessionData.laps.push(sessionData.currentLap)

          // Track drill progress if active
          if (activeDrill && sessionData.currentLap.lapTime > 0) {
            // Check if this lap should count for the drill (after drill started)
            if (sessionData.currentLap.lapNumber >= drillProgress.startLapNumber) {
              drillProgress.lapTimes.push(sessionData.currentLap.lapTime)
              drillProgress.lapsCompleted = drillProgress.lapTimes.length
              drillProgress.totalTime = drillProgress.lapTimes.reduce((sum, t) => sum + t, 0)

              // Calculate delta vs expected pace
              const expectedPace = (activeDrill.targetTime / activeDrill.targetLaps) * drillProgress.lapsCompleted
              const delta = drillProgress.totalTime - expectedPace

              console.log('[DRILL] Lap', drillProgress.lapsCompleted, '/', activeDrill.targetLaps,
                '- Total:', drillProgress.totalTime.toFixed(3),
                '- Delta:', (delta >= 0 ? '+' : '') + delta.toFixed(3))

              // Send drill update to overlay
              if (overlayWindow) {
                overlayWindow.webContents.send('drill-update', {
                  active: true,
                  type: activeDrill.type,
                  targetTime: activeDrill.targetTime,
                  targetLaps: activeDrill.targetLaps,
                  lapsCompleted: drillProgress.lapsCompleted,
                  totalTime: drillProgress.totalTime,
                  delta: delta
                })
              }

              // Check if drill is complete
              if (drillProgress.lapsCompleted >= activeDrill.targetLaps) {
                console.log('[DRILL] ✓ Drill complete! Total time:', drillProgress.totalTime.toFixed(3),
                  '- Target:', activeDrill.targetTime.toFixed(3),
                  '- Delta:', (drillProgress.totalTime - activeDrill.targetTime).toFixed(3))

                // Send completion to main window for API call
                if (mainWindow) {
                  mainWindow.webContents.send('drill-complete', {
                    drillId: activeDrill.id,
                    actualTime: drillProgress.totalTime,
                    lapsCompleted: drillProgress.lapsCompleted,
                    delta: drillProgress.totalTime - activeDrill.targetTime
                  })
                }

                // Send completion to overlay
                if (overlayWindow) {
                  overlayWindow.webContents.send('drill-complete', {
                    actualTime: drillProgress.totalTime,
                    targetTime: activeDrill.targetTime,
                    delta: drillProgress.totalTime - activeDrill.targetTime,
                    beatTarget: drillProgress.totalTime <= activeDrill.targetTime
                  })
                }

                // Stop real-time delta updates
                stopDrillDeltaUpdates()

                // Clear drill state
                activeDrill = null
                drillProgress = {
                  lapsCompleted: 0,
                  lapTimes: [],
                  totalTime: 0,
                  startLapNumber: 0
                }
              }
            }
          }
        }

        // Start new lap (skip lap 0/sighting lap in display, but still track it)
        console.log('[TELEMETRY] Starting lap:', telemetry.lapNumber)
        sessionData.currentLap = {
          lapNumber: telemetry.lapNumber,
          lapTime: 0,
          lapTimeFormatted: '00:00.000',
          telemetryPoints: [],
          isSightingLap: telemetry.lapNumber === 0
        }

        lastLapNumber = telemetry.lapNumber
      }

      // Record telemetry point
      if (sessionData.currentLap && telemetry.isOnTrack) {
        const pointCount = sessionData.currentLap.telemetryPoints.length

        // Log speed values periodically to diagnose units (every 50 points ~ 5 seconds)
        if (pointCount % 50 === 0) {
          console.log('[TELEMETRY] Speed sample:', {
            rawSpeed: telemetry.speed,
            lapDistPct: (telemetry.lapDistPct * 100).toFixed(1) + '%',
            gear: telemetry.gear,
            throttle: (telemetry.throttle * 100).toFixed(0) + '%',
            note: 'If speed is 50-200, units are likely m/s. If 180-320, units are likely km/h.'
          })
        }

        sessionData.currentLap.telemetryPoints.push({
          timestamp: Date.now(),
          sessionTime: telemetry.sessionTime || 0,
          speed: telemetry.speed || 0,
          throttle: telemetry.throttle || 0,
          brake: telemetry.brake || 0,
          steering: telemetry.steering || 0,
          gear: telemetry.gear || 0,
          rpm: telemetry.rpm || 0,
          lap: telemetry.lapNumber || 0,
          lapTime: telemetry.lapCurrentLapTime || 0,
          lapDistPct: telemetry.lapDistPct || 0,  // Lap distance as percentage (0-1)
          trackLength: telemetry.trackLength || 0  // Track length in km from iRacing
        })
      }

      // Track fastest lap
      if (telemetry.lapLastLapTime > 0) {
        if (fastestLapTime === 0 || telemetry.lapLastLapTime < fastestLapTime) {
          fastestLapTime = telemetry.lapLastLapTime
          sessionData.fastestLap = fastestLapTime
        }
      }

      // Send overlay updates
      if (overlayWindow) {
        const overlayData = {
          speed: telemetry.speed || 0,
          lapTime: telemetry.lapCurrentLapTime || 0,
          fastestLapTime: fastestLapTime
        }
        overlayWindow.webContents.send('telemetry-update', overlayData)
      }

    } catch (error) {
      // Ignore telemetry errors, will retry
    }
  }, 100)

  // Real-time drill delta updates (every 5 seconds)
  // This provides in-lap feedback on how the driver is performing vs target
  startDrillDeltaUpdates()
}

/**
 * Start real-time delta updates for active drills
 * Updates the overlay with current delta every 5 seconds during a lap
 */
function startDrillDeltaUpdates() {
  // Clear any existing interval
  if (drillDeltaUpdateInterval) {
    clearInterval(drillDeltaUpdateInterval)
  }

  drillDeltaUpdateInterval = setInterval(async () => {
    // Only update if recording, drill is active, and overlay exists
    if (!recordingStatus.isRecording || !activeDrill || !overlayWindow) {
      return
    }

    // Only send updates during active drills (not pending)
    if (activeDrill.status === 'pending') {
      return
    }

    try {
      // Fetch current telemetry to get current lap time
      const response = await fetch('http://127.0.0.1:5555/telemetry')
      const telemetry = await response.json()

      // Only calculate delta if we're on track and in a valid lap
      if (!telemetry.isOnTrack || !sessionData.currentLap) {
        return
      }

      // Calculate running delta: where we are now vs where we should be
      const completedTime = drillProgress.totalTime // Sum of finished laps
      const currentLapTime = telemetry.lapCurrentLapTime || 0 // Current lap in progress
      const totalTimeRightNow = completedTime + currentLapTime

      // Calculate expected pace at this exact moment
      const lapsCompleted = drillProgress.lapsCompleted
      const avgLapTarget = activeDrill.targetTime / activeDrill.targetLaps

      // Estimate fraction of current lap completed
      // This is approximate - we use current lap time / expected lap time
      const fractionOfCurrentLap = avgLapTarget > 0 ? Math.min(currentLapTime / avgLapTarget, 1.0) : 0
      const expectedPaceNow = avgLapTarget * (lapsCompleted + fractionOfCurrentLap)

      const realtimeDelta = totalTimeRightNow - expectedPaceNow

      // Send to overlay with real-time delta
      overlayWindow.webContents.send('drill-update', {
        active: true,
        pending: false,
        type: activeDrill.type,
        targetTime: activeDrill.targetTime,
        targetLaps: activeDrill.targetLaps,
        lapsCompleted: drillProgress.lapsCompleted,
        totalTime: totalTimeRightNow, // Include current lap progress
        delta: realtimeDelta
      })
    } catch (error) {
      // Ignore errors - telemetry might be temporarily unavailable
    }
  }, 5000) // Every 5 seconds
}

/**
 * Stop drill delta update interval
 */
function stopDrillDeltaUpdates() {
  if (drillDeltaUpdateInterval) {
    clearInterval(drillDeltaUpdateInterval)
    drillDeltaUpdateInterval = null
  }
}

function formatLapTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function stopPollingTelemetry() {
  if (telemetryPollInterval) {
    clearInterval(telemetryPollInterval)
    telemetryPollInterval = null
  }
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval)
    statusCheckInterval = null
  }
  // Also stop drill delta updates
  stopDrillDeltaUpdates()
}

async function startIRacingRecording() {
  if (recordingStatus.isConnected) {
    recordingStatus.isRecording = true

    // Reset session data
    sessionData = {
      trackName: null,
      carName: null,
      fastestLap: 0,
      duration: 0,
      startTime: Date.now(),
      laps: [],
      currentLap: null,
      trackLength: 0,  // Track length in meters
      trackTemperature: null,
      trackCondition: null
    }

    // Reset lap tracking
    lastLapNumber = 0
    fastestLapTime = 0

    // Fetch initial session data
    try {
      const response = await fetch('http://127.0.0.1:5555/session')
      const session = await response.json()

      sessionData.trackName = session.trackName || 'Unknown Track'
      sessionData.carName = session.carName || 'Unknown Car'
      sessionData.trackLength = session.trackLength || 0  // Track length in meters
      sessionData.trackTemperature = session.trackTemperature || null  // Track temperature in Celsius
      sessionData.airTemperature = session.airTemperature || null  // Air temperature in Celsius
      sessionData.trackCondition = session.trackCondition || 'dry'  // dry or wet

      console.log('[SESSION] ============ SESSION DATA FETCHED ============')
      console.log('[SESSION] Track name:', sessionData.trackName)
      console.log('[SESSION] Car name:', sessionData.carName)
      console.log('[SESSION] Track length:', sessionData.trackLength, 'meters')
      console.log('[SESSION] Track temperature:', sessionData.trackTemperature, '°C')
      console.log('[SESSION] Air temperature:', sessionData.airTemperature, '°C')
      console.log('[SESSION] Track condition:', sessionData.trackCondition)
    } catch (error) {
      console.error('Failed to fetch session data:', error)
    }

    // Destroy existing overlay to force reload with new design
    if (overlayWindow) {
      overlayWindow.destroy()
      overlayWindow = null
    }
    // Reset lock to allow new overlay creation
    overlayCreationInProgress = false

    createOverlay()

    // Ensure overlay is properly configured for fullscreen after creation
    if (overlayWindow) {
      reassertOverlayTopmost()
    }

    updateOverlayStatus()

    // Send active drill state to overlay if there's a drill in progress
    if (activeDrill && overlayWindow) {
      // Wait for overlay to be ready before sending drill data
      overlayWindow.webContents.once('did-finish-load', () => {
        if (activeDrill.status === 'pending') {
          overlayWindow.webContents.send('drill-update', {
            active: true,
            pending: true,
            type: activeDrill.type,
            targetLaps: activeDrill.targetLaps,
            lapsCompleted: 0,
            totalTime: 0
          })
        } else {
          overlayWindow.webContents.send('drill-update', {
            active: true,
            pending: false,
            type: activeDrill.type,
            targetTime: activeDrill.targetTime,
            targetLaps: activeDrill.targetLaps,
            lapsCompleted: drillProgress.lapsCompleted,
            totalTime: drillProgress.totalTime,
            delta: drillProgress.totalTime > 0
              ? drillProgress.totalTime - (activeDrill.targetTime / activeDrill.targetLaps) * drillProgress.lapsCompleted
              : 0
          })
        }
      })
    }

    // Notify main window of status change
    if (mainWindow) {
      mainWindow.webContents.send('iracing-status-changed', recordingStatus)
    }
  }
}

function stopIRacingRecording() {
  console.log('[TELEMETRY] ============ STOP RECORDING ============')
  console.log('[TELEMETRY] Total laps captured:', sessionData.laps.length)
  console.log('[TELEMETRY] Current lap in progress:', sessionData.currentLap ? 'Yes' : 'No')

  recordingStatus.isRecording = false

  // DO NOT reset auto-start flag - recording should only happen once per session
  // User can manually start recording again if needed
  wasOnTrack = false

  // Complete current lap if exists
  if (sessionData.currentLap && sessionData.currentLap.telemetryPoints.length > 0) {
    console.log('[TELEMETRY] Completing current lap:', sessionData.currentLap.lapNumber, 'with', sessionData.currentLap.telemetryPoints.length, 'telemetry points')
    sessionData.laps.push(sessionData.currentLap)
    sessionData.currentLap = null
  }

  console.log('[TELEMETRY] Final lap count:', sessionData.laps.length)

  if (overlayWindow) {
    // Don't hide overlay, just update status - user might want to start again
    // overlayWindow.hide()
  }

  updateOverlayStatus()

  // Calculate session duration
  if (sessionData.startTime) {
    sessionData.duration = Math.round((Date.now() - sessionData.startTime) / 1000 / 60) // minutes
  }

  // Format fastest lap time (MM:SS.mmm)
  let fastestLapFormatted = '--:--:---'
  if (sessionData.fastestLap > 0) {
    const mins = Math.floor(sessionData.fastestLap / 60)
    const secs = Math.floor(sessionData.fastestLap % 60)
    const ms = Math.floor((sessionData.fastestLap % 1) * 1000)
    fastestLapFormatted = `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  // Map track name to track ID (convert iRacing track names to our IDs)
  let trackId = 'silverstone-gp' // default
  const trackLower = (sessionData.trackName || '').toLowerCase()

  console.log('[TELEMETRY] ============ TRACK DETECTION ============')
  console.log('[TELEMETRY] Raw track name from iRacing:', sessionData.trackName)
  console.log('[TELEMETRY] Lowercase for matching:', trackLower)

  if (trackLower.includes('brands')) trackId = 'brands-hatch'
  else if (trackLower.includes('monza')) trackId = 'monza'
  else if (trackLower.includes('spa')) trackId = 'spa'
  else if (trackLower.includes('silverstone')) {
    // Detect Silverstone variant
    // iRacing uses format like "Silverstone Circuit - National" or "Silverstone Circuit - Grand Prix"
    console.log('[TELEMETRY] Silverstone detected, checking variant...')

    // Check for National first (more specific)
    if (trackLower.includes('national')) {
      trackId = 'silverstone-national'
      console.log('[TELEMETRY] ✓ Matched: Silverstone National')
    }
    // Check for International (separate track, not in our list yet)
    else if (trackLower.includes('international')) {
      trackId = 'silverstone-gp' // Default to GP for now
      console.log('[TELEMETRY] ⚠ Silverstone International detected, mapping to GP (not in track list)')
    }
    // Check for Grand Prix
    else if (trackLower.includes('grand prix') || trackLower.includes('gp')) {
      trackId = 'silverstone-gp'
      console.log('[TELEMETRY] ✓ Matched: Silverstone Grand Prix')
    }
    // If none of the specific variants are found, try to determine from track length or default
    else {
      // Silverstone National is ~2.6km, GP is ~5.9km
      // Use track length to differentiate if available
      const trackLengthKm = (sessionData.trackLength || 0) / 1000
      if (trackLengthKm > 0) {
        if (trackLengthKm < 4) {
          trackId = 'silverstone-national'
          console.log('[TELEMETRY] ✓ Matched via track length (' + trackLengthKm.toFixed(2) + ' km): Silverstone National')
        } else {
          trackId = 'silverstone-gp'
          console.log('[TELEMETRY] ✓ Matched via track length (' + trackLengthKm.toFixed(2) + ' km): Silverstone Grand Prix')
        }
      } else {
        trackId = 'silverstone-gp' // Default to GP if variant unclear
        console.log('[TELEMETRY] ⚠ No variant keyword found, defaulting to GP')
      }
    }
  }

  console.log('[TELEMETRY] Final track ID:', trackId)

  // Prepare telemetry data for activity creation in new format
  const telemetryData = {
    sessionData: {
      trackName: sessionData.trackName,
      carName: sessionData.carName,
      sessionType: 'Practice',
      totalLaps: sessionData.laps.length,
      fastestLapTime: fastestLapTime,
      sessionDuration: sessionData.duration,
      trackLength: sessionData.trackLength,  // Track length in meters
      trackTemperature: sessionData.trackTemperature,  // Track temperature in Celsius
      airTemperature: sessionData.airTemperature,  // Air temperature in Celsius
      trackCondition: sessionData.trackCondition  // dry or wet
    },
    lapData: sessionData.laps.map(lap => ({
      lapNumber: lap.lapNumber,
      lapTime: lap.lapTime,
      lapTimeFormatted: lap.lapTimeFormatted,
      telemetryPoints: lap.telemetryPoints
    })),
    referenceLap: null // Will be populated later when reference data is available
  }

  console.log('[TELEMETRY] ============ TELEMETRY DATA PREPARED ============')
  console.log('[TELEMETRY] Track:', sessionData.trackName, '→', trackId)
  console.log('[TELEMETRY] Car:', sessionData.carName)
  console.log('[TELEMETRY] Duration:', sessionData.duration, 'minutes')
  console.log('[TELEMETRY] Fastest lap:', fastestLapFormatted)
  console.log('[TELEMETRY] Lap data array length:', telemetryData.lapData.length)
  console.log('[TELEMETRY] Lap details:')
  telemetryData.lapData.forEach((lap, index) => {
    console.log(`[TELEMETRY]   Lap ${lap.lapNumber}: ${lap.lapTimeFormatted} (${lap.telemetryPoints.length} points)`)
  })
  const telemetrySize = JSON.stringify(telemetryData).length
  console.log('[TELEMETRY] Total telemetry payload size:', (telemetrySize / 1024 / 1024).toFixed(2), 'MB')

  // Navigate to activities page with pre-populated data
  if (mainWindow) {
    // Show the main window if it's hidden and restore it if minimized
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }

    // Force the window to be on top of iRacing (similar to overlay strategy)
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.focus()

    // Reset alwaysOnTop after a short delay so it doesn't stay on top forever
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.setAlwaysOnTop(false)
      }
    }, 3000)

    // Prepare navigation parameters (do NOT embed full telemetry in the URL)
    // We'll navigate with small params and send the full telemetry via IPC
    const params = new URLSearchParams({
      track: trackId,
      car: sessionData.carName || '',
      fastestLap: fastestLapFormatted,
      duration: sessionData.duration.toString()
    })

    // Navigate after a short delay to ensure window is ready and visible
    setTimeout(() => {
      if (mainWindow && mainWindow.webContents) {
        const navigationUrl = `/activities?${params.toString()}`
        console.log('Navigating to:', navigationUrl)

        // Send navigation without telemetry payload
        mainWindow.webContents.send('navigate', navigationUrl)

        // Send the full telemetry payload via IPC on a separate channel. This
        // avoids encoding huge JSON into the URL which can cause renderer
        // problems or exceed URL length limits.
        try {
          // Write the full telemetry JSON to a temporary file and send the path
          // to the renderer. This avoids transmitting huge JSON blobs over IPC
          // which can cause renderer crashes for very large payloads.
          const tmpDir = os.tmpdir()
          const filename = `forseti_iracing_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.json`
          const filePath = path.join(tmpDir, filename)

          try {
            fs.writeFileSync(filePath, JSON.stringify(telemetryData))
            console.log('[TELEMETRY] ✓ Telemetry file written:', filePath)
            console.log('[TELEMETRY] ✓ Sending IPC message: iracing-session-file')
            mainWindow.webContents.send('iracing-session-file', filePath)
            console.log('[TELEMETRY] ✓ IPC message sent successfully')
          } catch (writeErr) {
            console.error('[TELEMETRY] ✗ Failed to write telemetry temp file:', writeErr)
            console.log('[TELEMETRY] Falling back to direct IPC send')
            // Fallback: attempt to send the payload directly
            mainWindow.webContents.send('iracing-session', telemetryData)
            console.log('[TELEMETRY] ✓ Direct IPC message sent')
          }
        } catch (e) {
          console.error('[TELEMETRY] ✗ Failed to send iracing-session IPC or file:', e)
        }

        mainWindow.webContents.send('iracing-status-changed', recordingStatus)
      }
    }, 500)
  }
}

function updateOverlayStatus() {
  if (overlayWindow) {
    overlayWindow.webContents.send('recording-status', recordingStatus)
  }
}

// Register global keyboard shortcuts
function registerGlobalShortcuts() {
  // Register Ctrl+Shift+F to start/stop recording when iRacing is detected
  // Changed from Ctrl+F to Ctrl+Shift+F to avoid conflict with iRacing fullscreen
  const ret = globalShortcut.register('CommandOrControl+Shift+F', () => {
    console.log('Ctrl+Shift+F pressed')

    // Check if iRacing is connected
    if (recordingStatus.isConnected) {
      // Toggle recording
      if (recordingStatus.isRecording) {
        console.log('Stopping recording via hotkey')
        stopIRacingRecording()
      } else {
        console.log('Starting recording via hotkey')
        startIRacingRecording()
      }
    } else {
      console.log('iRacing not connected, cannot start recording')

      // Optionally show notification to user
      if (mainWindow) {
        mainWindow.webContents.send('show-notification', {
          type: 'warning',
          message: 'iRacing not detected. Please start iRacing first.'
        })
      }
    }
  })

  if (!ret) {
    console.log('Failed to register global shortcut Ctrl+Shift+F')
  } else {
    console.log('Global shortcut Ctrl+Shift+F registered successfully')
  }
}

// Unregister shortcuts when app quits
function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll()
}

// Setup IPC handlers before app is ready
setupIPCHandlers()

// Allow renderer to request temp telemetry file contents
ipcMain.handle('read-temp-file', async (event, filePath) => {
  try {
    // Basic validation: ensure file is in OS temp dir for safety
    const tmpDir = os.tmpdir()
    if (!filePath || typeof filePath !== 'string' || !filePath.startsWith(tmpDir)) {
      throw new Error('Invalid temp file path')
    }

    const content = fs.readFileSync(filePath, 'utf8')
    // Optionally delete after reading to avoid accumulation
    try { fs.unlinkSync(filePath) } catch (e) { /* ignore */ }
    return content
  } catch (error) {
    console.error('Failed to read temp telemetry file:', error)
    throw error
  }
})

/**
 * Initialize auto-updater for production builds
 * Checks for updates on startup and periodically
 */
function initializeAutoUpdater() {
  log.info('Initializing auto-updater...')

  // Check for updates after a short delay to allow app to initialize
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log.error('Auto-update check failed:', err)
    })
  }, 10000) // 10 second delay

  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log.error('Periodic auto-update check failed:', err)
    })
  }, 4 * 60 * 60 * 1000)

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...')
    sendUpdateStatusToRenderer('checking')
  })

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    sendUpdateStatusToRenderer('available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    log.info('No updates available, current version:', info.version)
    sendUpdateStatusToRenderer('not-available')
  })

  autoUpdater.on('download-progress', (progressObj) => {
    log.info(`Download progress: ${progressObj.percent.toFixed(1)}%`)
    sendUpdateStatusToRenderer('downloading', { percent: progressObj.percent })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    sendUpdateStatusToRenderer('downloaded', info)

    // Show notification to user
    if (mainWindow) {
      mainWindow.webContents.send('show-notification', {
        type: 'info',
        title: 'Update Ready',
        message: `Forseti ${info.version} has been downloaded. Restart to install.`
      })
    }
  })

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err)
    sendUpdateStatusToRenderer('error', { message: err.message })
  })
}

/**
 * Send update status to renderer process
 */
function sendUpdateStatusToRenderer(status, data = {}) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', { status, ...data })
  }
}

app.whenReady().then(async () => {
  // Initialize electron-store first (ESM module)
  await initStore()

  createWindow()
  createTray()

  // Register global keyboard shortcuts
  registerGlobalShortcuts()

  // Initialize iRacing integration
  initializeIRacing()

  // Initialize auto-updater (production only)
  if (!isDev && app.isPackaged) {
    initializeAutoUpdater()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuitting = true

  // Unregister global shortcuts
  unregisterGlobalShortcuts()

  // Clean up all intervals to prevent interference with Explorer
  stopPollingTelemetry()
  stopPythonRetryInterval()

  if (overlayReassertInterval) {
    clearInterval(overlayReassertInterval)
    overlayReassertInterval = null
  }

  // Close overlay window
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }

  // Close Python install prompt window
  if (pythonInstallWindow) {
    pythonInstallWindow.close()
    pythonInstallWindow = null
  }

  // Kill Python bridge process
  if (pythonBridgeProcess) {
    pythonBridgeProcess.kill()
    pythonBridgeProcess = null
  }
})

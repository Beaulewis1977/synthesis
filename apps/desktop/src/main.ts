import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { checkDocker, getDockerLogs, isPortInUse, startSynthesis, stopSynthesis } from './docker';
import { healthCheck } from './health';
import type { StartResult, StatusUpdate, StopResult, SynthesisStatus } from './preload';
import {
  type ProcessInfo,
  checkNode,
  checkPnpm,
  checkPrerequisites,
  getProcessLogs,
  loadEnvForDirectMode,
  startDirectMode,
  stopDirectMode,
} from './process';

// Application state
let controlWindow: BrowserWindow | null = null;
let webUIWindow: BrowserWindow | null = null;
let currentStatus: SynthesisStatus = 'stopped';
let statusMessage: string | undefined;
let isQuitting = false;

// Direct mode state
let currentMode: 'docker' | 'direct' = 'docker';
let runningProcesses: ProcessInfo[] = [];

// Phase 4: Service status monitoring
interface SimpleServiceStatus {
  db: 'running' | 'stopped' | 'error';
  server: 'running' | 'stopped' | 'error';
  web: 'running' | 'stopped' | 'error';
  mcp: 'running' | 'stopped' | 'error';
}

interface RecentEvent {
  timestamp: string;
  service: string;
  message: string;
}

let serviceStatuses: SimpleServiceStatus = {
  db: 'stopped',
  server: 'stopped',
  web: 'stopped',
  mcp: 'stopped',
};

const recentEvents: RecentEvent[] = [];
const MAX_EVENTS = 50;
let healthCheckInterval: NodeJS.Timeout | null = null;

// Configuration
const SYNTHESIS_URL = process.env.SYNTHESIS_URL || 'http://localhost:5173';
const HEALTH_URL = 'http://localhost:3333/health';
const SERVER_PORT = 3333;
const WEB_PORT = 5173;
const REPO_ROOT = path.resolve(__dirname, '../../..');
const isDev = !app.isPackaged;
const MAX_LOG_PREVIEW_LENGTH = 500; // Characters to show in error dialogs

/**
 * Mode persistence
 */
const MODE_CONFIG_FILE = path.join(app.getPath('userData'), 'mode.json');

function loadMode(): 'docker' | 'direct' {
  try {
    if (fs.existsSync(MODE_CONFIG_FILE)) {
      const data = fs.readFileSync(MODE_CONFIG_FILE, 'utf-8');
      const config = JSON.parse(data);
      return config.mode === 'direct' ? 'direct' : 'docker';
    }
  } catch (err) {
    console.error('Failed to load mode config:', err);
  }
  return 'docker'; // Default
}

function saveMode(mode: 'docker' | 'direct') {
  try {
    const dir = path.dirname(MODE_CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MODE_CONFIG_FILE, JSON.stringify({ mode }));
  } catch (err) {
    console.error('Failed to save mode config:', err);
  }
}

/**
 * Update status and notify renderer
 */
function updateStatus(status: SynthesisStatus, message?: string) {
  currentStatus = status;
  statusMessage = message;

  const update: StatusUpdate = { status, message };

  // Send to control window if it exists
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('status-update', update);
  }
}

/**
 * Add an event to recent events
 */
function addEvent(service: string, message: string) {
  const event: RecentEvent = {
    timestamp: new Date().toISOString(),
    service,
    message,
  };
  recentEvents.push(event);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.shift();
  }

  // Broadcast to renderer
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('recent-event', event);
  }
}

/**
 * Check simple service status (port-based)
 */
async function checkSimpleServiceStatus(): Promise<SimpleServiceStatus> {
  const [dbRunning, serverRunning, webRunning, mcpRunning] = await Promise.all([
    isPortInUse(5432), // PostgreSQL
    isPortInUse(SERVER_PORT), // Server
    isPortInUse(WEB_PORT), // Web
    // MCP: Check common ports
    Promise.any([isPortInUse(3001), isPortInUse(3000), isPortInUse(3334)]).catch(() => false),
  ]);

  return {
    db: dbRunning ? 'running' : 'stopped',
    server: serverRunning ? 'running' : 'stopped',
    web: webRunning ? 'running' : 'stopped',
    mcp: mcpRunning ? 'running' : 'stopped',
  };
}

/**
 * Start periodic health checks (every 10s while running)
 */
function startPeriodicHealthChecks() {
  stopPeriodicHealthChecks();

  healthCheckInterval = setInterval(async () => {
    if (currentStatus !== 'running') return;

    const prevStatuses = { ...serviceStatuses };
    serviceStatuses = await checkSimpleServiceStatus();

    // Detect crashes (service went from running to stopped/error)
    if (prevStatuses.server === 'running' && serviceStatuses.server === 'stopped') {
      addEvent('server', 'Server crashed - no longer responding');
      updateStatus('error', 'Server crashed');
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Service Crashed',
        message: 'The server has stopped responding.',
        detail: 'Click Stop and check recent events for details.',
        buttons: ['OK'],
      });
    }
  }, 10000); // Check every 10 seconds
}

/**
 * Stop periodic health checks
 */
function stopPeriodicHealthChecks() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

/**
 * Create the control window
 */
function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 800,
    height: 400,
    center: true,
    resizable: false,
    title: 'Synthesis Desktop Control',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load control UI
  const controlUIPath = path.join(__dirname, '../src/renderer/index.html');
  controlWindow.loadFile(controlUIPath);

  // Enable dev tools in development
  if (isDev) {
    controlWindow.webContents.openDevTools();
  }

  controlWindow.on('closed', () => {
    controlWindow = null;
  });
}

/**
 * Create the web UI window
 */
function createWebUIWindow() {
  if (webUIWindow && !webUIWindow.isDestroyed()) {
    webUIWindow.show();
    webUIWindow.focus();
    return;
  }

  webUIWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Synthesis',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  webUIWindow.loadURL(SYNTHESIS_URL);

  // Enable dev tools in development
  if (isDev) {
    webUIWindow.webContents.openDevTools();
  }

  webUIWindow.on('closed', () => {
    webUIWindow = null;
  });
}

/**
 * Handle start synthesis request
 */
async function handleStartSynthesis(): Promise<StartResult> {
  try {
    // Check if already running
    if (currentStatus === 'running' || currentStatus === 'starting') {
      return {
        success: false,
        error: 'Synthesis is already running or starting',
      };
    }

    updateStatus('starting', `Starting in ${currentMode} mode...`);

    if (currentMode === 'docker') {
      // ===== DOCKER MODE =====
      updateStatus('starting', 'Checking Docker availability...');

      // Check Docker is installed
      const dockerCheck = await checkDocker();
      if (!dockerCheck.available) {
        updateStatus('error', 'Docker is not available');
        await dialog.showMessageBox({
          type: 'error',
          title: 'Docker Not Found',
          message: 'Docker is not installed or not running.',
          detail:
            'Please install Docker Desktop from:\nhttps://www.docker.com/products/docker-desktop',
          buttons: ['OK'],
        });
        updateStatus('stopped');
        return {
          success: false,
          error: dockerCheck.error || 'Docker is not available',
        };
      }

      // Check if ports are available
      updateStatus('starting', 'Checking ports...');
      const serverPortInUse = await isPortInUse(SERVER_PORT);
      const webPortInUse = await isPortInUse(WEB_PORT);

      if (serverPortInUse || webPortInUse) {
        const portsInUse = [serverPortInUse && `${SERVER_PORT}`, webPortInUse && `${WEB_PORT}`]
          .filter(Boolean)
          .join(', ');

        updateStatus('error', `Ports in use: ${portsInUse}`);
        await dialog.showMessageBox({
          type: 'error',
          title: 'Port Conflict',
          message: `Required ports are already in use: ${portsInUse}`,
          detail:
            'Close any applications using these ports and try again.\n\nYou can find processes using ports with:\nlsof -i :PORT',
          buttons: ['OK'],
        });
        updateStatus('stopped');
        return {
          success: false,
          error: `Ports in use: ${portsInUse}`,
        };
      }

      // Start Docker Compose
      updateStatus('starting', 'Starting Docker services...');
      const startResult = await startSynthesis(REPO_ROOT);

      if (!startResult.success) {
        updateStatus('error', 'Failed to start Docker services');
        await dialog.showMessageBox({
          type: 'error',
          title: 'Docker Start Failed',
          message: 'Failed to start Docker services',
          detail: startResult.error || 'Unknown error',
          buttons: ['OK'],
        });
        updateStatus('stopped');
        return {
          success: false,
          error: startResult.error,
        };
      }

      // Wait for backend to be healthy
      updateStatus('starting', 'Waiting for backend to be ready...');
      const healthResult = await healthCheck(HEALTH_URL, 60000, 2000, (attempt, maxAttempts) => {
        updateStatus('starting', `Health check: attempt ${attempt}/${maxAttempts}...`);
      });

      if (!healthResult.healthy) {
        updateStatus('error', 'Backend failed to start');

        // Get Docker logs for troubleshooting
        const logsResult = await getDockerLogs(REPO_ROOT, 'synthesis-server');
        const logs = logsResult.success ? logsResult.logs : 'Unable to retrieve logs';

        await dialog.showMessageBox({
          type: 'error',
          title: 'Backend Failed to Start',
          message: 'The backend service failed to become healthy within 60 seconds.',
          detail: `Error: ${healthResult.error}\n\nRecent logs:\n${logs?.slice(-MAX_LOG_PREVIEW_LENGTH)}`,
          buttons: ['OK'],
        });
        updateStatus('stopped');
        return {
          success: false,
          error: healthResult.error,
        };
      }

      // Success! Open web UI
      updateStatus('running', 'Synthesis is running (Docker mode)');
      addEvent('system', 'Synthesis started successfully in Docker mode');
      createWebUIWindow();
      startPeriodicHealthChecks();

      return { success: true };
    }
    // ===== DIRECT MODE =====
    updateStatus('starting', 'Checking Node.js...');
    const nodeCheck = await checkNode();
    if (!nodeCheck.available) {
      updateStatus('error', 'Node.js not available');
      await dialog.showMessageBox({
        type: 'error',
        title: 'Node.js Not Found',
        message: 'Node.js 22+ is required for Direct mode.',
        detail: nodeCheck.error || 'Please install Node.js LTS from:\nhttps://nodejs.org',
        buttons: ['OK'],
      });
      updateStatus('stopped');
      return {
        success: false,
        error: nodeCheck.error,
      };
    }

    updateStatus('starting', 'Checking pnpm...');
    const pnpmCheck = await checkPnpm();
    if (!pnpmCheck.available) {
      updateStatus('error', 'pnpm not available');
      await dialog.showMessageBox({
        type: 'error',
        title: 'pnpm Not Found',
        message: 'pnpm is required for Direct mode.',
        detail: 'Install with:\n  npm install -g pnpm',
        buttons: ['OK'],
      });
      updateStatus('stopped');
      return {
        success: false,
        error: pnpmCheck.error,
      };
    }

    // Check prerequisites (DB + Ollama)
    updateStatus('starting', 'Checking prerequisites...');
    const prereqs = await checkPrerequisites();
    if (!prereqs.ready) {
      updateStatus('error', 'Prerequisites not met');
      await dialog.showMessageBox({
        type: 'error',
        title: 'Prerequisites Not Met',
        message: 'Direct mode requires DB and Ollama to be running.',
        detail: `${prereqs.error}\n\nStart them with:\n  docker compose up -d synthesis-db synthesis-ollama`,
        buttons: ['OK'],
      });
      updateStatus('stopped');
      return {
        success: false,
        error: prereqs.error,
      };
    }

    // Load .env file
    updateStatus('starting', 'Loading environment...');
    const envResult = loadEnvForDirectMode(REPO_ROOT);
    if (!envResult.success) {
      updateStatus('error', '.env file not found');
      await dialog.showMessageBox({
        type: 'error',
        title: 'Missing .env File',
        message: 'Direct mode requires .env file with configuration.',
        detail: 'Copy .env.example to .env and configure API keys.',
        buttons: ['OK'],
      });
      updateStatus('stopped');
      return {
        success: false,
        error: envResult.error,
      };
    }

    // Show warning if critical vars missing (but continue)
    if (envResult.warnings?.length) {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Environment Variables Missing',
        message: `Some environment variables are not set:\n${envResult.warnings.join('\n')}`,
        detail: 'Services may fail to start. Check your .env file.',
        buttons: ['Continue Anyway'],
      });
    }

    // Check if ports are available
    updateStatus('starting', 'Checking ports...');
    const serverPortInUse = await isPortInUse(SERVER_PORT);
    const webPortInUse = await isPortInUse(WEB_PORT);

    if (serverPortInUse || webPortInUse) {
      const portsInUse = [serverPortInUse && `${SERVER_PORT}`, webPortInUse && `${WEB_PORT}`]
        .filter(Boolean)
        .join(', ');

      updateStatus('error', `Ports in use: ${portsInUse}`);
      await dialog.showMessageBox({
        type: 'error',
        title: 'Port Conflict',
        message: `Required ports are already in use: ${portsInUse}`,
        detail: 'Close any applications using these ports and try again.',
        buttons: ['OK'],
      });
      updateStatus('stopped');
      return {
        success: false,
        error: `Ports in use: ${portsInUse}`,
      };
    }

    // Start processes
    updateStatus('starting', 'Starting services...');
    const startResult = await startDirectMode(
      REPO_ROOT,
      envResult.env || {},
      (_service, _data) => {}
    );

    if (!startResult.success) {
      updateStatus('error', 'Failed to start services');
      await dialog.showMessageBox({
        type: 'error',
        title: 'Start Failed',
        message: 'Failed to start Synthesis services',
        detail: startResult.error || 'Unknown error',
        buttons: ['OK'],
      });
      updateStatus('stopped');
      return {
        success: false,
        error: startResult.error,
      };
    }

    runningProcesses = startResult.processes || [];

    // Wait for backend health
    updateStatus('starting', 'Waiting for backend...');
    const healthResult = await healthCheck(HEALTH_URL, 60000, 2000, (attempt, maxAttempts) => {
      updateStatus('starting', `Health check: attempt ${attempt}/${maxAttempts}...`);
    });

    if (!healthResult.healthy) {
      updateStatus('error', 'Backend failed to start');
      const logs = await getProcessLogs('server');
      await dialog.showMessageBox({
        type: 'error',
        title: 'Backend Failed',
        message: 'The backend failed to become healthy within 60 seconds.',
        detail: `Error: ${healthResult.error}\n\nLogs:\n${logs.logs?.slice(-MAX_LOG_PREVIEW_LENGTH) || 'No logs'}`,
        buttons: ['OK'],
      });
      await stopDirectMode(runningProcesses);
      runningProcesses = [];
      updateStatus('stopped');
      return {
        success: false,
        error: healthResult.error,
      };
    }

    // Success
    updateStatus('running', 'Synthesis is running (Direct mode)');
    addEvent('system', 'Synthesis started successfully in Direct mode');
    createWebUIWindow();
    startPeriodicHealthChecks();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    updateStatus('error', errorMessage);
    await dialog.showMessageBox({
      type: 'error',
      title: 'Unexpected Error',
      message: 'An unexpected error occurred while starting Synthesis',
      detail: errorMessage,
      buttons: ['OK'],
    });
    updateStatus('stopped');
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle stop synthesis request
 */
async function handleStopSynthesis(): Promise<StopResult> {
  try {
    updateStatus('stopped', 'Stopping services...');
    stopPeriodicHealthChecks();

    // Close web UI window if open
    if (webUIWindow && !webUIWindow.isDestroyed()) {
      webUIWindow.close();
    }

    if (currentMode === 'docker') {
      // Stop Docker Compose
      const stopResult = await stopSynthesis(REPO_ROOT);

      if (!stopResult.success) {
        updateStatus('error', 'Failed to stop Docker services');
        await dialog.showMessageBox({
          type: 'error',
          title: 'Docker Stop Failed',
          message: 'Failed to stop Docker services',
          detail: stopResult.error || 'Unknown error',
          buttons: ['OK'],
        });
        return { success: false };
      }
    } else {
      // Stop Direct mode processes
      const stopResult = await stopDirectMode(runningProcesses);
      runningProcesses = [];

      if (!stopResult.success) {
        updateStatus('error', 'Failed to stop processes');
        return { success: false };
      }
    }

    updateStatus('stopped', 'Services stopped');
    addEvent('system', 'Synthesis stopped successfully');
    // Reset service statuses
    serviceStatuses = {
      db: 'stopped',
      server: 'stopped',
      web: 'stopped',
      mcp: 'stopped',
    };
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    updateStatus('error', errorMessage);
    return { success: false };
  }
}

/**
 * Setup IPC handlers
 */
function setupIPCHandlers() {
  ipcMain.handle('start-synthesis', handleStartSynthesis);
  ipcMain.handle('stop-synthesis', handleStopSynthesis);
  ipcMain.handle('get-status', () => ({ status: currentStatus, message: statusMessage }));
  ipcMain.handle('open-web-ui', () => {
    if (currentStatus === 'running') {
      createWebUIWindow();
    }
  });
  ipcMain.handle('show-logs', async () => {
    const logsResult = await getDockerLogs(REPO_ROOT);
    if (logsResult.success) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Docker Logs',
        message: 'Recent Docker Compose Logs',
        detail: logsResult.logs || 'No logs available',
        buttons: ['OK'],
      });
    } else {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Failed to Get Logs',
        message: 'Could not retrieve Docker logs',
        detail: logsResult.error || 'Unknown error',
        buttons: ['OK'],
      });
    }
  });

  // Mode management
  ipcMain.handle('set-mode', async (_event, mode: 'docker' | 'direct') => {
    if (currentStatus === 'running' || currentStatus === 'starting') {
      return {
        success: false,
        error: 'Stop Synthesis before changing modes',
      };
    }
    currentMode = mode;
    saveMode(mode);
    return { success: true, mode };
  });

  ipcMain.handle('get-mode', () => ({ mode: currentMode }));

  // Phase 4: Service status and events
  ipcMain.handle('get-service-status', async () => {
    // If running, get current status; otherwise return stopped
    if (currentStatus === 'running') {
      return await checkSimpleServiceStatus();
    }
    return serviceStatuses;
  });

  ipcMain.handle('get-recent-events', () => {
    return recentEvents;
  });
}

/**
 * Check if services are already running on startup
 */
async function checkInitialStatus() {
  const [serverRunning, webRunning] = await Promise.all([
    isPortInUse(SERVER_PORT),
    isPortInUse(WEB_PORT),
  ]);

  if (serverRunning && webRunning) {
    // Check if backend is actually healthy
    const health = await healthCheck(HEALTH_URL, 5000, 1000);
    if (health.healthy) {
      updateStatus('running', 'Synthesis is already running');
      addEvent('system', 'Detected running services on startup');
      startPeriodicHealthChecks();
    }
  }
}

/**
 * App lifecycle
 */
app.on('ready', async () => {
  currentMode = loadMode(); // Load saved mode
  setupIPCHandlers();
  createControlWindow();

  // Check if services are already running
  await checkInitialStatus();
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, recreate window when dock icon is clicked
  if (controlWindow === null) {
    createControlWindow();
  }
});

app.on('before-quit', async (event) => {
  // Stop services if running (prevent race condition with flag)
  if (currentStatus === 'running' && !isQuitting) {
    event.preventDefault();
    isQuitting = true;

    // Clean up based on mode
    if (currentMode === 'direct' && runningProcesses.length > 0) {
      await stopDirectMode(runningProcesses);
      runningProcesses = [];
    } else {
      await handleStopSynthesis();
    }

    app.quit();
  }
});

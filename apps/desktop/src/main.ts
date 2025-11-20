import path from 'node:path';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { checkDocker, getDockerLogs, isPortInUse, startSynthesis, stopSynthesis } from './docker';
import { healthCheck } from './health';
import type { StartResult, StatusUpdate, StopResult, SynthesisStatus } from './preload';

// Application state
let controlWindow: BrowserWindow | null = null;
let webUIWindow: BrowserWindow | null = null;
let currentStatus: SynthesisStatus = 'stopped';
let statusMessage: string | undefined;

// Configuration
const SYNTHESIS_URL = process.env.SYNTHESIS_URL || 'http://localhost:5173';
const HEALTH_URL = 'http://localhost:3333/health';
const SERVER_PORT = 3333;
const WEB_PORT = 5173;
const REPO_ROOT = path.resolve(__dirname, '../../..');
const isDev = !app.isPackaged;

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
        detail: `Error: ${healthResult.error}\n\nRecent logs:\n${logs?.slice(-500)}`,
        buttons: ['OK'],
      });
      updateStatus('stopped');
      return {
        success: false,
        error: healthResult.error,
      };
    }

    // Success! Open web UI
    updateStatus('running', 'Synthesis is running');
    createWebUIWindow();

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

    // Close web UI window if open
    if (webUIWindow && !webUIWindow.isDestroyed()) {
      webUIWindow.close();
    }

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

    updateStatus('stopped', 'Services stopped');
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
}

/**
 * App lifecycle
 */
app.on('ready', () => {
  setupIPCHandlers();
  createControlWindow();
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
  // Stop Docker services if running
  if (currentStatus === 'running') {
    event.preventDefault();
    await handleStopSynthesis();
    app.quit();
  }
});

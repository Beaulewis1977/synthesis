/**
 * Main Electron process for Synthesis Desktop
 * Handles window management, IPC, and orchestration
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron';
import {
  checkDocker,
  cleanup as dockerCleanup,
  startSynthesis as dockerStart,
  stopSynthesis as dockerStop,
} from './docker.js';
import { getStackStatus, httpHealthCheck, waitForStack } from './health-check.js';
import { addLog, clearLogs, getLogs, setMainWindow } from './logger.js';
import {
  isRunning as isDevRunning,
  cleanup as processCleanup,
  startDevMode,
  stopDevMode,
} from './process-manager.js';
import type { LaunchMode, StackStatus } from './types.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Main application window */
let mainWindow: BrowserWindow | null = null;

/** Flag to track if cleanup has been performed */
let cleanupCompleted = false;

/** Current launch mode */
let launchMode: LaunchMode = 'docker';

/** Status polling interval */
let statusInterval: NodeJS.Timeout | null = null;

/** Whether the app is currently starting/stopping */
let isTransitioning = false;

/**
 * Create the main control window
 */
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    minWidth: 400,
    minHeight: 600,
    title: 'Synthesis Desktop',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload to work with IPC
    },
    show: false, // Don't show until ready
  });

  // Set the main window reference for logging
  setMainWindow(mainWindow);

  // Load the renderer HTML
  const rendererPath = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
  mainWindow.loadFile(rendererPath);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    addLog('info', 'Synthesis Desktop started', 'app');
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    setMainWindow(null);
    stopStatusPolling();
  });
}

/**
 * Open the web UI in a new window or external browser
 */
function openWebUI(): void {
  const webUrl = 'http://localhost:5173';

  // Option 1: Open in external browser (simpler, recommended)
  shell.openExternal(webUrl);

  // Option 2: Open in Electron window (commented out)
  // if (webWindow && !webWindow.isDestroyed()) {
  //   webWindow.focus();
  //   return;
  // }
  //
  // webWindow = new BrowserWindow({
  //   width: 1280,
  //   height: 800,
  //   title: 'Synthesis',
  //   webPreferences: {
  //     contextIsolation: true,
  //     nodeIntegration: false,
  //   },
  // });
  //
  // webWindow.loadURL(webUrl);
  //
  // webWindow.on('closed', () => {
  //   webWindow = null;
  // });
}

/**
 * Start status polling
 */
function startStatusPolling(): void {
  if (statusInterval) return;

  statusInterval = setInterval(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const status = await getStackStatus();
      mainWindow.webContents.send('status-update', status);
    }
  }, 5000);
}

/**
 * Stop status polling
 */
function stopStatusPolling(): void {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
}

/**
 * Start Synthesis (Docker or Dev mode)
 */
async function startSynthesis(): Promise<{ success: boolean; error?: string }> {
  if (isTransitioning) {
    return { success: false, error: 'Operation already in progress' };
  }

  isTransitioning = true;
  addLog('info', `Starting Synthesis in ${launchMode} mode...`, 'app');

  try {
    if (launchMode === 'docker') {
      // Check Docker availability
      const dockerCheck = await checkDocker();
      if (!dockerCheck.available) {
        const error = dockerCheck.error || 'Docker is not available';
        addLog('error', error, 'app');

        // Show dialog with install instructions
        if (mainWindow) {
          dialog
            .showMessageBox(mainWindow, {
              type: 'error',
              title: 'Docker Not Found',
              message: 'Docker is required to run Synthesis in Docker mode.',
              detail:
                'Please install Docker Desktop from https://docs.docker.com/get-docker/\n\n' +
                'Alternatively, switch to Dev mode if you have Node.js installed.',
              buttons: ['OK', 'Open Docker Website'],
            })
            .then((result) => {
              if (result.response === 1) {
                shell.openExternal('https://docs.docker.com/get-docker/');
              }
            });
        }

        return { success: false, error };
      }

      // Start Docker Compose
      const result = await dockerStart();
      if (!result.success) {
        return result;
      }
    } else {
      // Dev mode
      const result = await startDevMode();
      if (!result.success) {
        return result;
      }
    }

    // Start status polling
    startStatusPolling();

    // Wait for stack to be ready
    addLog('info', 'Waiting for services to be ready...', 'app');
    const ready = await waitForStack(120000, 3000);

    if (ready) {
      addLog('info', 'Synthesis is ready!', 'app');

      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        const status = await getStackStatus();
        mainWindow.webContents.send('status-update', status);
      }

      return { success: true };
    }

    addLog('warn', 'Services started but not all are healthy', 'app');
    return { success: true }; // Still consider it a success, services might be slow
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    addLog('error', `Failed to start: ${error}`, 'app');
    return { success: false, error };
  } finally {
    isTransitioning = false;
  }
}

/**
 * Stop Synthesis
 */
async function stopSynthesis(): Promise<{ success: boolean; error?: string }> {
  if (isTransitioning) {
    return { success: false, error: 'Operation already in progress' };
  }

  isTransitioning = true;
  addLog('info', 'Stopping Synthesis...', 'app');

  try {
    stopStatusPolling();

    if (launchMode === 'docker') {
      const result = await dockerStop();
      return result;
    }

    const result = await stopDevMode();
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    addLog('error', `Failed to stop: ${error}`, 'app');
    return { success: false, error };
  } finally {
    isTransitioning = false;

    // Update status
    if (mainWindow && !mainWindow.isDestroyed()) {
      const status = await getStackStatus();
      mainWindow.webContents.send('status-update', status);
    }
  }
}

/**
 * Register IPC handlers
 */
function registerIpcHandlers(): void {
  // Docker operations
  ipcMain.handle('docker:check', async () => {
    return checkDocker();
  });

  ipcMain.handle('synthesis:start', async () => {
    return startSynthesis();
  });

  ipcMain.handle('synthesis:stop', async () => {
    return stopSynthesis();
  });

  // Health checks
  ipcMain.handle('health:stack-status', async () => {
    return getStackStatus();
  });

  ipcMain.handle('health:check', async (_event, url: string) => {
    return httpHealthCheck(url);
  });

  // Mode management
  ipcMain.handle('mode:get', () => {
    return launchMode;
  });

  ipcMain.handle('mode:set', (_event, mode: LaunchMode) => {
    launchMode = mode;
    addLog('info', `Launch mode set to: ${mode}`, 'app');
  });

  // Logs
  ipcMain.handle('logs:get', () => {
    return getLogs();
  });

  ipcMain.handle('logs:clear', () => {
    clearLogs();
  });

  // UI actions
  ipcMain.on('ui:open-web', () => {
    openWebUI();
  });

  ipcMain.on('ui:open-external', (event, url: string) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol.toLowerCase();

      if (protocol === 'http:' || protocol === 'https:') {
        shell.openExternal(parsedUrl.toString());
        return;
      }

      addLog('warn', `Blocked external URL with disallowed protocol: ${url}`, 'app');
      event.reply('ui:open-external:error', 'Unsupported URL protocol');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid URL';
      addLog('warn', `Failed to open external URL "${url}": ${message}`, 'app');
      event.reply('ui:open-external:error', message);
    }
  });
}

/**
 * Clean up before exit
 */
async function cleanup(): Promise<void> {
  addLog('info', 'Cleaning up...', 'app');
  stopStatusPolling();

  // Stop any running processes
  if (isDevRunning()) {
    await processCleanup();
  }

  // Docker cleanup
  dockerCleanup();
}

// App lifecycle handlers
app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up before quit
app.on('before-quit', async (event) => {
  if (!cleanupCompleted) {
    event.preventDefault();
    await cleanup();
    cleanupCompleted = true;
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  addLog('error', `Uncaught exception: ${error.message}`, 'app');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  addLog('error', `Unhandled rejection: ${reason}`, 'app');
});

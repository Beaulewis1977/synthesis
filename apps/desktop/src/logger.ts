/**
 * Logger module for Synthesis Desktop
 * Manages application logs with level-based filtering and IPC broadcasting
 */

import type { BrowserWindow } from 'electron';
import type { LogEntry, LogLevel } from './types.js';

/** Maximum number of log entries to keep in memory */
const MAX_LOG_ENTRIES = 1000;

/** In-memory log storage */
const logs: LogEntry[] = [];

/** Reference to main window for IPC */
let mainWindow: BrowserWindow | null = null;

/**
 * Set the main window reference for IPC broadcasting
 */
export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

/**
 * Add a log entry
 */
export function addLog(level: LogLevel, message: string, source?: string): void {
  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
    source,
  };

  logs.push(entry);

  // Trim old entries if over limit
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  }

  // Broadcast to renderer if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-entry', entry);
  }

  // Also log to console in development
  const timestamp = entry.timestamp.toISOString().substring(11, 19);
  const prefix = source ? `[${source}]` : '';
  const logMessage = `[${timestamp}] ${prefix} ${message}`;

  switch (level) {
    case 'error':
      console.error(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'info':
      console.info(logMessage);
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(logMessage);
      }
      break;
  }
}

/**
 * Get all log entries
 */
export function getLogs(): LogEntry[] {
  return [...logs];
}

/**
 * Get logs filtered by level
 */
export function getLogsByLevel(level: LogLevel): LogEntry[] {
  return logs.filter((entry) => entry.level === level);
}

/**
 * Get logs filtered by source
 */
export function getLogsBySource(source: string): LogEntry[] {
  return logs.filter((entry) => entry.source === source);
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logs.length = 0;
  addLog('info', 'Logs cleared', 'system');
}

/**
 * Export logs as JSON string
 */
export function exportLogs(): string {
  return JSON.stringify(logs, null, 2);
}

/**
 * Convenience functions for different log levels
 */
export const log = {
  info: (message: string, source?: string) => addLog('info', message, source),
  warn: (message: string, source?: string) => addLog('warn', message, source),
  error: (message: string, source?: string) => addLog('error', message, source),
  debug: (message: string, source?: string) => addLog('debug', message, source),
};

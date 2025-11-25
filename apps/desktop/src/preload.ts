/**
 * Preload script for Synthesis Desktop
 * Exposes safe IPC methods to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  DockerCheckResult,
  HealthCheckResult,
  LaunchMode,
  LogEntry,
  OperationResult,
  StackStatus,
} from './types.js';

/**
 * Expose the Synthesis API to the renderer process
 * All methods use IPC to communicate with the main process
 */
contextBridge.exposeInMainWorld('synthesisAPI', {
  // Docker operations
  checkDocker: (): Promise<DockerCheckResult> => {
    return ipcRenderer.invoke('docker:check');
  },

  startSynthesis: (): Promise<OperationResult> => {
    return ipcRenderer.invoke('synthesis:start');
  },

  stopSynthesis: (): Promise<OperationResult> => {
    return ipcRenderer.invoke('synthesis:stop');
  },

  // Health checks
  getStackStatus: (): Promise<StackStatus> => {
    return ipcRenderer.invoke('health:stack-status');
  },

  healthCheck: (url: string): Promise<HealthCheckResult> => {
    return ipcRenderer.invoke('health:check', url);
  },

  // Mode management
  getLaunchMode: (): Promise<LaunchMode> => {
    return ipcRenderer.invoke('mode:get');
  },

  setLaunchMode: (mode: LaunchMode): Promise<void> => {
    return ipcRenderer.invoke('mode:set', mode);
  },

  // UI actions
  openWebUI: (): void => {
    ipcRenderer.send('ui:open-web');
  },

  openExternal: (url: string): void => {
    ipcRenderer.send('ui:open-external', url);
  },

  // Logs
  getLogs: (): Promise<LogEntry[]> => {
    return ipcRenderer.invoke('logs:get');
  },

  clearLogs: (): Promise<void> => {
    return ipcRenderer.invoke('logs:clear');
  },

  // Events - return cleanup function
  onStatusUpdate: (callback: (status: StackStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: StackStatus) => {
      callback(status);
    };
    ipcRenderer.on('status-update', handler);
    return () => {
      ipcRenderer.removeListener('status-update', handler);
    };
  },

  onLogEntry: (callback: (entry: LogEntry) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: LogEntry) => {
      callback(entry);
    };
    ipcRenderer.on('log-entry', handler);
    return () => {
      ipcRenderer.removeListener('log-entry', handler);
    };
  },

  // App info
  getVersion: (): string => {
    return process.env.npm_package_version || '1.0.0';
  },

  getPlatform: (): string => {
    return process.platform;
  },
});

/**
 * Type definitions for Synthesis Desktop
 */

/** Application status states */
export type AppStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/** Service status states */
export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'error' | 'unknown';

/** Launch mode */
export type LaunchMode = 'docker' | 'dev';

/** Log level */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/** Log entry */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  source?: string;
}

/** Service health status */
export interface ServiceHealth {
  name: string;
  port: number;
  status: ServiceStatus;
  url?: string;
  error?: string;
}

/** Stack status with all services */
export interface StackStatus {
  overall: AppStatus;
  services: {
    database: ServiceHealth;
    server: ServiceHealth;
    web: ServiceHealth;
    ollama: ServiceHealth;
    redis: ServiceHealth;
  };
}

/** Result of a command execution */
export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  code?: number;
}

/** Docker check result */
export interface DockerCheckResult {
  available: boolean;
  version?: string;
  error?: string;
}

/** Start/Stop operation result */
export interface OperationResult {
  success: boolean;
  error?: string;
}

/** Health check result */
export interface HealthCheckResult {
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

/** App configuration */
export interface AppConfig {
  launchMode: LaunchMode;
  autoStart: boolean;
  minimizeToTray: boolean;
  checkUpdates: boolean;
}

/** IPC API exposed to renderer */
export interface SynthesisAPI {
  // Docker operations
  checkDocker: () => Promise<DockerCheckResult>;
  startSynthesis: () => Promise<OperationResult>;
  stopSynthesis: () => Promise<OperationResult>;

  // Health checks
  getStackStatus: () => Promise<StackStatus>;
  healthCheck: (url: string) => Promise<HealthCheckResult>;

  // Mode management
  getLaunchMode: () => Promise<LaunchMode>;
  setLaunchMode: (mode: LaunchMode) => Promise<void>;

  // UI actions
  openWebUI: () => void;
  openExternal: (url: string) => void;

  // Logs
  getLogs: () => Promise<LogEntry[]>;
  clearLogs: () => Promise<void>;

  // Events
  onStatusUpdate: (callback: (status: StackStatus) => void) => () => void;
  onLogEntry: (callback: (entry: LogEntry) => void) => () => void;

  // App info
  getVersion: () => string;
  getPlatform: () => string;
}

/** Extend Window interface for renderer */
declare global {
  interface Window {
    synthesisAPI: SynthesisAPI;
  }
}

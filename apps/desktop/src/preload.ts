import { type IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

export type SynthesisStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface StatusUpdate {
  status: SynthesisStatus;
  message?: string;
}

export interface StartResult {
  success: boolean;
  error?: string;
}

export interface StopResult {
  success: boolean;
}

export interface SynthesisAPI {
  startSynthesis: () => Promise<StartResult>;
  stopSynthesis: () => Promise<StopResult>;
  getStatus: () => Promise<StatusUpdate>;
  openWebUI: () => Promise<void>;
  showLogs: () => Promise<void>;
  onStatusUpdate: (callback: (update: StatusUpdate) => void) => () => void;
  setMode: (
    mode: 'docker' | 'direct'
  ) => Promise<{ success: boolean; mode?: string; error?: string }>;
  getMode: () => Promise<{ mode: 'docker' | 'direct' }>;
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('synthesisAPI', {
  startSynthesis: (): Promise<StartResult> => {
    return ipcRenderer.invoke('start-synthesis');
  },

  stopSynthesis: (): Promise<StopResult> => {
    return ipcRenderer.invoke('stop-synthesis');
  },

  getStatus: (): Promise<StatusUpdate> => {
    return ipcRenderer.invoke('get-status');
  },

  openWebUI: (): Promise<void> => {
    return ipcRenderer.invoke('open-web-ui');
  },

  showLogs: (): Promise<void> => {
    return ipcRenderer.invoke('show-logs');
  },

  onStatusUpdate: (callback: (update: StatusUpdate) => void) => {
    const listener = (_event: IpcRendererEvent, update: StatusUpdate) => {
      callback(update);
    };

    ipcRenderer.on('status-update', listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('status-update', listener);
    };
  },

  setMode: (
    mode: 'docker' | 'direct'
  ): Promise<{ success: boolean; mode?: string; error?: string }> => {
    return ipcRenderer.invoke('set-mode', mode);
  },

  getMode: (): Promise<{ mode: 'docker' | 'direct' }> => {
    return ipcRenderer.invoke('get-mode');
  },
} as SynthesisAPI);

// Type declaration for global window object
declare global {
  interface Window {
    synthesisAPI: SynthesisAPI;
  }
}

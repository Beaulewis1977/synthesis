/**
 * Health check utilities for Synthesis Desktop
 * Monitors service health and provides status updates
 */

import { type Socket, createConnection } from 'node:net';
import { addLog } from './logger.js';
import type {
  AppStatus,
  HealthCheckResult,
  ServiceHealth,
  ServiceStatus,
  StackStatus,
} from './types.js';

/** Service configuration */
interface ServiceConfig {
  name: string;
  port: number;
  healthUrl?: string;
  containerName?: string;
}

/** Service definitions */
const SERVICES: Record<string, ServiceConfig> = {
  database: {
    name: 'PostgreSQL',
    port: 5432,
    containerName: 'synthesis-db',
  },
  server: {
    name: 'Server',
    port: 3333,
    healthUrl: 'http://localhost:3333/health',
    containerName: 'synthesis-server',
  },
  web: {
    name: 'Web UI',
    port: 5173,
    healthUrl: 'http://localhost:5173/',
    containerName: 'synthesis-web',
  },
  ollama: {
    name: 'Ollama',
    port: 11434,
    healthUrl: 'http://localhost:11434/api/tags',
    containerName: 'synthesis-ollama',
  },
  redis: {
    name: 'Redis',
    port: 6379,
    containerName: 'synthesis-redis',
  },
};

/**
 * Check if a port is open (TCP connection test)
 */
export function checkPort(port: number, host = 'localhost'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket: Socket = createConnection({ port, host });

    socket.setTimeout(2000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Perform HTTP health check
 */
export async function httpHealthCheck(url: string): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        healthy: true,
        responseTime,
      };
    }

    return {
      healthy: false,
      responseTime,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return {
      healthy: false,
      error: error.includes('abort') ? 'Timeout' : error,
    };
  }
}

/**
 * Check health of a specific service
 */
export async function checkServiceHealth(serviceKey: string): Promise<ServiceHealth> {
  const config = SERVICES[serviceKey];

  if (!config) {
    return {
      name: serviceKey,
      port: 0,
      status: 'unknown',
      error: 'Unknown service',
    };
  }

  // First check if port is open
  const portOpen = await checkPort(config.port);

  if (!portOpen) {
    return {
      name: config.name,
      port: config.port,
      status: 'stopped',
      url: config.healthUrl,
    };
  }

  // If service has a health URL, check it
  if (config.healthUrl) {
    const health = await httpHealthCheck(config.healthUrl);

    return {
      name: config.name,
      port: config.port,
      status: health.healthy ? 'running' : 'error',
      url: config.healthUrl,
      error: health.error,
    };
  }

  // Port is open, no health URL - assume running
  return {
    name: config.name,
    port: config.port,
    status: 'running',
  };
}

/**
 * Get full stack status
 */
export async function getStackStatus(): Promise<StackStatus> {
  const [database, server, web, ollama, redis] = await Promise.all([
    checkServiceHealth('database'),
    checkServiceHealth('server'),
    checkServiceHealth('web'),
    checkServiceHealth('ollama'),
    checkServiceHealth('redis'),
  ]);

  // Determine overall status
  const statuses = [database.status, server.status, web.status];
  let overall: AppStatus;

  if (statuses.every((s) => s === 'running')) {
    overall = 'running';
  } else if (statuses.every((s) => s === 'stopped')) {
    overall = 'stopped';
  } else if (statuses.some((s) => s === 'error')) {
    overall = 'error';
  } else if (statuses.some((s) => s === 'starting')) {
    overall = 'starting';
  } else {
    // Mixed state - some running, some stopped
    overall = 'starting';
  }

  return {
    overall,
    services: {
      database,
      server,
      web,
      ollama,
      redis,
    },
  };
}

/**
 * Wait for server to be healthy with polling
 */
export async function waitForServer(maxWaitMs = 60000, pollIntervalMs = 2000): Promise<boolean> {
  const startTime = Date.now();

  addLog('info', 'Waiting for server to be ready...', 'health');

  while (Date.now() - startTime < maxWaitMs) {
    const health = await httpHealthCheck('http://localhost:3333/health');

    if (health.healthy) {
      addLog('info', `Server ready (${health.responseTime}ms)`, 'health');
      return true;
    }

    addLog('debug', `Health check failed: ${health.error}`, 'health');

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  addLog('error', `Server not ready after ${maxWaitMs / 1000}s`, 'health');
  return false;
}

/**
 * Wait for all core services to be healthy
 */
export async function waitForStack(maxWaitMs = 120000, pollIntervalMs = 3000): Promise<boolean> {
  const startTime = Date.now();

  addLog('info', 'Waiting for stack to be ready...', 'health');

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getStackStatus();

    if (status.overall === 'running') {
      addLog('info', 'Stack is ready', 'health');
      return true;
    }

    if (status.overall === 'error') {
      const errorServices = Object.entries(status.services)
        .filter(([_, s]) => s.status === 'error')
        .map(([k, s]) => `${s.name}: ${s.error}`)
        .join(', ');
      addLog('warn', `Services with errors: ${errorServices}`, 'health');
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  addLog('error', `Stack not ready after ${maxWaitMs / 1000}s`, 'health');
  return false;
}

/**
 * Check if required ports are available
 */
export async function checkPortsAvailable(): Promise<{
  available: boolean;
  conflicts: string[];
}> {
  const portsToCheck = [
    { port: 3333, name: 'Server' },
    { port: 5173, name: 'Web UI' },
    { port: 5432, name: 'PostgreSQL' },
  ];

  const conflicts: string[] = [];

  for (const { port, name } of portsToCheck) {
    const inUse = await checkPort(port);
    if (inUse) {
      conflicts.push(`${name} (port ${port})`);
    }
  }

  return {
    available: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Synthesis Desktop - Configuration Management
 *
 * Config Hierarchy (precedence order):
 * 1. Environment variables (runtime overrides)
 * 2. User config file (~/.synthesis/config.json)
 * 3. Packaged defaults (embedded in app)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { z } from 'zod';

// =============================================================================
// CONFIG SCHEMA
// =============================================================================

const ConfigSchema = z.object({
  // Service URLs
  serverUrl: z.string().url().default('http://localhost:3333'),
  webUrl: z.string().url().default('http://localhost:5173'),

  // Orchestration mode
  mode: z.enum(['docker', 'direct']).default('docker'),

  // Docker configuration
  docker: z.object({
    composePath: z.string().optional(), // Custom docker-compose.yml path
    command: z.string().default('docker'), // Allow 'podman' override
    autoStart: z.boolean().default(false),
  }),

  // Direct mode configuration (dev convenience)
  direct: z.object({
    serverCommand: z.string().default('pnpm --filter @synthesis/server dev'),
    webCommand: z.string().default('pnpm --filter @synthesis/web dev'),
    workingDir: z.string().optional(), // Repository root
  }),

  // Environment variables
  env: z.record(z.string()).default({}),

  // UI preferences
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    showLogs: z.boolean().default(false),
    startMinimized: z.boolean().default(false),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: Config = {
  serverUrl: 'http://localhost:3333',
  webUrl: 'http://localhost:5173',
  mode: 'docker',
  docker: {
    command: 'docker',
    autoStart: false,
  },
  direct: {
    serverCommand: 'pnpm --filter @synthesis/server dev',
    webCommand: 'pnpm --filter @synthesis/web dev',
  },
  env: {},
  ui: {
    theme: 'system',
    showLogs: false,
    startMinimized: false,
  },
};

// =============================================================================
// CONFIG PATHS
// =============================================================================

/**
 * Get user config directory (~/.synthesis/)
 */
export function getUserConfigDir(): string {
  const userDataPath = app.getPath('userData');
  const configDir = join(userDataPath, '.synthesis');

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  return configDir;
}

/**
 * Get user config file path (~/.synthesis/config.json)
 */
export function getUserConfigPath(): string {
  return join(getUserConfigDir(), 'config.json');
}

/**
 * Get path to bundled resource (docker-compose.yml, .env.example)
 * Works in both development and packaged app
 *
 * @param resourceName - Name of the resource file (e.g., 'docker-compose.yml')
 * @returns Absolute path to the resource
 * @throws Error if resourceName contains path traversal sequences
 */
export function getResourcePath(resourceName: string): string {
  // Security: Prevent path traversal attacks
  if (resourceName.includes('..') || resourceName.includes('/') || resourceName.includes('\\')) {
    throw new Error(
      `Invalid resource name: "${resourceName}". Resource names cannot contain path separators or traversal sequences.`
    );
  }

  if (app.isPackaged) {
    // Production: resources are in extraResources/
    return join(process.resourcesPath, resourceName);
  }
  // Development: resources are in repo root
  return join(__dirname, '..', '..', '..', '..', resourceName);
}

/**
 * Get path to docker-compose.yml (bundled or custom)
 *
 * @param config - Optional config object with custom docker-compose path
 * @returns Absolute path to docker-compose.yml (validated if custom)
 */
export function getDockerComposePath(config?: Config): string {
  if (config?.docker?.composePath) {
    // User-specified custom path - validate it exists
    const customPath = config.docker.composePath;

    // Security: Validate path exists before using
    if (!existsSync(customPath)) {
      console.warn(
        `Custom docker-compose path does not exist: ${customPath}. Falling back to bundled version.`
      );
      return getResourcePath('docker-compose.yml');
    }

    return customPath;
  }

  // Use bundled docker-compose.yml
  return getResourcePath('docker-compose.yml');
}

// =============================================================================
// CONFIG LOADING
// =============================================================================

/**
 * Load config from file (if exists)
 */
function loadUserConfig(): Partial<Config> | null {
  const configPath = getUserConfigPath();

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const configData = readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Failed to load user config:', error);
    return null;
  }
}

/**
 * Load config from environment variables
 */
function loadEnvConfig(): Partial<Config> {
  const envConfig: Partial<Config> = {};

  // Service URLs
  if (process.env.SYNTHESIS_SERVER_URL) {
    envConfig.serverUrl = process.env.SYNTHESIS_SERVER_URL;
  }
  if (process.env.SYNTHESIS_WEB_URL) {
    envConfig.webUrl = process.env.SYNTHESIS_WEB_URL;
  }

  // Mode
  if (process.env.SYNTHESIS_MODE === 'docker' || process.env.SYNTHESIS_MODE === 'direct') {
    envConfig.mode = process.env.SYNTHESIS_MODE;
  }

  // Docker command override (for Podman users)
  if (process.env.DOCKER_COMMAND) {
    envConfig.docker = {
      command: process.env.DOCKER_COMMAND,
      autoStart: false,
    };
  }

  return envConfig;
}

/**
 * Load merged config (defaults → user file → env vars)
 */
export function loadConfig(): Config {
  const userConfig = loadUserConfig();
  const envConfig = loadEnvConfig();

  // Merge configs (precedence: env > user > defaults)
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    ...envConfig,
  };

  // Validate with Zod
  const result = ConfigSchema.safeParse(mergedConfig);

  if (!result.success) {
    console.error('Config validation failed:', result.error);
    console.warn('Falling back to default config');
    return DEFAULT_CONFIG;
  }

  return result.data;
}

// =============================================================================
// CONFIG SAVING
// =============================================================================

/**
 * Save config to user config file
 */
export function saveConfig(config: Config): void {
  const configPath = getUserConfigPath();

  try {
    const configData = JSON.stringify(config, null, 2);
    writeFileSync(configPath, configData, 'utf-8');
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

/**
 * Reset config to defaults
 */
export function resetConfig(): Config {
  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

// =============================================================================
// CONFIG UTILITIES
// =============================================================================

/**
 * Merge partial config update with existing config
 */
export function updateConfig(existing: Config, updates: Partial<Config>): Config {
  const merged = {
    ...existing,
    ...updates,
    docker: { ...existing.docker, ...updates.docker },
    direct: { ...existing.direct, ...updates.direct },
    env: { ...existing.env, ...updates.env },
    ui: { ...existing.ui, ...updates.ui },
  };

  // Validate merged config
  const result = ConfigSchema.safeParse(merged);

  if (!result.success) {
    console.error('Config update validation failed:', result.error);
    return existing; // Return unchanged if invalid
  }

  return result.data;
}

/**
 * Validate if a config object is valid
 */
export function isValidConfig(config: unknown): config is Config {
  const result = ConfigSchema.safeParse(config);
  return result.success;
}

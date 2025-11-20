import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';

/**
 * Check if Docker is installed and available
 */
export async function checkDocker(): Promise<{ available: boolean; error?: string }> {
  return new Promise((resolve) => {
    const process = spawn('docker', ['--version']);

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ available: true });
      } else {
        resolve({
          available: false,
          error: stderr || 'Docker command not found',
        });
      }
    });

    process.on('error', (err) => {
      resolve({
        available: false,
        error: `Failed to check Docker: ${err.message}`,
      });
    });
  });
}

/**
 * Check if a port is in use
 */
export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Start Synthesis services via Docker Compose
 */
export async function startSynthesis(
  cwd: string,
  onOutput?: (data: string) => void
): Promise<{ success: boolean; error?: string; process?: ChildProcess }> {
  return new Promise((resolve) => {
    const dockerProcess = spawn('docker', ['compose', 'up', '-d'], { cwd });

    let stdout = '';
    let stderr = '';

    dockerProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      onOutput?.(text);
    });

    dockerProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      onOutput?.(text);
    });

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, process: dockerProcess });
      } else {
        resolve({
          success: false,
          error: stderr || `Docker compose exited with code ${code}`,
        });
      }
    });

    dockerProcess.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to start Docker: ${err.message}`,
      });
    });
  });
}

/**
 * Stop Synthesis services via Docker Compose
 */
export async function stopSynthesis(
  cwd: string,
  onOutput?: (data: string) => void
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const dockerProcess = spawn('docker', ['compose', 'down'], { cwd });

    let stdout = '';
    let stderr = '';

    dockerProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      onOutput?.(text);
    });

    dockerProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      onOutput?.(text);
    });

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: stderr || `Docker compose down exited with code ${code}`,
        });
      }
    });

    dockerProcess.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to stop Docker: ${err.message}`,
      });
    });
  });
}

/**
 * Get Docker Compose logs for troubleshooting
 */
export async function getDockerLogs(
  cwd: string,
  service?: string
): Promise<{ success: boolean; logs?: string; error?: string }> {
  return new Promise((resolve) => {
    const args = ['compose', 'logs', '--tail=50'];
    if (service) {
      args.push(service);
    }

    const dockerProcess = spawn('docker', args, { cwd });

    let stdout = '';
    let stderr = '';

    dockerProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    dockerProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, logs: stdout });
      } else {
        resolve({
          success: false,
          error: stderr || `Failed to get logs (code ${code})`,
        });
      }
    });

    dockerProcess.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to get logs: ${err.message}`,
      });
    });
  });
}

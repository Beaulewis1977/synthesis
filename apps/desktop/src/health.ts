/**
 * Poll a health endpoint until it returns healthy or timeout is reached
 */
export async function healthCheck(
  url: string,
  timeoutMs = 60000,
  intervalMs = 2000,
  onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<{ healthy: boolean; error?: string }> {
  const maxAttempts = Math.floor(timeoutMs / intervalMs);
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    onProgress?.(attempt, maxAttempts);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(intervalMs - 100), // Leave some margin
      });

      if (response.ok) {
        const data = (await response.json()) as { status?: string };
        if (data.status === 'ok') {
          return { healthy: true };
        }
        // Health endpoint responded but status is not 'ok'
        return {
          healthy: false,
          error: `Health check failed: received status "${data.status ?? 'undefined'}" from ${url}`,
        };
      }
    } catch (error) {
      // Ignore fetch errors and continue polling
      // This is expected when services are still starting
    }

    // Wait before next attempt
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return {
    healthy: false,
    error: `Health check timed out after ${timeoutMs / 1000} seconds (${maxAttempts} attempts)`,
  };
}

/**
 * Check if a URL is reachable
 */
export async function isServiceReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

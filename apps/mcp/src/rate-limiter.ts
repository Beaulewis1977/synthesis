/**
 * Token Bucket Rate Limiter for MCP Server
 *
 * Implements a token bucket algorithm with:
 * - Configurable refill rate and burst capacity
 * - Per-IP tracking with automatic cleanup
 * - Bypass for authenticated users and internal CIDRs
 */

import type { IncomingMessage } from 'node:http';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterConfig {
  /** Tokens added per minute (default: 100) */
  refillRate: number;
  /** Maximum tokens (burst capacity, default: 200) */
  burstCapacity: number;
  /** Trust X-Forwarded-For header (default: false) */
  trustProxy: boolean;
  /** CIDRs to bypass rate limiting (e.g., ['127.0.0.1', '10.0.0.0/8']) */
  bypassCidrs: string[];
  /** Cleanup interval in ms (default: 10 minutes) */
  cleanupIntervalMs: number;
  /** Idle timeout for cleanup in ms (default: 30 minutes) */
  idleTimeoutMs: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  refillRate: Number.parseInt(process.env.RATE_LIMIT_REFILL_RATE || '100', 10),
  burstCapacity: Number.parseInt(process.env.RATE_LIMIT_BURST_CAPACITY || '200', 10),
  trustProxy: process.env.RATE_LIMIT_TRUST_PROXY === 'true',
  bypassCidrs: (process.env.RATE_LIMIT_BYPASS_CIDRS || '127.0.0.1,::1').split(',').filter(Boolean),
  cleanupIntervalMs: 10 * 60 * 1000, // 10 minutes
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
};

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private config: RateLimiterConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Check if a request should be allowed
   * @returns true if allowed, false if rate limited
   */
  isAllowed(req: IncomingMessage): boolean {
    // Check for bypass conditions
    if (this.shouldBypass(req)) {
      return true;
    }

    const ip = this.getClientIp(req);
    const now = Date.now();
    let bucket = this.buckets.get(ip);

    if (!bucket) {
      // New client - give them full burst capacity
      bucket = {
        tokens: this.config.burstCapacity,
        lastRefill: now,
      };
      this.buckets.set(ip, bucket);
    }

    // Refill tokens based on time elapsed
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = (elapsed / 60000) * this.config.refillRate;
    bucket.tokens = Math.min(this.config.burstCapacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get rate limit headers for response
   */
  getHeaders(req: IncomingMessage): Record<string, string> {
    const ip = this.getClientIp(req);
    const bucket = this.buckets.get(ip);

    if (!bucket) {
      return {
        'X-RateLimit-Limit': String(this.config.burstCapacity),
        'X-RateLimit-Remaining': String(this.config.burstCapacity),
      };
    }

    const remaining = Math.max(0, Math.floor(bucket.tokens));
    const resetTime = Math.ceil((1 - bucket.tokens) * (60000 / this.config.refillRate));

    return {
      'X-RateLimit-Limit': String(this.config.burstCapacity),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + Math.ceil(resetTime / 1000)),
    };
  }

  /**
   * Check if request should bypass rate limiting
   */
  private shouldBypass(req: IncomingMessage): boolean {
    // Bypass for authenticated users
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return true;
    }

    // Bypass for internal CIDRs
    const ip = this.getClientIp(req);
    for (const cidr of this.config.bypassCidrs) {
      if (this.ipMatchesCidr(ip, cidr)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract client IP from request
   */
  private getClientIp(req: IncomingMessage): string {
    if (this.config.trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',');
        // Return first public IP
        for (const ip of ips) {
          const trimmed = ip.trim();
          if (!this.isPrivateIp(trimmed)) {
            return trimmed;
          }
        }
        return ips[0].trim();
      }
    }

    return req.socket.remoteAddress || '0.0.0.0';
  }

  /**
   * Check if IP is private
   */
  private isPrivateIp(ip: string): boolean {
    // IPv4 private ranges
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.')) {
      return true;
    }
    // 172.16.0.0 - 172.31.255.255
    if (ip.startsWith('172.')) {
      const second = Number.parseInt(ip.split('.')[1], 10);
      if (second >= 16 && second <= 31) {
        return true;
      }
    }
    // IPv6 loopback
    if (ip === '::1') {
      return true;
    }
    return false;
  }

  /**
   * Simple CIDR matching (supports /8, /16, /24 for IPv4)
   */
  private ipMatchesCidr(ip: string, cidr: string): boolean {
    // Exact match
    if (ip === cidr) {
      return true;
    }

    // CIDR notation
    if (cidr.includes('/')) {
      const [network, bits] = cidr.split('/');
      const maskBits = Number.parseInt(bits, 10);

      // Simple IPv4 CIDR matching
      if (ip.includes('.') && network.includes('.')) {
        const ipParts = ip.split('.').map((p) => Number.parseInt(p, 10));
        const networkParts = network.split('.').map((p) => Number.parseInt(p, 10));

        const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
        const netNum =
          (networkParts[0] << 24) |
          (networkParts[1] << 16) |
          (networkParts[2] << 8) |
          networkParts[3];
        const mask = ~((1 << (32 - maskBits)) - 1);

        return (ipNum & mask) === (netNum & mask);
      }
    }

    return false;
  }

  /**
   * Start periodic cleanup of idle buckets
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.config.idleTimeoutMs;

      for (const [ip, bucket] of this.buckets.entries()) {
        if (bucket.lastRefill < cutoff) {
          this.buckets.delete(ip);
        }
      }
    }, this.config.cleanupIntervalMs);

    // Don't keep process alive just for cleanup
    this.cleanupInterval.unref();
  }

  /**
   * Stop the rate limiter and cleanup
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
  }

  /**
   * Get current stats for monitoring
   */
  getStats(): { activeClients: number; config: RateLimiterConfig } {
    return {
      activeClients: this.buckets.size,
      config: this.config,
    };
  }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}

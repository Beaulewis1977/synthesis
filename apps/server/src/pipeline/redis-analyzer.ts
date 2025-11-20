import type { Chunk } from './chunk.js';

/**
 * Redis Usage Analyzer
 * Scans code for Redis command patterns to identify caching and messaging logic.
 *
 * Supported patterns:
 * - redis.set(key, val)
 * - redis.get(key)
 * - redis.publish(channel, msg)
 * - redis.subscribe(channel)
 */

export interface RedisUsage {
  type: 'cache' | 'messaging' | 'queue';
  command: string;
  key_pattern?: string;
  line: number;
}

/**
 * Analyze code content for Redis usage.
 *
 * @param content - The file content to analyze
 * @param filePath - The path to the file
 * @returns Array of Chunks tagged with Redis metadata
 */
export async function analyzeRedisUsage(content: string, filePath: string): Promise<Chunk[]> {
  const lines = content.split('\n');
  const usages: RedisUsage[] = [];

  // Regex patterns for common Redis clients (Node/Redis, IORedis, PyRedis)
  const patterns = [
    {
      regex: /\.(set|setex|setnx)\s*\(['"]([^'"]+)['"]/,
      type: 'cache',
      cmdGroup: 1,
      keyGroup: 2,
    },
    { regex: /\.(get|mget)\s*\(['"]([^'"]+)['"]/, type: 'cache', cmdGroup: 1, keyGroup: 2 },
    {
      regex: /\.(publish|subscribe)\s*\(['"]([^'"]+)['"]/,
      type: 'messaging',
      cmdGroup: 1,
      keyGroup: 2,
    },
    { regex: /\.(lpush|rpush|lpop|rpop)\s*\(['"]([^'"]+)['"]/, type: 'queue', cmdGroup: 1, keyGroup: 2 },
  ] as const;

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) {
        usages.push({
          type: pattern.type as RedisUsage['type'],
          command: match[pattern.cmdGroup],
          key_pattern: match[pattern.keyGroup],
          line: index + 1,
        });
      }
    }
  });

  if (usages.length === 0) {
    return [];
  }

  // Create a "Virtual Chunk" that summarizes Redis usage for this file
  // This allows the LLM to find "files that use Redis for X" without reading the whole file
  return [
    {
      text: `Redis Usage Analysis for ${filePath}:\n` +
        usages.map((u) => `- Line ${u.line}: ${u.command.toUpperCase()} on key "${u.key_pattern}" (${u.type})`).join('\n'),
      index: 0,
      metadata: {
        chunk_type: 'analysis',
        source_file: filePath,
        tech_stack: ['redis'],
        redis_usage: usages,
        line_range: [1, lines.length],
        startOffset: 0,
        endOffset: content.length,
      },
    },
  ];
}


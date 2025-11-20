/**
 * Tech Stack Detection Service
 *
 * Detects technology stacks from file paths, content, and metadata.
 * Requires at least 2 signals before tagging a technology to avoid false positives.
 *
 * @module tech-detector
 */

/**
 * Docker Compose detection results
 */
interface DockerComposeSignals {
  hasPostgres: boolean;
  hasRedis: boolean;
  hasSupabase: boolean;
}

/**
 * Counts the number of true signals from detection array
 *
 * @param detections - Array of boolean detection signals
 * @returns Number of signals that are true
 *
 * @example
 * countSignals([true, false, true]) // → 2
 */
function countSignals(detections: boolean[]): number {
  return detections.filter((d) => d === true).length;
}

/**
 * Analyzes docker-compose.yml content for service definitions
 *
 * @param content - Docker Compose file content
 * @returns Object with boolean flags for each detected service
 *
 * @example
 * checkDockerCompose('services:\n  postgres:\n    image: postgres:16')
 * // → { hasPostgres: true, hasRedis: false, hasSupabase: false }
 */
function checkDockerCompose(content: string): DockerComposeSignals {
  const lowerContent = content.toLowerCase();

  return {
    hasPostgres:
      lowerContent.includes('postgres:') &&
      lowerContent.includes('image:') &&
      /postgres:\s*\d+/.test(lowerContent),
    hasRedis:
      lowerContent.includes('redis:') &&
      lowerContent.includes('image:') &&
      /redis:\s*\d+/.test(lowerContent),
    hasSupabase:
      lowerContent.includes('supabase/postgres') ||
      lowerContent.includes('supabase-db') ||
      lowerContent.includes('supabase_db'),
  };
}

// Note: checkPackageJson() is reserved for future package.json analysis
// to detect additional tech stacks based on npm dependencies

/**
 * Detects Flutter framework signals
 *
 * @param filePath - Relative or absolute file path
 * @param content - File content
 * @param metadata - Optional metadata object
 * @returns Array of boolean signals [signal1, signal2, signal3]
 */
function detectFlutter(
  filePath: string,
  content: string,
  metadata?: Record<string, unknown>
): boolean[] {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  const signal1 = lowerPath.includes('lib/') || lowerPath.includes('pubspec.yaml');

  const signal2 =
    lowerContent.includes('package:flutter') ||
    lowerContent.includes('statelesswidget') ||
    lowerContent.includes('statefulwidget') ||
    lowerContent.includes("import 'package:flutter");

  const signal3 = metadata?.language === 'dart';

  return [signal1, signal2, signal3];
}

/**
 * Detects Supabase platform signals
 *
 * @param filePath - Relative or absolute file path
 * @param content - File content
 * @returns Array of boolean signals [signal1, signal2, signal3, signal4]
 */
function detectSupabase(filePath: string, content: string): boolean[] {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  const signal1 = lowerPath.includes('supabase/') || lowerPath.includes('migrations/');

  // Signal 2: SQL content with Supabase patterns
  const hasUuid = lowerContent.includes('uuid');
  const hasGenRandomUuid = lowerContent.includes('gen_random_uuid');
  const hasAuthSchema = lowerContent.includes('auth.') || lowerContent.includes('schema auth');
  const signal2 = hasUuid && (hasGenRandomUuid || hasAuthSchema);

  // Signal 3: Config has Supabase environment variables
  const signal3 =
    lowerContent.includes('supabase_url') ||
    lowerContent.includes('supabase_anon_key') ||
    lowerContent.includes('supabase_service_role_key');

  // Signal 4: Docker Compose has Supabase postgres image
  const dockerSignals = checkDockerCompose(content);
  const signal4 = dockerSignals.hasSupabase;

  return [signal1, signal2, signal3, signal4];
}

/**
 * Detects PostgreSQL database signals
 *
 * @param filePath - Relative or absolute file path
 * @param content - File content
 * @returns Array of boolean signals [signal1, signal2, signal3, signal4]
 */
function detectPostgres(filePath: string, content: string): boolean[] {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  // Signal 1: File extension .sql
  const signal1 = lowerPath.endsWith('.sql');

  // Signal 2: Content has Postgres-specific syntax
  const hasSerial = lowerContent.includes('serial') || lowerContent.includes('bigserial');
  const hasUuid = lowerContent.includes('uuid');
  const hasGenRandomUuid = lowerContent.includes('gen_random_uuid');
  const hasJsonb = lowerContent.includes('jsonb');
  const signal2 = hasSerial || (hasUuid && hasGenRandomUuid) || hasJsonb;

  // Signal 3: Config has DATABASE_URL with postgres://
  const signal3 =
    lowerContent.includes('postgres://') ||
    (lowerContent.includes('database_url') && lowerContent.includes('postgresql://'));

  // Signal 4: Docker Compose has postgres image
  const dockerSignals = checkDockerCompose(content);
  const signal4 = dockerSignals.hasPostgres;

  return [signal1, signal2, signal3, signal4];
}

/**
 * Detects Redis cache/database signals
 *
 * @param filePath - Relative or absolute file path
 * @param content - File content
 * @returns Array of boolean signals [signal1, signal2, signal3, signal4]
 */
function detectRedis(filePath: string, content: string): boolean[] {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  // Signal 1: File name is redis.conf
  const signal1 = lowerPath.includes('redis.conf');

  // Signal 2: Config has redis.host or REDIS_URL
  const signal2 =
    lowerContent.includes('redis.host') ||
    lowerContent.includes('redis_url') ||
    lowerContent.includes('redis_host');

  // Signal 3: Docker Compose has redis image
  const dockerSignals = checkDockerCompose(content);
  const signal3 = dockerSignals.hasRedis;

  // Signal 4: Content has redis-specific directives
  const hasBind = lowerContent.includes('bind ');
  const hasPort = lowerContent.includes('port ');
  const hasMaxMemory = lowerContent.includes('maxmemory');
  const hasRequirePass = lowerContent.includes('requirepass');
  const signal4 = (hasBind && hasPort) || hasMaxMemory || hasRequirePass;

  return [signal1, signal2, signal3, signal4];
}

/**
 * Detects Dart programming language signals
 *
 * @param filePath - Relative or absolute file path
 * @param content - File content
 * @param metadata - Optional metadata object
 * @returns Array of boolean signals [signal1, signal2, signal3]
 */
function detectDart(
  filePath: string,
  content: string,
  metadata?: Record<string, unknown>
): boolean[] {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  // Signal 1: File extension .dart
  const signal1 = lowerPath.endsWith('.dart');

  // Signal 2: Content has Dart-specific syntax
  const hasDartImport = lowerContent.includes("import 'dart:");
  const hasDartPackage = lowerContent.includes("import 'package:");
  const hasDartKeywords = lowerContent.includes('void main()') || lowerContent.includes('class ');
  const signal2 = hasDartImport || hasDartPackage || hasDartKeywords;

  // Signal 3: Metadata language is dart
  const signal3 = metadata?.language === 'dart';

  return [signal1, signal2, signal3];
}

/**
 * Detects technology stacks from file path, content, and metadata.
 * Requires at least 2 signals before tagging a technology to reduce false positives.
 *
 * @param filePath - Relative or absolute file path
 * @param content - File content as string
 * @param metadata - Optional metadata object (may include language, doc_type, etc.)
 * @returns Sorted array of detected tech stack tags (empty if < 2 signals per tech)
 *
 * @example
 * // Flutter detection (2+ signals)
 * detectTechStack('lib/main.dart', 'import package:flutter/material.dart;', { language: 'dart' })
 * // → ['dart', 'flutter']
 *
 * @example
 * // Supabase + Postgres detection (3+ signals each)
 * detectTechStack('supabase/migrations/001_users.sql', 'CREATE TABLE users (id uuid DEFAULT gen_random_uuid());')
 * // → ['postgres', 'supabase']
 *
 * @example
 * // Insufficient signals (< 2)
 * detectTechStack('random.txt', 'some content')
 * // → []
 */
export function detectTechStack(
  filePath: string,
  content: string,
  metadata?: Record<string, unknown>
): string[] {
  const tags = new Set<string>();

  // Detect Flutter
  const flutterSignals = detectFlutter(filePath, content, metadata);
  if (countSignals(flutterSignals) >= 2) {
    tags.add('flutter');
  }

  // Detect Dart (independent of Flutter)
  const dartSignals = detectDart(filePath, content, metadata);
  if (countSignals(dartSignals) >= 2) {
    tags.add('dart');
  }

  // Detect Supabase
  const supabaseSignals = detectSupabase(filePath, content);
  if (countSignals(supabaseSignals) >= 2) {
    tags.add('supabase');
  }

  // Detect Postgres
  const postgresSignals = detectPostgres(filePath, content);
  if (countSignals(postgresSignals) >= 2) {
    tags.add('postgres');
  }

  // Detect Redis
  const redisSignals = detectRedis(filePath, content);
  if (countSignals(redisSignals) >= 2) {
    tags.add('redis');
  }

  // Return sorted, deduplicated array
  return Array.from(tags).sort();
}

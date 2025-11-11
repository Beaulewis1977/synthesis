/**
 * Secret Redaction Utility
 *
 * Provides safe redaction of sensitive values in objects for logging purposes.
 * Detects secret-like keys and replaces their values with '<redacted>' while
 * preserving the object structure.
 *
 * @example
 * ```typescript
 * import { redactSecrets } from './secret-redaction';
 *
 * const config = {
 *   database: {
 *     host: 'localhost',
 *     password: 'super_secret_123'
 *   },
 *   api_key: 'sk_live_abc123',
 *   anthropic_api_key: 'sk-ant-xyz789',
 *   public_url: 'https://example.com'
 * };
 *
 * const safe = redactSecrets(config);
 * console.log(safe);
 * // {
 * //   database: {
 * //     host: 'localhost',
 * //     password: '<redacted>'
 * //   },
 * //   api_key: '<redacted>',
 * //   anthropic_api_key: '<redacted>',
 * //   public_url: 'https://example.com'
 * // }
 * ```
 *
 * @example Handling arrays
 * ```typescript
 * const data = {
 *   tokens: ['token1', 'token2'],
 *   users: [
 *     { name: 'Alice', password: 'secret1' },
 *     { name: 'Bob', password: 'secret2' }
 *   ]
 * };
 *
 * redactSecrets(data);
 * // {
 * //   tokens: ['<redacted>', '<redacted>'],
 * //   users: [
 * //     { name: 'Alice', password: '<redacted>' },
 * //     { name: 'Bob', password: '<redacted>' }
 * //   ]
 * // }
 * ```
 */

/**
 * Patterns that indicate a key contains sensitive information.
 * These are matched case-insensitively against object keys.
 */
const SECRET_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /_key$/i, // Match keys ending with '_key' (api_key, private_key)
  /[a-z0-9]key$/i, // Match keys ending with 'key' with at least one char before (apikey, privatekey)
  /token/i,
  /credential/i,
  /auth/i,
  /api[_-]?key/i,
  /private/i,
  /jwt/i,
  /bearer/i,
  /session/i,
  /cookie/i,
  /csrf/i,
  /salt/i,
  /hash/i,
];

/**
 * The string used to replace redacted values.
 */
const REDACTED_MARKER = '<redacted>';

/**
 * Checks if a key name appears to contain sensitive information.
 *
 * @param key - The key name to check
 * @returns True if the key matches any secret pattern
 *
 * @example
 * ```typescript
 * isSecretKey('password')      // true
 * isSecretKey('api_key')       // true
 * isSecretKey('BEARER_TOKEN')  // true
 * isSecretKey('username')      // false
 * isSecretKey('public_url')    // false
 * ```
 */
export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively redacts sensitive values from an object or array.
 *
 * This function traverses objects and arrays, identifying keys that match
 * secret patterns and replacing their values with '<redacted>'. The original
 * structure is preserved (keys are not removed).
 *
 * @param value - The value to redact (can be object, array, or primitive)
 * @param keyPath - Internal parameter tracking the current path (used for recursion)
 * @returns A new object/array with sensitive values redacted
 *
 * @example Basic object redaction
 * ```typescript
 * redactSecrets({
 *   username: 'alice',
 *   password: 'secret123'
 * });
 * // { username: 'alice', password: '<redacted>' }
 * ```
 *
 * @example Nested object redaction
 * ```typescript
 * redactSecrets({
 *   database: {
 *     host: 'localhost',
 *     password: 'db_secret'
 *   },
 *   api: {
 *     endpoint: 'https://api.example.com',
 *     api_key: 'sk_live_123'
 *   }
 * });
 * // {
 * //   database: { host: 'localhost', password: '<redacted>' },
 * //   api: { endpoint: 'https://api.example.com', api_key: '<redacted>' }
 * // }
 * ```
 *
 * @example Array handling
 * ```typescript
 * redactSecrets({
 *   tokens: ['token1', 'token2', 'token3']
 * });
 * // { tokens: ['<redacted>', '<redacted>', '<redacted>'] }
 * ```
 *
 * @example Mixed types
 * ```typescript
 * redactSecrets({
 *   config: {
 *     debug: true,
 *     private_key: 'rsa_private_abc',
 *     timeout: 5000
 *   }
 * });
 * // {
 * //   config: {
 * //     debug: true,
 * //     private_key: '<redacted>',
 * //     timeout: 5000
 * //   }
 * // }
 * ```
 */
export function redactSecrets<T>(value: T, keyPath: string[] = []): T {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    // Recursively process each element
    return value.map((item, index) => redactSecrets(item, [...keyPath, String(index)])) as T;
  }

  // Handle objects (but preserve special objects like Date, RegExp, etc.)
  if (typeof value === 'object') {
    // Check if this is a plain object (not Date, RegExp, etc.)
    const isPlainObject = value.constructor === Object;

    if (!isPlainObject) {
      // Preserve special objects as-is
      return value;
    }

    const redacted: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      // If the key matches a secret pattern, redact the entire value
      if (isSecretKey(key)) {
        redacted[key] = REDACTED_MARKER;
      } else {
        // Otherwise, recursively process the value
        redacted[key] = redactSecrets(val, [...keyPath, key]);
      }
    }

    return redacted as T;
  }

  // Return primitive values as-is (string, number, boolean)
  return value;
}

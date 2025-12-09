/**
 * Shared encryption utilities for sensitive data storage
 * Uses AES-256-GCM with HKDF-SHA256 key derivation
 * Format: {iv_hex}:{authTag_hex}:{encrypted_hex}
 */

import crypto from 'node:crypto';

const MIN_KEY_LENGTH = 16;
const HKDF_SALT = process.env.HKDF_SALT || 'synthesis-api-key-encryption-salt';
const HKDF_INFO = process.env.HKDF_INFO || 'synthesis-api-key-encryption-info';

/**
 * Derives encryption key from environment variable using HKDF-SHA256
 * @returns 32-byte encryption key for AES-256-GCM
 * @throws Error if API_KEY_ENCRYPTION_KEY is not set or too short
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.API_KEY_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error(
      'API_KEY_ENCRYPTION_KEY environment variable is not set. ' +
        'Please set this variable to enable encryption.'
    );
  }

  // Support both hex-encoded (64 chars) and raw keys
  const ikm = keyEnv.length === 64 ? Buffer.from(keyEnv, 'hex') : Buffer.from(keyEnv);

  if (ikm.length < MIN_KEY_LENGTH) {
    throw new Error(
      `Encryption key is too short. Minimum length is ${MIN_KEY_LENGTH} bytes, got ${ikm.length} bytes.`
    );
  }

  // Derive deterministic 32-byte key using HKDF-SHA256
  const salt = Buffer.from(HKDF_SALT, 'utf8');
  const info = Buffer.from(HKDF_INFO, 'utf8');
  const derived = crypto.hkdfSync('sha256', ikm, salt, info, 32);

  return Buffer.from(derived as ArrayBuffer);
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext - String to encrypt
 * @returns Encrypted string in format: {iv_hex}:{authTag_hex}:{encrypted_hex}
 * @throws Error if encryption fails
 */
export function encryptValue(plaintext: string): string {
  // Generate random 16-byte IV for this encryption
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);

  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag (ensures data integrity)
  const authTag = cipher.getAuthTag();

  // Return combined format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string encrypted with encryptValue()
 * @param ciphertext - Encrypted string in format: {iv_hex}:{authTag_hex}:{encrypted_hex}
 * @returns Decrypted plaintext string
 * @throws Error if ciphertext format is invalid or decryption fails
 */
export function decryptValue(ciphertext: string): string {
  // Parse the combined format
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid ciphertext format. Expected format: iv:authTag:encrypted, got ${parts.length} parts.`
    );
  }

  const [ivHex, authTagHex, encrypted] = parts;

  // Convert hex strings back to buffers
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  // Create decipher and set authentication tag
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  // Decrypt the ciphertext
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

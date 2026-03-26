import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Generates a cryptographically secure hex token.
 * Default: 32 bytes = 64 hex chars.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Constant-time string comparison — prevents timing attacks.
 * Returns false if either value is empty.
 */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

import type { MiddlewareHandler } from 'hono';
import type { ResolvedAuth } from '../auth/resolve.js';
import { safeEqual } from '../auth/utils.js';
import { createRateLimiter } from '../auth/rate-limit.js';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

/** Routes that skip authentication */
const PUBLIC_PATHS = new Set(['/health']);

/**
 * Creates a Hono middleware that enforces Bearer token auth.
 *
 * - Skips public paths (health check)
 * - Bypasses auth for loopback requests (desktop → local gateway)
 * - Rate-limits failed attempts per IP
 * - Uses constant-time comparison to prevent timing attacks
 */
export function createAuthMiddleware(auth: ResolvedAuth): MiddlewareHandler {
  const limiter = createRateLimiter();

  return async (c, next) => {
    // Public routes are always accessible
    if (PUBLIC_PATHS.has(c.req.path)) {
      return next();
    }

    // Auth disabled — pass through
    if (auth.mode === 'none') {
      return next();
    }

    // Resolve client IP
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      (c.env as any)?.incoming?.socket?.remoteAddress ||
      'unknown';

    // Loopback bypass — local desktop app doesn't need a token
    if (LOOPBACK.has(ip)) {
      return next();
    }

    // Rate limit check
    const rateCheck = limiter.check(ip);
    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.retryAfterMs || 0) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Too many failed attempts. Try again later.' }, 429);
    }

    // Extract Bearer token
    const authHeader = c.req.header('authorization');
    const clientToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!clientToken || !safeEqual(clientToken, auth.token!)) {
      limiter.recordFailure(ip);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return next();
  };
}

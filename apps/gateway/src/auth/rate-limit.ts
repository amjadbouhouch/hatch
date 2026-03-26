/**
 * In-memory sliding-window rate limiter.
 * Tracks failed auth attempts per IP with automatic cleanup.
 */

export interface RateLimitConfig {
  /** Max failed attempts before lockout. @default 10 */
  maxAttempts: number;
  /** Sliding window duration in ms. @default 60_000 */
  windowMs: number;
  /** Lockout duration in ms after exceeding max attempts. @default 300_000 (5 min) */
  lockoutMs: number;
}

interface Entry {
  timestamps: number[];
  lockedUntil: number | null;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 10,
  windowMs: 60_000,
  lockoutMs: 300_000,
};

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

export function createRateLimiter(config?: Partial<RateLimitConfig>) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const entries = new Map<string, Entry>();

  // Auto-prune stale entries every 60s
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.lockedUntil && now > entry.lockedUntil) {
        entries.delete(key);
        continue;
      }
      entry.timestamps = entry.timestamps.filter((t) => now - t < cfg.windowMs);
      if (entry.timestamps.length === 0 && !entry.lockedUntil) {
        entries.delete(key);
      }
    }
  }, 60_000);
  // Don't keep the process alive for this
  if (pruneInterval.unref) pruneInterval.unref();

  function check(ip: string): { allowed: boolean; retryAfterMs?: number } {
    // Loopback is always exempt
    if (LOOPBACK.has(ip)) return { allowed: true };

    const now = Date.now();
    const entry = entries.get(ip);

    if (!entry) return { allowed: true };

    // Check lockout
    if (entry.lockedUntil) {
      if (now < entry.lockedUntil) {
        return { allowed: false, retryAfterMs: entry.lockedUntil - now };
      }
      // Lockout expired — reset
      entries.delete(ip);
      return { allowed: true };
    }

    // Prune old timestamps in the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < cfg.windowMs);

    if (entry.timestamps.length >= cfg.maxAttempts) {
      entry.lockedUntil = now + cfg.lockoutMs;
      return { allowed: false, retryAfterMs: cfg.lockoutMs };
    }

    return { allowed: true };
  }

  function recordFailure(ip: string): void {
    if (LOOPBACK.has(ip)) return;

    const now = Date.now();
    let entry = entries.get(ip);

    if (!entry) {
      entry = { timestamps: [], lockedUntil: null };
      entries.set(ip, entry);
    }

    entry.timestamps.push(now);

    // Trigger lockout if threshold exceeded
    const recent = entry.timestamps.filter((t) => now - t < cfg.windowMs);
    entry.timestamps = recent;
    if (recent.length >= cfg.maxAttempts) {
      entry.lockedUntil = now + cfg.lockoutMs;
    }
  }

  return { check, recordFailure };
}

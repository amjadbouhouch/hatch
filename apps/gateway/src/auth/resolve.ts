import { generateToken } from './utils.js';

/**
 * Auth modes — only 'token' is active for MVP.
 * Architecture supports adding 'password' | 'device' | 'trusted-proxy' later
 * by extending the union and the resolver below.
 */
export type AuthMode = 'token' | 'none';

export interface ResolvedAuth {
  mode: AuthMode;
  token: string | null;
}

/**
 * Resolves auth configuration from environment.
 *
 * Precedence:
 *   1. HATCH_GATEWAY_TOKEN env var (explicit)
 *   2. Auto-generate a token and print to console
 *
 * Set HATCH_AUTH_MODE=none to disable auth entirely (dev only).
 */
export function resolveAuth(): ResolvedAuth {
  const modeEnv = process.env.HATCH_AUTH_MODE?.toLowerCase();

  if (modeEnv === 'none') {
    console.warn('[auth] WARNING: auth disabled (HATCH_AUTH_MODE=none) — do not use in production');
    return { mode: 'none', token: null };
  }

  // Token mode (default)
  let token = process.env.HATCH_GATEWAY_TOKEN || null;

  if (!token) {
    token = generateToken();
    // Set it in the process env so it persists for the gateway lifetime
    process.env.HATCH_GATEWAY_TOKEN = token;
  }

  return { mode: 'token', token };
}

/**
 * Prints auth info to console on startup.
 */
export function printAuthInfo(auth: ResolvedAuth, port: number): void {
  if (auth.mode === 'none') {
    console.log('[auth] mode: none (open access)');
    return;
  }

  console.log('[auth] mode: token');
  console.log(`[auth] token: ${auth.token}`);
  console.log('[auth] Paste this token into your Hatch desktop app to connect.');
  console.log(`[auth] Or set HATCH_GATEWAY_TOKEN in your .env to use a fixed token.`);
}

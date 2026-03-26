import { hc } from 'hono/client';
import type { AppType } from '@hatch/gateway/app-type';
import { useUIStore } from '../stores/ui-store.js';

let _client: ReturnType<typeof hc<AppType>> | null = null;
let _cachedToken: string | null = null;

export async function getClient(): Promise<ReturnType<typeof hc<AppType>>> {
  const token = useUIStore.getState().gatewayToken;

  // Recreate client if token changed (e.g. after onboarding)
  if (_client && token === _cachedToken) return _client;

  const url = await window.hatchAPI.getGatewayUrl();
  _cachedToken = token;
  _client = hc<AppType>(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return _client;
}

export type ApiClient = Awaited<ReturnType<typeof getClient>>;

import {
  createHarnessStore,
  createSSEConnector,
  createUseThreadHarness,
} from '@hatch/client/harness';
import type { StoreApi } from 'zustand';
import type { HarnessStore } from '@hatch/client/harness';
import { queryClient } from '../client/query-client.js';

let store: StoreApi<HarnessStore> | null = null;
let sseConnector: ReturnType<typeof createSSEConnector> | null = null;
let useThreadHarnessHook: ReturnType<typeof createUseThreadHarness> | null = null;

export function initHarness(gatewayUrl: string, token?: string | null) {
  if (store) return { store, sseConnector: sseConnector! };

  const config = {
    apiUrl: gatewayUrl,
    getAuthHeaders: (): Record<string, string> =>
      token ? { Authorization: `Bearer ${token}` } : {},
    onAgentComplete: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  };

  store = createHarnessStore(config);
  sseConnector = createSSEConnector(store, config);
  useThreadHarnessHook = createUseThreadHarness(store);

  return { store, sseConnector };
}

export function getHarnessStore(): StoreApi<HarnessStore> {
  if (!store) throw new Error('Harness not initialized — call initHarness() first');
  return store;
}

export function useThreadHarness(
  ...args: Parameters<ReturnType<typeof createUseThreadHarness>>
) {
  if (!useThreadHarnessHook) throw new Error('Harness not initialized');
  return useThreadHarnessHook(...args);
}

import type { HarnessSSEEvent, HarnessClientConfig, HarnessStore } from './types';
import type { StoreApi } from 'zustand';

/**
 * Creates a singleton SSE connector for a harness store.
 * Works in both browser (web-app) and React Native (Expo SDK 53+).
 *
 * Uses fetch().body.getReader() + TextDecoder — NOT EventSource —
 * so custom auth headers can be injected per-request.
 */
export function createSSEConnector(
  store: StoreApi<HarnessStore>,
  config: HarnessClientConfig
) {
  let abortController: AbortController | null = null;

  function connect() {
    if (abortController) return; // Already connected

    const ctrl = new AbortController();
    abortController = ctrl;

    async function _connect() {
      try {
        const res = await fetch(`${config.apiUrl}/events`, {
          headers: config.getAuthHeaders(),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          console.error(`[harnessSSE] open failed: ${res.status}`);
          store.getState().setConnected(false);
          if (!ctrl.signal.aborted) setTimeout(_connect, 5000);
          return;
        }

        store.getState().setConnected(true);
        console.log('[harnessSSE] connected');

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        // Persist across chunks — an event's `event:` and `data:` lines may
        // arrive in separate read() calls when packets are split.
        let currentEvent = '';
        let currentData = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line === '') {
              if (
                currentEvent &&
                currentEvent !== 'heartbeat' &&
                currentEvent !== 'connected' &&
                currentData
              ) {
                try {
                  const data = JSON.parse(currentData) as Record<string, unknown>;
                  data.type = currentEvent;
                  store.getState().handleEvent(data as unknown as HarnessSSEEvent);
                } catch (err) {
                  console.error(`[harnessSSE] parse error ${currentEvent}:`, err);
                }
              }
              currentEvent = '';
              currentData = '';
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[harnessSSE] error:', err);
      }

      // Reconnect if not aborted
      if (!ctrl.signal.aborted) {
        store.getState().setConnected(false);
        setTimeout(_connect, 5000);
      }
    }

    _connect();
  }

  function disconnect() {
    if (abortController) {
      abortController.abort();
      abortController = null;
      store.getState().setConnected(false);
    }
  }

  return { connect, disconnect };
}

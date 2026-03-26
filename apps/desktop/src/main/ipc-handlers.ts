import { ipcMain } from 'electron';

const DEFAULT_GATEWAY_URL = process.env.HATCH_GATEWAY_URL ?? 'http://localhost:3000';

export function registerIpcHandlers(): void {
  ipcMain.handle('gateway:url', () => DEFAULT_GATEWAY_URL);
}

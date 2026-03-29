import { ipcMain, dialog, BrowserWindow } from 'electron';

const DEFAULT_GATEWAY_URL = process.env.HATCH_GATEWAY_URL ?? 'http://localhost:3000';

export function registerIpcHandlers(): void {
  ipcMain.handle('gateway:url', () => DEFAULT_GATEWAY_URL);

  ipcMain.handle('dialog:select-folder', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select project directory',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getGatewayUrl: (): Promise<string> => ipcRenderer.invoke('gateway:url'),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:select-folder'),
};

contextBridge.exposeInMainWorld('hatchAPI', api);

export type HatchAPI = typeof api;

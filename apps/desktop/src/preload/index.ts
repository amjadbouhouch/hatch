import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getGatewayUrl: (): Promise<string> => ipcRenderer.invoke('gateway:url'),
};

contextBridge.exposeInMainWorld('hatchAPI', api);

export type HatchAPI = typeof api;

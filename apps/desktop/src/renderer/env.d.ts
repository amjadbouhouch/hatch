/// <reference types="vite/client" />

import type { HatchAPI } from '../preload/index.js';

declare global {
  interface Window {
    hatchAPI: HatchAPI;
  }
}

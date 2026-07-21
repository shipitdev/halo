/**
 * Halo — Preload Script
 * Context bridge exposing safe IPC methods to the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('halo', {
  // ─── Screen Capture ─────────────────────────────────────────────────
  /** Request a full-resolution screenshot. Returns base64 data URL or null. */
  captureScreen: () => ipcRenderer.invoke('halo:capture-screen'),

  // ─── AI Streaming ───────────────────────────────────────────────────
  /** Listen for streamed AI response chunks. */
  onStream: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('halo:stream', handler);
    return () => ipcRenderer.removeListener('halo:stream', handler);
  },

  // ─── Actions from Main Process ──────────────────────────────────────
  /** Listen for action triggers from hotkeys/tray. */
  onAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('halo:action', handler);
    return () => ipcRenderer.removeListener('halo:action', handler);
  },

  /** Listen for listening state toggles from tray. */
  onToggleListening: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('halo:toggle-listening', handler);
    return () => ipcRenderer.removeListener('halo:toggle-listening', handler);
  },

  /** Listen for settings open request from tray. */
  onOpenSettings: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('halo:open-settings', handler);
    return () => ipcRenderer.removeListener('halo:open-settings', handler);
  },

  // ─── Settings / Config ──────────────────────────────────────────────
  settings: {
    /** Get a config value by key. */
    get: (key, defaultValue) => ipcRenderer.invoke('halo:config-get', key, defaultValue),

    /** Set a config value by key. */
    set: (key, value) => ipcRenderer.invoke('halo:config-set', key, value),

    /** Get all config values. */
    getAll: () => ipcRenderer.invoke('halo:config-get-all'),
  },

  // ─── Window Controls ───────────────────────────────────────────────
  /** Toggle overlay visibility. */
  toggleVisibility: () => ipcRenderer.send('halo:toggle-visibility'),

  /** Set whether the window ignores mouse events. */
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('halo:set-ignore-mouse', ignore),

  /** Resize the window (for expand/collapse). */
  resize: (height) => ipcRenderer.send('halo:resize', height),

  /** Get the collapsed toolbar height. */
  getToolbarHeight: () => ipcRenderer.invoke('halo:get-toolbar-height'),

  /** Sync listening state to main process. */
  setListeningState: (state) => ipcRenderer.send('halo:listening-state', state),
});

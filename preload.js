/**
 * Halo — Preload Script
 * Context bridge exposing safe IPC methods to the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('halo', {
  // ─── Screen Capture ─────────────────────────────────────────────────
  /** Request a full-resolution screenshot. Returns base64 data URL or null. */
  captureScreen: () => ipcRenderer.invoke('halo:capture-screen'),

  // ─── AI Streaming & Transcription ─────────────────────────────────
  /** Stream AI completion via main process IPC */
  streamAI: (payload, onChunk, onEnd, onError) => {
    const streamId = Math.random().toString(36).substring(2);

    const chunkHandler = (_event, data) => {
      if (data && data.id === streamId) onChunk(data.chunk);
    };
    const endHandler = (_event, data) => {
      if (data && data.id === streamId) {
        cleanup();
        onEnd(data.fullText);
      }
    };
    const errorHandler = (_event, data) => {
      if (data && data.id === streamId) {
        cleanup();
        onError(new Error(data.error));
      }
    };

    function cleanup() {
      ipcRenderer.removeListener('halo:ai-chunk', chunkHandler);
      ipcRenderer.removeListener('halo:ai-end', endHandler);
      ipcRenderer.removeListener('halo:ai-error', errorHandler);
    }

    ipcRenderer.on('halo:ai-chunk', chunkHandler);
    ipcRenderer.on('halo:ai-end', endHandler);
    ipcRenderer.on('halo:ai-error', errorHandler);

    ipcRenderer.send('halo:stream-ai', { id: streamId, ...payload });
  },

  /** Transcribe audio via main process STT provider */
  transcribeAudio: (audioBuffer, format) => ipcRenderer.invoke('halo:transcribe-audio', audioBuffer, format),

  /** Listen for streamed AI response chunks (legacy). */
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

  // ─── Knowledge Base ───────────────────────────────────────────────
  knowledge: {
    /** Upload a resume (opens file picker). Returns resume info or null. */
    uploadResume: () => ipcRenderer.invoke('halo:upload-resume'),

    /** Get stored resume info. */
    getResume: () => ipcRenderer.invoke('halo:get-resume'),

    /** Clear stored resume. */
    clearResume: () => ipcRenderer.invoke('halo:clear-resume'),

    /** Upload documents (opens file picker, multi-select). Returns array of added docs. */
    uploadDocuments: () => ipcRenderer.invoke('halo:upload-doc'),

    /** List all uploaded documents. */
    listDocuments: () => ipcRenderer.invoke('halo:list-docs'),

    /** Remove a document by ID. */
    removeDocument: (id) => ipcRenderer.invoke('halo:remove-doc', id),

    /** Get the full knowledge context string for prompt injection. */
    getContext: () => ipcRenderer.invoke('halo:get-knowledge-context'),

    /** Check if any knowledge context exists. */
    hasContext: () => ipcRenderer.invoke('halo:has-knowledge'),
  },

  // ─── Meeting Detection ────────────────────────────────────────────
  /** Listen for meeting detection events. */
  onMeetingDetected: (callback) => {
    const handler = (_event, meeting) => callback(meeting);
    ipcRenderer.on('halo:meeting-detected', handler);
    return () => ipcRenderer.removeListener('halo:meeting-detected', handler);
  },

  onMeetingEnded: (callback) => {
    const handler = (_event, meeting) => callback(meeting);
    ipcRenderer.on('halo:meeting-ended', handler);
    return () => ipcRenderer.removeListener('halo:meeting-ended', handler);
  },

  /** Get currently active meeting info. */
  getActiveMeeting: () => ipcRenderer.invoke('halo:get-active-meeting'),
});

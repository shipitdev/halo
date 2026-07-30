/**
 * Halo — Main Process
 * Electron entry point: overlay window, tray icon, IPC, global hotkeys.
 */

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  globalShortcut,
  desktopCapturer,
  nativeImage,
  screen,
  dialog,
} = require('electron');
const path = require('path');
const { ConfigManager } = require('./src/config');
const { KnowledgeBase } = require('./src/knowledge');
const { MeetingDetector } = require('./src/meetings');
const { createProvider, getTranscriptionProvider, getModel } = require('./src/providers');
const { getPrompt } = require('./src/prompts');

// ─── Globals ────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let config = null;
let kb = null;
let meetingDetector = null;
let isListening = false;
let isVisible = true;

// ─── Constants ──────────────────────────────────────────────────────────────
const TOOLBAR_HEIGHT = 48;
const TOOLBAR_WIDTH = 700;
const MAX_EXPANDED_HEIGHT = 520;

// ─── Window Creation ────────────────────────────────────────────────────────
function createOverlayWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  // Start as a slim horizontal toolbar at top-center
  mainWindow = new BrowserWindow({
    width: TOOLBAR_WIDTH,
    height: TOOLBAR_HEIGHT,
    minWidth: 400,
    minHeight: TOOLBAR_HEIGHT,
    maxHeight: 800,
    x: Math.round((screenWidth - TOOLBAR_WIDTH) / 2),
    y: 8,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    hasShadow: false,
    roundedCorners: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Invisible to screen recordings & screen shares
  mainWindow.setContentProtection(true);

  // Float above everything, including fullscreen apps
  mainWindow.setAlwaysOnTop(true, 'floating', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Tray Icon ──────────────────────────────────────────────────────────────
function createTray() {
  // Tray icon: 22x22 template image (white circle, macOS auto-colors it)
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Halo');
  updateTrayMenu();
}

function createTrayIcon() {
  // Base64-encoded 22x22 PNG: a simple filled white circle
  // This is a template image so macOS handles dark/light mode automatically
  const size = 22;
  // Create via canvas-like approach using nativeImage
  // Fallback: use a data URL with a tiny green circle SVG → PNG
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="8" fill="white" opacity="0.9"/>
    <circle cx="11" cy="11" r="4" fill="white"/>
  </svg>`;
  const base64 = Buffer.from(svgStr).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  const img = nativeImage.createFromDataURL(dataUrl);
  img.setTemplateImage(true);
  return img;
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isListening ? '⏹ Stop Listening' : '🎙 Start Listening',
      click: () => toggleListening(),
    },
    {
      label: isVisible ? '👁 Hide Overlay' : '👁 Show Overlay',
      click: () => toggleVisibility(),
    },
    { type: 'separator' },
    {
      label: '⚙ Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('halo:open-settings');
        }
      },
    },
    { type: 'separator' },
    {
      label: '✕ Quit Halo',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ─── Toggle Functions ───────────────────────────────────────────────────────
function toggleVisibility() {
  if (!mainWindow) return;

  if (isVisible) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
  isVisible = !isVisible;
  updateTrayMenu();
}

function toggleListening() {
  isListening = !isListening;
  if (mainWindow) {
    mainWindow.webContents.send('halo:toggle-listening', isListening);
  }
  updateTrayMenu();
}

// ─── Global Hotkeys ─────────────────────────────────────────────────────────
function registerHotkeys() {
  const hotkeys = config.get('hotkeys', {
    toggleOverlay: 'CommandOrControl+B',
    assist: 'CommandOrControl+Return',
    solveCode: 'CommandOrControl+Shift+H',
    quit: 'CommandOrControl+Shift+X',
  });

  // Unregister all first
  globalShortcut.unregisterAll();

  const bindings = {
    [hotkeys.toggleOverlay]: () => toggleVisibility(),
    [hotkeys.assist]: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.webContents.send('halo:action', 'assist');
      }
    },
    [hotkeys.solveCode]: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.webContents.send('halo:action', 'solveCode');
      }
    },
    [hotkeys.quit]: () => app.quit(),
  };

  for (const [accelerator, callback] of Object.entries(bindings)) {
    if (accelerator) {
      try {
        globalShortcut.register(accelerator, callback);
      } catch (err) {
        console.warn(`Failed to register hotkey "${accelerator}":`, err.message);
      }
    }
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────
function setupIPC() {
  // Screenshot capture — compressed JPEG (max 1024px) to prevent 429 Rate Limit Errors
  ipcMain.handle('halo:capture-screen', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 },
      });

      if (sources.length === 0) return null;

      const thumb = sources[0].thumbnail;
      const resized = thumb.resize({ width: 1024 });
      const jpegBuf = resized.toJPEG(75);
      return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      return null;
    }
  });

  // Config management
  ipcMain.handle('halo:config-get', (_event, key, defaultValue) => {
    return config.get(key, defaultValue);
  });

  ipcMain.handle('halo:config-set', (_event, key, value) => {
    config.set(key, value);

    // Re-register hotkeys if they changed
    if (key === 'hotkeys') {
      registerHotkeys();
    }
  });

  ipcMain.handle('halo:config-get-all', () => {
    return config.getAll();
  });

  // Window controls
  ipcMain.on('halo:toggle-visibility', () => toggleVisibility());

  ipcMain.on('halo:set-ignore-mouse', (_event, ignore) => {
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  // Dynamic resize — expand/collapse the toolbar
  ipcMain.on('halo:resize', (_event, height) => {
    if (!mainWindow) return;
    const clampedHeight = Math.max(TOOLBAR_HEIGHT, Math.min(height, MAX_EXPANDED_HEIGHT));
    const [w] = mainWindow.getSize();
    mainWindow.setSize(w, Math.round(clampedHeight), true);
  });

  ipcMain.handle('halo:get-toolbar-height', () => TOOLBAR_HEIGHT);

  // Listening state sync
  ipcMain.on('halo:listening-state', (_event, state) => {
    isListening = state;
    updateTrayMenu();
  });

  // ─── Knowledge Base IPC ─────────────────────────────────────────────

  // Resume
  ipcMain.handle('halo:upload-resume', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Upload Resume',
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt', 'md'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return await kb.setResume(result.filePaths[0]);
  });

  ipcMain.handle('halo:get-resume', () => {
    return kb.getResume();
  });

  ipcMain.handle('halo:clear-resume', () => {
    kb.clearResume();
    return true;
  });

  // Documents
  ipcMain.handle('halo:upload-doc', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Upload Document',
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'json'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || result.filePaths.length === 0) return [];

    const added = [];
    for (const fp of result.filePaths) {
      try {
        const doc = await kb.addDocument(fp);
        added.push(doc);
      } catch (err) {
        console.error('Failed to add document:', fp, err.message);
      }
    }
    return added;
  });

  ipcMain.handle('halo:list-docs', () => {
    return kb.listDocuments();
  });

  ipcMain.handle('halo:remove-doc', (_event, id) => {
    return kb.removeDocument(id);
  });

  ipcMain.handle('halo:get-knowledge-context', () => {
    return kb.getContext();
  });

  ipcMain.handle('halo:has-knowledge', () => {
    return kb.hasContext();
  });

  // ─── Meeting Detection IPC ──────────────────────────────────────────

  ipcMain.handle('halo:get-active-meeting', () => {
    return meetingDetector ? meetingDetector.getActiveMeeting() : null;
  });

  // ─── System Prompts IPC ─────────────────────────────────────────────

  ipcMain.handle('halo:get-prompt', (_event, action) => {
    return getPrompt(action);
  });

  // ─── AI Provider & STT IPC ──────────────────────────────────────────
  ipcMain.on('halo:stream-ai', async (event, payload) => {
    const { id, messages = [], screenshot } = payload;
    let providerName = 'openai';

    try {
      providerName = config.get('provider', 'openai');
      const apiKey = config.get('apiKey', '');
      const useSmart = config.get('useSmart', true);

      if (!apiKey) {
        throw new Error(`API key for provider "${providerName}" is missing. Please set your key in Settings.`);
      }

      const model = getModel(providerName, useSmart);
      const provider = createProvider(providerName, apiKey);

      // Inject Knowledge Base context if available
      const kbContext = kb ? kb.getContext() : '';
      const processedMessages = messages.map((m) => ({ ...m }));

      if (kbContext) {
        const sysIdx = processedMessages.findIndex((m) => m.role === 'system');
        if (sysIdx !== -1) {
          processedMessages[sysIdx].content += `\n\n[KNOWLEDGE BASE & RESUME CONTEXT]\n${kbContext}`;
        } else {
          processedMessages.unshift({
            role: 'system',
            content: `[KNOWLEDGE BASE & RESUME CONTEXT]\n${kbContext}`,
          });
        }
      }

      // Format multimodal image if screenshot attached
      if (screenshot && typeof screenshot === 'string' && screenshot.startsWith('data:image/')) {
        let lastUserIdx = -1;
        for (let i = processedMessages.length - 1; i >= 0; i--) {
          if (processedMessages[i].role === 'user') {
            lastUserIdx = i;
            break;
          }
        }

        if (lastUserIdx !== -1) {
          const userMsg = processedMessages[lastUserIdx];
          const textPrompt = typeof userMsg.content === 'string'
            ? userMsg.content
            : 'Analyze the visible content on screen.';

          userMsg.content = [
            { type: 'text', text: textPrompt },
            { type: 'image_url', image_url: { url: screenshot, detail: 'low' } },
          ];
        }
      }

      let fullText = '';
      for await (const chunk of provider.chat(processedMessages, { model })) {
        fullText += chunk;
        if (mainWindow && !mainWindow.isDestroyed()) {
          event.sender.send('halo:ai-chunk', { id, chunk });
        }
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        event.sender.send('halo:ai-end', { id, fullText });
      }
    } catch (err) {
      console.error('AI Stream Error:', err.message);
      let userErrorMsg = err.message;
      if (err.message.includes('429') || err.message.includes('Too Many Requests') || err.message.includes('RESOURCE_EXHAUSTED')) {
        userErrorMsg = 'Rate limit reached (429 Too Many Requests). Please wait a few seconds before trying again, or check your API key quota in provider settings.';
      } else if (err.message.includes('401') || err.message.includes('API key') || err.message.includes('unauthorized')) {
        userErrorMsg = `Authentication error with ${providerName}. Please verify your API key in Settings.`;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        event.sender.send('halo:ai-error', { id, error: userErrorMsg });
      }
    }
  });

  ipcMain.handle('halo:transcribe-audio', async (_event, audioBuffer, format = 'webm') => {
    try {
      const sttProviderName = config.get('sttProvider', 'openai');
      let sttApiKey = config.get('sttApiKey') || (sttProviderName === config.get('provider') ? config.get('apiKey') : '');

      const buf = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
      let provider = null;

      if (sttApiKey) {
        try {
          const p = createProvider(sttProviderName, sttApiKey);
          if (p.supportsTranscription()) provider = p;
        } catch {
          // ignore instantiation failure
        }
      }

      // Fallback: try getTranscriptionProvider with available keys
      if (!provider) {
        const primaryProvider = config.get('provider');
        const primaryKey = config.get('apiKey');
        const configs = {
          openai: { apiKey: sttProviderName === 'openai' ? sttApiKey : (primaryProvider === 'openai' ? primaryKey : '') },
          gemini: { apiKey: sttProviderName === 'gemini' ? sttApiKey : (primaryProvider === 'gemini' ? primaryKey : '') },
        };
        provider = getTranscriptionProvider(configs);
      }

      if (!provider) {
        throw new Error(`Provider "${sttProviderName}" does not support speech transcription. Please configure OpenAI or Gemini API key in Settings.`);
      }

      return await provider.transcribe(buf, format);
    } catch (err) {
      console.error('STT Transcription error:', err);
      throw err;
    }
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  config = new ConfigManager();
  kb = new KnowledgeBase();
  meetingDetector = new MeetingDetector();

  createOverlayWindow();
  createTray();
  setupIPC();
  registerHotkeys();

  // Start meeting detection
  meetingDetector.start();

  meetingDetector.on('meeting-started', (meeting) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('halo:meeting-detected', meeting);
    }
  });

  meetingDetector.on('meeting-ended', (meeting) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('halo:meeting-ended', meeting);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep the app running in the tray on macOS
  // Don't quit — the tray icon stays active
  if (process.platform !== 'darwin') {
    // On non-macOS, we still don't quit (tray keeps running)
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

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
} = require('electron');
const path = require('path');
const { ConfigManager } = require('./src/config');

// ─── Globals ────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let config = null;
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
    x: Math.round((screenWidth - TOOLBAR_WIDTH) / 2),
    y: 8,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
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
  // Screenshot capture
  ipcMain.handle('halo:capture-screen', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: screen.getPrimaryDisplay().size,
      });

      if (sources.length === 0) return null;

      const primarySource = sources[0];
      return primarySource.thumbnail.toDataURL();
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
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  config = new ConfigManager();

  createOverlayWindow();
  createTray();
  setupIPC();
  registerHotkeys();

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

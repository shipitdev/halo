const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function app() {
  const appEvents = {}, shortcuts = new Map(), windows = [];
  let trayMenu;
  class BrowserWindow {
    constructor() {
      this.visible = true;
      this.destroyed = false;
      this.handlers = {};
      this.sent = [];
      this.webContents = { send: (...args) => this.sent.push(args) };
      windows.push(this);
    }
    setContentProtection() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {}
    loadFile() {} getSize() { return [700, 48]; }
    on(name, callback) { this.handlers[name] = callback; }
    hide() { this.visible = false; }
    show() { this.visible = true; }
    focus() {}
    isDestroyed() { return this.destroyed; }
  }
  const electron = {
    app: {
      whenReady: () => ({ then() {} }),
      requestSingleInstanceLock: () => true,
      on: (name, callback) => { appEvents[name] = callback; },
      quit() {},
    },
    BrowserWindow,
    Tray: class { setToolTip() {} setContextMenu(menu) { trayMenu = menu; } },
    Menu: { buildFromTemplate: items => items },
    ipcMain: { handle() {}, on() {} },
    globalShortcut: {
      unregisterAll: () => shortcuts.clear(),
      register: (key, callback) => { shortcuts.set(key, callback); return true; },
    },
    nativeImage: { createFromDataURL: () => ({ setTemplateImage() {} }) },
    screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920 } }) },
    dialog: {},
  };
  const context = {
    require(name) {
      if (name === 'electron') return electron;
      if (name === 'path') return path;
      if (name === './src/config') return { ConfigManager: class {} };
      if (name === './src/knowledge') return { KnowledgeBase: class {} };
      if (name === './src/meetings') return { MeetingDetector: class {} };
      if (name === './src/capture') return { captureScreen() {} };
      if (name === './src/providers') return { createProvider() {}, getTranscriptionProvider() {}, getModel() {} };
      if (name === './src/prompts') return { getPrompt() {} };
      throw new Error(`Unexpected require: ${name}`);
    },
    __dirname: process.cwd(), Buffer, console, process,
  };
  vm.createContext(context);
  const source = fs.readFileSync('./main.js', 'utf8');
  vm.runInContext(source + `
    globalThis.testHooks = {
      createOverlayWindow, createTray, registerHotkeys, toggleVisibility,
      setConfig(value) { config = value; },
      getWindow() { return mainWindow; },
    };
  `, context);
  context.testHooks.setConfig({ get: (_key, fallback) => fallback });
  context.testHooks.createOverlayWindow();
  context.testHooks.createTray();
  context.testHooks.registerHotkeys();
  const currentWindow = () => windows[windows.length - 1];
  const toggleMenu = () => trayMenu.find(item => item.label?.includes('Overlay'));
  return { appEvents, shortcuts, windows, currentWindow, toggleMenu, trayMenu: () => trayMenu,
    testHooks: context.testHooks };
}

test('hotkey show paths restore visibility state and the next toggle hides', async () => {
  for (const key of ['CommandOrControl+Return', 'CommandOrControl+Shift+H']) {
    const halo = app();
    const win = halo.currentWindow();
    halo.shortcuts.get('CommandOrControl+B')();
    assert.equal(win.visible, false);
    halo.shortcuts.get(key)();
    assert.equal(win.visible, true);
    assert.match(halo.toggleMenu().label, /Hide Overlay/);
    halo.shortcuts.get('CommandOrControl+B')();
    assert.equal(win.visible, false);
    assert.match(halo.toggleMenu().label, /Show Overlay/);
  }
});

test('tray Settings show restores visibility state and the next toggle hides', () => {
  const halo = app();
  const win = halo.currentWindow();
  halo.shortcuts.get('CommandOrControl+B')();
  halo.trayMenu().find(item => item.label?.includes('Settings')).click();
  assert.equal(win.visible, true);
  assert.match(halo.toggleMenu().label, /Hide Overlay/);
  halo.shortcuts.get('CommandOrControl+B')();
  assert.equal(win.visible, false);
  assert.match(halo.toggleMenu().label, /Show Overlay/);
});

test('second-instance show restores visibility state and the next toggle hides', () => {
  const halo = app();
  const win = halo.currentWindow();
  halo.shortcuts.get('CommandOrControl+B')();
  halo.appEvents['second-instance']();
  assert.equal(win.visible, true);
  assert.match(halo.toggleMenu().label, /Hide Overlay/);
  halo.shortcuts.get('CommandOrControl+B')();
  assert.equal(win.visible, false);
  assert.match(halo.toggleMenu().label, /Show Overlay/);
});

test('a recreated window reflects visibility state before its next toggle', () => {
  const halo = app();
  const oldWindow = halo.currentWindow();
  halo.shortcuts.get('CommandOrControl+B')();
  oldWindow.destroyed = true;
  oldWindow.handlers.closed();
  halo.testHooks.createOverlayWindow();
  const newWindow = halo.currentWindow();
  assert.equal(newWindow.visible, true);
  halo.shortcuts.get('CommandOrControl+B')();
  assert.equal(newWindow.visible, false);
  assert.match(halo.toggleMenu().label, /Show Overlay/);
});

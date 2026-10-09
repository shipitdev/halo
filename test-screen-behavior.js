const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function capture({ fail = false, access = 'granted', visible = true } = {}) {
  const events = [];
  let request;
  const overlayWindow = {
    isDestroyed: () => false, isVisible: () => visible,
    getBounds: () => ({ x: 2000, y: 0, width: 700, height: 48 }),
    hide: () => events.push('hidden'), showInactive: () => events.push('restored'),
  };
  const electron = {
    systemPreferences: { getMediaAccessStatus: () => access },
    screen: {
      getPrimaryDisplay: () => ({ id: 1, size: { width: 1440, height: 900 }, scaleFactor: 2 }),
      getDisplayMatching: () => ({ id: 2, size: { width: 1920, height: 1080 }, scaleFactor: 2 }),
    },
    desktopCapturer: { getSources: async options => {
      events.push('captured'); request = options;
      if (fail) throw new Error('Capture unavailable');
      return [1, 2].map(id => ({ display_id: String(id), thumbnail: {
        isEmpty: () => false, toPNG: () => Buffer.from(`display-${id}`),
      } }));
    } },
  };
  const context = { require: () => electron, module: { exports: {} }, Buffer,
    process: { platform: 'darwin' }, setTimeout: callback => callback() };
  vm.runInNewContext(fs.readFileSync('./src/capture.js', 'utf8'), context);
  return { ...context.module.exports, overlayWindow, events, request: () => request };
}

test('captures the overlay display as readable PNG and restores without taking focus', async () => {
  const app = capture();
  const data = await app.captureScreen({ overlayWindow: app.overlayWindow });
  assert.equal(Buffer.from(data.split(',')[1], 'base64').toString(), 'display-2');
  assert.ok(data.startsWith('data:image/png;base64,'));
  assert.deepEqual(app.events, ['hidden', 'captured', 'restored']);
  assert.equal(app.request().thumbnailSize.width, 2560);
  assert.equal(app.request().thumbnailSize.height, 1440);
});

test('capture failure still restores the overlay', async () => {
  const app = capture({ fail: true });
  await assert.rejects(app.captureScreen({ overlayWindow: app.overlayWindow }), /Capture unavailable/);
  assert.deepEqual(app.events, ['hidden', 'captured', 'restored']);
});

test('permission denial does not hide the app or attempt capture', async () => {
  const app = capture({ access: 'denied' });
  await assert.rejects(app.captureScreen({ overlayWindow: app.overlayWindow }), /Screen Recording access is blocked/);
  assert.deepEqual(app.events, []);
});

test('a previously hidden overlay stays hidden and PNG buffer uses the same display', async () => {
  const app = capture({ visible: false });
  const data = await app.captureScreenBuffer({ overlayWindow: app.overlayWindow });
  assert.equal(data.toString(), 'display-2');
  assert.deepEqual(app.events, ['captured']);
});

function renderer(captureScreen) {
  const actions = [], messages = [], events = [], handlers = {};
  const context = { console, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    window: { halo: { captureScreen } } };
  vm.createContext(context);
  let code = fs.readFileSync('./renderer/app.js', 'utf8');
  code = code.replace("document.addEventListener('DOMContentLoaded', init);", `
    expandPanel = () => globalThis.events.push('expanded');
    showToast = () => {}; setStatus = () => {};
    appendResponse = (...args) => globalThis.messages.push(args);
    runAI = async (...args) => globalThis.actions.push(args);
    dom.inputField = { value: 'Explain this chart', addEventListener() {} };
    dom.btnCode = { addEventListener: (name, handler) => globalThis.handlers[name] = handler };
    state.apiKey = 'test-only';
    globalThis.app = { triggerAction, bindEvents, state, dom };
  `);
  Object.assign(context, { actions, messages, events, handlers });
  vm.runInContext(code, context);
  return { ...context.app, actions, messages, events, handlers };
}

test('Screen click captures before expanding and sends the screenshot with the note', async () => {
  const app = renderer(async () => 'data:image/png;base64,c2NyZWVu');
  app.bindEvents(); await app.handlers.click();
  assert.equal(app.actions[0][0], 'analyzeScreen');
  assert.equal(app.actions[0][2].userInput, 'Explain this chart');
  assert.equal(app.actions[0][2].screenshot, 'data:image/png;base64,c2NyZWVu');
  assert.equal(app.dom.inputField.value, '');
  assert.deepEqual(app.events, ['expanded']);
});

test('duplicate Screen clicks do not capture twice and edits made while waiting survive', async () => {
  let resolve, requests = 0;
  const app = renderer(() => { requests++; return new Promise(done => { resolve = done; }); });
  const first = app.triggerAction('analyzeScreen');
  await app.triggerAction('analyzeScreen');
  assert.deepEqual(app.events, []);
  app.dom.inputField.value = 'New question';
  resolve('data:image/png;base64,c2NyZWVu'); await first;
  assert.equal(requests, 1); assert.equal(app.actions.length, 1);
  assert.equal(app.dom.inputField.value, 'New question');
});

test('a failed Screen capture preserves the note and does not ask AI to guess', async () => {
  const app = renderer(async () => { throw new Error('Permission denied'); });
  await app.triggerAction('analyzeScreen');
  assert.equal(app.actions.length, 0); assert.equal(app.state.isCapturing, false);
  assert.equal(app.dom.inputField.value, 'Explain this chart');
  assert.match(app.messages[0][1], /Permission denied/);
});

test('Screen without an API key does not capture desktop content', async () => {
  let requests = 0;
  const app = renderer(async () => requests++);
  app.state.apiKey = '';
  await app.triggerAction('analyzeScreen'); assert.equal(requests, 0);
});

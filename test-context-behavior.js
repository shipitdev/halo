const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function renderer() {
  const actions = [];
  const context = { console, document: { addEventListener() {} },
    window: { halo: { captureScreen: async () => 'data:image/png;base64,c2NyZWVu' } }, actions };
  vm.createContext(context);
  const code = fs.readFileSync('./renderer/app.js', 'utf8').replace("document.addEventListener('DOMContentLoaded', init);", `
    expandPanel = () => {}; setStatus = () => {}; showToast = () => {};
    runAI = async (...args) => globalThis.actions.push(args);
    dom.inputField = { value: 'How should I approach this?' };
    state.apiKey = 'test-only';
    globalThis.app = { handleSend, triggerAction, transcriptManager, buildUserContent };
  `);
  vm.runInContext(code, context);
  return { ...context.app, actions };
}

test('ending a meeting keeps its transcript but restores normal assistance', async () => {
  const app = renderer();
  app.transcriptManager.setMeeting({ id: 'zoom', name: 'Zoom' });
  app.transcriptManager.add('Tell me about a difficult technical decision');
  app.transcriptManager.clearMeeting(); await app.triggerAction('assist');
  assert.equal(app.actions[0][0], 'assist');
  assert.match(app.actions[0][2].transcript, /technical decision/);
});

test('an active meeting selects meeting help without overriding the say action', async () => {
  const app = renderer();
  app.transcriptManager.setMeeting({ id: 'zoom', name: 'Zoom' });
  await app.triggerAction('assist'); await app.triggerAction('say');
  assert.equal(app.actions[0][0], 'meetingAssist');
  assert.equal(app.actions[1][0], 'say');
});

test('typed interview questions include the recent spoken context', async () => {
  const app = renderer(); app.transcriptManager.add('Explain the tradeoffs of caching');
  await app.handleSend();
  const [action, question, context] = app.actions[0];
  assert.equal(action, 'question');
  const content = app.buildUserContent(action, question, context);
  assert.match(content, /How should I approach this/);
  assert.match(content, /tradeoffs of caching/);
});

test('the overlay requests operating-system content protection', () => {
  const source = fs.readFileSync('./main.js', 'utf8');
  const code = source.slice(source.indexOf('function createOverlayWindow()'), source.indexOf('// ─── Tray Icon'));
  let protectedContent = false;
  class Window {
    setContentProtection(value) { protectedContent = value; }
    setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} loadFile() {} on() {}
  }
  const context = { BrowserWindow: Window, screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920 } }) },
    path: require('node:path'), __dirname: process.cwd(), TOOLBAR_WIDTH: 700, TOOLBAR_HEIGHT: 48, MAX_EXPANDED_HEIGHT: 750 };
  vm.runInNewContext(code + '\ncreateOverlayWindow();', context);
  assert.equal(protectedContent, true);
});

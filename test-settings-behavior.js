require('./test-isolation');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { ConfigManager, DEFAULT_CONFIG } = require('./src/config');

test('reset restores the original hotkeys and returned settings are independent', () => {
  const cfg = new ConfigManager();
  cfg.reset();
  cfg.set('hotkeys.toggleOverlay', 'Cmd+K'); cfg.reset();
  assert.equal(cfg.get('hotkeys.toggleOverlay'), 'CommandOrControl+B');
  const copy = cfg.getAll(); copy.hotkeys.assist = 'Broken';
  assert.equal(cfg.get('hotkeys.assist'), 'CommandOrControl+Return');
  assert.equal(DEFAULT_CONFIG.hotkeys.toggleOverlay, 'CommandOrControl+B');
});

test('partial hotkeys loaded from disk retain other default shortcuts', () => {
  const cfg = new ConfigManager();
  fs.writeFileSync(cfg.configPath, JSON.stringify({ hotkeys: { assist: 'Cmd+J' } }));
  const loaded = new ConfigManager();
  assert.equal(loaded.get('hotkeys.assist'), 'Cmd+J');
  assert.equal(loaded.get('hotkeys.quit'), 'CommandOrControl+Shift+X');
});

test('failed save preserves both the previous file and in-memory settings', () => {
  const cfg = new ConfigManager(); cfg.reset();
  const before = fs.readFileSync(cfg.configPath, 'utf8');
  const rename = fs.renameSync;
  fs.renameSync = () => { throw new Error('disk failure'); };
  try {
    assert.throws(() => cfg.set('provider', 'gemini'), /disk failure/);
    assert.equal(cfg.get('provider'), 'openai');
    assert.equal(fs.readFileSync(cfg.configPath, 'utf8'), before);
  } finally { fs.renameSync = rename; }
});

test('saving a group of settings writes one consistent snapshot', () => {
  const cfg = new ConfigManager(); cfg.reset();
  cfg.update({ provider: 'gemini', apiKey: 'test-only', hotkeys: { assist: 'Cmd+J' } });
  const loaded = new ConfigManager();
  assert.equal(loaded.get('provider'), 'gemini');
  assert.equal(loaded.get('apiKey'), 'test-only');
  assert.equal(loaded.get('hotkeys.quit'), 'CommandOrControl+Shift+X');
  assert.equal(fs.statSync(cfg.configPath).mode & 0o777, 0o600);
});

test('settings keys cannot mutate object prototypes', () => {
  const cfg = new ConfigManager();
  assert.throws(() => cfg.set('__proto__.haloPolluted', true), /Invalid settings key/);
  assert.equal({}.haloPolluted, undefined);
});

function settingsForm(save) {
  const vm = require('node:vm');
  const saved = [], messages = [];
  const context = { console, document: { addEventListener() {} },
    window: { halo: { settings: { save: async values => { saved.push(values); return save(values); } } } }, messages };
  vm.createContext(context);
  const code = fs.readFileSync('./renderer/app.js', 'utf8').replace("document.addEventListener('DOMContentLoaded', init);", `
    showToast = text => globalThis.messages.push(text);
    closeSettings = () => { globalThis.closed = true; };
    dom.selectProvider = { value: 'gemini' }; dom.inputApiKey = { value: 'test-only' };
    dom.selectSttProvider = { value: 'groq' }; dom.inputSttKey = { value: 'stt-test-only' };
    dom.audioInput = { value: 'mixed-input' };
    for (const name of ['hotkeyToggle', 'hotkeyAssist', 'hotkeyCode', 'hotkeyQuit']) dom[name] = { value: 'Cmd+J' };
    globalThis.form = { saveSettings, state };
  `);
  vm.runInContext(code, context);
  return { ...context.form, saved, messages, closed: () => context.closed };
}

test('failed settings submission keeps the form open and old state intact', async () => {
  const form = settingsForm(() => { throw new Error('disk failure'); });
  await form.saveSettings();
  assert.equal(form.closed(), undefined); assert.equal(form.state.provider, 'openai');
  assert.match(form.messages[0], /not saved.*disk failure/);
  assert.equal(form.saved.length, 1);
});

test('successful settings submission sends one snapshot and updates the UI state', async () => {
  const form = settingsForm(() => {}); await form.saveSettings();
  assert.equal(form.saved.length, 1); assert.equal(form.closed(), true);
  assert.equal(form.state.provider, 'gemini'); assert.equal(form.state.audioInputDeviceId, 'mixed-input');
});

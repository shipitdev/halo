const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function renderer({ config = { useSmart: true }, set = async () => {} } = {}) {
  const messages = [];
  const classes = new Set();
  const label = { textContent: 'smart' };
  const button = { classList: {
    add: name => classes.add(name),
    remove: name => classes.delete(name),
    toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
    contains: name => classes.has(name),
  } };
  const context = {
    console,
    document: { addEventListener() {} },
    window: { halo: { settings: {
      getAll: async () => config,
      set: (...args) => set(...args),
    } } },
    messages,
  };
  vm.createContext(context);
  const code = fs.readFileSync('./renderer/app.js', 'utf8').replace("document.addEventListener('DOMContentLoaded', init);", `
    showToast = text => globalThis.messages.push(text);
    dom.modelLabel = globalThis.label;
    dom.btnModelToggle = globalThis.button;
    globalThis.app = { loadSettings, toggleModel, state, dom };
  `);
  Object.assign(context, { label, button });
  vm.runInContext(code, context);
  return { ...context.app, label, button, classes, messages };
}

test('saved fast model loads into both label and button styling', async () => {
  const app = renderer({ config: { useSmart: false } });
  await app.loadSettings();
  assert.equal(app.state.useSmart, false);
  assert.equal(app.label.textContent, 'fast');
  assert.equal(app.button.classList.contains('fast'), true);
});

test('a failed model preference save restores prior state and reports the failure', async () => {
  const app = renderer({ set: () => {
    const pending = Promise.reject(new Error('disk failure'));
    pending.catch(() => {});
    return pending;
  } });
  await app.toggleModel();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.state.useSmart, true);
  assert.equal(app.label.textContent, 'smart');
  assert.equal(app.button.classList.contains('fast'), false);
  assert.match(app.messages.join(' '), /disk failure/);
});

test('a pending toggle keeps the old choice until saving succeeds', async () => {
  let resolveSave;
  const app = renderer({ set: () => new Promise(resolve => { resolveSave = resolve; }) });
  const pending = app.toggleModel();
  assert.equal(app.state.useSmart, true);
  assert.equal(app.label.textContent, 'smart');
  resolveSave();
  await pending;
  assert.equal(app.state.useSmart, false);
  assert.equal(app.label.textContent, 'fast');
  assert.equal(app.button.classList.contains('fast'), true);
});

test('a second toggle while a save is pending cannot leave a stale choice after failure', async () => {
  let rejectSave;
  const app = renderer({ set: () => {
    const pending = new Promise((_, reject) => { rejectSave = reject; });
    pending.catch(() => {});
    return pending;
  } });
  const first = app.toggleModel();
  const second = app.toggleModel();
  rejectSave(new Error('disk failure'));
  await Promise.all([first, second]);
  assert.equal(app.state.useSmart, true);
  assert.equal(app.label.textContent, 'smart');
  assert.equal(app.button.classList.contains('fast'), false);
  assert.match(app.messages.join(' '), /disk failure/);
});

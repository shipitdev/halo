const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function renderer({ provider = 'openai', apiKey = 'test-only', streamError = null } = {}) {
  const messages = [], toasts = [];
  const body = {
    classList: { add() {}, remove() {} },
    set innerHTML(value) { this.html = value; },
  };
  const input = { value: 'Explain the design tradeoff' };
  const document = {
    addEventListener() {},
    createElement() {
      let value = '';
      return { set textContent(text) {
        value = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      }, get innerHTML() { return value; } };
    },
  };
  const context = {
    console, document, body, input, messages, toasts,
    window: { halo: { getPrompt: async () => 'Prompt' } },
  };
  vm.createContext(context);
  const code = fs.readFileSync('./renderer/app.js', 'utf8').replace("document.addEventListener('DOMContentLoaded', init);", `
    autoExpand = () => {}; expandPanel = () => {}; scrollToBottom = () => {}; setStatus = () => {};
    showToast = text => globalThis.toasts.push(text);
    openSettings = () => globalThis.settingsOpened = true;
    appendResponse = (...args) => globalThis.messages.push(args);
    createResponseEntry = () => ({ querySelector: () => globalThis.body });
    streamAIResponse = async () => { if (globalThis.streamError) throw globalThis.streamError; return 'answer'; };
    dom.inputField = globalThis.input;
    state.provider = globalThis.provider;
    state.apiKey = globalThis.apiKey;
    globalThis.app = { handleSend, runAI, state, dom };
  `);
  Object.assign(context, { provider, apiKey, streamError });
  vm.runInContext(code, context);
  return { ...context.app, body, input, messages, toasts,
    settingsOpened: () => context.settingsOpened };
}

test('typed send without an API key preserves the question while opening settings', async () => {
  const app = renderer({ apiKey: '' });
  await app.handleSend();
  assert.equal(app.input.value, 'Explain the design tradeoff');
  assert.equal(app.settingsOpened(), true);
  assert.equal(app.messages.length, 1);
});

for (const provider of ['openai', 'anthropic']) {
  test(`${provider} 429 feedback does not blame Gemini`, async () => {
    const app = renderer({ provider, streamError: new Error('429 rate limit exceeded') });
    await app.runAI('question', 'Question');
    assert.match(app.body.html, /429|quota/i);
    assert.doesNotMatch(app.body.html, /Gemini|Google|Free Tier|AIza/);
  });
}

test('generic provider errors remain escaped in rendered output', async () => {
  const app = renderer({ streamError: new Error('<img src=x onerror=alert(1)>') });
  await app.runAI('question', 'Question');
  assert.doesNotMatch(app.body.html, /<img\s/i);
  assert.match(app.body.html, /&lt;img|&amp;lt;img/);
});

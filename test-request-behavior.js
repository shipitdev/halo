const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function renderer({ promptFailure = false } = {}) {
  const frames = new Map(); let nextFrame = 0, callbacks, renders = 0;
  const body = { classList: { add() {}, remove() {} } };
  const context = { console, document: {
    addEventListener() {}, createElement() { return { textContent: '', get innerHTML() {
      return this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    } }; },
  }, requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
  cancelAnimationFrame: id => frames.delete(id),
  window: { halo: { getPrompt: async () => { if (promptFailure) throw new Error('IPC unavailable'); return 'Prompt'; },
    streamAI: (_, ...value) => { callbacks = value; },
  } }, body };
  vm.createContext(context);
  const code = fs.readFileSync('./renderer/app.js', 'utf8').replace("document.addEventListener('DOMContentLoaded', init);", `
    autoExpand = () => {}; scrollToBottom = () => {}; setStatus = () => {}; showToast = () => {}; openSettings = () => {};
    createResponseEntry = () => ({ querySelector: () => globalThis.body });
    appendResponse = () => {};
    state.apiKey = 'test-only';
    globalThis.app = { runAI, state, streamAIResponse, renderMarkdown };
  `);
  vm.runInContext(code, context);
  const target = { set innerHTML(value) { renders++; this.html = value; } };
  return { ...context.app, target, frames, renders: () => renders, callbacks: () => callbacks };
}

test('a failed prompt lookup releases the assistant for another action', async () => {
  const app = renderer({ promptFailure: true });
  await app.runAI('analyzeScreen');
  assert.equal(app.state.isProcessing, false);
});

test('streamed chunks share a render frame and final text renders before completion', async () => {
  const app = renderer();
  const answer = app.streamAIResponse([], app.target);
  const [chunk, finish] = app.callbacks();
  chunk('Hello'); chunk(' there'); chunk('!');
  assert.equal(app.renders(), 0); assert.equal(app.frames.size, 1);
  finish('Hello there!');
  assert.equal(await answer, 'Hello there!');
  assert.equal(app.renders(), 1); assert.equal(app.frames.size, 0);
});

test('stream failure flushes partial text and clears pending render work', async () => {
  const app = renderer();
  const answer = app.streamAIResponse([], app.target);
  const [chunk, , fail] = app.callbacks(); chunk('Partial answer'); fail(new Error('Disconnected'));
  await assert.rejects(answer, /Disconnected/);
  assert.equal(app.frames.size, 0); assert.match(app.target.html, /Partial answer/);
});

test('math markup renders while embedded HTML stays escaped', () => {
  const app = renderer();
  app.renderMarkdown(app.target, '$x < y$ and $$z$$');
  assert.match(app.target.html, /<span class="math-inline">x &lt; y<\/span>/);
  assert.match(app.target.html, /<div class="math-block">z<\/div>/);
});

test('coding answers preserve literal replacement tokens inside code blocks', () => {
  const app = renderer();
  app.renderMarkdown(app.target, '```js\nconst replacement = "$&";\n```');
  assert.ok(app.target.html.includes('const replacement = &quot;$&amp;&quot;;'));
  assert.equal(app.target.html.includes('___CODE_BLOCK_0___'), false);
});

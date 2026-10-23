const { after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'halo-knowledge-tests-'));
const load = Module._load;
Module._load = function (request, ...args) {
  if (request === 'electron') return { app: { getPath: () => userData } };
  return load.call(this, request, ...args);
};
const { KnowledgeBase } = require('./src/knowledge');
Module._load = load;

const knowledgeDir = path.join(userData, 'knowledge');
const resumeFile = path.join(knowledgeDir, 'resume.json');
const docsFile = path.join(knowledgeDir, 'documents.json');
const inputs = path.join(userData, 'inputs');

beforeEach(() => {
  fs.rmSync(knowledgeDir, { recursive: true, force: true });
  fs.mkdirSync(inputs, { recursive: true });
});

after(() => fs.rmSync(userData, { recursive: true, force: true }));

async function withFsFailure(method, matches, run) {
  const original = fs[method];
  fs[method] = function (file, ...args) {
    const target = method === 'renameSync' ? args[0] : file;
    if (matches(String(target))) throw new Error(`Injected ${method} failure`);
    return original.call(this, file, ...args);
  };
  try {
    return await run();
  } finally {
    fs[method] = original;
  }
}

function input(name, content) {
  const file = path.join(inputs, name);
  fs.writeFileSync(file, content);
  return file;
}

function temporaryKnowledgeFiles() {
  return fs.readdirSync(knowledgeDir).filter(name => name.endsWith('.tmp'));
}

test('failed resume replacement preserves the saved file, memory, and context', async () => {
  const kb = new KnowledgeBase();
  await kb.setResume(input('old.txt', 'old resume'));
  const saved = fs.readFileSync(resumeFile, 'utf8');
  const context = kb.getContext();

  await withFsFailure('writeFileSync', file => file.startsWith(resumeFile), async () => {
    await assert.rejects(kb.setResume(input('new.txt', 'new resume')), /writeFileSync failure/);
  });

  assert.equal(fs.readFileSync(resumeFile, 'utf8'), saved);
  assert.deepEqual(temporaryKnowledgeFiles(), []);
  assert.equal(kb.getResume().text, 'old resume');
  assert.equal(kb.getContext(), context);
});

test('failed document add and removal preserve prior file, list, and context', async () => {
  const kb = new KnowledgeBase();
  await kb.addDocument(input('kept.txt', 'kept content'));
  const saved = fs.readFileSync(docsFile, 'utf8');
  const context = kb.getContext();

  await withFsFailure('writeFileSync', file => file.startsWith(docsFile), async () => {
    await assert.rejects(kb.addDocument(input('rejected.txt', 'new content')), /writeFileSync failure/);
  });
  assert.equal(fs.readFileSync(docsFile, 'utf8'), saved);
  assert.deepEqual(temporaryKnowledgeFiles(), []);
  assert.deepEqual(kb.listDocuments().map(doc => doc.filename), ['kept.txt']);
  assert.equal(kb.getContext(), context);

  const id = kb.listDocuments()[0].id;
  await withFsFailure('writeFileSync', file => file.startsWith(docsFile), () => {
    assert.throws(() => kb.removeDocument(id), /writeFileSync failure/);
  });
  assert.equal(fs.readFileSync(docsFile, 'utf8'), saved);
  assert.deepEqual(kb.listDocuments().map(doc => doc.filename), ['kept.txt']);
  assert.equal(kb.getContext(), context);
});

test('failed resume unlink preserves resume in memory and context', async () => {
  const kb = new KnowledgeBase();
  await kb.setResume(input('resume.txt', 'resume to keep'));
  const saved = fs.readFileSync(resumeFile, 'utf8');
  const context = kb.getContext();

  await withFsFailure('unlinkSync', file => file === resumeFile, () => {
    assert.throws(() => kb.clearResume(), /unlinkSync failure/);
  });
  assert.equal(fs.readFileSync(resumeFile, 'utf8'), saved);
  assert.deepEqual(temporaryKnowledgeFiles(), []);
  assert.equal(kb.getResume().text, 'resume to keep');
  assert.equal(kb.getContext(), context);
});

test('failed atomic replacement keeps the original resume file intact', async () => {
  const kb = new KnowledgeBase();
  await kb.setResume(input('old.txt', 'original'));
  const saved = fs.readFileSync(resumeFile, 'utf8');

  await withFsFailure('renameSync', file => file === resumeFile, async () => {
    await assert.rejects(kb.setResume(input('new.txt', 'replacement')), /renameSync failure/);
  });

  assert.equal(fs.readFileSync(resumeFile, 'utf8'), saved);
  assert.deepEqual(temporaryKnowledgeFiles(), []);
  assert.equal(kb.getResume().text, 'original');
});

test('resume and document data round-trip through disk', async () => {
  const kb = new KnowledgeBase();
  await kb.setResume(input('resume.txt', 'resume text'));
  const added = await kb.addDocument(input('notes.md', 'document text'));
  assert.equal(fs.statSync(resumeFile).mode & 0o777, 0o600);
  assert.equal(fs.statSync(docsFile).mode & 0o777, 0o600);

  const reloaded = new KnowledgeBase();
  assert.equal(reloaded.getResume().text, 'resume text');
  assert.deepEqual(reloaded.listDocuments().map(doc => doc.filename), ['notes.md']);
  assert.ok(reloaded.getContext().includes('resume text'));
  assert.ok(reloaded.getContext().includes('document text'));
  assert.equal(reloaded.removeDocument(added.id), true);
});

test('invalid PDF parsing rejects without replacing saved resume or documents', async () => {
  const kb = new KnowledgeBase();
  await kb.setResume(input('saved.txt', 'saved resume'));
  await kb.addDocument(input('saved.md', 'saved document'));
  const resume = fs.readFileSync(resumeFile, 'utf8');
  const docs = fs.readFileSync(docsFile, 'utf8');
  const pdf = input('broken.pdf', '%PDF-invalid bytes');

  Module._load = function (request, ...args) {
    if (request === 'pdf-parse') return async () => { throw new Error('Invalid PDF'); };
    return load.call(this, request, ...args);
  };
  try {
    await assert.rejects(kb.setResume(pdf), /Invalid PDF/);
    await assert.rejects(kb.addDocument(pdf), /Invalid PDF/);
  } finally {
    Module._load = load;
  }

  assert.equal(fs.readFileSync(resumeFile, 'utf8'), resume);
  assert.equal(fs.readFileSync(docsFile, 'utf8'), docs);
  assert.equal(kb.getResume().text, 'saved resume');
  assert.deepEqual(kb.listDocuments().map(doc => doc.filename), ['saved.md']);
});

test('PDFParse v2 parser is destroyed after successful extraction', async () => {
  const kb = new KnowledgeBase();
  const pdf = input('valid.pdf', '%PDF-valid');
  let destroyed = 0;
  Module._load = function (request, ...args) {
    if (request === 'pdf-parse') return { PDFParse: class {
      constructor(options) { assert.equal(options.data.toString(), '%PDF-valid'); }
      async getText() { return { text: 'parsed PDF text' }; }
      async destroy() { destroyed++; }
    } };
    return load.call(this, request, ...args);
  };
  try {
    await kb.setResume(pdf);
  } finally {
    Module._load = load;
  }
  assert.equal(kb.getResume().text, 'parsed PDF text');
  assert.equal(destroyed, 1);
});

test('PDFParse v2 parser is destroyed when extraction fails', async () => {
  const kb = new KnowledgeBase();
  const pdf = input('broken.pdf', '%PDF-broken');
  let destroyed = 0;
  Module._load = function (request, ...args) {
    if (request === 'pdf-parse') return { PDFParse: class {
      async getText() { throw new Error('Invalid PDF'); }
      async destroy() { destroyed++; }
    } };
    return load.call(this, request, ...args);
  };
  try {
    await assert.rejects(kb.setResume(pdf), /Invalid PDF/);
  } finally {
    Module._load = load;
  }
  assert.equal(destroyed, 1);
});

function uploadDocsIPC(filePaths, knowledge) {
  const handlers = {};
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths }) };
  const electron = {
    app: {
      whenReady: () => ({ then() {} }),
      requestSingleInstanceLock: () => true,
      on() {},
    },
    BrowserWindow: class {}, Tray: class {}, Menu: {},
    ipcMain: { handle: (channel, handler) => { handlers[channel] = handler; }, on() {} },
    globalShortcut: {}, nativeImage: {}, screen: {}, dialog,
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
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8') + `
    globalThis.testHooks = { setupIPC, setKnowledge(value) { kb = value; } };
  `, context);
  context.testHooks.setKnowledge(knowledge);
  context.testHooks.setupIPC();
  return handlers['halo:upload-doc']();
}

test('multi-file document upload reports partial failures instead of silently returning successes', async () => {
  const added = [];
  const good = input('good.txt', 'good');
  const bad = input('bad.pdf', '%PDF-broken');
  const knowledge = { async addDocument(file) {
    if (file === bad) throw new Error('Failed to extract PDF text: Invalid PDF');
    const doc = { filename: path.basename(file), textLength: 4 };
    added.push(doc);
    return doc;
  } };

  await assert.rejects(uploadDocsIPC([good, bad], knowledge), /Added 1 document\(s\).*bad\.pdf.*Invalid PDF/);
  assert.deepEqual(added.map(doc => doc.filename), ['good.txt']);
});

function renderer(knowledge, docs = []) {
  const handlers = {};
  const docsList = { innerHTML: '', children: [], appendChild(node) { this.children.push(node); } };
  const context = {
    console,
    document: {
      addEventListener() {},
      createElement() {
        return {
          style: {},
          querySelector() {
            return { addEventListener(_event, handler) { handlers.remove = handler; } };
          },
        };
      },
    },
    window: { halo: { knowledge } },
    toastMessages: [],
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'renderer/app.js'), 'utf8')
    .replace("document.addEventListener('DOMContentLoaded', init);", `
      dom.docsList = globalThis.docsList;
      showToast = message => globalThis.toastMessages.push(message);
      escapeHtml = value => value;
      globalThis.actions = { handleUploadResume, handleUploadDocs, renderDocsUI };
    `);
  context.docsList = docsList;
  vm.runInContext(source, context);
  return { actions: context.actions, handlers, docsList, toastMessages: context.toastMessages };
}

test('renderer reports resume upload failures to the user', async () => {
  const app = renderer({ uploadResume: async () => { throw new Error('disk full'); } });
  await app.actions.handleUploadResume();
  assert.ok(app.toastMessages.length > 0);
});

test('renderer reports document upload failures to the user', async () => {
  const app = renderer({
    uploadDocuments: async () => { throw new Error('Added 1 document(s); failed to add bad.pdf: Invalid PDF'); },
    listDocuments: async () => [{ id: 'good-1', filename: 'good.txt' }],
  });
  await app.actions.handleUploadDocs();
  assert.match(app.toastMessages.join(' '), /Added 1 document\(s\).*bad\.pdf/);
  assert.equal(app.docsList.children.length, 1);
});

test('renderer reports document removal failures to the user', async () => {
  const app = renderer({
    listDocuments: async () => [{ id: 'doc-1', filename: 'notes.md' }],
    removeDocument: async () => { throw new Error('disk full'); },
  });
  await app.actions.renderDocsUI();
  await app.handlers.remove();
  assert.ok(app.toastMessages.length > 0);
});

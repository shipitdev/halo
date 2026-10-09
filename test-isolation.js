// Existing suites write configuration and knowledge; redirect Electron userData for tests.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'halo-tests-'));
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === 'electron') return { app: { getPath: () => directory } };
  return load.call(this, name, ...args);
};
process.on('exit', () => fs.rmSync(directory, { recursive: true, force: true }));

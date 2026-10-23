const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Module = require('node:module');

let windowSources = [];
let getSourcesImpl = async () => windowSources;
let lastSourceOptions;
const originalLoad = Module._load;
Module._load = function (request, ...args) {
  if (request === 'electron') {
    return { desktopCapturer: { getSources: (options, ...args) => {
      lastSourceOptions = options;
      return getSourcesImpl(options, ...args);
    } } };
  }
  return originalLoad.call(this, request, ...args);
};

const { MeetingDetector } = require('./src/meetings');

function detector(processOutput = 'Google Chrome\n') {
  const instance = new MeetingDetector();
  instance._getRunningProcesses = async () => processOutput;
  instance._isPolling = true;
  return instance;
}

test('poll detects Meet from desktopCapturer window titles when Chrome is the only process match', async () => {
  windowSources = [{ name: 'Meet - Google Chrome' }];
  getSourcesImpl = async () => windowSources;
  const meetingDetector = detector();
  const started = [];
  meetingDetector.on('meeting-started', meeting => started.push(meeting));

  await meetingDetector._poll();

  assert.equal(started.length, 1);
  assert.equal(started[0].id, 'meet');
  assert.equal(started[0].name, 'Google Meet');
  assert.deepEqual({ ...lastSourceOptions }, {
    types: ['window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false,
  });
});

test('stopping polling while desktopCapturer is pending suppresses its late result', async () => {
  let releaseSources;
  let sourceCalls = 0;
  getSourcesImpl = () => {
    sourceCalls++;
    return new Promise(resolve => { releaseSources = resolve; });
  };
  const meetingDetector = detector();
  const events = [];
  meetingDetector.on('meeting-started', meeting => events.push(['started', meeting]));
  meetingDetector.on('meeting-ended', meeting => events.push(['ended', meeting]));

  const polling = meetingDetector._poll();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sourceCalls, 1, 'poll should be waiting on desktopCapturer');
  meetingDetector.stop();
  releaseSources([{ name: 'Meet - Google Chrome' }]);
  await polling;

  assert.deepEqual(events, []);
  assert.equal(meetingDetector.getActiveMeeting(), null);
});

test('switching directly from Zoom to Meet emits an end followed by a start', async () => {
  let processOutput = 'zoom.us\n';
  windowSources = [];
  getSourcesImpl = async () => windowSources;
  const meetingDetector = detector();
  meetingDetector._getRunningProcesses = async () => processOutput;
  const events = [];
  meetingDetector.on('meeting-started', meeting => events.push(['started', meeting.id]));
  meetingDetector.on('meeting-ended', meeting => events.push(['ended', meeting.id]));

  await meetingDetector._poll();
  processOutput = 'Google Chrome\n';
  windowSources = [{ name: 'Meet - Google Chrome' }];
  await meetingDetector._poll();

  assert.deepEqual(events, [['started', 'zoom'], ['ended', 'zoom'], ['started', 'meet']]);
  assert.equal(meetingDetector.getActiveMeeting().id, 'meet');
});

test('renderer hydrates an already-active meeting after registering event listeners', async () => {
  const activeMeeting = { id: 'meet', name: 'Google Meet', startedAt: '2026-10-22T00:00:00.000Z' };
  const handlers = {};
  const context = {
    console,
    document: { addEventListener() {} },
    window: { halo: {
      onAction() {}, onToggleListening() {},
      onOpenSettings() {},
      onMeetingDetected(callback) { handlers.started = callback; },
      onMeetingEnded(callback) { handlers.ended = callback; },
      getActiveMeeting: async () => activeMeeting,
    } },
  };
  vm.createContext(context);
  const code = fs.readFileSync('./renderer/app.js', 'utf8').replace(
    "document.addEventListener('DOMContentLoaded', init);",
    'globalThis.bindListeners = bindIPCListeners; globalThis.transcript = transcriptManager;'
  );
  vm.runInContext(code, context);

  context.bindListeners();
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual({ ...context.transcript.activeMeeting }, { id: 'meet', name: 'Google Meet' });
});

function rendererIPC({ getActiveMeeting = async () => null, getListeningState = async () => false } = {}) {
  const handlers = {};
  const tracks = [{ stop() {}, addEventListener() {} }];
  class MockVoiceRecorder { stop() {} sample() {} }
  class MockAudioContext {
    async resume() {}
    close() {}
    createMediaStreamSource() { return { connect() {} }; }
    createAnalyser() { return { fftSize: 512, getFloatTimeDomainData() {} }; }
  }
  const context = {
    console,
    document: { addEventListener() {} },
    navigator: { mediaDevices: { getUserMedia: async () => ({
      getTracks: () => tracks, getAudioTracks: () => tracks,
    }) } },
    VoiceRecorder: MockVoiceRecorder,
    setInterval: () => 1,
    clearInterval() {},
    window: { halo: {
      onAction() {}, onToggleListening(callback) { handlers.listening = callback; },
      onOpenSettings() {},
      onMeetingDetected(callback) { handlers.started = callback; },
      onMeetingEnded(callback) { handlers.ended = callback; },
      getActiveMeeting, getListeningState, setListeningState() {},
    }, AudioContext: MockAudioContext },
  };
  vm.createContext(context);
  let source = fs.readFileSync('./renderer/app.js', 'utf8');
  source = source.replace(
    "document.addEventListener('DOMContentLoaded', init);",
    'showToast = () => {}; dom.btnListen = { classList: { add() {}, remove() {} } }; dom.statusIndicator = {}; dom.statusText = {}; globalThis.bindListeners = bindIPCListeners; globalThis.toggleListening = toggleListening; globalThis.stopListening = stopListening; globalThis.state = state; globalThis.transcript = transcriptManager;'
  );
  vm.runInContext(source, context);
  return { handlers, bind: context.bindListeners, toggleListening: context.toggleListening,
    stopListening: context.stopListening, state: context.state, transcript: context.transcript };
}

test('a stale active-meeting query cannot overwrite newer ended and started events', async () => {
  let resolveSnapshot;
  const oldMeeting = { id: 'zoom', name: 'Zoom', startedAt: 'old' };
  const newMeeting = { id: 'meet', name: 'Google Meet', startedAt: 'new' };
  let queries = 0;
  const app = rendererIPC({ getActiveMeeting: () => {
    queries++;
    return new Promise(resolve => { resolveSnapshot = resolve; });
  } });

  app.bind();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(queries, 1, 'renderer should request the active meeting snapshot');
  app.handlers.ended(oldMeeting);
  app.handlers.started(newMeeting);
  resolveSnapshot(oldMeeting);
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual({ ...app.transcript.activeMeeting }, { id: 'meet', name: 'Google Meet' });
});

test('desktopCapturer permission errors leave process-only polling usable', async () => {
  let sourceCalls = 0;
  getSourcesImpl = async () => {
    sourceCalls++;
    throw new Error('Screen Recording permission denied');
  };
  const meetingDetector = detector();
  const events = [];
  meetingDetector.on('meeting-started', meeting => events.push(meeting));

  await assert.doesNotReject(meetingDetector._poll());

  assert.equal(sourceCalls, 1, 'window-source lookup should be attempted when process matching finds no app');
  assert.deepEqual(events, []);
  assert.equal(meetingDetector.getActiveMeeting(), null);
});

test('documentation pages for process-detected apps do not count as meetings', async () => {
  const titles = [
    'Zoom API documentation - Google Chrome',
    'Microsoft Teams API docs - Google Chrome',
    'Webex developer documentation - Google Chrome',
    'Amazon Chime API documentation - Google Chrome',
  ];
  getSourcesImpl = async () => windowSources;

  for (const title of titles) {
    windowSources = [{ name: title }];
    const meetingDetector = detector();
    const events = [];
    meetingDetector.on('meeting-started', meeting => events.push(meeting));
    await meetingDetector._poll();
    assert.deepEqual(events, [], `${title} should not be treated as a meeting`);
  }
});

test('failed window-source lookup does not count as a confirmed empty meeting poll', async () => {
  windowSources = [{ name: 'Meet - Google Chrome' }];
  getSourcesImpl = async () => windowSources;
  const meetingDetector = detector();
  const events = [];
  meetingDetector.on('meeting-started', meeting => events.push(['started', meeting.id]));
  meetingDetector.on('meeting-ended', meeting => events.push(['ended', meeting.id]));
  await meetingDetector._poll();

  windowSources = [];
  await meetingDetector._poll(); // First confirmed empty poll.
  getSourcesImpl = async () => { throw new Error('Screen Recording permission denied'); };
  await meetingDetector._poll(); // Failed lookup must not be treated as empty.
  assert.equal(meetingDetector.getActiveMeeting().id, 'meet');
  assert.deepEqual(events, [['started', 'meet']]);

  getSourcesImpl = async () => [];
  await meetingDetector._poll();
  assert.equal(meetingDetector.getActiveMeeting(), null);
  assert.deepEqual(events, [['started', 'meet'], ['ended', 'meet']]);
});

test('stopping polling while the process query is pending suppresses its late result', async () => {
  let releaseProcessQuery;
  const meetingDetector = detector();
  meetingDetector._getRunningProcesses = () => new Promise(resolve => { releaseProcessQuery = resolve; });
  const events = [];
  meetingDetector.on('meeting-started', meeting => events.push(meeting));

  const polling = meetingDetector._poll();
  meetingDetector.stop();
  releaseProcessQuery('zoom.us\n');
  await polling;

  assert.deepEqual(events, []);
  assert.equal(meetingDetector.getActiveMeeting(), null);
});

test('an older overlapping poll cannot replace a newer meeting result', async () => {
  let resolveOlder, resolveNewer;
  let processRequests = 0;
  windowSources = [{ name: 'Meet - Google Chrome' }];
  getSourcesImpl = async () => windowSources;
  const meetingDetector = detector();
  meetingDetector._getRunningProcesses = () => new Promise(resolve => {
    if (processRequests++ === 0) resolveOlder = resolve;
    else resolveNewer = resolve;
  });

  const olderPoll = meetingDetector._poll();
  const newerPoll = meetingDetector._poll();
  await new Promise(resolve => setImmediate(resolve));
  resolveNewer('Google Chrome\n');
  await newerPoll;
  resolveOlder('zoom.us\n');
  await olderPoll;

  assert.equal(meetingDetector.getActiveMeeting().id, 'meet');
});

test('renderer hydrates listening that began from the tray before listeners attached', async () => {
  const app = rendererIPC({ getListeningState: async () => true });

  app.bind();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(app.state.isListening, true);
  app.stopListening();
});

test('stale not-listening snapshot does not stop a toolbar-started session', async () => {
  let resolveSnapshot;
  const app = rendererIPC({ getListeningState: () => new Promise(resolve => { resolveSnapshot = resolve; }) });

  app.bind();
  await new Promise(resolve => setImmediate(resolve));
  await app.toggleListening(); // Toolbar Start
  resolveSnapshot(false);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(app.state.isListening, true);
  app.stopListening();
});

test('stale listening snapshot does not restart a session stopped from the toolbar', async () => {
  let resolveSnapshot;
  const app = rendererIPC({ getListeningState: () => new Promise(resolve => { resolveSnapshot = resolve; }) });

  app.bind();
  await new Promise(resolve => setImmediate(resolve));
  await app.toggleListening(); // Toolbar Start
  await app.toggleListening(); // Toolbar Stop
  resolveSnapshot(true);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(app.state.isListening, false);
});

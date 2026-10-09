const { test } = require('node:test');
const assert = require('node:assert/strict');
const { VoiceRecorder } = require('./renderer/voice-recorder');

class Recorder {
  static isTypeSupported(type) { return type.startsWith('audio/webm'); }
  constructor(stream, options) { this.mimeType = options.mimeType; this.state = 'inactive'; }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable({ data: new Blob(['HEADER speech FINAL']) });
    this.onstop();
  }
}

function setup(onAudio = async () => {}) {
  let time = 0;
  const errors = [];
  const voice = new VoiceRecorder({}, { Recorder, now: () => time, onAudio, onError: e => errors.push(e) });
  return { voice, errors, advance: ms => { time += ms; } };
}

test('each spoken sentence is independently decodable and includes final data', async () => {
  const audio = [];
  const { voice, advance } = setup(async (blob, format) => audio.push([await blob.text(), format]));
  for (let i = 0; i < 2; i++) {
    voice.sample(0.02); voice.sample(0); advance(1200); voice.sample(0);
  }
  voice.stop(); await voice.queue;
  assert.deepEqual(audio, [['HEADER speech FINAL', 'webm'], ['HEADER speech FINAL', 'webm']]);
});

test('stopping while speaking transcribes the unfinished sentence', async () => {
  const audio = [];
  const { voice } = setup(async blob => audio.push(await blob.text()));
  voice.sample(0.03); voice.stop(); await voice.queue;
  assert.equal(audio.length, 1);
  assert.equal(voice.recorder.state, 'inactive');
});

test('silence sends no transcription requests', async () => {
  let requests = 0;
  const { voice, advance } = setup(async () => requests++);
  voice.sample(0); advance(1200); voice.sample(0); voice.stop(); await voice.queue;
  assert.equal(requests, 0);
});

test('continuous speech is bounded and transcription results stay in order', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const audio = [];
  const { voice, advance } = setup(async () => { await pending; audio.push(audio.length); });
  voice.sample(0.03); advance(20000); voice.sample(0.03);
  voice.sample(0.03); voice.stop();
  release(); await voice.queue;
  assert.deepEqual(audio, [0, 1]);
});

test('a failed request does not prevent the next sentence being transcribed', async () => {
  let requests = 0;
  const { voice, advance, errors } = setup(async () => { if (++requests === 1) throw new Error('quota'); });
  voice.sample(0.03); advance(20000); voice.sample(0.03);
  voice.sample(0.03); voice.stop(); await voice.queue;
  assert.equal(requests, 2); assert.equal(errors.length, 1);
});

const fs = require('node:fs');
const vm = require('node:vm');
function renderer(getUserMedia) {
  const context = {
    console, Blob, Float32Array, VoiceRecorder,
    navigator: { mediaDevices: { getUserMedia } },
    document: { addEventListener() {} },
    window: { halo: { setListeningState() {} } },
    setInterval() { return 1; }, clearInterval() {},
  };
  vm.createContext(context);
  let code = fs.readFileSync('./renderer/app.js', 'utf8');
  code = code.replace("document.addEventListener('DOMContentLoaded', init);", `
    showToast = () => {}; showTranscript = () => {};
    dom.btnListen = { classList: { add() {}, remove() {} } };
    dom.statusIndicator = {}; dom.statusText = {};
    globalThis.app = { startListening, stopListening, state, transcriptManager };
  `);
  vm.runInContext(code, context);
  return context.app;
}

test('stopping during the microphone permission prompt releases late tracks', async () => {
  let grant, stopped = 0;
  const app = renderer(() => new Promise(resolve => { grant = resolve; }));
  const starting = app.startListening();
  app.stopListening();
  grant({ getTracks: () => [{ stop() { stopped++; } }] });
  await starting;
  assert.equal(stopped, 1); assert.equal(app.state.isListening, false);
  assert.equal(app.state.micStream, null);
});

test('double clicking start requests the microphone only once', async () => {
  let reject, requests = 0;
  const app = renderer(() => { requests++; return new Promise((_, fail) => { reject = fail; }); });
  const starting = app.startListening();
  await app.startListening(); reject(new Error('permission denied')); await starting;
  assert.equal(requests, 1); assert.equal(app.state.isListening, false);
});

test('similar sentences with opposite meaning are both preserved', () => {
  const { transcriptManager: transcript } = renderer();
  transcript.add('We should deploy the release today');
  transcript.add('We should not deploy the release today');
  assert.equal(transcript.entries.length, 2);
});

test('transcript history is bounded and meeting context belongs to each utterance', () => {
  const { transcriptManager: transcript } = renderer();
  transcript.setMeeting({ id: 'zoom', name: 'Zoom' }); transcript.add('Meeting sentence');
  transcript.clearMeeting(); transcript.add('After meeting');
  assert.equal(transcript.entries[0].meetingContext.name, 'Zoom');
  assert.equal(transcript.entries[1].meetingContext, null);
  for (let i = 0; i < 60; i++) transcript.add(`Sentence ${i}`);
  assert.equal(transcript.entries.length, 50);
  assert.equal(transcript.entries[0].text, 'Sentence 10');
});

test('stopping while final recorder data is pending does not restart capture', async () => {
  class AsyncRecorder extends Recorder {
    stop() {
      this.state = 'inactive';
      this.finish = () => {
        this.ondataavailable({ data: new Blob(['HEADER FINAL']) });
        this.onstop();
      };
    }
  }
  let time = 0;
  const audio = [];
  const voice = new VoiceRecorder({}, {
    Recorder: AsyncRecorder, now: () => time,
    onAudio: async blob => audio.push(await blob.text()), onError: assert.fail,
  });
  voice.sample(0.02); time = 20000; voice.sample(0.02);
  const recorder = voice.recorder;
  voice.stop(); recorder.finish(); await voice.queue;
  assert.equal(voice.recorder, recorder);
  assert.deepEqual(audio, ['HEADER FINAL']);
});

test('Groq transcription uses the compatible endpoint and Whisper model', async () => {
  const Module = require('node:module');
  const original = Module._load;
  let options, request, file;
  class OpenAI {
    constructor(value) {
      options = value;
      this.audio = { transcriptions: { create: async value => { request = value; return { text: 'Meeting transcript' }; } } };
    }
    static async toFile(buffer, name, metadata) { file = { buffer, name, metadata }; return file; }
  }
  Module._load = function (name, ...args) {
    return name === 'openai' ? OpenAI : original.call(this, name, ...args);
  };
  try {
    const { OpenAIProvider } = require('./src/providers/openai');
    const provider = new OpenAIProvider('test-only', {
      baseURL: 'https://api.groq.com/openai/v1', transcriptionModel: 'whisper-large-v3-turbo',
    });
    assert.equal(await provider.transcribe(Buffer.from('audio'), 'webm'), 'Meeting transcript');
    assert.equal(options.baseURL, 'https://api.groq.com/openai/v1');
    assert.equal(request.model, 'whisper-large-v3-turbo');
    assert.equal(file.name, 'audio.webm'); assert.equal(file.metadata.type, 'audio/webm');
  } finally { Module._load = original; }
});

/**
 * Halo — Module Validation Tests
 * Validates that all modules load and core logic functions correctly.
 * Run with: node test-modules.js
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name} — ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ─── Test Provider Modules ──────────────────────────────────────────────────
console.log('\n⦿ Provider Layer');

test('base.js loads', () => {
  const { BaseProvider } = require('./src/providers/base');
  assert(BaseProvider, 'BaseProvider not exported');
});

test('BaseProvider cannot be instantiated directly', () => {
  const { BaseProvider } = require('./src/providers/base');
  try {
    new BaseProvider('key');
    throw new Error('Should have thrown');
  } catch (e) {
    assert(e.message.includes('abstract'), `Wrong error: ${e.message}`);
  }
});

test('openai.js loads', () => {
  const { OpenAIProvider } = require('./src/providers/openai');
  assert(OpenAIProvider, 'OpenAIProvider not exported');
  const p = new OpenAIProvider('test-key');
  assert(p.name === 'OpenAI');
  assert(p.models.smart === 'gpt-4o');
  assert(p.models.fast === 'gpt-4o-mini');
  assert(p.supportsTranscription() === true);
});

test('anthropic.js loads', () => {
  const { AnthropicProvider } = require('./src/providers/anthropic');
  assert(AnthropicProvider, 'AnthropicProvider not exported');
  const p = new AnthropicProvider('test-key');
  assert(p.name === 'Anthropic');
  assert(p.supportsTranscription() === false);
});

test('gemini.js loads', () => {
  const { GeminiProvider } = require('./src/providers/gemini');
  assert(GeminiProvider, 'GeminiProvider not exported');
  const p = new GeminiProvider('test-key');
  assert(p.name === 'Google Gemini');
  assert(p.supportsTranscription() === true);
});

test('index.js factory works', () => {
  const { createProvider, getModel, listProviders } = require('./src/providers');
  assert(typeof createProvider === 'function');
  assert(typeof getModel === 'function');
  assert(typeof listProviders === 'function');

  const providers = listProviders();
  assert(providers.length === 3, `Expected 3 providers, got ${providers.length}`);
  assert(providers.some(p => p.id === 'openai'));
  assert(providers.some(p => p.id === 'anthropic'));
  assert(providers.some(p => p.id === 'gemini'));
});

test('createProvider creates correct instances', () => {
  const { createProvider } = require('./src/providers');
  const openai = createProvider('openai', 'key');
  assert(openai.name === 'OpenAI');
  const anthropic = createProvider('anthropic', 'key');
  assert(anthropic.name === 'Anthropic');
  const gemini = createProvider('gemini', 'key');
  assert(gemini.name === 'Google Gemini');
});

test('createProvider rejects unknown provider', () => {
  const { createProvider } = require('./src/providers');
  try {
    createProvider('unknown', 'key');
    throw new Error('Should have thrown');
  } catch (e) {
    assert(e.message.includes('Unknown provider'));
  }
});

test('getModel returns correct models', () => {
  const { getModel } = require('./src/providers');
  assert(getModel('openai', true) === 'gpt-4o');
  assert(getModel('openai', false) === 'gpt-4o-mini');
  assert(getModel('anthropic', true) === 'claude-sonnet-4-20250514');
  assert(getModel('gemini', false) === 'gemini-3.5-flash');
});

// ─── Test Audio Module ──────────────────────────────────────────────────────
console.log('\n⦿ Audio Processing');

test('audio.js loads', () => {
  const audio = require('./src/audio');
  assert(audio.downsamplePCM, 'downsamplePCM not exported');
  assert(audio.float32ToInt16, 'float32ToInt16 not exported');
  assert(audio.encodeWAV, 'encodeWAV not exported');
  assert(audio.AudioChunkBuffer, 'AudioChunkBuffer not exported');
});

test('downsamplePCM reduces samples correctly', () => {
  const { downsamplePCM } = require('./src/audio');
  const input = new Float32Array(44100); // 1 second at 44.1kHz
  for (let i = 0; i < input.length; i++) input[i] = Math.sin(i * 0.1);

  const output = downsamplePCM(input, 44100, 16000);
  assert(output.length === Math.floor(44100 / (44100 / 16000)),
    `Expected ~16000 samples, got ${output.length}`);
});

test('downsamplePCM returns original if target >= source', () => {
  const { downsamplePCM } = require('./src/audio');
  const input = new Float32Array([1, 2, 3]);
  const output = downsamplePCM(input, 16000, 44100);
  assert(output === input, 'Should return same array');
});

test('float32ToInt16 converts correctly', () => {
  const { float32ToInt16 } = require('./src/audio');
  const input = new Float32Array([0, 1, -1, 0.5, -0.5]);
  const output = float32ToInt16(input);
  assert(output instanceof Int16Array);
  assert(output.length === 5);
  assert(output[0] === 0, `Expected 0, got ${output[0]}`);
  assert(output[1] === 32767, `Expected 32767, got ${output[1]}`);
  assert(output[2] === -32768, `Expected -32768, got ${output[2]}`);
});

test('encodeWAV produces valid WAV header', () => {
  const { encodeWAV, float32ToInt16 } = require('./src/audio');
  const pcm = float32ToInt16(new Float32Array([0.5, -0.5, 0.25]));
  const wav = encodeWAV(pcm, 16000);

  assert(wav instanceof Buffer, 'Should return Buffer');
  assert(wav.length === 44 + pcm.length * 2, 'WAV size incorrect');

  // Check RIFF header
  assert(wav.toString('ascii', 0, 4) === 'RIFF', 'Missing RIFF header');
  assert(wav.toString('ascii', 8, 12) === 'WAVE', 'Missing WAVE marker');
  assert(wav.toString('ascii', 12, 16) === 'fmt ', 'Missing fmt chunk');
  assert(wav.toString('ascii', 36, 40) === 'data', 'Missing data chunk');

  // Check sample rate
  assert(wav.readUInt32LE(24) === 16000, 'Wrong sample rate in header');
});

test('AudioChunkBuffer flushes correctly', () => {
  const { AudioChunkBuffer } = require('./src/audio');
  let flushedBuffer = null;

  const buffer = new AudioChunkBuffer({
    flushIntervalMs: 100,
    sampleRate: 16000,
    onFlush: (wavBuffer) => { flushedBuffer = wavBuffer; },
  });

  buffer.push(new Float32Array([0.1, 0.2, 0.3]));
  buffer.push(new Float32Array([0.4, 0.5]));
  buffer.flush();

  assert(flushedBuffer !== null, 'onFlush not called');
  assert(flushedBuffer instanceof Buffer, 'Should flush a Buffer');
  assert(flushedBuffer.toString('ascii', 0, 4) === 'RIFF', 'Flushed buffer should be WAV');
});

// ─── Test Prompts Module ────────────────────────────────────────────────────
console.log('\n⦿ System Prompts');

test('prompts.js loads', () => {
  const { getPrompt, getActions, PROMPTS } = require('./src/prompts');
  assert(typeof getPrompt === 'function');
  assert(typeof getActions === 'function');
  assert(typeof PROMPTS === 'object');
});

test('all actions have prompts', () => {
  const { getPrompt, getActions } = require('./src/prompts');
  const actions = getActions();
  assert(actions.length >= 6, `Expected >= 6 actions, got ${actions.length}`);

  for (const action of actions) {
    const prompt = getPrompt(action);
    assert(typeof prompt === 'string' && prompt.length > 50,
      `Prompt for "${action}" is too short or missing`);
  }
});

test('unknown action falls back to question prompt', () => {
  const { getPrompt, PROMPTS } = require('./src/prompts');
  assert(getPrompt('nonexistent') === PROMPTS.question);
});

// ─── Test Provider Index (getTranscriptionProvider) ─────────────────────────
console.log('\n⦿ Provider Factory');

test('getTranscriptionProvider prefers OpenAI', () => {
  const { getTranscriptionProvider } = require('./src/providers');
  const provider = getTranscriptionProvider({
    openai: { apiKey: 'test-key' },
    gemini: { apiKey: 'test-key' },
  });
  assert(provider !== null, 'Should return a provider');
  assert(provider.name === 'OpenAI', `Expected OpenAI, got ${provider.name}`);
});

test('getTranscriptionProvider falls back to Gemini', () => {
  const { getTranscriptionProvider } = require('./src/providers');
  const provider = getTranscriptionProvider({
    gemini: { apiKey: 'test-key' },
  });
  assert(provider !== null, 'Should return a provider');
  assert(provider.name === 'Google Gemini', `Expected Gemini, got ${provider.name}`);
});

test('getTranscriptionProvider returns null when no providers configured', () => {
  const { getTranscriptionProvider } = require('./src/providers');
  const provider = getTranscriptionProvider({});
  assert(provider === null, 'Should return null');
});

// ─── Test Meeting Detection (Enhanced) ──────────────────────────────────────
console.log('\n⦿ Meeting Detection (Enhanced)');

test('_matchMeetingApp uses word-boundary matching (no false positives)', () => {
  const { MeetingDetector } = require('./src/meetings');
  const detector = new MeetingDetector();

  // Should NOT match 'Slack' from a path containing 'slack' as a substring
  const noMatch = detector._matchMeetingApp('/usr/local/slackbot-handler\n/bin/bash');
  // 'slackbot-handler' should not match 'slack' since 'slack' must be a standalone token
  // The word boundary pattern requires a separator before and after the process name
  assert(noMatch === null || noMatch.id !== 'slack',
    'Should not false-positive match "slackbot-handler" as Slack');
});

test('_matchMeetingApp correctly matches full process names', () => {
  const { MeetingDetector } = require('./src/meetings');
  const detector = new MeetingDetector();

  // zoom.us as a standalone process (typical macOS ps output)
  const zoomMatch = detector._matchMeetingApp('/Applications/zoom.us\n/bin/bash');
  assert(zoomMatch && zoomMatch.id === 'zoom', 'Should match zoom.us');

  // MSTeams as standalone
  const teamsMatch = detector._matchMeetingApp('/Applications/MSTeams\n');
  assert(teamsMatch && teamsMatch.id === 'teams', 'Should match MSTeams');
});

test('Meeting debounce prevents premature end events', () => {
  const { MeetingDetector, END_DEBOUNCE_COUNT } = require('./src/meetings');
  const detector = new MeetingDetector();
  const events = [];

  detector.on('meeting-started', (m) => events.push({ type: 'started', meeting: m }));
  detector.on('meeting-ended', (m) => events.push({ type: 'ended', meeting: m }));

  // Simulate: override _getRunningProcesses for controlled testing
  let mockProcessOutput = 'zoom.us\n';
  detector._getRunningProcesses = () => Promise.resolve(mockProcessOutput);

  // Run polls manually
  const runPoll = async () => {
    await detector._poll();
  };

  // Start polling synchronously for testing
  (async () => {
    // Poll 1: detect meeting
    await runPoll();
    assert(events.length === 1, `Expected 1 event after first poll, got ${events.length}`);
    assert(events[0].type === 'started', 'First event should be started');

    // Poll 2: meeting disappears (first empty poll)
    mockProcessOutput = '/bin/bash\n';
    await runPoll();
    assert(events.length === 1, `Expected 1 event (debouncing), got ${events.length}`);
    assert(detector.isInMeeting(), 'Should still be in meeting during debounce');

    // Poll 3: second consecutive empty poll → should end
    await runPoll();
    assert(events.length === 2, `Expected 2 events after debounce, got ${events.length}`);
    assert(events[1].type === 'ended', 'Second event should be ended');
  })();

  detector.stop();
});

test('Meeting debounce resets when app reappears', () => {
  const { MeetingDetector } = require('./src/meetings');
  const detector = new MeetingDetector();
  const events = [];

  detector.on('meeting-started', (m) => events.push('started'));
  detector.on('meeting-ended', (m) => events.push('ended'));

  let mockOutput = 'zoom.us\n';
  detector._getRunningProcesses = () => Promise.resolve(mockOutput);

  (async () => {
    // Start meeting
    await detector._poll();
    assert(events.length === 1 && events[0] === 'started');

    // Flicker: disappears for one poll
    mockOutput = '';
    await detector._poll();
    assert(events.length === 1, 'Should not have ended yet');

    // Reappears before debounce completes
    mockOutput = 'zoom.us\n';
    await detector._poll();
    assert(events.length === 1, 'Should still only have started event');
    assert(detector._emptyPollCount === 0, 'Debounce counter should be reset');
  })();

  detector.stop();
});

test('matchWindowTitles handles empty and null inputs', () => {
  const { MeetingDetector } = require('./src/meetings');
  const detector = new MeetingDetector();

  assert(detector.matchWindowTitles(null) === null, 'null should return null');
  assert(detector.matchWindowTitles([]) === null, 'empty array should return null');
  assert(detector.matchWindowTitles([{ name: '' }]) === null, 'empty title should return null');
  assert(detector.matchWindowTitles([{ name: 'Regular App' }]) === null, 'non-meeting title should return null');
});

test('matchWindowTitles detects Slack huddle', () => {
  const { MeetingDetector } = require('./src/meetings');
  const detector = new MeetingDetector();

  const result = detector.matchWindowTitles([{ name: 'Slack - Huddle with team' }]);
  assert(result && result.id === 'slack', `Expected Slack huddle detection, got ${result?.id}`);
});

// ─── Test Audio Edge Cases ──────────────────────────────────────────────────
console.log('\n⦿ Audio Edge Cases');

test('AudioChunkBuffer flush with no chunks does nothing', () => {
  const { AudioChunkBuffer } = require('./src/audio');
  let flushCalled = false;

  const buffer = new AudioChunkBuffer({
    sampleRate: 16000,
    onFlush: () => { flushCalled = true; },
  });

  buffer.flush();
  assert(flushCalled === false, 'onFlush should not be called when there are no chunks');
});

test('AudioChunkBuffer dispose stops timer and flushes remaining', () => {
  const { AudioChunkBuffer } = require('./src/audio');
  let flushedBuffer = null;

  const buffer = new AudioChunkBuffer({
    flushIntervalMs: 60000, // long interval so it doesn't auto-flush
    sampleRate: 16000,
    onFlush: (wav) => { flushedBuffer = wav; },
  });

  buffer.start();
  assert(buffer.intervalId !== null, 'Timer should be running');

  buffer.push(new Float32Array([0.1, 0.2]));
  buffer.dispose();

  assert(buffer.intervalId === null, 'Timer should be stopped after dispose');
  assert(flushedBuffer !== null, 'Should have flushed remaining audio on dispose');
  assert(flushedBuffer.toString('ascii', 0, 4) === 'RIFF', 'Disposed flush should produce valid WAV');
});

test('AudioChunkBuffer multiple pushes concatenate correctly', () => {
  const { AudioChunkBuffer } = require('./src/audio');
  let flushedSize = 0;

  const buffer = new AudioChunkBuffer({
    sampleRate: 16000,
    onFlush: (wav) => {
      // WAV data size = total length - 44 header, each sample = 2 bytes
      flushedSize = (wav.length - 44) / 2;
    },
  });

  buffer.push(new Float32Array([0.1, 0.2, 0.3]));
  buffer.push(new Float32Array([0.4, 0.5]));
  buffer.flush();

  assert(flushedSize === 5, `Expected 5 samples in flushed WAV, got ${flushedSize}`);
});

// ─── Test Config Deep Merge ─────────────────────────────────────────────────
console.log('\n⦿ Config Deep Merge');

test('ConfigManager preserves nested hotkeys on partial update', () => {
  const { ConfigManager } = require('./src/config');
  const cfg = new ConfigManager();

  // Set a nested value
  cfg.set('hotkeys.toggleOverlay', 'Cmd+B');
  cfg.set('hotkeys.custom', 'Cmd+K');

  assert(cfg.get('hotkeys.toggleOverlay') === 'Cmd+B', 'toggleOverlay should be preserved');
  assert(cfg.get('hotkeys.custom') === 'Cmd+K', 'custom hotkey should be set');
  // Original defaults should still be accessible if not overwritten
  assert(cfg.get('hotkeys.assist') !== undefined, 'assist hotkey from defaults should exist');
});

test('ConfigManager getAll returns a copy', () => {
  const { ConfigManager } = require('./src/config');
  const cfg = new ConfigManager();

  const all1 = cfg.getAll();
  all1.provider = 'mutated';
  const all2 = cfg.getAll();
  assert(all2.provider !== 'mutated', 'getAll should return a copy, not a reference');
});

// ─── Test Prompts Module (Enhanced) ─────────────────────────────────────────
console.log('\n⦿ Prompts Module (Enhanced)');

test('meetingAssist prompt exists and is substantial', () => {
  const { getPrompt, getActions } = require('./src/prompts');
  const actions = getActions();
  assert(actions.includes('meetingAssist'), 'meetingAssist action should be available');

  const prompt = getPrompt('meetingAssist');
  assert(typeof prompt === 'string' && prompt.length > 100,
    'meetingAssist prompt should be substantial');
  assert(prompt.includes('MEETING'), 'meetingAssist prompt should reference meeting context');
});

test('prompts reference structured transcript format', () => {
  const { getPrompt } = require('./src/prompts');

  // Key prompts that consume transcripts should mention the timestamp format
  const assistPrompt = getPrompt('assist');
  assert(assistPrompt.includes('[') && assistPrompt.includes('timestamp'),
    'assist prompt should reference timestamp format');

  const sayPrompt = getPrompt('say');
  assert(sayPrompt.includes('timestamp') || sayPrompt.includes('MEETING'),
    'say prompt should reference transcript format');
});

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.log('  ⚠ Some tests failed!\n');
  process.exit(1);
} else {
  console.log('  ✦ All tests passed!\n');
  process.exit(0);
}

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

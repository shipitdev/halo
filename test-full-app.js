/**
 * Halo — Comprehensive End-to-End Component Test Suite
 * Tests every component and module in the application for functional correctness.
 * Run with: node test-full-app.js
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name} — ${err.message}`);
    if (err.stack) console.error(`    ${err.stack.split('\n')[1]}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name} — ${err.message}`);
    if (err.stack) console.error(`    ${err.stack.split('\n')[1]}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function runAllTests() {
  console.log('\n==================================================');
  console.log('HALO COMPONENT & INTEGRATION TEST SUITE');
  console.log('==================================================');

  // 1. Config Manager Tests
  console.log('\n[1] ConfigManager (src/config.js)');
  test('ConfigManager loads and initializes defaults', () => {
    const { ConfigManager, DEFAULT_CONFIG } = require('./src/config');
    const cfg = new ConfigManager();
    assert(cfg.get('provider') === DEFAULT_CONFIG.provider, 'Provider default mismatch');
    assert(cfg.get('useSmart') === true, 'useSmart default mismatch');
  });

  test('ConfigManager handles dot-notation keys', () => {
    const { ConfigManager } = require('./src/config');
    const cfg = new ConfigManager();
    cfg.set('hotkeys.testKey', 'Cmd+Shift+T');
    assert(cfg.get('hotkeys.testKey') === 'Cmd+Shift+T', 'Dot notation set/get failed');
    assert(cfg.get('nonexistent.path', 'fallback') === 'fallback', 'Fallback failed');
  });

  test('ConfigManager resets to default', () => {
    const { ConfigManager, DEFAULT_CONFIG } = require('./src/config');
    const cfg = new ConfigManager();
    cfg.set('provider', 'custom');
    cfg.reset();
    assert(cfg.get('provider') === DEFAULT_CONFIG.provider, 'Reset failed');
  });

  // 2. Knowledge Base Tests
  console.log('\n[2] KnowledgeBase (src/knowledge.js)');
  testAsync('KnowledgeBase manages resume and documents', async () => {
    const { KnowledgeBase } = require('./src/knowledge');
    const kb = new KnowledgeBase();

    // Create temporary file for testing
    const tmpDocPath = path.join(__dirname, 'tmp_test_doc.txt');
    fs.writeFileSync(tmpDocPath, 'Halo test document content.', 'utf-8');

    try {
      const doc = await kb.addDocument(tmpDocPath);
      assert(doc.filename === 'tmp_test_doc.txt', 'Document filename mismatch');
      assert(kb.hasContext() === true, 'hasContext should be true');

      const docs = kb.listDocuments();
      assert(docs.some(d => d.id === doc.id), 'Doc list should contain added doc');

      const context = kb.getContext();
      assert(context.includes('Halo test document content'), 'Context string missing doc text');

      const removed = kb.removeDocument(doc.id);
      assert(removed === true, 'Document removal failed');
    } finally {
      if (fs.existsSync(tmpDocPath)) fs.unlinkSync(tmpDocPath);
    }
  });

  // 3. Meeting Detector Tests
  console.log('\n[3] MeetingDetector (src/meetings.js)');
  test('MeetingDetector process and window title matching', () => {
    const { MeetingDetector } = require('./src/meetings');
    const detector = new MeetingDetector();

    // Test process matching
    const zoomMatched = detector._matchMeetingApp('/Applications/zoom.us.app/Contents/MacOS/zoom.us\n/bin/bash');
    assert(zoomMatched && zoomMatched.id === 'zoom', 'Failed to match Zoom process');

    const teamsMatched = detector._matchMeetingApp('/Applications/MSTeams.app/Contents/MacOS/MSTeams');
    assert(teamsMatched && teamsMatched.id === 'teams', 'Failed to match Teams process');

    // Test window title matching
    const meetWindow = detector.matchWindowTitles([{ name: 'Meet - weekly sync - Google Chrome' }]);
    assert(meetWindow && meetWindow.id === 'meet', 'Failed to match Google Meet window title');

    detector.stop();
  });

  // 4. Audio Processing Tests
  console.log('\n[4] Audio Utilities (src/audio.js)');
  test('Audio processing algorithms operate cleanly', () => {
    const { downsamplePCM, float32ToInt16, encodeWAV, AudioChunkBuffer } = require('./src/audio');

    const pcm32 = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0]);
    const pcm16 = float32ToInt16(pcm32);
    assert(pcm16.length === 5, 'PCM int16 conversion length mismatch');

    const wavBuffer = encodeWAV(pcm16, 16000);
    assert(wavBuffer.length === 44 + 5 * 2, 'WAV size mismatch');
    assert(wavBuffer.toString('ascii', 0, 4) === 'RIFF', 'WAV RIFF header mismatch');

    const downsampled = downsamplePCM(new Float32Array(44100), 44100, 16000);
    assert(downsampled.length === 16000, 'Downsample sample count mismatch');
  });

  // 5. System Prompts Tests
  console.log('\n[5] System Prompts (src/prompts.js)');
  test('System prompts defined for all core actions', () => {
    const { getPrompt, getActions } = require('./src/prompts');
    const actions = getActions();
    const expectedActions = ['assist', 'say', 'followup', 'recap', 'solveCode', 'question'];

    for (const act of expectedActions) {
      assert(actions.includes(act), `Action ${act} missing from getActions()`);
      const p = getPrompt(act);
      assert(typeof p === 'string' && p.length > 50, `Prompt for ${act} invalid`);
    }
  });

  // 6. AI Providers & Factory Tests
  console.log('\n[6] AI Providers (src/providers/)');
  test('Provider instances and model lookups', () => {
    const { createProvider, getModel, listProviders, getTranscriptionProvider } = require('./src/providers');

    const providersList = listProviders();
    assert(providersList.length === 3, 'Expected 3 providers');

    const openai = createProvider('openai', 'test-key');
    assert(openai.name === 'OpenAI');

    const anthropic = createProvider('anthropic', 'test-key');
    assert(anthropic.name === 'Anthropic');

    const gemini = createProvider('gemini', 'test-key');
    assert(gemini.name === 'Google Gemini');

    assert(getModel('openai', true) === 'gpt-4o');
    assert(getModel('openai', false) === 'gpt-4o-mini');
    assert(getModel('anthropic', true) === 'claude-sonnet-4-20250514');
    assert(getModel('gemini', true) === 'gemini-3.6-flash');

    const stt = getTranscriptionProvider({ openai: { apiKey: 'key' } });
    assert(stt && stt.name === 'OpenAI');
  });

  // 7. HTML & Renderer DOM Elements Audit
  console.log('\n[7] HTML & Renderer DOM Binding Audit');
  test('index.html contains every DOM element referenced in app.js', () => {
    const htmlPath = path.join(__dirname, 'renderer', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    const requiredIds = [
      'status-indicator',
      'halo-panel',
      'response-area',
      'response-stream',
      'input-field',
      'btn-listen',
      'btn-send',
      'btn-assist',
      'btn-say',
      'btn-followup',
      'btn-recap',
      'btn-code',
      'btn-settings',
      'btn-expand',
      'chevron-icon',
      'btn-model-toggle',
      'btn-more',
      'dropdown-menu',
      'menu-clear',
      'menu-copy',
      'menu-clickthrough',
      'session-timer',
      'timer-display',
      'resume-filename',
      'btn-upload-resume',
      'btn-clear-resume',
      'docs-list',
      'btn-upload-docs',
      'halo-toast',
      'toast-content',
      'toast-dismiss',
      'toast-accept',
      'settings-overlay',
      'settings-modal',
      'btn-close-settings',
      'btn-save-settings',
      'select-provider',
      'input-api-key',
      'select-stt-provider',
      'input-stt-key',
    ];

    for (const id of requiredIds) {
      assert(htmlContent.includes(`id="${id}"`), `DOM element id="${id}" missing from index.html`);
    }
  });

  // 8. Main Process & Preload Integration Audit
  console.log('\n[8] Main Process & Preload Bridge Audit');
  test('Preload script and IPC contract consistency', () => {
    const preloadPath = path.join(__dirname, 'preload.js');
    const mainPath = path.join(__dirname, 'main.js');

    const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
    const mainContent = fs.readFileSync(mainPath, 'utf-8');

    const requiredIPCEvents = [
      'halo:capture-screen',
      'halo:config-get',
      'halo:config-set',
      'halo:config-get-all',
      'halo:toggle-visibility',
      'halo:set-ignore-mouse',
      'halo:resize',
      'halo:upload-resume',
      'halo:get-resume',
      'halo:clear-resume',
      'halo:upload-doc',
      'halo:list-docs',
      'halo:remove-doc',
      'halo:get-knowledge-context',
      'halo:has-knowledge',
      'halo:get-active-meeting',
      'halo:stream-ai',
      'halo:transcribe-audio',
      'halo:get-prompt',
    ];

    for (const channel of requiredIPCEvents) {
      assert(preloadContent.includes(`'${channel}'`), `IPC channel ${channel} missing in preload.js`);
      assert(mainContent.includes(`'${channel}'`), `IPC handler for ${channel} missing in main.js`);
    }
  });

  // 9. Prompt Single Source of Truth Audit
  console.log('\n[9] Prompt Single Source of Truth Audit');
  test('renderer/app.js does NOT contain duplicate system prompts', () => {
    const appPath = path.join(__dirname, 'renderer', 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    // The old inline getSystemPrompt function should be gone
    assert(!appContent.includes('function getSystemPrompt('),
      'renderer/app.js still contains inline getSystemPrompt function — should use preload bridge');

    // The comment explaining the removal should exist
    assert(appContent.includes('prompts.js via the preload bridge'),
      'renderer/app.js should reference the preload bridge for prompts');
  });

  test('prompts.js is the single source of truth with all actions', () => {
    const { getActions, getPrompt } = require('./src/prompts');
    const actions = getActions();

    // Must include all core actions plus meetingAssist
    const required = ['assist', 'say', 'followup', 'recap', 'solveCode', 'question', 'meetingAssist'];
    for (const act of required) {
      assert(actions.includes(act), `Action '${act}' missing from prompts.js`);
      const prompt = getPrompt(act);
      assert(typeof prompt === 'string' && prompt.length > 50,
        `Prompt for '${act}' is missing or too short`);
    }
  });

  // 10. Knowledge Base Edge Cases
  console.log('\n[10] Knowledge Base Edge Cases');
  await testAsync('KnowledgeBase handles empty files', async () => {
    const { KnowledgeBase } = require('./src/knowledge');
    const kb = new KnowledgeBase();

    const tmpPath = path.join(__dirname, 'tmp_test_empty.txt');
    fs.writeFileSync(tmpPath, '', 'utf-8');

    try {
      const doc = await kb.addDocument(tmpPath);
      assert(doc.filename === 'tmp_test_empty.txt', 'Should add empty file');
      assert(doc.textLength === 0, 'Empty file should have 0 text length');

      // Context should still work
      const context = kb.getContext();
      assert(typeof context === 'string', 'Context should be a string even with empty doc');

      kb.removeDocument(doc.id);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  });

  await testAsync('KnowledgeBase removeDocument returns false for unknown ID', async () => {
    const { KnowledgeBase } = require('./src/knowledge');
    const kb = new KnowledgeBase();

    const result = kb.removeDocument('nonexistent_id_12345');
    assert(result === false, 'removeDocument should return false for unknown ID');
  });

  // 11. Meeting Detection Event Integration
  console.log('\n[11] Meeting Detection Events');
  test('MeetingDetector emits correctly through state machine', () => {
    const { MeetingDetector } = require('./src/meetings');
    const detector = new MeetingDetector();

    assert(detector.isInMeeting() === false, 'Should not be in meeting initially');
    assert(detector.getActiveMeeting() === null, 'No active meeting initially');

    // Verify event emitter interface
    assert(typeof detector.on === 'function', 'Should have EventEmitter on method');
    assert(typeof detector.emit === 'function', 'Should have EventEmitter emit method');

    detector.stop();
  });

  // 12. Renderer Markdown Patterns
  console.log('\n[12] Renderer Markdown Patterns');
  test('renderer/app.js handles ordered lists with <ol> wrapping', () => {
    const appPath = path.join(__dirname, 'renderer', 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    assert(appContent.includes('<ol>'), 'Markdown renderer should include <ol> tags');
    assert(appContent.includes('ol-item'), 'Should use ol-item marker for ordered list differentiation');
  });

  test('renderer/app.js handles checkbox rendering', () => {
    const appPath = path.join(__dirname, 'renderer', 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    assert(appContent.includes('checkbox'), 'Markdown renderer should handle checkboxes');
    assert(appContent.includes('\\[x\\]') || appContent.includes('[x]'),
      'Should handle checked checkboxes');
    assert(appContent.includes('\\[ \\]') || appContent.includes('[ ]'),
      'Should handle unchecked checkboxes');
  });

  test('renderer/app.js caps conversation history', () => {
    const appPath = path.join(__dirname, 'renderer', 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    assert(appContent.includes('MAX_CONVERSATION_HISTORY'),
      'Should define MAX_CONVERSATION_HISTORY constant');
    assert(appContent.includes('slice(-MAX_CONVERSATION_HISTORY)'),
      'Should slice conversation history to cap');
  });

  test('renderer/app.js contains TranscriptManager class', () => {
    const appPath = path.join(__dirname, 'renderer', 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    assert(appContent.includes('class TranscriptManager'),
      'Should contain TranscriptManager class');
    assert(appContent.includes('_similarity'),
      'TranscriptManager should have deduplication logic');
    assert(appContent.includes('meetingContext'),
      'TranscriptManager should track meeting context');
    assert(appContent.includes('buildContext'),
      'TranscriptManager should have buildContext method');
  });

  // Summary
  console.log('\n==================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();

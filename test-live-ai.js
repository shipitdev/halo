/**
 * Halo — Live Integration Tests
 * Tests the actual AI pipeline end-to-end with a real Gemini API key.
 * 
 * TEST 1: Screen analysis — Sends a LeetCode problem description as text
 *         and verifies Halo's solveCode prompt produces correct analysis + code.
 * 
 * TEST 2: Response conciseness — Verifies Gemini gives short, overlay-friendly
 *         answers suitable for cheating in a small window.
 * 
 * TEST 3: Transcript annotation — Simulates a spoken line being transcribed
 *         and verifies Halo provides contextual feedback and answers.
 * 
 * Run with: node test-live-ai.js
 */

const { createProvider, getModel } = require('./src/providers');
const { getPrompt } = require('./src/prompts');
const { ConfigManager } = require('./src/config');

let passed = 0;
let failed = 0;
let skipped = 0;

async function testAsync(name, fn, timeoutMs = 60000) {
  try {
    const result = await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s`)), timeoutMs)
      ),
    ]);
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

async function collectStream(provider, messages, options) {
  let fullText = '';
  for await (const chunk of provider.chat(messages, options)) {
    fullText += chunk;
  }
  return fullText;
}

async function runTests() {
  console.log('\n==================================================');
  console.log('HALO LIVE AI INTEGRATION TESTS (Gemini API)');
  console.log('==================================================');

  // Load config to get API key
  const config = new ConfigManager();
  const apiKey = config.get('apiKey', '');
  const providerName = config.get('provider', 'gemini');

  if (!apiKey) {
    console.log('\n  ⚠ No API key configured. Skipping live tests.');
    console.log('  Set your API key in ~/.halo/halo-config.json\n');
    process.exit(0);
  }

  console.log(`\n  Provider: ${providerName}`);
  console.log(`  API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);

  const provider = createProvider(providerName, apiKey);
  const model = getModel(providerName, true);
  console.log(`  Model: ${model}\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 1: Screen Analysis — LeetCode Minimum Path Sum
  // ═══════════════════════════════════════════════════════════════════════
  console.log('[TEST 1] Screen Analysis — LeetCode Minimum Path Sum');

  await testAsync('Gemini API key is valid and responds', async () => {
    const messages = [
      { role: 'user', content: 'Reply with just the word "ok".' },
    ];
    const response = await collectStream(provider, messages, { model });
    assert(response && response.trim().length > 0, 'Got empty response');
    console.log(`    → API responded: "${response.trim().substring(0, 50)}"`);
  });

  await testAsync('solveCode prompt correctly analyzes LeetCode problem', async () => {
    const systemPrompt = getPrompt('solveCode');

    // Simulate what Halo sees when the user has LeetCode open
    const leetcodeProblem = `[SCREENSHOT attached — analyze the visible content]

The screen shows LeetCode problem #64: Minimum Path Sum

Problem:
Given a m x n grid filled with non-negative numbers, find a path from top left to bottom right, which minimizes the sum of all numbers along its path.

Note: You can only move either down or right at any point in time.

Example 1:
Input: grid = [[1,3,1],[1,5,1],[4,2,1]]
Output: 7
Explanation: Because the path 1 → 3 → 1 → 1 → 1 minimizes the sum.

Example 2:
Input: grid = [[1,2,3],[4,5,6]]  
Output: 12

Constraints:
- m == grid.length
- n == grid[i].length
- 1 <= m, n <= 200
- 0 <= grid[i][j] <= 200`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: leetcodeProblem },
    ];

    const response = await collectStream(provider, messages, { model });

    // Verify the response contains correct analysis
    const lower = response.toLowerCase();

    // Should mention dynamic programming or DP
    const mentionsDP = lower.includes('dynamic programming') || lower.includes(' dp ') || lower.includes('dp[');
    assert(mentionsDP, `Response should mention dynamic programming. Got: ${response.substring(0, 200)}`);

    // Should contain actual code
    const hasCode = response.includes('def ') || response.includes('function ') ||
      response.includes('grid[') || response.includes('for ');
    assert(hasCode, `Response should contain code solution. Got: ${response.substring(0, 200)}`);

    // Should reference the grid/path concept
    const mentionsGrid = lower.includes('grid') || lower.includes('path') || lower.includes('min');
    assert(mentionsGrid, 'Response should reference grid/path concepts');

    console.log(`    → Response length: ${response.length} chars`);
    console.log(`    → Mentions DP: ✓`);
    console.log(`    → Contains code: ✓`);
    console.log(`    → Full response preview:\n`);
    // Print first 600 chars of the response for inspection
    const preview = response.substring(0, 600);
    preview.split('\n').forEach(line => console.log(`      ${line}`));
    if (response.length > 600) console.log(`      ... (${response.length - 600} more chars)`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 2: Response Conciseness — Small Overlay Window
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[TEST 2] Response Conciseness — Overlay-Friendly Answers');

  await testAsync('assist prompt produces concise, scannable response', async () => {
    const systemPrompt = getPrompt('assist');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'The screen shows a Python error: "TypeError: cannot unpack non-iterable NoneType object" on line 42 of main.py where it says "x, y = get_coordinates()"' },
    ];

    const response = await collectStream(provider, messages, { model });

    // Should be concise (under 800 chars for overlay)
    assert(response.length < 1500,
      `Response too long for overlay: ${response.length} chars. Should be <1500. Preview: ${response.substring(0, 100)}`);
    assert(response.length > 30, 'Response too short — might be empty');

    // Should use markdown formatting (bullets, bold, code)
    const hasFormatting = response.includes('`') || response.includes('*') || response.includes('-');
    assert(hasFormatting, 'Response should use markdown formatting for overlay readability');

    // Should mention the fix (return value / None)
    const mentionsFix = response.toLowerCase().includes('none') || response.toLowerCase().includes('return');
    assert(mentionsFix, 'Should identify the None/return issue');

    console.log(`    → Response length: ${response.length} chars (good for overlay: ${response.length < 800 ? '✓ compact' : '⚠ a bit long'})`);
    console.log(`    → Has formatting: ✓`);
    console.log(`    → Identifies fix: ✓`);
    console.log(`    → Full response:\n`);
    response.split('\n').forEach(line => console.log(`      ${line}`));
  });

  await testAsync('question prompt gives short direct answer', async () => {
    const systemPrompt = getPrompt('question');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'What is the time complexity of binary search?' },
    ];

    const response = await collectStream(provider, messages, { model });

    // Should be very concise
    assert(response.length < 800, `Too verbose for overlay: ${response.length} chars`);
    assert(response.length > 10, 'Response too short');

    // Should mention O(log n)
    const mentionsLogN = response.toLowerCase().includes('log n') || response.includes('O(log');
    assert(mentionsLogN, `Should mention O(log n). Got: ${response}`);

    console.log(`    → Response length: ${response.length} chars ✓`);
    console.log(`    → Response: ${response.trim().substring(0, 200)}`);
  });

  await testAsync('say prompt gives 2-3 numbered reply options', async () => {
    const systemPrompt = getPrompt('say');

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user', content: `[LIVE TRANSCRIPT]
[03:30:15] So we've been looking at the Q3 numbers and I think we need to adjust our timeline.
[03:30:22] The engineering team says they need two more sprints to finish the migration.
[03:30:28] What do you think about pushing the launch to October?
[/LIVE TRANSCRIPT]` },
    ];

    const response = await collectStream(provider, messages, { model });

    // Should contain numbered options
    const hasNumbers = response.includes('1.') || response.includes('1)');
    assert(hasNumbers, `Should have numbered reply options. Got: ${response.substring(0, 200)}`);

    // Should be conversational
    assert(response.length < 1500, `Reply suggestions too long: ${response.length} chars`);

    console.log(`    → Has numbered options: ✓`);
    console.log(`    → Response length: ${response.length} chars`);
    console.log(`    → Full response:\n`);
    response.split('\n').forEach(line => console.log(`      ${line}`));
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 3: Transcript Annotation — Simulated spoken line
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[TEST 3] Transcript Annotation & Contextual Feedback');

  await testAsync('meetingAssist prompt gives contextual meeting feedback', async () => {
    const systemPrompt = getPrompt('meetingAssist');

    // Simulate a meeting transcript where someone asks a technical question
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user', content: `[LIVE TRANSCRIPT]
[03:32:00] [MEETING: Zoom] Alright, let's discuss the database migration plan.
[03:32:08] [MEETING: Zoom] We're currently on PostgreSQL 14 and need to upgrade to 16.
[03:32:15] [MEETING: Zoom] The main concern is the breaking change with the pg_stat_activity columns.
[03:32:22] [MEETING: Zoom] Can someone explain what changes we need to make to our monitoring queries?
[/LIVE TRANSCRIPT]

[SCREENSHOT attached — analyze the visible content]` },
    ];

    const response = await collectStream(provider, messages, { model });

    // Should provide actionable meeting help
    assert(response.length > 50, 'Response too short for meeting context');
    assert(response.length < 2000, `Too verbose for live meeting overlay: ${response.length} chars`);

    // Should reference PostgreSQL or the upgrade
    const lower = response.toLowerCase();
    const isRelevant = lower.includes('postgres') || lower.includes('pg_stat') ||
      lower.includes('upgrade') || lower.includes('migration') ||
      lower.includes('monitoring');
    assert(isRelevant, `Response should be contextually relevant to the meeting topic. Got: ${response.substring(0, 200)}`);

    console.log(`    → Contextually relevant: ✓`);
    console.log(`    → Response length: ${response.length} chars`);
    console.log(`    → Full response:\n`);
    response.split('\n').forEach(line => console.log(`      ${line}`));
  });

  await testAsync('assist prompt handles transcript + question combo', async () => {
    const systemPrompt = getPrompt('assist');

    // Simulate: user heard something in a call and asks Halo a question
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user', content: `[LIVE TRANSCRIPT]
[03:35:10] The interviewer said: "Can you explain the difference between TCP and UDP?"
[/LIVE TRANSCRIPT]

[USER NOTE]
Help me answer this interview question about TCP vs UDP` },
    ];

    const response = await collectStream(provider, messages, { model });

    // Should provide a clear comparison
    const lower = response.toLowerCase();
    assert(lower.includes('tcp') && lower.includes('udp'), 'Should mention both TCP and UDP');

    // Should be concise enough for quick reading during interview
    assert(response.length < 2000, `Too long for interview cheating: ${response.length} chars`);

    // Should mention key differences
    const mentionsKey = lower.includes('reliable') || lower.includes('connection') ||
      lower.includes('ordered') || lower.includes('handshake') ||
      lower.includes('stream');
    assert(mentionsKey, 'Should mention key TCP/UDP differences');

    console.log(`    → Covers TCP & UDP: ✓`);
    console.log(`    → Mentions key differences: ✓`);
    console.log(`    → Response length: ${response.length} chars`);
    console.log(`    → Full response:\n`);
    response.split('\n').forEach(line => console.log(`      ${line}`));
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n==================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});

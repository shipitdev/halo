/**
 * Halo — Renderer Application
 * Main renderer logic: state management, audio capture, AI streaming, UI updates.
 * All code is original.
 */

;(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────────
  const state = {
    isListening: false,
    isProcessing: false,
    useSmart: true, // true = smart (large model), false = fast (small model)
    provider: 'openai',
    apiKey: '',
    sttProvider: 'openai',
    sttApiKey: '',
    conversationHistory: [],
    transcriptBuffer: '',
    micStream: null,
    micRecorder: null,
    audioChunks: [],
    audioChunkInterval: null,
  };

  // ─── DOM References ─────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const dom = {
    statusIndicator: $('status-indicator'),
    statusDot: null,
    statusText: null,
    panel: $('halo-panel'),
    responseArea: $('response-area'),
    responseStream: $('response-stream'),
    inputField: $('input-field'),
    btnListen: $('btn-listen'),
    btnSend: $('btn-send'),
    btnAssist: $('btn-assist'),
    btnSay: $('btn-say'),
    btnFollowup: $('btn-followup'),
    btnRecap: $('btn-recap'),
    btnCode: $('btn-code'),
    btnSettings: $('btn-settings'),
    btnExpand: $('btn-expand'),
    chevronIcon: $('chevron-icon'),
    btnModelToggle: $('btn-model-toggle'),
    modelLabel: null,
    toast: $('halo-toast'),
    toastContent: $('toast-content'),
    toastDismiss: $('toast-dismiss'),
    toastAccept: $('toast-accept'),
    settingsOverlay: $('settings-overlay'),
    settingsModal: $('settings-modal'),
    btnCloseSettings: $('btn-close-settings'),
    btnSaveSettings: $('btn-save-settings'),
    selectProvider: $('select-provider'),
    inputApiKey: $('input-api-key'),
    selectSttProvider: $('select-stt-provider'),
    inputSttKey: $('input-stt-key'),
    hotkeyToggle: $('hotkey-toggle'),
    hotkeyAssist: $('hotkey-assist'),
    hotkeyCode: $('hotkey-code'),
    hotkeyQuit: $('hotkey-quit'),
  };

  // ─── Initialization ─────────────────────────────────────────────────────
  let isExpanded = false;
  const TOOLBAR_H = 48;

  async function init() {
    dom.statusDot = dom.statusIndicator.querySelector('.status-dot');
    dom.statusText = dom.statusIndicator.querySelector('.status-text');
    dom.modelLabel = dom.btnModelToggle.querySelector('.model-label');

    await loadSettings();
    bindEvents();
    bindIPCListeners();
  }

  // ─── Settings ───────────────────────────────────────────────────────────
  async function loadSettings() {
    try {
      const config = await window.halo.settings.getAll();
      if (config) {
        state.provider = config.provider || 'openai';
        state.apiKey = config.apiKey || '';
        state.sttProvider = config.sttProvider || 'openai';
        state.sttApiKey = config.sttApiKey || '';
        state.useSmart = config.useSmart !== false;
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  }

  async function saveSettings() {
    state.provider = dom.selectProvider.value;
    state.apiKey = dom.inputApiKey.value;
    state.sttProvider = dom.selectSttProvider.value;
    state.sttApiKey = dom.inputSttKey.value;

    try {
      await window.halo.settings.set('provider', state.provider);
      await window.halo.settings.set('apiKey', state.apiKey);
      await window.halo.settings.set('sttProvider', state.sttProvider);
      await window.halo.settings.set('sttApiKey', state.sttApiKey);
      await window.halo.settings.set('useSmart', state.useSmart);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }

    closeSettings();
  }

  function openSettings() {
    dom.selectProvider.value = state.provider;
    dom.inputApiKey.value = state.apiKey;
    dom.selectSttProvider.value = state.sttProvider;
    dom.inputSttKey.value = state.sttApiKey;
    dom.settingsOverlay.classList.remove('hidden');
  }

  function closeSettings() {
    dom.settingsOverlay.classList.add('hidden');
  }

  // ─── Event Binding ──────────────────────────────────────────────────────
  function bindEvents() {
    // Input
    dom.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    dom.btnSend.addEventListener('click', handleSend);

    // Listen toggle
    dom.btnListen.addEventListener('click', toggleListening);

    // Action buttons
    dom.btnAssist.addEventListener('click', () => triggerAction('assist'));
    dom.btnSay.addEventListener('click', () => triggerAction('say'));
    dom.btnFollowup.addEventListener('click', () => triggerAction('followup'));
    dom.btnRecap.addEventListener('click', () => triggerAction('recap'));
    dom.btnCode.addEventListener('click', () => triggerAction('solveCode'));

    // Model toggle
    dom.btnModelToggle.addEventListener('click', toggleModel);

    // Settings
    dom.btnSettings.addEventListener('click', openSettings);
    dom.btnCloseSettings.addEventListener('click', closeSettings);
    dom.btnSaveSettings.addEventListener('click', saveSettings);
    dom.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === dom.settingsOverlay) closeSettings();
    });

    // Expand / Collapse
    dom.btnExpand.addEventListener('click', togglePanel);

    // Toast
    dom.toastDismiss.addEventListener('click', hideToast);
    dom.toastAccept.addEventListener('click', hideToast);

    // Hotkey recording
    document.querySelectorAll('.hotkey-input').forEach((input) => {
      input.addEventListener('focus', () => {
        input.value = 'Press keys…';
        input.classList.add('recording');
      });

      input.addEventListener('keydown', (e) => {
        e.preventDefault();
        const parts = [];
        if (e.metaKey) parts.push('Cmd');
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');

        const key = e.key;
        if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
          parts.push(key === 'Enter' ? 'Enter' : key.length === 1 ? key.toUpperCase() : key);
          input.value = parts.join('+');
          input.blur();
          input.classList.remove('recording');
        }
      });

      input.addEventListener('blur', () => {
        if (input.value === 'Press keys…') {
          // Revert to previous
          input.value = input.defaultValue;
        }
        input.classList.remove('recording');
      });
    });
  }

  // ─── IPC Listeners ──────────────────────────────────────────────────────
  function bindIPCListeners() {
    // Hotkey/tray triggers
    window.halo.onAction((action) => {
      triggerAction(action);
    });

    // Tray listening toggle
    window.halo.onToggleListening((shouldListen) => {
      if (shouldListen !== state.isListening) {
        toggleListening();
      }
    });

    // Tray settings
    window.halo.onOpenSettings(() => {
      openSettings();
    });
  }

  // ─── Model Toggle ──────────────────────────────────────────────────────
  function toggleModel() {
    state.useSmart = !state.useSmart;
    dom.modelLabel.textContent = state.useSmart ? 'smart' : 'fast';
    dom.btnModelToggle.classList.toggle('fast', !state.useSmart);
    window.halo.settings.set('useSmart', state.useSmart);
  }

  // ─── Expand / Collapse ───────────────────────────────────────────────
  function togglePanel() {
    isExpanded = !isExpanded;
    if (isExpanded) {
      expandPanel();
    } else {
      collapsePanel();
    }
  }

  function expandPanel() {
    isExpanded = true;
    dom.panel.classList.remove('collapsed');
    dom.chevronIcon.style.transform = 'rotate(180deg)';
    // Resize window to fit content
    requestAnimationFrame(() => {
      const contentH = dom.panel.scrollHeight;
      const totalH = TOOLBAR_H + contentH;
      window.halo.resize(totalH);
    });
  }

  function collapsePanel() {
    isExpanded = false;
    dom.panel.classList.add('collapsed');
    dom.chevronIcon.style.transform = 'rotate(0deg)';
    window.halo.resize(TOOLBAR_H);
  }

  /** Auto-expand when content arrives and resize to fit. */
  function autoExpand() {
    if (!isExpanded) expandPanel();
    // Re-measure after content renders
    requestAnimationFrame(() => {
      const contentH = dom.panel.scrollHeight;
      const totalH = TOOLBAR_H + contentH;
      window.halo.resize(totalH);
    });
  }

  /** Show a toast notification. */
  function showToast(text) {
    dom.toastContent.textContent = text;
    dom.toast.classList.remove('hidden');
    // Resize to include toast
    requestAnimationFrame(() => {
      const toastH = dom.toast.offsetHeight;
      const panelH = isExpanded ? dom.panel.scrollHeight : 0;
      window.halo.resize(TOOLBAR_H + panelH + toastH);
    });
  }

  function hideToast() {
    dom.toast.classList.add('hidden');
    const panelH = isExpanded ? dom.panel.scrollHeight : 0;
    window.halo.resize(TOOLBAR_H + panelH);
  }

  // ─── Status Updates ────────────────────────────────────────────────────
  function setStatus(status, text) {
    dom.statusIndicator.className = `status-${status}`;
    dom.statusText.textContent = text;
  }

  // ─── Listening (Microphone) ─────────────────────────────────────────────
  async function toggleListening() {
    if (state.isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }

  async function startListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      state.micStream = stream;
      state.micRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      state.audioChunks = [];

      state.micRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          state.audioChunks.push(event.data);
        }
      };

      state.micRecorder.start(1000); // Collect chunks every second

      state.isListening = true;
      dom.btnListen.classList.add('active');
      setStatus('listening', 'Listening');
      window.halo.setListeningState(true);

      // Periodic transcription
      state.audioChunkInterval = setInterval(() => {
        processAudioChunks();
      }, 5000);
    } catch (err) {
      console.error('Microphone access failed:', err);
      setStatus('error', 'Mic Error');
    }
  }

  function stopListening() {
    if (state.micRecorder && state.micRecorder.state !== 'inactive') {
      state.micRecorder.stop();
    }
    if (state.micStream) {
      state.micStream.getTracks().forEach((t) => t.stop());
      state.micStream = null;
    }
    if (state.audioChunkInterval) {
      clearInterval(state.audioChunkInterval);
      state.audioChunkInterval = null;
    }

    // Process any remaining audio
    if (state.audioChunks.length > 0) {
      processAudioChunks();
    }

    state.isListening = false;
    state.micRecorder = null;
    dom.btnListen.classList.remove('active');
    setStatus('idle', 'Idle');
    window.halo.setListeningState(false);
  }

  async function processAudioChunks() {
    if (state.audioChunks.length === 0) return;

    const chunks = [...state.audioChunks];
    state.audioChunks = [];

    try {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const base64Audio = arrayBufferToBase64(arrayBuffer);

      // Send to transcription
      const transcript = await transcribeAudio(base64Audio);
      if (transcript && transcript.trim()) {
        state.transcriptBuffer += ' ' + transcript.trim();
        showTranscript(transcript.trim());
      }
    } catch (err) {
      console.error('Audio processing failed:', err);
    }
  }

  // ─── Transcription ─────────────────────────────────────────────────────
  async function transcribeAudio(base64Audio) {
    const provider = state.sttProvider;
    const apiKey = state.sttApiKey || state.apiKey;

    if (!apiKey) {
      console.warn('No API key for transcription');
      return null;
    }

    try {
      if (provider === 'openai') {
        return await transcribeWithWhisper(base64Audio, apiKey);
      } else if (provider === 'gemini') {
        return await transcribeWithGemini(base64Audio, apiKey);
      }
    } catch (err) {
      console.error('Transcription failed:', err);
      return null;
    }
  }

  async function transcribeWithWhisper(base64Audio, apiKey) {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) throw new Error(`Whisper API error: ${res.status}`);
    const data = await res.json();
    return data.text;
  }

  async function transcribeWithGemini(base64Audio, apiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/webm',
                    data: base64Audio,
                  },
                },
                {
                  text: 'Transcribe this audio accurately. Return only the transcription, no commentary.',
                },
              ],
            },
          ],
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // ─── Actions ────────────────────────────────────────────────────────────
  async function handleSend() {
    const text = dom.inputField.value.trim();
    if (!text || state.isProcessing) return;

    dom.inputField.value = '';
    await runAI('question', text);
  }

  async function triggerAction(action) {
    if (state.isProcessing) return;

    // Capture screenshot for visual context
    const screenshot = await window.halo.captureScreen();

    const transcript = state.transcriptBuffer.trim();
    const inputText = dom.inputField.value.trim();
    dom.inputField.value = '';

    const context = {
      action,
      screenshot,
      transcript: transcript || null,
      userInput: inputText || null,
    };

    await runAI(action, null, context);
  }

  // ─── AI Execution ──────────────────────────────────────────────────────
  async function runAI(action, userText, context) {
    if (!state.apiKey) {
      appendResponse('system', 'Please set your API key in Settings first.');
      openSettings();
      return;
    }

    state.isProcessing = true;
    setStatus('thinking', 'Thinking');
    autoExpand();

    // Build messages
    const systemPrompt = getSystemPrompt(action);
    const messages = [{ role: 'system', content: systemPrompt }];

    // Add conversation history (last 10 messages for context)
    const recentHistory = state.conversationHistory.slice(-10);
    messages.push(...recentHistory);

    // Build user message
    const userContent = buildUserContent(action, userText, context);
    messages.push({ role: 'user', content: userContent });

    // Show what we're doing
    const actionLabels = {
      assist: '✦ Assist',
      say: '💬 What Should I Say',
      followup: '→ Follow-up',
      recap: '📋 Recap',
      solveCode: '< > Solve Code',
      question: '? Question',
    };
    const label = actionLabels[action] || action;

    const responseEl = createResponseEntry(label);
    const bodyEl = responseEl.querySelector('.response-body');
    bodyEl.classList.add('streaming-cursor');

    try {
      const fullResponse = await streamAIResponse(messages, bodyEl);

      // Store in history
      state.conversationHistory.push(
        { role: 'user', content: typeof userContent === 'string' ? userContent : '[multimodal]' },
        { role: 'assistant', content: fullResponse }
      );

      // Clear transcript buffer after use
      if (context?.transcript) {
        state.transcriptBuffer = '';
      }
    } catch (err) {
      bodyEl.textContent = `Error: ${err.message}`;
      bodyEl.style.color = 'var(--status-error)';
    } finally {
      bodyEl.classList.remove('streaming-cursor');
      state.isProcessing = false;
      setStatus(state.isListening ? 'listening' : 'idle', state.isListening ? 'Listening' : 'Idle');
    }
  }

  function buildUserContent(action, userText, context) {
    if (userText) return userText;

    const parts = [];

    if (context?.transcript) {
      parts.push(`[TRANSCRIPT]\n${context.transcript}`);
    }

    if (context?.userInput) {
      parts.push(`[USER NOTE]\n${context.userInput}`);
    }

    if (context?.screenshot) {
      parts.push('[SCREENSHOT attached — analyze the visible content]');
    }

    return parts.join('\n\n') || 'Analyze the current screen and provide assistance.';
  }

  // ─── AI Streaming ──────────────────────────────────────────────────────
  async function streamAIResponse(messages, targetEl) {
    const provider = state.provider;
    const apiKey = state.apiKey;
    const model = getModel(provider, state.useSmart);

    let fullText = '';

    if (provider === 'openai') {
      fullText = await streamOpenAI(messages, model, apiKey, targetEl);
    } else if (provider === 'anthropic') {
      fullText = await streamAnthropic(messages, model, apiKey, targetEl);
    } else if (provider === 'gemini') {
      fullText = await streamGemini(messages, model, apiKey, targetEl);
    }

    return fullText;
  }

  function getModel(provider, smart) {
    const models = {
      openai: { smart: 'gpt-4o', fast: 'gpt-4o-mini' },
      anthropic: { smart: 'claude-sonnet-4-20250514', fast: 'claude-haiku-3-20250317' },
      gemini: { smart: 'gemini-2.0-flash', fast: 'gemini-2.0-flash-lite' },
    };
    return models[provider]?.[smart ? 'smart' : 'fast'] || 'gpt-4o';
  }

  async function streamOpenAI(messages, model, apiKey, targetEl) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI ${res.status}: ${errBody}`);
    }

    return await processSSEStream(res.body, targetEl, (data) => {
      return data.choices?.[0]?.delta?.content || '';
    });
  }

  async function streamAnthropic(messages, model, apiKey, targetEl) {
    // Anthropic uses a separate system parameter
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemMsg?.content || '',
        messages: chatMessages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errBody}`);
    }

    return await processSSEStream(res.body, targetEl, (data) => {
      if (data.type === 'content_block_delta') {
        return data.delta?.text || '';
      }
      return '';
    });
  }

  async function streamGemini(messages, model, apiKey, targetEl) {
    // Convert to Gemini format
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const contents = chatMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemMsg
            ? { parts: [{ text: systemMsg.content }] }
            : undefined,
          generationConfig: {
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini ${res.status}: ${errBody}`);
    }

    return await processSSEStream(res.body, targetEl, (data) => {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    });
  }

  /**
   * Generic SSE stream processor.
   */
  async function processSSEStream(readableStream, targetEl, extractContent) {
    const reader = readableStream.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const content = extractContent(data);
            if (content) {
              fullText += content;
              renderMarkdown(targetEl, fullText);
              scrollToBottom();
            }
          } catch (parseErr) {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  // ─── Markdown Rendering (Lightweight) ──────────────────────────────────
  function renderMarkdown(el, text) {
    // Simple markdown to HTML conversion
    let html = escapeHtml(text);

    // Code blocks (```...```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

    // Unordered lists
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Paragraphs (double newline)
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[234]>)/g, '$1');
    html = html.replace(/(<\/h[234]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');

    el.innerHTML = html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── UI Helpers ─────────────────────────────────────────────────────────

  function createResponseEntry(label) {
    const entry = document.createElement('div');
    entry.className = 'response-entry';
    entry.innerHTML = `
      <div class="response-role">${escapeHtml(label)}</div>
      <div class="response-body"></div>
    `;
    dom.responseStream.appendChild(entry);
    autoExpand();
    scrollToBottom();
    return entry;
  }

  function appendResponse(role, text) {
    const entry = createResponseEntry(role);
    const body = entry.querySelector('.response-body');
    renderMarkdown(body, text);
    autoExpand();
    scrollToBottom();
  }

  function showTranscript(text) {
    const entry = document.createElement('div');
    entry.className = 'transcript-entry';
    entry.innerHTML = `
      <div class="transcript-label">Transcript</div>
      <div>${escapeHtml(text)}</div>
    `;
    dom.responseStream.appendChild(entry);
    autoExpand();
    scrollToBottom();
  }

  function scrollToBottom() {
    if (dom.responseArea) {
      dom.responseArea.scrollTop = dom.responseArea.scrollHeight;
    }
  }

  // ─── System Prompts ─────────────────────────────────────────────────────
  function getSystemPrompt(action) {
    const prompts = {
      assist: `You are Halo, an invisible AI copilot overlay on the user's screen. You can see their screen via a screenshot. You may also receive a transcript of recent audio from a meeting or conversation.

Your job: Analyze the screen and any transcript, then provide concise, actionable help. Be direct. Use bullet points and short paragraphs. Format responses with markdown.

Rules:
- Be concise — the user is reading this in a small overlay panel
- If you see code, help with it directly
- If there's a conversation transcript, provide context-aware suggestions
- Never say "I can see your screen" — just act on the information
- Prioritize actionable insights over explanations`,

      say: `You are Halo, helping the user navigate a conversation. Based on the screen content and conversation transcript, suggest what the user should say next.

Rules:
- Provide 2-3 concrete response options
- Match the tone of the conversation
- Keep suggestions natural and conversational
- Format as numbered options with brief context for each
- Be concise — this is a small overlay panel`,

      followup: `You are Halo. Based on the conversation context, generate smart follow-up questions the user could ask.

Rules:
- Provide 3-5 follow-up questions
- Make them specific to the conversation topic
- Prioritize questions that drive deeper understanding
- Format as a numbered list
- Be concise`,

      recap: `You are Halo. Provide a concise recap of the conversation or content visible on screen.

Rules:
- Summarize key points in bullet form
- Highlight decisions, action items, or important details
- Keep it scannable — use headers and bullets
- Maximum 5-8 bullet points
- Note any unresolved questions or pending items`,

      solveCode: `You are Halo, a code analysis assistant. Analyze the code visible on screen and provide solutions.

Rules:
- Identify bugs, issues, or optimization opportunities
- Provide corrected code snippets
- Explain changes briefly
- Use proper code formatting with language tags
- If the code looks fine, suggest improvements or best practices
- Be concise — show code, not paragraphs of explanation`,

      question: `You are Halo, a helpful AI assistant running as an invisible overlay. Answer the user's question concisely and accurately.

Rules:
- Be direct and concise
- Use markdown formatting
- If the question relates to something on screen, reference it
- Keep responses appropriate for a small overlay panel`,
    };

    return prompts[action] || prompts.question;
  }

  // ─── Utility ────────────────────────────────────────────────────────────
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // ─── Boot ───────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();

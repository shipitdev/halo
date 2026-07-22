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
  const dom = {};

  function initDOM() {
    const $ = (id) => document.getElementById(id);
    dom.statusIndicator = $('status-indicator');
    dom.statusDot = dom.statusIndicator ? dom.statusIndicator.querySelector('.status-dot') : null;
    dom.statusText = dom.statusIndicator ? dom.statusIndicator.querySelector('.status-text') : null;
    dom.panel = $('halo-panel');
    dom.responseArea = $('response-area');
    dom.responseStream = $('response-stream');
    dom.inputField = $('input-field');
    dom.btnListen = $('btn-listen');
    dom.btnSend = $('btn-send');
    dom.btnAssist = $('btn-assist');
    dom.btnSay = $('btn-say');
    dom.btnFollowup = $('btn-followup');
    dom.btnRecap = $('btn-recap');
    dom.btnCode = $('btn-code');
    dom.btnSettings = $('btn-settings');
    dom.btnExpand = $('btn-expand');
    dom.chevronIcon = $('chevron-icon');
    dom.btnModelToggle = $('btn-model-toggle');
    dom.modelLabel = dom.btnModelToggle ? dom.btnModelToggle.querySelector('.model-label') : null;
    dom.btnMore = $('btn-more');
    dom.dropdownMenu = $('dropdown-menu');
    dom.menuClear = $('menu-clear');
    dom.menuCopy = $('menu-copy');
    dom.menuClickthrough = $('menu-clickthrough');
    dom.sessionTimer = $('session-timer');
    dom.timerDisplay = $('timer-display');
    dom.resumeFilename = $('resume-filename');
    dom.btnUploadResume = $('btn-upload-resume');
    dom.btnClearResume = $('btn-clear-resume');
    dom.docsList = $('docs-list');
    dom.btnUploadDocs = $('btn-upload-docs');
    dom.toast = $('halo-toast');
    dom.toastContent = $('toast-content');
    dom.toastDismiss = $('toast-dismiss');
    dom.toastAccept = $('toast-accept');
    dom.settingsOverlay = $('settings-overlay');
    dom.settingsModal = $('settings-modal');
    dom.btnCloseSettings = $('btn-close-settings');
    dom.btnSaveSettings = $('btn-save-settings');
    dom.selectProvider = $('select-provider');
    dom.inputApiKey = $('input-api-key');
    dom.selectSttProvider = $('select-stt-provider');
    dom.inputSttKey = $('input-stt-key');
    dom.hotkeyToggle = $('hotkey-toggle');
    dom.hotkeyAssist = $('hotkey-assist');
    dom.hotkeyCode = $('hotkey-code');
    dom.hotkeyQuit = $('hotkey-quit');
  }

  // ─── Initialization ─────────────────────────────────────────────────────
  let isExpanded = false;
  let isClickthrough = false;
  let sessionSeconds = 0;
  let sessionTimerInterval = null;
  const TOOLBAR_H = 48;

  async function init() {
    initDOM();
    await loadSettings();
    bindEvents();
    bindIPCListeners();
    startSessionTimer();
  }

  // ─── Session Timer ──────────────────────────────────────────────────────
  function startSessionTimer() {
    if (dom.sessionTimer) dom.sessionTimer.classList.remove('hidden');
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    sessionTimerInterval = setInterval(() => {
      sessionSeconds++;
      const m = Math.floor(sessionSeconds / 60);
      const s = sessionSeconds % 60;
      if (dom.timerDisplay) {
        dom.timerDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      }
    }, 1000);
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

  async function openSettings() {
    dom.selectProvider.value = state.provider;
    dom.inputApiKey.value = state.apiKey;
    dom.selectSttProvider.value = state.sttProvider;
    dom.inputSttKey.value = state.sttApiKey;
    await renderResumeUI();
    await renderDocsUI();
    dom.settingsOverlay.classList.remove('hidden');

    // Auto-scale overlay window so Settings modal is fully visible
    requestAnimationFrame(() => {
      const modalH = dom.settingsModal ? dom.settingsModal.offsetHeight : 480;
      window.halo.resize(Math.max(520, modalH + 40));
    });
  }

  function closeSettings() {
    dom.settingsOverlay.classList.add('hidden');
    const panelH = isExpanded ? dom.panel.scrollHeight : 0;
    window.halo.resize(TOOLBAR_H + panelH);
  }

  // ─── Knowledge Base UI ──────────────────────────────────────────────────
  async function renderResumeUI() {
    if (!window.halo.knowledge) return;
    try {
      const resume = await window.halo.knowledge.getResume();
      if (resume && resume.filename) {
        if (dom.resumeFilename) dom.resumeFilename.textContent = resume.filename;
        if (dom.btnClearResume) dom.btnClearResume.classList.remove('hidden');
      } else {
        if (dom.resumeFilename) dom.resumeFilename.textContent = 'No resume uploaded';
        if (dom.btnClearResume) dom.btnClearResume.classList.add('hidden');
      }
    } catch (err) {
      console.error('Failed to load resume info:', err);
    }
  }

  async function handleUploadResume() {
    if (!window.halo.knowledge) return;
    try {
      const resume = await window.halo.knowledge.uploadResume();
      if (resume) {
        await renderResumeUI();
        showToast(`Resume uploaded: ${resume.filename}`);
      }
    } catch (err) {
      console.error('Failed to upload resume:', err);
    }
  }

  async function handleClearResume() {
    if (!window.halo.knowledge) return;
    try {
      await window.halo.knowledge.clearResume();
      await renderResumeUI();
      showToast('Resume removed');
    } catch (err) {
      console.error('Failed to clear resume:', err);
    }
  }

  async function renderDocsUI() {
    if (!window.halo.knowledge || !dom.docsList) return;
    try {
      const docs = await window.halo.knowledge.listDocuments();
      dom.docsList.innerHTML = '';
      if (!docs || docs.length === 0) {
        dom.docsList.innerHTML = '<span class="file-label">No documents added</span>';
        return;
      }
      docs.forEach((d) => {
        const tag = document.createElement('div');
        tag.className = 'doc-tag';
        tag.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:4px 8px; margin-bottom:4px; background:rgba(255,255,255,0.05); border-radius:4px; font-size:12px;';
        tag.innerHTML = `
          <span class="doc-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%;">${escapeHtml(d.filename)}</span>
          <button class="btn-remove-doc" data-id="${d.id}" title="Remove" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:12px;">✕</button>
        `;
        tag.querySelector('.btn-remove-doc').addEventListener('click', async () => {
          await window.halo.knowledge.removeDocument(d.id);
          await renderDocsUI();
        });
        dom.docsList.appendChild(tag);
      });
    } catch (err) {
      console.error('Failed to list docs:', err);
    }
  }

  async function handleUploadDocs() {
    if (!window.halo.knowledge) return;
    try {
      const added = await window.halo.knowledge.uploadDocuments();
      if (added && added.length > 0) {
        await renderDocsUI();
        showToast(`Added ${added.length} document(s)`);
      }
    } catch (err) {
      console.error('Failed to upload docs:', err);
    }
  }

  // ─── Dropdown Menu ──────────────────────────────────────────────────────
  function toggleDropdown() {
    if (dom.dropdownMenu) dom.dropdownMenu.classList.toggle('hidden');
  }

  function closeDropdown() {
    if (dom.dropdownMenu) dom.dropdownMenu.classList.add('hidden');
  }

  function handleClearConversation() {
    state.conversationHistory = [];
    state.transcriptBuffer = '';
    if (dom.responseStream) dom.responseStream.innerHTML = '';
    collapsePanel();
    showToast('Conversation cleared');
    closeDropdown();
  }

  async function handleCopyLastAnswer() {
    const lastAssistant = [...state.conversationHistory].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant && lastAssistant.content) {
      try {
        await navigator.clipboard.writeText(lastAssistant.content);
        showToast('Last answer copied to clipboard');
      } catch (err) {
        showToast('Failed to copy to clipboard');
      }
    } else {
      showToast('No answer available to copy');
    }
    closeDropdown();
  }

  function handleToggleClickthrough() {
    isClickthrough = !isClickthrough;
    window.halo.setIgnoreMouseEvents(isClickthrough);
    showToast(isClickthrough ? 'Click-through enabled' : 'Click-through disabled');
    closeDropdown();
  }

  // ─── Event Binding ──────────────────────────────────────────────────────
  function bindEvents() {
    // Input
    if (dom.inputField) {
      dom.inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }
    if (dom.btnSend) dom.btnSend.addEventListener('click', handleSend);

    // Listen toggle
    if (dom.btnListen) dom.btnListen.addEventListener('click', toggleListening);

    // Action buttons
    if (dom.btnAssist) dom.btnAssist.addEventListener('click', () => triggerAction('assist'));
    if (dom.btnSay) dom.btnSay.addEventListener('click', () => triggerAction('say'));
    if (dom.btnFollowup) dom.btnFollowup.addEventListener('click', () => triggerAction('followup'));
    if (dom.btnRecap) dom.btnRecap.addEventListener('click', () => triggerAction('recap'));
    if (dom.btnCode) dom.btnCode.addEventListener('click', () => triggerAction('solveCode'));

    // Model toggle
    if (dom.btnModelToggle) dom.btnModelToggle.addEventListener('click', toggleModel);

    // Three-dot dropdown menu
    if (dom.btnMore) {
      dom.btnMore.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
      });
    }
    document.addEventListener('click', (e) => {
      if (dom.dropdownMenu && !dom.dropdownMenu.contains(e.target) && e.target !== dom.btnMore) {
        closeDropdown();
      }
    });

    if (dom.menuClear) {
      dom.menuClear.addEventListener('click', (e) => {
        e.stopPropagation();
        handleClearConversation();
      });
    }
    if (dom.menuCopy) {
      dom.menuCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCopyLastAnswer();
      });
    }
    if (dom.menuClickthrough) {
      dom.menuClickthrough.addEventListener('click', (e) => {
        e.stopPropagation();
        handleToggleClickthrough();
      });
    }

    // Toolbar mouse hover handling for click-through mode
    const toolbarEl = document.getElementById('halo-toolbar');
    if (toolbarEl) {
      toolbarEl.addEventListener('mouseenter', () => {
        if (isClickthrough) window.halo.setIgnoreMouseEvents(false);
      });
      toolbarEl.addEventListener('mouseleave', () => {
        if (isClickthrough) window.halo.setIgnoreMouseEvents(true, { forward: true });
      });
    }

    // Resume & Knowledge Base UI
    if (dom.btnUploadResume) dom.btnUploadResume.addEventListener('click', handleUploadResume);
    if (dom.btnClearResume) dom.btnClearResume.addEventListener('click', handleClearResume);
    if (dom.btnUploadDocs) dom.btnUploadDocs.addEventListener('click', handleUploadDocs);

    // Settings
    if (dom.btnSettings) dom.btnSettings.addEventListener('click', openSettings);
    if (dom.btnCloseSettings) dom.btnCloseSettings.addEventListener('click', closeSettings);
    if (dom.btnSaveSettings) dom.btnSaveSettings.addEventListener('click', saveSettings);
    if (dom.settingsOverlay) {
      dom.settingsOverlay.addEventListener('click', (e) => {
        if (e.target === dom.settingsOverlay) closeSettings();
      });
    }

    // Expand / Collapse
    if (dom.btnExpand) dom.btnExpand.addEventListener('click', togglePanel);

    // Toast
    if (dom.toastDismiss) dom.toastDismiss.addEventListener('click', hideToast);
    if (dom.toastAccept) dom.toastAccept.addEventListener('click', hideToast);

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

    // Meeting detection
    if (window.halo.onMeetingDetected) {
      window.halo.onMeetingDetected((meeting) => {
        showToast(`Meeting detected: ${meeting.name} — Halo active`);
      });
    }
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
    lastResizedH = TOOLBAR_H;
    window.halo.resize(TOOLBAR_H);
  }

  /** Auto-expand when content arrives and resize window height dynamically. */
  let lastResizedH = 0;
  let isResizeScheduled = false;

  function autoExpand() {
    if (!isExpanded) {
      isExpanded = true;
      dom.panel.classList.remove('collapsed');
      dom.chevronIcon.style.transform = 'rotate(180deg)';
    }

    if (isResizeScheduled) return;
    isResizeScheduled = true;

    requestAnimationFrame(() => {
      isResizeScheduled = false;
      const contentH = dom.panel ? (dom.panel.offsetHeight || dom.panel.scrollHeight) : 0;
      const totalH = TOOLBAR_H + contentH;
      if (Math.abs(totalH - lastResizedH) >= 2) {
        lastResizedH = totalH;
        window.halo.resize(totalH);
      }
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

  // ─── Listening (Microphone with Valid WebM Headers) ──────────────────────
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
      state.isListening = true;
      dom.btnListen.classList.add('active');
      setStatus('listening', 'Listening');
      window.halo.setListeningState(true);

      startRecordingSlice();

      // Transcribe completed slices every 4 seconds
      state.audioChunkInterval = setInterval(() => {
        cycleRecordingSlice();
      }, 4000);
    } catch (err) {
      console.error('Microphone access failed:', err);
      setStatus('error', 'Mic Error');
    }
  }

  function startRecordingSlice() {
    if (!state.micStream || !state.isListening) return;

    try {
      state.audioChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(state.micStream, { mimeType });
      state.micRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          state.audioChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (state.audioChunks.length > 0) {
          const blob = new Blob(state.audioChunks, { type: mimeType });
          state.audioChunks = [];
          await processAudioBlob(blob);
        }
      };

      recorder.start();
    } catch (err) {
      console.error('Failed to start MediaRecorder slice:', err);
    }
  }

  function cycleRecordingSlice() {
    if (state.micRecorder && state.micRecorder.state === 'recording') {
      const oldRecorder = state.micRecorder;
      startRecordingSlice(); // Start new standalone slice first
      oldRecorder.stop(); // Stop old slice to produce valid EBML container
    }
  }

  function stopListening() {
    state.isListening = false;
    if (state.audioChunkInterval) {
      clearInterval(state.audioChunkInterval);
      state.audioChunkInterval = null;
    }

    if (state.micRecorder && state.micRecorder.state !== 'inactive') {
      state.micRecorder.stop();
    }

    if (state.micStream) {
      state.micStream.getTracks().forEach((t) => t.stop());
      state.micStream = null;
    }

    dom.btnListen.classList.remove('active');
    setStatus('idle', 'Idle');
    window.halo.setListeningState(false);
  }

  async function processAudioBlob(blob) {
    if (!blob || blob.size < 100) return;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const transcript = await window.halo.transcribeAudio(arrayBuffer, 'webm');
      if (transcript && transcript.trim()) {
        const text = transcript.trim();
        state.transcriptBuffer += ' ' + text;
        showToast(`🎤 "${text}"`);
      }
    } catch (err) {
      console.error('Audio transcription failed:', err.message);
    }
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

    let screenshot = null;
    try {
      screenshot = await window.halo.captureScreen();
    } catch (err) {
      console.warn('Screen capture failed, proceeding without screenshot:', err);
    }

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
    lastResizedH = 0;
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
      const fullResponse = await streamAIResponse(messages, bodyEl, context?.screenshot);

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

  // ─── AI Streaming via IPC Bridge ───────────────────────────────────────
  async function streamAIResponse(messages, targetEl, screenshot) {
    return new Promise((resolve, reject) => {
      let fullText = '';
      window.halo.streamAI(
        { messages, screenshot },
        (chunk) => {
          fullText += chunk;
          renderMarkdown(targetEl, fullText);
          scrollToBottom();
          autoExpand();
        },
        (finalText) => {
          resolve(finalText);
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  // ─── Markdown Rendering (Lightweight) ──────────────────────────────────
  function renderMarkdown(el, text) {
    let source = text || '';

    // Handle unclosed code block during live streaming
    const codeBlockCount = (source.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
      source += '\n```';
    }

    let html = escapeHtml(source);

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

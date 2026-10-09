# Halo (v1.0.0 Beta)
![Status: Beta](https://img.shields.io/badge/Status-Beta_v1.0.0-emerald)
![Platform: macOS](https://img.shields.io/badge/Platform-macOS-blue)
![License: GPL--3.0](https://img.shields.io/badge/License-GPL--3.0-purple)

Halo is a discreet macOS overlay designed to help with coding problems and interview questions using screen content, spoken questions, and optional resume context.

> [!NOTE]
> **Halo is currently in Beta (v1.0.0)**. Features and APIs are actively evolving.

---

## ⚡ Key Features

- **Liquid Glassmorphism UI** — High-contrast frosted glass overlay with emerald accents that floats over your browser, IDE, or meeting apps without obscuring underlying content.
- **Dynamic Auto-Scaling & Resizing** — Panel automatically expands to show complete AI responses and includes a manual bottom drag handle for custom window heights up to 800px.
- **Voice Activity Detection (VAD)** — Intelligent Web Audio API energy monitoring detects spoken sentences and transcribes audio only when speech finishes, saving API quota.
- **Screen Analysis & Coding Assistant** — Instantly captures LeetCode problems or on-screen code (`Cmd+Shift+H`) and delivers formatted analysis with 1-click code copying.
- **LaTeX Math Rendering** — Beautifully formats complexity notations (e.g. $\mathcal{O}(N)$) and mathematical expressions inline and in dedicated math blocks.
- **Multi-Model Provider Architecture** — Seamlessly stream responses from OpenAI (GPT-4o, GPT-4o-mini, Whisper) or Google Gemini (2.0 Flash, 2.0 Flash Lite, 1.5 Pro).
- **Global Hotkeys & Click-Through Mode** — Toggle overlay visibility (`Cmd+B`), trigger AI assistance (`Cmd+Enter`), or enable mouse click-through mode for uninterrupted work.

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/shipitdev/halo.git
cd halo

# Install dependencies
npm install

# Start Halo
npm start
```

On first launch, open **Settings** (⚙ top right of toolbar) to enter your **Gemini** (`AIzaSy...`) or **OpenAI** (`sk-...`) API Key.

---

## ⌨️ Default Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd + B` | Toggle overlay visibility |
| `Cmd + Enter` | Trigger AI Assist (Screen + Transcript Context) |
| `Cmd + Shift + H` | Solve Code / Analyze Screen |
| `Cmd + Shift + X` | Quit Halo |

---

## 🛠 Tech Stack

- **Framework**: Electron (Frameless transparent overlay)
- **Frontend**: Vanilla HTML5, CSS3 Glassmorphism System, ES2022 JavaScript
- **AI Integration**: OpenAI Node SDK, `@google/genai` Google GenAI SDK
- **Audio Processing**: Web Audio API (RMS Analyser) + MediaRecorder WebM / PCM Audio Buffer

---

## 📄 License

GPL-3.0 — Copyright (c) 2026 shipitdev

### Audio transcription

In Settings, choose OpenAI Whisper, Gemini, or Groq Whisper. Groq requires its own
STT API key and uses `whisper-large-v3-turbo` through the existing OpenAI SDK.
No additional SDK is needed. Audio is sent to the selected cloud provider; configured
OpenAI or Gemini keys can be used as fallbacks if that request fails.

The audio input defaults to the microphone. On this project's Electron 33 build,
meeting detection does **not** capture system playback. To transcribe remote
participants, route meeting playback through an installed loopback input and select
it under **Audio input**. To capture yourself too, choose an input that mixes the
microphone and system playback. Input names may appear only after microphone
permission has been granted. Restart listening after changing the input.

Each recording ends after a speech pause or 20 seconds and includes a complete file
header. Stopping listening flushes unfinished speech. Requests run in capture order;
results from a previous listening session are ignored after a new session starts.

Run `npm test` for module, component, and audio behavior checks. Tests store settings
and documents in temporary directories rather than changing your Halo profile.

### Screen analysis

The Screen button captures the display containing Halo, briefly hides the overlay,
and restores it without taking focus. It captures before expanding the response panel.
Images use lossless PNG at up to 2560 pixels wide, taking Retina scale into account.
Screen analysis follows your typed note or explains the visible task; the coding
hotkey keeps its dedicated coding prompt. A failed capture preserves your note and
shows the error instead of asking the model to answer without the image.


### Hidden-overlay behavior

The goal is to keep Halo available to you while excluding it from screen shares.
Halo now requests operating-system content protection and hides during its own
screenshots. This is best-effort protection: newer macOS sharing apps using
ScreenCaptureKit can still include a protected window. Verify your sharing setup;
universal exclusion is not implemented. Track that work in
[the hidden-overlay implementation report](https://github.com/shipitdev/halo/issues/3).

Typed questions include the recent transcript, and explicit “What should I say”
actions keep their own response format. Ending a meeting changes the selected
assistance mode without deleting its transcript.

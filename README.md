# Halo (v1.0.0 Beta)
![Status: Beta](https://img.shields.io/badge/Status-Beta_v1.0.0-emerald)
![Platform: macOS](https://img.shields.io/badge/Platform-macOS-blue)
![License: GPL--3.0](https://img.shields.io/badge/License-GPL--3.0-purple)

A translucent, liquid-glass AI copilot overlay for macOS — captures your screen, mic, and desktop content in real time to power a live AI assistant.

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

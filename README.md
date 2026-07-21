# Halo

An invisible AI overlay for macOS — captures your screen, mic, and meeting audio to power a real-time AI copilot that stays hidden from screen shares.

## What It Does

Halo floats on top of everything but is **invisible to screen recordings and screen shares**. It listens to your microphone and system audio, transcribes conversations in real time, and gives you AI-powered assistance — all without anyone knowing.

### Features

- **Screen-Share Invisible** — Uses macOS content protection so the overlay never appears in recordings or shared screens
- **Real-Time Transcription** — Captures mic + system audio and transcribes with Whisper / Gemini
- **Multi-Provider AI** — Choose between OpenAI (GPT-4o), Anthropic (Claude), or Google (Gemini)
- **Smart Actions** — Assist, "What Should I Say?", Follow-Up, Recap, Solve Code
- **Glassmorphism UI** — Sleek frosted-glass dark theme with purple/blue accents
- **Global Hotkeys** — Fully customizable keyboard shortcuts
- **System Tray** — Minimal footprint, runs from the menu bar

## Requirements

- macOS 12+
- Node.js 18+
- An API key for at least one provider (OpenAI, Anthropic, or Google)

## Setup

```bash
# Install dependencies
npm install

# Launch the app
npm start
```

On first launch, open **Settings** (via the tray icon or gear button) and enter your API key.

## Hotkeys (Defaults)

| Shortcut | Action |
|---|---|
| `Cmd + B` | Toggle overlay visibility |
| `Cmd + Enter` | Assist (analyze screen + audio) |
| `Cmd + H` | Solve Code |
| `Cmd + Shift + X` | Quit Halo |

Hotkeys are fully customizable from the Settings panel.

## Tech Stack

- **Desktop:** Electron + vanilla HTML/CSS/JS
- **AI:** OpenAI, Anthropic, Google Gemini SDKs
- **Audio:** Web Audio API + Electron desktopCapturer
- **Server:** Express.js + PostgreSQL (optional, for auth/billing)

## Privacy

Halo processes audio and screenshots **only when you trigger an action**. No data is stored on external servers unless you opt into the hosted backend. All AI calls go directly to the provider you choose.

## License

GPL-3.0 — Copyright (C) 2026 shipitdev

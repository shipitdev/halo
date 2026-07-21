# Halo — Clean-Room AI Overlay Rewrite

A from-scratch invisible AI overlay for macOS. Same concept as "cue" (Cluely-style copilot), but **100% original code** under a new identity.

## Summary of Decisions

| Decision | Choice |
|---|---|
| **Name** | Halo |
| **Author** | shipitdev |
| **License** | GPL-3.0 (your copyright) |
| **Desktop Stack** | Electron + plain HTML/CSS/JS |
| **Server Stack** | Express.js + PostgreSQL |
| **UI Style** | Dark glassmorphism — frosted panels, purple/blue gradients, subtle glows |
| **Location** | `~/Desktop/halo` |

---

## User Review Required

> [!IMPORTANT]
> **Clean-room rewrite:** All code will be written from scratch. No code will be copied from the original `cue` project. The architecture and feature design are original implementations of the same concept (invisible AI overlay), which is not copyrightable — only code is.

> [!WARNING]
> **Scope is large.** This is a full Electron app + Express server + PostgreSQL schema + Stripe integration + multi-provider AI + audio capture pipeline. I'll build it in phases so you can test as we go. Estimated: ~25-30 files across client and server.

---

## Proposed Changes

### Phase 1 — Project Scaffold & Core Electron Shell

Sets up the project structure, Electron main process, and the basic overlay window with content protection.

#### [NEW] `~/Desktop/halo/package.json`
Root package.json with Electron, electron-builder config. App name "halo", author "shipitdev", GPL-3.0 license. App ID `com.shipitdev.halo`.

#### [NEW] `~/Desktop/halo/LICENSE`
GPL-3.0 license text with `Copyright (C) 2026 shipitdev`.

#### [NEW] `~/Desktop/halo/README.md`
Fresh README for Halo — what it does, install instructions, setup guide, usage, privacy statement. No mention of cue or Blueturboguy07.

#### [NEW] `~/Desktop/halo/.gitignore`
Standard Node/Electron gitignore (node_modules, dist, .env, etc.)

#### [NEW] `~/Desktop/halo/main.js`
Electron main process — from scratch:
- Creates frameless, transparent, always-on-top BrowserWindow
- `setContentProtection(true)` for screen-share invisibility
- `LSUIElement: true` (no dock icon)
- IPC handlers for screenshot capture via `desktopCapturer`
- Global hotkey registration (customizable via config)
- Tray icon with quick actions (start/stop listening, toggle visibility, quit)
- System audio loopback setup via `getDisplayMedia`

#### [NEW] `~/Desktop/halo/preload.js`
Context bridge exposing safe IPC methods to renderer:
- `halo.screenshot()` — request screen capture
- `halo.onStream()` — receive AI streaming responses
- `halo.settings.get/set()` — config management
- `halo.hotkeys.register/unregister()` — custom hotkey management

---

### Phase 2 — Renderer (UI)

The glassmorphism overlay interface — all original HTML/CSS/JS.

#### [NEW] `~/Desktop/halo/renderer/index.html`
Semantic HTML5 layout:
- Top pill/handle bar (drag area, status indicators, controls)
- Main response panel (streaming AI output with markdown rendering)
- Input bar with text input, action buttons, Smart toggle
- Settings modal
- Unique IDs on all interactive elements

#### [NEW] `~/Desktop/halo/renderer/styles.css`
Original design system from scratch:
- CSS custom properties for the entire theme (colors, spacing, typography, etc.)
- Dark glassmorphism: `backdrop-filter: blur()`, translucent `rgba()` backgrounds
- Purple/blue gradient accents (`hsl(260, ...)` → `hsl(220, ...)`)
- Subtle glow effects via `box-shadow` with accent colors
- Micro-animations (fade-in for messages, pulse for recording indicator, smooth transitions)
- Responsive panel sizing
- Google Fonts: Inter for UI text

#### [NEW] `~/Desktop/halo/renderer/app.js`
Main renderer logic — from scratch:
- State management (current mode, conversation history, settings)
- Audio capture pipeline: mic via `getUserMedia`, system audio via IPC
- Audio chunking, downsampling to 16kHz, WAV encoding
- UI updates: streaming text rendering, button state management
- Action handlers: Assist, What Should I Say, Follow-up, Recap, Solve Code
- Settings panel: provider selection, API key input, hotkey customization
- Drag handling for the overlay panel
- Tray icon state sync

#### [NEW] `~/Desktop/halo/renderer/icons.js`
SVG icon module — original icon set using simple geometric SVGs (not copying lucide or any icon library from cue).

---

### Phase 3 — AI Provider Layer

Multi-provider AI abstraction — completely original architecture.

#### [NEW] `~/Desktop/halo/src/providers/base.js`
Abstract provider interface:
- `chat(messages, options)` → async generator (streaming)
- `transcribe(audioBuffer, format)` → text
- `supportsTranscription()` → boolean

#### [NEW] `~/Desktop/halo/src/providers/openai.js`
OpenAI provider: GPT-4o / GPT-4o-mini for chat, Whisper for STT. Streaming via SDK.

#### [NEW] `~/Desktop/halo/src/providers/anthropic.js`
Anthropic provider: Claude Sonnet / Opus for chat. No native STT (falls back to other provider).

#### [NEW] `~/Desktop/halo/src/providers/gemini.js`
Gemini provider: Gemini models for chat + native audio transcription.

#### [NEW] `~/Desktop/halo/src/providers/index.js`
Provider factory/manager:
- `createProvider(name, apiKey)` — instantiate by name
- `getTranscriptionProvider(providers)` — pick the best STT-capable provider
- Smart/Fast model selection per provider

---

### Phase 4 — Core Logic Modules

#### [NEW] `~/Desktop/halo/src/audio.js`
Audio processing utilities:
- PCM downsampling to 16kHz mono
- WAV header encoding
- Audio chunk buffering with configurable intervals

#### [NEW] `~/Desktop/halo/src/capture.js`
Screen capture module:
- `captureScreen()` — full-resolution screenshot via Electron desktopCapturer
- Returns base64-encoded image

#### [NEW] `~/Desktop/halo/src/prompts.js`
System prompts for each mode — all original text:
- Assist mode prompt
- "What should I say?" prompt
- Follow-up question prompt
- Recap prompt
- Code solver prompt
- General question prompt

#### [NEW] `~/Desktop/halo/src/config.js`
Configuration/settings manager:
- Read/write `halo-config.json` in user data directory
- API keys, provider preferences, hotkey mappings
- Default hotkey config with customization support

---

### Phase 5 — Server Backend

Independent Express.js server for auth, billing, and AI proxying.

#### [NEW] `~/Desktop/halo/server/package.json`
Server dependencies: express, pg, bcryptjs, jsonwebtoken, stripe, helmet, cors, dotenv, rate-limit, AI SDKs.

#### [NEW] `~/Desktop/halo/server/.env.example`
Template env file with all required variables documented.

#### [NEW] `~/Desktop/halo/server/src/index.js`
Express app entry point:
- Middleware stack (helmet, cors, rate-limit, JSON parsing)
- Route mounting
- Error handler
- Server startup

#### [NEW] `~/Desktop/halo/server/src/db.js`
PostgreSQL connection pool using `pg`. Connection via `DATABASE_URL`.

#### [NEW] `~/Desktop/halo/server/src/migrate.js`
Database migration script — creates tables:
- `users` (id, email, password_hash, plan, stripe_customer_id, timestamps)
- `sessions` (id, user_id, token, expires_at)
- `usage` (id, user_id, provider, tokens_used, timestamp)

#### [NEW] `~/Desktop/halo/server/src/middleware/auth.js`
JWT authentication middleware — verify token, attach user to request.

#### [NEW] `~/Desktop/halo/server/src/routes/auth.js`
Auth routes: POST `/register`, POST `/login`, POST `/logout`, GET `/me`.

#### [NEW] `~/Desktop/halo/server/src/routes/billing.js`
Stripe billing routes:
- POST `/create-checkout` — create Stripe checkout session
- POST `/webhook` — handle Stripe webhooks (subscription events)
- GET `/subscription` — current plan info

#### [NEW] `~/Desktop/halo/server/src/routes/ai.js`
AI proxy routes:
- POST `/chat` — proxied streaming chat (uses server-side API keys)
- POST `/transcribe` — proxied audio transcription
- Provider selection based on user preference + plan

---

### Phase 6 — Tray Icon & Hotkey Customization

#### Integrated into `main.js`
- System tray icon with context menu:
  - Start/Stop Listening
  - Toggle Visibility (Show/Hide overlay)
  - Settings
  - Quit Halo
- Global hotkey system:
  - Default: `Cmd+Enter` (Assist), `Cmd+H` (Solve Code), `Cmd+Shift+X` (Quit)
  - Configurable via Settings panel
  - Stored in `halo-config.json`

---

## File Structure Overview

```
~/Desktop/halo/
├── main.js                    # Electron main process
├── preload.js                 # Context bridge
├── package.json               # Root package + electron-builder config
├── LICENSE                    # GPL-3.0, Copyright 2026 shipitdev
├── README.md                  # Fresh docs
├── .gitignore
├── renderer/
│   ├── index.html             # Overlay UI
│   ├── styles.css             # Glassmorphism design system
│   ├── app.js                 # Renderer logic
│   └── icons.js               # SVG icons
├── src/
│   ├── audio.js               # Audio processing
│   ├── capture.js             # Screen capture
│   ├── prompts.js             # AI system prompts
│   ├── config.js              # Settings manager
│   └── providers/
│       ├── index.js           # Provider factory
│       ├── base.js            # Abstract provider
│       ├── openai.js          # OpenAI integration
│       ├── anthropic.js       # Anthropic integration
│       └── gemini.js          # Gemini integration
└── server/
    ├── package.json           # Server dependencies
    ├── .env.example           # Config template
    └── src/
        ├── index.js           # Express entry
        ├── db.js              # PostgreSQL pool
        ├── migrate.js         # DB migrations
        ├── middleware/
        │   └── auth.js        # JWT auth
        └── routes/
            ├── auth.js        # Auth endpoints
            ├── billing.js     # Stripe billing
            └── ai.js          # AI proxy
```

**Total: ~27 new files**

---

## Verification Plan

### Automated Tests
```bash
# Verify project installs cleanly
cd ~/Desktop/halo && npm install

# Verify server installs cleanly
cd ~/Desktop/halo/server && npm install

# Verify Electron app launches
cd ~/Desktop/halo && npm start

# Verify server starts (will need a .env)
cd ~/Desktop/halo/server && npm run dev
```

### Manual Verification
- Launch the Electron app and verify:
  - Overlay window appears with glassmorphism UI
  - Window is invisible in screen recordings (test with QuickTime screen record)
  - Tray icon appears with context menu
  - Settings panel opens and accepts API keys
  - Hotkeys are registered and functional
  - Dragging the overlay works
- Verify no code overlap with original `cue` project (different architecture, naming, structure)

---

## Build Order

I'll implement in this order, testing after each phase:

1. **Scaffold** → `package.json`, `LICENSE`, `.gitignore`, `README.md`
2. **Electron shell** → `main.js`, `preload.js` (verify window launches)
3. **UI** → `renderer/*` (verify glassmorphism overlay renders)
4. **AI providers** → `src/providers/*` (verify streaming works with a real key)
5. **Core logic** → `src/audio.js`, `src/capture.js`, `src/prompts.js`, `src/config.js`
6. **Wire it all together** → connect UI ↔ main process ↔ providers
7. **Server** → `server/*` (auth, billing, AI proxy)
8. **Tray & hotkeys** → system tray + customizable shortcuts

> [!NOTE]
> Each phase produces a testable app. After Phase 3, you'll have a working overlay that can chat with AI. The server (Phase 7) is independent and can be built/tested separately.

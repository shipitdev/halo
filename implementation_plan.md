# Halo v2 — Feature Expansion Plan

## Goal

Add ParakeetAI-style answer layouts, knowledge base (resume + documents), auto-detect meetings, and a session timer — while preserving all existing features.

---

## User Review Required

> [!IMPORTANT]
> **No features will be removed.** All existing actions (Assist, Say, Follow-up, Recap, Code, Question), mic transcription, multi-provider AI streaming, settings, hotkeys, tray icon, and screen capture are preserved.

> [!NOTE]
> The toolbar was redesigned (horizontal glass bar), but the underlying action logic is identical. The button labels changed cosmetically:
> - "Assist" → "AI Answer" (same `assist` action)
> - "Solve Code" → "Analyze Screen" (same `solveCode` action)
> - "What Should I Say" → "Chat" (same `say` action)
> - Follow-up and Recap moved to the expanded panel's quick-actions row

---

## Proposed Changes

### 1. Answer Layouts (ParakeetAI-style)

Based on the screenshots:

**For coding answers:**
- `🎯 Question:` header with detected question
- `⭐ Answer:` section with bullet explanation
- `🔑 Key Steps:` enumerated approach
- `💻 Code:` section with syntax-highlighted code block + copy button + language label

**For interview/behavioral answers:**
- `🎯 Question:` detected question
- `⭐ Answer:` structured response with bullet points
- Chat-bubble style (interviewer question → AI answer)

#### Files to modify:
- [MODIFY] [app.js](file:///Users/harsh/Desktop/halo/renderer/app.js) — Enhanced markdown renderer with copy-to-clipboard on code blocks, emoji section headers
- [MODIFY] [styles.css](file:///Users/harsh/Desktop/halo/renderer/styles.css) — Code block styling (language label, copy button, syntax colors), answer section cards
- [MODIFY] [prompts.js](file:///Users/harsh/Desktop/halo/src/prompts.js) — Update prompts to output structured sections with `🎯 Question`, `⭐ Answer`, `💻 Code` headers

---

### 2. Resume Upload (Tailored Responses)

Upload a PDF resume → text is extracted and stored → injected into AI prompts so responses are personalized to the user's background.

#### Files:
- [NEW] [src/knowledge.js](file:///Users/harsh/Desktop/halo/src/knowledge.js) — Knowledge base manager: stores resume text + documents, reads/writes to `~/.halo/knowledge/`
- [MODIFY] [main.js](file:///Users/harsh/Desktop/halo/main.js) — IPC handlers for `halo:upload-resume`, `halo:get-resume`
- [MODIFY] [preload.js](file:///Users/harsh/Desktop/halo/preload.js) — Expose `uploadResume()`, `getResume()` to renderer
- [MODIFY] [index.html](file:///Users/harsh/Desktop/halo/renderer/index.html) — Settings modal: "Resume" section with upload button + filename display
- [MODIFY] [app.js](file:///Users/harsh/Desktop/halo/renderer/app.js) — File picker trigger, save resume, inject resume context into AI calls
- [MODIFY] [prompts.js](file:///Users/harsh/Desktop/halo/src/prompts.js) — All prompts enhanced with `{RESUME_CONTEXT}` placeholder

**PDF Parsing:** Use `pdf-parse` npm package (lightweight, no native deps) to extract text from uploaded PDFs.

---

### 3. Document/Notes Knowledge Base

Upload additional documents (PDFs, text files, markdown) that the AI can reference as context. Think of it as a "notes folder" the AI always has access to.

#### Files:
- [MODIFY] [src/knowledge.js](file:///Users/harsh/Desktop/halo/src/knowledge.js) — `addDocument(filePath)`, `removeDocument(id)`, `listDocuments()`, `getContext()` — stores extracted text in JSON
- [MODIFY] [main.js](file:///Users/harsh/Desktop/halo/main.js) — IPC: `halo:upload-doc`, `halo:remove-doc`, `halo:list-docs`
- [MODIFY] [preload.js](file:///Users/harsh/Desktop/halo/preload.js) — Expose document management APIs
- [MODIFY] [index.html](file:///Users/harsh/Desktop/halo/renderer/index.html) — Settings modal: "Knowledge Base" section with upload, list of docs with delete buttons
- [MODIFY] [app.js](file:///Users/harsh/Desktop/halo/renderer/app.js) — Inject document context into AI prompts alongside resume

**Storage:** `~/.halo/knowledge/resume.json` and `~/.halo/knowledge/documents.json` — simple JSON files with extracted text. No vector DB needed at this scale.

---

### 4. Auto-Detect Meetings

Poll for running meeting apps (Zoom, Google Meet, Microsoft Teams, Webex) and auto-start listening when one is detected.

#### Files:
- [NEW] [src/meetings.js](file:///Users/harsh/Desktop/halo/src/meetings.js) — `MeetingDetector` class:
  - Uses `child_process.exec('pgrep -lf "zoom|teams|webex"')` on macOS
  - For Google Meet: checks `desktopCapturer` window titles for "Meet -"
  - Polls every 5 seconds
  - Emits events: `meeting-started(app)`, `meeting-ended(app)`
  - Detects: Zoom, Microsoft Teams, Webex, Google Meet, Amazon Chime, Slack Huddles
- [MODIFY] [main.js](file:///Users/harsh/Desktop/halo/main.js) — Initialize `MeetingDetector`, send IPC notifications to renderer, start/stop timer
- [MODIFY] [preload.js](file:///Users/harsh/Desktop/halo/preload.js) — Expose `onMeetingDetected(callback)`
- [MODIFY] [app.js](file:///Users/harsh/Desktop/halo/renderer/app.js) — Show toast notification when meeting detected, auto-start listening, update status
- [MODIFY] [index.html](file:///Users/harsh/Desktop/halo/renderer/index.html) — Add session timer display to toolbar right section

---

### 5. Session Timer (from ParakeetAI screenshots)

Show a `MM:SS` timer in the toolbar that starts when listening begins (or meeting detected) and shows elapsed time.

#### Files:
- [MODIFY] [index.html](file:///Users/harsh/Desktop/halo/renderer/index.html) — Timer element in toolbar: `<span id="session-timer">0:00</span>`
- [MODIFY] [app.js](file:///Users/harsh/Desktop/halo/renderer/app.js) — Timer logic (start/stop/reset) tied to listening state
- [MODIFY] [styles.css](file:///Users/harsh/Desktop/halo/renderer/styles.css) — Timer styling (monospace, pill background)

---

### 6. Toolbar Enhancements

From the ParakeetAI screenshots, a few more toolbar elements:
- **"More" dropdown** — three-dot menu with: Clear Conversation, Copy Last Answer, Toggle Click-Through
- **Move handle** — cross/plus icon for repositioning (already works via drag, just visual indicator)

#### Files:
- [MODIFY] [index.html](file:///Users/harsh/Desktop/halo/renderer/index.html) — Three-dot menu button, dropdown menu
- [MODIFY] [app.js](file:///Users/harsh/Desktop/halo/renderer/app.js) — Dropdown toggle, clear conversation, copy answer
- [MODIFY] [styles.css](file:///Users/harsh/Desktop/halo/renderer/styles.css) — Dropdown styling
- [MODIFY] [icons.js](file:///Users/harsh/Desktop/halo/renderer/icons.js) — Add three-dot, move, and file upload icons

---

## Open Questions

1. **Resume format**: Should we support only PDF, or also DOCX and plain text?
2. **Knowledge base size limit**: Should we cap document uploads (e.g. 5 docs, 50KB text each) to keep prompt context manageable?
3. **Meeting auto-listen**: Should it auto-start listening when a meeting is detected, or just notify and let the user start manually?

---

## Verification Plan

### Automated Tests
- `node test-modules.js` — existing 21 tests still pass
- New tests for `knowledge.js` (CRUD operations)
- New tests for `meetings.js` (process detection mock)

### Manual Verification
- Upload a test PDF resume → verify text appears in Settings
- Upload 2-3 docs → verify they show in Knowledge Base list
- Open Zoom → verify meeting detection toast
- Trigger AI Answer on a coding problem → verify structured answer with copy-able code block
- Run `npm start` → verify toolbar, expand/collapse, all actions work

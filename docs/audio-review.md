# Audio and functionality review — 2026-10-09

## Changes in this pass

- Replaced slices of one ongoing WebM recording with complete per-utterance recordings. Later WebM slices previously lacked a standalone container header, and trimming silence could discard the original header before the first request.
- Stop now waits for the recorder's final data event to submit unfinished speech.
- Added permission-prompt cancellation and duplicate-start guards; capture errors release resources.
- Sequential transcription preserves sentence order. Starting another listening session suppresses late results from the old session.
- Preserved similar and repeated utterances. Word-set overlap could delete a correction such as “We should not deploy the release today.”
- Fixed the transcript toast's call to nonexistent `hasContext()`.
- Added Groq Whisper via the existing OpenAI SDK, audio format/size checks at IPC, and an audio-input selector for loopback/mixed meeting input.
- Fixed two asynchronous meeting tests which previously reported success without awaiting assertions. Isolated both existing suites from real settings and documents.

## Remaining findings

1. **Remote participants are not captured natively.** Electron is pinned to 33.2.1 and the app only requests `getUserMedia`. Selecting a preconfigured loopback/mixed input is supported; this pass does not install a driver, upgrade Electron, or implement ScreenCaptureKit. Native system capture needs its own integration and actual macOS permission/hardware testing.
2. **Meeting detection is an application heuristic.** A running Zoom/Teams app is treated as an active meeting. Google Meet window-title matching exists but is not wired into polling. Do not use detection as proof someone joined a call or as permission to record. Detection does not start recording.
3. **VAD is an energy threshold.** Quiet speech can be missed, background noise can trigger transcription, and restarting the recorder at the 20-second limit can lose a small boundary interval. Test with real input levels before claiming transcription accuracy. Upgrade to continuous PCM/AudioWorklet capture if boundary loss matters.
4. **Cloud latency can create a backlog.** Sequential requests retain pending recordings in memory while the service is slow. Long-session backpressure needs a deliberate queue policy; silently dropping speech is not implemented.
5. **Backend authentication uses a development JWT fallback.** `server/src/middleware/auth.js` uses `halo-dev-secret` if `JWT_SECRET` is absent. Production should fail startup without a secret. This was inspected but not changed in this audio patch.
6. **Storage error reporting and PDF parsing need separate work.** Configuration/knowledge save failures are logged but not returned to the user. PDF failures fall back to reading binary bytes as text, and the modern parser is not destroyed. Avoid treating the component suite as proof these integration paths work.

## Validation boundaries

Automated tests exercise capture state, complete-file assembly, stop/cancellation,
request ordering and recovery, transcript preservation, and Groq request construction.
MediaRecorder and devices are faked at the browser boundary: these checks do not prove
Chromium decoding, microphone sensitivity, meeting loopback routing, or live cloud
accuracy. Existing “full app” checks are component/static checks, not GUI end-to-end tests.

No live credentials were used. Existing UI-animation working-tree changes are excluded
from the audio/capture PR and remain local.

References: https://console.groq.com/docs/speech-to-text and
https://github.com/techiesms/ESP32-Groq-Speech-to-Text (the repository linked to the supplied tutorial).


## Screen button follow-up

The Screen button previously expanded the overlay before capture, always selected
primary-display content, and sent a coding prompt even for general screen content.
It now captures the display containing Halo while the overlay is briefly hidden,
restores without taking focus, accounts for display scaling, and sends lossless PNG.
Duplicate captures are blocked; failure and edits during capture preserve user input.
The dedicated coding hotkey still uses the coding prompt.

Validation: 73 automated checks passed. A real Electron 33 run on macOS returned
non-empty display images with the overlay hidden, attached both image and typed note
to one local stub AI request, and restored the window with Idle status. No cloud
vision call was made. The renderer emitted the existing development CSP warning.
Multi-monitor selection and failure restoration also have controlled automated tests.
The 120ms compositor wait is a heuristic; pixel-level exclusion across all macOS
versions and display setups still needs broader hardware validation.

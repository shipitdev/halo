/**
 * Halo — Meeting Detector
 * Polls for running meeting applications on macOS.
 * Emits events when meetings start or end.
 */

const { exec } = require('child_process');
const EventEmitter = require('events');

// Process names / window title patterns for each meeting platform
const MEETING_APPS = [
  { id: 'zoom', name: 'Zoom', processNames: ['zoom.us', 'zoom'], windowTitle: /zoom/i },
  { id: 'teams', name: 'Microsoft Teams', processNames: ['Teams', 'MSTeams'], windowTitle: /teams/i },
  { id: 'meet', name: 'Google Meet', processNames: [], windowTitle: /meet\.google\.com|meet\s*-/i },
  { id: 'webex', name: 'Webex', processNames: ['Webex', 'CiscoWebex', 'webexmeetings'], windowTitle: /webex/i },
  { id: 'chime', name: 'Amazon Chime', processNames: ['Amazon Chime'], windowTitle: /chime/i },
  { id: 'slack', name: 'Slack Huddle', processNames: ['Slack'], windowTitle: /slack.*huddle/i },
];

const POLL_INTERVAL_MS = 5000; // 5 seconds
const END_DEBOUNCE_COUNT = 2; // Require N consecutive empty polls before ending

class MeetingDetector extends EventEmitter {
  constructor() {
    super();
    this._activeMeeting = null; // { id, name, startedAt }
    this._pollTimer = null;
    this._isPolling = false;
    this._emptyPollCount = 0; // Debounce counter for meeting-ended
  }

  /**
   * Start polling for meetings.
   */
  start() {
    if (this._pollTimer) return;
    this._isPolling = true;
    this._poll(); // immediate first check
    this._pollTimer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }

  /**
   * Stop polling.
   */
  stop() {
    this._isPolling = false;
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /**
   * Get the currently active meeting, if any.
   * @returns {{ id: string, name: string, startedAt: string } | null}
   */
  getActiveMeeting() {
    return this._activeMeeting;
  }

  /**
   * Check if any meeting is currently active.
   * @returns {boolean}
   */
  isInMeeting() {
    return this._activeMeeting !== null;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  async _poll() {
    if (!this._isPolling) return;

    try {
      const runningProcesses = await this._getRunningProcesses();
      const detectedApp = this._matchMeetingApp(runningProcesses);

      if (detectedApp && !this._activeMeeting) {
        // Meeting just started
        this._emptyPollCount = 0;
        this._activeMeeting = {
          id: detectedApp.id,
          name: detectedApp.name,
          startedAt: new Date().toISOString(),
        };
        this.emit('meeting-started', this._activeMeeting);
      } else if (detectedApp && this._activeMeeting) {
        // Meeting still active — reset debounce
        this._emptyPollCount = 0;
      } else if (!detectedApp && this._activeMeeting) {
        // Meeting may have ended — debounce
        this._emptyPollCount++;
        if (this._emptyPollCount >= END_DEBOUNCE_COUNT) {
          const ended = { ...this._activeMeeting };
          this._activeMeeting = null;
          this._emptyPollCount = 0;
          this.emit('meeting-ended', ended);
        }
      }
    } catch (err) {
      // Silently ignore poll errors (process might have exited)
    }
  }

  _getRunningProcesses() {
    return new Promise((resolve, reject) => {
      // Use 'ps' to list all running processes
      exec('ps -eo comm= 2>/dev/null', (err, stdout) => {
        if (err) {
          resolve('');
          return;
        }
        resolve(stdout || '');
      });
    });
  }

  _matchMeetingApp(processOutput) {
    const lines = processOutput.toLowerCase();

    for (const app of MEETING_APPS) {
      // Check process names using word-boundary matching
      for (const procName of app.processNames) {
        const escaped = procName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match as a standalone token: preceded by start/slash/space, followed by end/space/newline
        const pattern = new RegExp(`(?:^|[/\\\\\\s])${escaped}(?:[\\s\n]|$)`, 'm');
        if (pattern.test(lines)) {
          return app;
        }
      }
    }

    return null;
  }

  /**
   * Enhanced detection using desktopCapturer window titles.
   * Call this with the list of window sources from Electron.
   * @param {Array<{name: string}>} windowSources
   * @returns {{ id: string, name: string } | null}
   */
  matchWindowTitles(windowSources) {
    if (!windowSources || windowSources.length === 0) return null;

    for (const source of windowSources) {
      const title = source.name || '';
      for (const app of MEETING_APPS) {
        if (app.windowTitle.test(title)) {
          return app;
        }
      }
    }

    return null;
  }
}

module.exports = { MeetingDetector, MEETING_APPS, END_DEBOUNCE_COUNT };

/* Each utterance gets a complete container, including its header and final data event. */
;(function (root) {
  class VoiceRecorder {
    constructor(stream, { onAudio, onError, Recorder = MediaRecorder, now = Date.now }) {
      this.stream = stream;
      this.onAudio = onAudio;
      this.onError = onError;
      this.Recorder = Recorder;
      this.now = now;
      this.stopped = false;
      this.queue = Promise.resolve();
      this.start();
    }

    start() {
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => this.Recorder.isTypeSupported(type));
      this.recorder = new this.Recorder(this.stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];
      this.speaking = false;
      this.silenceAt = null;
      this.startedAt = this.now();
      this.rotating = false;
      this.recorder.ondataavailable = ({ data }) => {
        if (data?.size) this.chunks.push(data);
      };
      this.recorder.onerror = ({ error }) => this.onError(error);
      this.recorder.onstop = () => {
        if (this.speaking && this.chunks.length) {
          const type = this.recorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type });
          const format = type.includes('mp4') ? 'mp4' : 'webm';
          this.queue = this.queue.then(() => this.onAudio(blob, format)).catch(this.onError);
        }
        if (!this.stopped) this.start();
      };
      this.recorder.start();
    }

    sample(rms) {
      if (this.stopped || this.rotating) return;
      const now = this.now();
      if (rms > 0.01) {
        this.speaking = true;
        this.silenceAt = null;
      } else if (this.silenceAt === null) {
        this.silenceAt = now;
      }
      if ((this.silenceAt !== null && now - this.silenceAt >= 1200) || now - this.startedAt >= 20000) {
        this.rotating = true;
        this.recorder.stop();
      }
    }

    stop() {
      this.stopped = true;
      if (this.recorder.state !== 'inactive') this.recorder.stop();
    }
  }
  if (typeof module !== 'undefined') module.exports = { VoiceRecorder };
  else root.VoiceRecorder = VoiceRecorder;
})(globalThis);

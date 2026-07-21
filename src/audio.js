/**
 * Halo — Audio Processing Utilities
 * PCM downsampling, WAV encoding, and chunk buffering.
 */

/**
 * Downsample Float32 PCM audio to a target sample rate (mono).
 * @param {Float32Array} audioData - Source PCM samples
 * @param {number} sourceSampleRate - Source sample rate (e.g., 44100)
 * @param {number} targetSampleRate - Target sample rate (e.g., 16000)
 * @returns {Float32Array} Downsampled audio
 */
function downsamplePCM(audioData, sourceSampleRate, targetSampleRate) {
  if (targetSampleRate >= sourceSampleRate) return audioData;

  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.floor(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    result[i] = audioData[srcIndex];
  }

  return result;
}

/**
 * Convert Float32 PCM samples to 16-bit PCM.
 * @param {Float32Array} float32Array
 * @returns {Int16Array}
 */
function float32ToInt16(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return int16;
}

/**
 * Encode PCM data into a WAV file buffer.
 * @param {Int16Array} pcmData - 16-bit PCM samples
 * @param {number} sampleRate - Sample rate
 * @param {number} numChannels - Number of channels (default 1 = mono)
 * @returns {Buffer} WAV file buffer
 */
function encodeWAV(pcmData, sampleRate, numChannels = 1) {
  const bytesPerSample = 2; // 16-bit
  const dataSize = pcmData.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);              // Chunk size
  buffer.writeUInt16LE(1, 20);               // PCM format
  buffer.writeUInt16LE(numChannels, 22);      // Channels
  buffer.writeUInt32LE(sampleRate, 24);       // Sample rate
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // Byte rate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // Block align
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // Bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write PCM samples
  const pcmBytes = Buffer.from(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  pcmBytes.copy(buffer, 44);

  return buffer;
}

/**
 * Audio chunk buffer — collects PCM chunks and flushes at intervals.
 */
class AudioChunkBuffer {
  /**
   * @param {Object} options
   * @param {number} options.flushIntervalMs - Flush interval in ms (default 5000)
   * @param {function(Buffer): void} options.onFlush - Callback when buffer flushes
   * @param {number} options.sampleRate - Target sample rate (default 16000)
   */
  constructor({ flushIntervalMs = 5000, onFlush, sampleRate = 16000 } = {}) {
    this.chunks = [];
    this.flushIntervalMs = flushIntervalMs;
    this.onFlush = onFlush;
    this.sampleRate = sampleRate;
    this.intervalId = null;
  }

  /** Add a Float32Array chunk of audio data. */
  push(float32Chunk) {
    this.chunks.push(float32Chunk);
  }

  /** Start the periodic flush timer. */
  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  /** Stop the periodic flush timer. */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Flush current chunks as a WAV buffer. */
  flush() {
    if (this.chunks.length === 0) return;

    // Concatenate all chunks
    const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];

    // Convert to WAV
    const int16 = float32ToInt16(merged);
    const wavBuffer = encodeWAV(int16, this.sampleRate);

    if (this.onFlush) {
      this.onFlush(wavBuffer);
    }
  }

  /** Stop and flush any remaining audio. */
  dispose() {
    this.stop();
    this.flush();
  }
}

module.exports = {
  downsamplePCM,
  float32ToInt16,
  encodeWAV,
  AudioChunkBuffer,
};

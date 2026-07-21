/**
 * Halo — Base Provider
 * Abstract interface all AI providers must implement.
 */

class BaseProvider {
  constructor(apiKey, options = {}) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly.');
    }
    this.apiKey = apiKey;
    this.options = options;
  }

  /** Provider display name. */
  get name() {
    throw new Error('Subclass must implement "name" getter.');
  }

  /** List of supported model IDs. */
  get models() {
    throw new Error('Subclass must implement "models" getter.');
  }

  /**
   * Stream a chat completion.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options - { model, maxTokens, temperature }
   * @returns {AsyncGenerator<string>} Yields text chunks.
   */
  async *chat(messages, options = {}) {
    throw new Error('Subclass must implement "chat" method.');
  }

  /**
   * Transcribe audio to text.
   * @param {Buffer} audioBuffer - Audio data
   * @param {string} format - Audio format (e.g., 'webm', 'wav')
   * @returns {Promise<string>} Transcription text
   */
  async transcribe(audioBuffer, format = 'webm') {
    throw new Error(`${this.name} does not support transcription.`);
  }

  /**
   * Whether this provider supports audio transcription.
   * @returns {boolean}
   */
  supportsTranscription() {
    return false;
  }
}

module.exports = { BaseProvider };

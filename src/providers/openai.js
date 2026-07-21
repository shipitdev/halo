/**
 * Halo — OpenAI Provider
 * GPT-4o / GPT-4o-mini for chat, Whisper for speech-to-text.
 */

const { BaseProvider } = require('./base');

class OpenAIProvider extends BaseProvider {
  get name() {
    return 'OpenAI';
  }

  get models() {
    return {
      smart: 'gpt-4o',
      fast: 'gpt-4o-mini',
    };
  }

  /**
   * Stream chat completion via OpenAI API.
   */
  async *chat(messages, options = {}) {
    const model = options.model || this.models.smart;
    const maxTokens = options.maxTokens || 4096;

    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: this.apiKey });

    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Transcribe audio using Whisper.
   */
  async transcribe(audioBuffer, format = 'webm') {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: this.apiKey });
    const { Readable } = require('stream');

    // Convert Buffer to a File-like object
    const file = new File([audioBuffer], `audio.${format}`, {
      type: `audio/${format}`,
    });

    const response = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    return response.text;
  }

  supportsTranscription() {
    return true;
  }
}

module.exports = { OpenAIProvider };

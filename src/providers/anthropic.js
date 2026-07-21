/**
 * Halo — Anthropic Provider
 * Claude Sonnet / Haiku for chat. No native STT.
 */

const { BaseProvider } = require('./base');

class AnthropicProvider extends BaseProvider {
  get name() {
    return 'Anthropic';
  }

  get models() {
    return {
      smart: 'claude-sonnet-4-20250514',
      fast: 'claude-haiku-3-20250317',
    };
  }

  /**
   * Stream chat via Anthropic Messages API.
   */
  async *chat(messages, options = {}) {
    const model = options.model || this.models.smart;
    const maxTokens = options.maxTokens || 4096;

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: this.apiKey });

    // Anthropic separates system from messages
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemMsg?.content || '',
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  supportsTranscription() {
    return false;
  }
}

module.exports = { AnthropicProvider };

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

    // Separate system from messages
    const systemParts = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .filter(Boolean);
    const systemPrompt = systemParts.join('\n\n');

    // Build Anthropic-compliant messages array
    const chatMessages = [];
    const nonSystem = messages.filter((m) => m.role !== 'system');

    for (const m of nonSystem) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      let content = m.content;

      // Handle image data if structured or data URL
      if (typeof content === 'string' && content.startsWith('data:image/')) {
        const match = content.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          content = [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: match[1],
                data: match[2],
              },
            },
          ];
        }
      } else if (Array.isArray(content)) {
        content = content.map((item) => {
          if (item.type === 'image_url' && item.image_url?.url) {
            const match = item.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: match[1],
                  data: match[2],
                },
              };
            }
          }
          return item;
        });
      }

      // Anthropic requires strict role alternation
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg && lastMsg.role === role) {
        if (typeof lastMsg.content === 'string' && typeof content === 'string') {
          lastMsg.content += '\n\n' + content;
        } else {
          const normLast = Array.isArray(lastMsg.content)
            ? lastMsg.content
            : [{ type: 'text', text: String(lastMsg.content) }];
          const normNew = Array.isArray(content)
            ? content
            : [{ type: 'text', text: String(content) }];
          lastMsg.content = [...normLast, ...normNew];
        }
      } else {
        chatMessages.push({ role, content });
      }
    }

    if (chatMessages.length === 0) {
      chatMessages.push({ role: 'user', content: 'Hello' });
    }

    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt || undefined,
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

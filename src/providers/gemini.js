/**
 * Halo — Gemini Provider
 * Gemini models for chat + native audio understanding.
 */

const { BaseProvider } = require('./base');

class GeminiProvider extends BaseProvider {
  get name() {
    return 'Google Gemini';
  }

  get models() {
    return {
      smart: 'gemini-3.6-flash',
      fast: 'gemini-3.5-flash',
    };
  }

  /**
   * Stream chat via Gemini API.
   */
  async *chat(messages, options = {}) {
    let model = options.model || this.models.smart;

    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    // Separate system instruction from messages
    const systemParts = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .filter(Boolean);
    const systemInstruction = systemParts.join('\n\n');

    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const role = m.role === 'assistant' ? 'model' : 'user';
        const parts = [];

        if (typeof m.content === 'string') {
          if (m.content.startsWith('data:image/')) {
            const match = m.content.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2],
                },
              });
            } else {
              parts.push({ text: m.content });
            }
          } else {
            parts.push({ text: m.content });
          }
        } else if (Array.isArray(m.content)) {
          for (const item of m.content) {
            if (item.type === 'text') {
              parts.push({ text: item.text });
            } else if (item.type === 'image_url' && item.image_url?.url) {
              const match = item.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inlineData: {
                    mimeType: match[1],
                    data: match[2],
                  },
                });
              }
            }
          }
        }

        return { role, parts };
      });

    const callApi = async (targetModel) => {
      return ai.models.generateContentStream({
        model: targetModel,
        contents: chatMessages,
        config: {
          systemInstruction: systemInstruction || undefined,
          maxOutputTokens: options.maxTokens || 4096,
        },
      });
    };

    let response;
    try {
      response = await callApi(model);
    } catch (err) {
      if (err.message && (err.message.includes('404') || err.message.includes('429'))) {
        console.warn(`Gemini model ${model} returned error. Retrying with fallback model gemini-3.6-flash...`);
        response = await callApi('gemini-3.6-flash');
      } else {
        throw err;
      }
    }

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        yield text;
      }
    }
  }

  /**
   * Transcribe audio using Gemini's native audio understanding.
   */
  async transcribe(audioBuffer, format = 'webm') {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const base64Audio = audioBuffer.toString('base64');
    const mimeType = format === 'wav' ? 'audio/wav' : `audio/${format}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: 'Transcribe this audio accurately. Return only the transcription text, no commentary or formatting.',
            },
          ],
        },
      ],
    });

    return response.text || '';
  }

  supportsTranscription() {
    return true;
  }
}

module.exports = { GeminiProvider };

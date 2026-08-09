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
      smart: 'gemini-2.0-flash',
      fast: 'gemini-2.0-flash-lite',
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
    // Valid Google Gemini API model names in order of fallback
    const fallbackModels = [model, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
    const uniqueFallbacks = [...new Set(fallbackModels)];

    let lastError = null;
    for (const targetModel of uniqueFallbacks) {
      try {
        response = await callApi(targetModel);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const errStr = (err.message || '').toLowerCase();
        if (errStr.includes('429') || errStr.includes('resource_exhausted') || errStr.includes('quota')) {
          console.warn(`Gemini rate limited (429) on model ${targetModel}. Trying next fallback model...`);
          await new Promise((res) => setTimeout(res, 1500));
        } else if (errStr.includes('404') || errStr.includes('not found')) {
          console.warn(`Gemini model ${targetModel} not found (404). Trying next fallback model...`);
        } else {
          throw err;
        }
      }
    }

    if (lastError && !response) {
      if ((lastError.message || '').includes('429') || (lastError.message || '').includes('RESOURCE_EXHAUSTED')) {
        throw new Error('Gemini API Rate Limit (429) reached. Please wait a few seconds before trying again.');
      }
      throw lastError;
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

    const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    let lastErr;
    for (const m of models) {
      try {
        const response = await ai.models.generateContent({
          model: m,
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
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr?.message?.includes('429') || lastErr?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Gemini API rate limit reached (429). Please wait a moment or configure an OpenAI API key.');
    }
    throw lastErr || new Error('Gemini audio transcription failed.');
  }

  supportsTranscription() {
    return true;
  }
}

module.exports = { GeminiProvider };

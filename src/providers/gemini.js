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
    const model = options.model || this.models.smart;

    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    // Separate system instruction from messages
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const response = await ai.models.generateContentStream({
      model,
      contents: chatMessages,
      config: {
        systemInstruction: systemMsg ? systemMsg.content : undefined,
        maxOutputTokens: options.maxTokens || 4096,
      },
    });

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
      model: 'gemini-2.0-flash',
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

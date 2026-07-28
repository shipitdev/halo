/**
 * Halo Server — AI Proxy Routes
 * POST /chat (streaming), POST /transcribe
 * Uses server-side API keys — keeps user keys private.
 */

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Lazy-load AI SDKs
let OpenAI, Anthropic, GoogleGenAI;

function getOpenAI() {
  if (!OpenAI) OpenAI = require('openai');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getAnthropic() {
  if (!Anthropic) Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getGemini() {
  if (!GoogleGenAI) {
    const { GoogleGenAI: GenAI } = require('@google/genai');
    GoogleGenAI = GenAI;
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/**
 * POST /api/ai/chat
 * Proxied streaming chat completion.
 */
router.post('/chat', requireAuth, async (req, res) => {
  const { messages, provider = 'openai', model, maxTokens = 4096 } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let tokensUsed = 0;

  try {
    if (provider === 'openai') {
      const client = getOpenAI();
      const stream = await client.chat.completions.create({
        model: model || 'gpt-4o',
        messages,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          tokensUsed += content.length; // Rough estimate
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } else if (provider === 'anthropic') {
      const client = getAnthropic();
      const systemMsg = messages.find((m) => m.role === 'system');
      const chatMessages = messages.filter((m) => m.role !== 'system');

      const stream = client.messages.stream({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemMsg?.content || '',
        messages: chatMessages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const content = event.delta.text;
          tokensUsed += content.length;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } else if (provider === 'gemini') {
      const ai = getGemini();
      const systemMsg = messages.find((m) => m.role === 'system');
      const chatMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const response = await ai.models.generateContentStream({
        model: model || 'gemini-3.6-flash',
        contents: chatMessages,
        config: {
          systemInstruction: systemMsg ? systemMsg.content : undefined,
          maxOutputTokens: maxTokens,
        },
      });

      for await (const chunk of response) {
        const content = chunk.text;
        if (content) {
          tokensUsed += content.length;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } else {
      res.write(`data: ${JSON.stringify({ error: `Unknown provider: ${provider}` })}\n\n`);
    }

    // Log usage
    try {
      await query(
        'INSERT INTO usage (user_id, provider, model, tokens_used, action) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, provider, model || 'default', tokensUsed, 'chat']
      );
    } catch (usageErr) {
      console.warn('Usage tracking failed:', usageErr.message);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('AI chat proxy error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/ai/transcribe
 * Proxied audio transcription.
 */
router.post('/transcribe', requireAuth, async (req, res) => {
  const { audio, format = 'webm', provider = 'openai' } = req.body;

  if (!audio) {
    return res.status(400).json({ error: 'Audio data is required (base64).' });
  }

  try {
    const audioBuffer = Buffer.from(audio, 'base64');
    let transcript = '';

    if (provider === 'openai') {
      const client = getOpenAI();
      const { toFile } = require('openai');
      const file = await toFile(audioBuffer, `audio.${format}`, {
        type: `audio/${format}`,
      });

      const response = await client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      });
      transcript = response.text;
    } else if (provider === 'gemini') {
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: `audio/${format}`,
                  data: audio,
                },
              },
              {
                text: 'Transcribe this audio accurately. Return only the transcription text.',
              },
            ],
          },
        ],
      });
      transcript = response.text || '';
    } else {
      return res.status(400).json({ error: `Provider "${provider}" does not support transcription.` });
    }

    // Log usage
    try {
      await query(
        'INSERT INTO usage (user_id, provider, model, tokens_used, action) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, provider, 'stt', transcript.length, 'transcribe']
      );
    } catch (usageErr) {
      console.warn('Usage tracking failed:', usageErr.message);
    }

    res.json({ transcript });
  } catch (err) {
    console.error('Transcription proxy error:', err);
    res.status(500).json({ error: 'Transcription failed.' });
  }
});

module.exports = router;

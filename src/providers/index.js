/**
 * Halo — Provider Factory
 * Creates and manages AI provider instances.
 */

const { OpenAIProvider } = require('./openai');
const { AnthropicProvider } = require('./anthropic');
const { GeminiProvider } = require('./gemini');

const PROVIDERS = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  gemini: GeminiProvider,
};

/**
 * Create a provider instance by name.
 * @param {string} name - Provider key: 'openai' | 'anthropic' | 'gemini'
 * @param {string} apiKey
 * @param {Object} options
 * @returns {BaseProvider}
 */
function createProvider(name, apiKey, options = {}) {
  const Provider = PROVIDERS[name];
  if (!Provider) {
    throw new Error(`Unknown provider: "${name}". Available: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  return new Provider(apiKey, options);
}

/**
 * Find the best transcription provider from a list.
 * Prefers OpenAI (Whisper) > Gemini > others.
 * @param {Object} providerConfigs - { openai: { apiKey }, gemini: { apiKey }, ... }
 * @returns {BaseProvider|null}
 */
function getTranscriptionProvider(providerConfigs) {
  // Priority order for STT
  const sttPriority = ['openai', 'gemini'];

  for (const name of sttPriority) {
    const cfg = providerConfigs[name];
    if (cfg?.apiKey) {
      const provider = createProvider(name, cfg.apiKey);
      if (provider.supportsTranscription()) {
        return provider;
      }
    }
  }

  return null;
}

/**
 * Get model ID for a provider.
 * @param {string} providerName
 * @param {boolean} smart - true for large model, false for fast model
 * @returns {string}
 */
function getModel(providerName, smart = true) {
  const models = {
    openai: { smart: 'gpt-4o', fast: 'gpt-4o-mini' },
    anthropic: { smart: 'claude-sonnet-4-20250514', fast: 'claude-haiku-3-20250317' },
    gemini: { smart: 'gemini-2.0-flash', fast: 'gemini-2.0-flash-lite' },
  };

  return models[providerName]?.[smart ? 'smart' : 'fast'] || 'gpt-4o';
}

/**
 * List available providers.
 * @returns {Array<{id: string, name: string, supportsSTT: boolean}>}
 */
function listProviders() {
  return Object.entries(PROVIDERS).map(([id, Provider]) => {
    const instance = new Provider('');
    return {
      id,
      name: instance.name,
      supportsSTT: instance.supportsTranscription(),
    };
  });
}

module.exports = {
  createProvider,
  getTranscriptionProvider,
  getModel,
  listProviders,
  PROVIDERS,
};

/**
 * ─── Providers ────────────────────────────────────────────────────────────────
 * Single source of truth for every API provider used in the app.
 * Add a new entry here whenever you onboard a new provider.
 */
export const PROVIDERS = {
  nim: {
    apiBase: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_NIM_API_KEY',
  },
  groq: {
    apiBase: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
  },
  openrouter: {
    apiBase: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
} as const;

/**
 * ─── Models ───────────────────────────────────────────────────────────────────
 * Each entry spreads its provider so every config is self-contained:
 *   { model, apiBase, apiKeyEnv }
 *
 * Spreading prevents accidentally routing a model to the wrong provider
 * (e.g. an OpenRouter ID sent to Groq). To switch a model to a different
 * provider just change the spread reference — the base URL and key follow.
 *
 * OpenRouter model IDs must end in `:free` when using a free-tier key.
 */
export const MODELS = {
  /** OCR-optimized vision — transcribes handwritten math from whiteboard canvas */
  vision: {
    ...PROVIDERS.nim,
    model: 'nvidia/nemotron-ocr-v2',
  },

  /** Fast Socratic feedback from canvas description */
  reasoning: {
    ...PROVIDERS.groq,
    model: 'llama-3.3-70b-versatile',
  },

  /** Deep multi-step reasoning / manual deep-check */
  reasoningDeep: {
    ...PROVIDERS.nim,
    model: 'meta/llama-3.3-70b-instruct',
  },
} as const;

/**
 * ─── Helper ───────────────────────────────────────────────────────────────────
 * Returns the bearer token for a model config at runtime.
 * Throws immediately if the env var is missing rather than sending an
 * unauthenticated request that fails with a cryptic 401.
 */
export function apiKey(m: { apiKeyEnv: string }): string {
  const key = process.env[m.apiKeyEnv];
  if (!key) throw new Error(`Missing env var: ${m.apiKeyEnv}`);
  return key;
}

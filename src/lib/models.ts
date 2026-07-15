export const MODELS = {
  // Step 1: describes canvas image (multimodal, OpenRouter free)
  vision: 'google/gemma-4-31b-it:free',
  // Step 2: writes Socratic feedback from vision description (Groq, ~500 tok/s)
  reasoning: 'openai/gpt-oss-120b',
  // Manual fallback: deeper multi-step reasoning (NVIDIA NIM, strip <think> trace)
  reasoningDeep: 'deepseek-ai/deepseek-r1',
} as const;

export const API_BASES = {
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  nim: 'https://integrate.api.nvidia.com/v1',
} as const;

export const MODELS = {
  // Step 1: describes canvas image (multimodal, NVIDIA NIM)
  vision: 'meta/llama-3.2-11b-vision-instruct',
  // Step 2: writes Socratic feedback from vision description (Groq, ~500 tok/s)
  reasoning: 'llama-3.3-70b-versatile',
  // Manual fallback: deeper multi-step reasoning (NVIDIA NIM)
  reasoningDeep: 'meta/llama-3.3-70b-instruct',
} as const;

export const API_BASES = {
  groq: 'https://api.groq.com/openai/v1',
  nim: 'https://integrate.api.nvidia.com/v1',
} as const;

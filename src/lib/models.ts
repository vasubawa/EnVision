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
} as const

export const MODELS = {
  vision: {
    ...PROVIDERS.nim,
    model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  },

  visionDeep: {
    ...PROVIDERS.nim,
    model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  },

  reasoning: {
    ...PROVIDERS.groq,
    model: 'openai/gpt-oss-120b',
  },

  reasoningDeep: {
    ...PROVIDERS.nim,
    model: 'nvidia/nemotron-3-super-120b-a12b',
  },
} as const

export interface ChatCompletionResponse {
  choices: { message: { content: string } }[]
}

export function apiKey(m: { apiKeyEnv: string }): string {
  const key = process.env[m.apiKeyEnv]
  if (!key) throw new Error(`Missing env var: ${m.apiKeyEnv}`)
  return key
}

export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

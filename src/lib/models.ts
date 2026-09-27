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
  choices: { message: { content: string; reasoning?: string | null } }[]
}

export function apiKey(m: { apiKeyEnv: string }): string {
  const key = process.env[m.apiKeyEnv]
  if (!key) throw new Error(`Missing env var: ${m.apiKeyEnv}`)
  return key
}

export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

export class UpstreamAIError extends Error {
  public status: number
  public upstreamStatus: number
  public userMessage: string
  public details?: string

  constructor(status: number, userMessage: string, details?: string, upstreamStatus?: number) {
    super(userMessage)
    this.name = 'UpstreamAIError'
    this.status = status
    this.upstreamStatus = upstreamStatus ?? status
    this.userMessage = userMessage
    this.details = details
  }
}

export async function parseUpstreamError(
  res: Response,
  serviceLabel: string,
): Promise<UpstreamAIError> {
  let rawText = ''
  try {
    rawText = await res.text()
  } catch {
    // ignore
  }

  let rawMessage = rawText
  try {
    const json = JSON.parse(rawText)
    if (json?.error?.message) {
      rawMessage =
        typeof json.error.message === 'string'
          ? json.error.message
          : JSON.stringify(json.error.message)
    } else if (json?.message) {
      rawMessage = typeof json.message === 'string' ? json.message : JSON.stringify(json.message)
    }
  } catch {
    // not JSON
  }

  const lower = rawMessage.toLowerCase()

  // Concurrency saturation / worker exhausted (e.g. NVIDIA NIM 16/16 limit)
  if (
    res.status === 503 ||
    rawMessage.includes('Worker local total request limit reached') ||
    rawMessage.includes('ResourceExhausted') ||
    lower.includes('capacity') ||
    lower.includes('overloaded')
  ) {
    return new UpstreamAIError(
      503,
      `The ${serviceLabel} is temporarily at peak capacity. Please wait a few seconds and try again.`,
      rawMessage,
    )
  }

  // Rate limit / 429
  if (res.status === 429 || lower.includes('rate limit') || lower.includes('quota')) {
    return new UpstreamAIError(
      429,
      `Rate limit reached for ${serviceLabel}. Please wait a moment before trying again.`,
      rawMessage,
    )
  }

  // Gateway errors / timeouts
  if (
    res.status === 502 ||
    res.status === 504 ||
    lower.includes('gateway') ||
    lower.includes('timeout')
  ) {
    return new UpstreamAIError(
      504,
      `The ${serviceLabel} took too long to respond. Please try again.`,
      rawMessage,
    )
  }

  // Auth / configuration errors
  if (res.status === 401 || res.status === 403) {
    return new UpstreamAIError(
      500,
      `Authentication error connecting to ${serviceLabel}. Please verify API keys.`,
      rawMessage,
      res.status,
    )
  }

  return new UpstreamAIError(
    res.status >= 400 && res.status < 600 ? res.status : 500,
    `The ${serviceLabel} returned ${res.status}. Please try again.`,
    rawMessage,
  )
}

export async function fetchAIWithRetry(
  url: string,
  options: RequestInit,
  serviceLabel: string,
  maxRetries = 2,
  baseDelayMs = 1000,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (options.signal?.aborted) {
      throw options.signal.reason || new Error('Request aborted')
    }

    try {
      const res = await fetch(url, options)
      if (res.ok) {
        return res
      }

      const isRetryable =
        res.status === 503 || res.status === 429 || res.status === 502 || res.status === 504

      if (isRetryable && attempt < maxRetries && !options.signal?.aborted) {
        const delay = baseDelayMs * Math.pow(1.5, attempt) + Math.random() * 300
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      throw await parseUpstreamError(res, serviceLabel)
    } catch (err: unknown) {
      if (err instanceof UpstreamAIError) {
        throw err
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw err
      }
      if (attempt < maxRetries && !options.signal?.aborted) {
        const delay = baseDelayMs * Math.pow(1.5, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw err
    }
  }

  throw new UpstreamAIError(500, `Failed to reach ${serviceLabel}.`)
}

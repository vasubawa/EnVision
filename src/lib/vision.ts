import {
  MODELS,
  apiKey,
  stripThinking,
  fetchAIWithRetry,
  UpstreamAIError,
  type ChatCompletionResponse,
} from '@/lib/models'
import { VISION_TRANSCRIBE_PROMPT, extractTranscription } from '@/lib/prompts'

const GOOGLE_VISION = {
  apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai',
  model: 'gemma-4-31b-it',
}

function googleKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null
}

async function readOnce(
  apiBase: string,
  model: string,
  key: string,
  image: string,
  signal: AbortSignal | undefined,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const response = await fetchAIWithRetry(
    `${apiBase}/chat/completions`,
    {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        temperature: 0.2,
        ...extra,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_TRANSCRIBE_PROMPT },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
      }),
    },
    'vision service',
    0,
    400,
  )
  const body = (await response.json()) as ChatCompletionResponse
  return extractTranscription(body.choices[0].message.content, stripThinking)
}

function limit(ms: number): { signal: AbortSignal; clear: () => void; abort: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
    abort: () => controller.abort(),
  }
}

function upstreamStatus(error: unknown): number | null {
  if (!(error instanceof UpstreamAIError)) return null
  return error.upstreamStatus
}

/** NVIDIA first, then Gemma, sharing one time budget. */
export async function transcribeImage(
  image: string,
  budgetMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const started = Date.now()
  const deadline = started + budgetMs
  const remaining = () => deadline - Date.now()
  const nvidiaMs = Math.min(45_000, remaining())
  if (nvidiaMs < 1_000) {
    throw new UpstreamAIError(504, 'The vision service took too long to respond. Please try again.')
  }
  const nvidia = limit(nvidiaMs)
  const onParentAbort = () => nvidia.abort()
  signal?.addEventListener('abort', onParentAbort)
  try {
    const text = await readOnce(
      MODELS.vision.apiBase,
      MODELS.vision.model,
      apiKey(MODELS.vision),
      image,
      nvidia.signal,
      { chat_template_kwargs: { enable_thinking: false } },
    )
    // eslint-disable-next-line no-console
    console.info('[vision] nvidia ok', { ms: Date.now() - started, chars: text.length })
    return text
  } catch (error) {
    const status = upstreamStatus(error)
    const aborted = error instanceof Error && error.name === 'AbortError'
    const detail =
      error instanceof UpstreamAIError ? (error.details ?? error.message).slice(0, 240) : ''
    // eslint-disable-next-line no-console
    console.warn('[vision] nvidia failed', { ms: Date.now() - started, status, aborted, detail })
    const backup = googleKey()
    const auth = status === 401 || status === 403
    if (!backup || auth || signal?.aborted || remaining() < 1_000) throw error
    // eslint-disable-next-line no-console
    console.info('[vision] trying gemma')
    const gemma = limit(remaining())
    const readGemma = () =>
      readOnce(GOOGLE_VISION.apiBase, GOOGLE_VISION.model, backup, image, gemma.signal, {
        chat_template_kwargs: { enable_thinking: false },
      })
    try {
      let text
      try {
        text = await readGemma()
      } catch (first) {
        const gemmaStatus = upstreamStatus(first)
        if (gemmaStatus !== 500 || gemma.signal.aborted || remaining() < 1_000) throw first
        // eslint-disable-next-line no-console
        console.warn('[vision] gemma 500, retrying once')
        text = await readGemma()
      }
      // eslint-disable-next-line no-console
      console.info('[vision] gemma ok', { ms: Date.now() - started, chars: text.length })
      return text
    } catch (backupError) {
      // eslint-disable-next-line no-console
      console.warn('[vision] gemma failed', {
        ms: Date.now() - started,
        aborted: backupError instanceof Error && backupError.name === 'AbortError',
        status: upstreamStatus(backupError),
        detail:
          backupError instanceof UpstreamAIError
            ? (backupError.details ?? backupError.message).slice(0, 240)
            : '',
      })
      throw backupError
    } finally {
      gemma.clear()
    }
  } finally {
    signal?.removeEventListener('abort', onParentAbort)
    nvidia.clear()
  }
}

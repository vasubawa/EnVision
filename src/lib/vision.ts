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
        max_tokens: 2500,
        temperature: 0.2,
        response_format: { type: 'json_object' },
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

/** NVIDIA first. Google Gemma reads the same image when NVIDIA is unavailable. */
export async function transcribeImage(image: string, signal?: AbortSignal): Promise<string> {
  try {
    return await readOnce(
      MODELS.vision.apiBase,
      MODELS.vision.model,
      apiKey(MODELS.vision),
      image,
      signal,
    )
  } catch (error) {
    const backup = googleKey()
    const busy = error instanceof UpstreamAIError && [429, 502, 503, 504].includes(error.status)
    if (!backup || !busy) throw error
    return readOnce(GOOGLE_VISION.apiBase, GOOGLE_VISION.model, backup, image, signal)
  }
}

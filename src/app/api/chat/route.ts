import { NextRequest } from 'next/server'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { MODELS, apiKey, stripThinking } from '@/lib/models'
import { VISION_TRANSCRIBE_PROMPT, extractTranscription } from '@/lib/prompts'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { messages, canvasBase64 }: { messages: UIMessage[]; canvasBase64?: string } =
      await req.json()

    let systemPrompt =
      "You are a helpful Socratic tutor. Guide the student using hints and questions. STRICTLY format ALL math, physics, and chemistry expressions using LaTeX enclosed in $ for inline and $$ for blocks. NEVER use plain-text math like 'int(x)' or 'x^2' without $...$. For example, use $\\\\int$ instead of int, $\\\\frac{1}{2}$ instead of 1/2, and $H_2O$ instead of H2O."

    // If a canvas image was sent, transcribe it first so the tutor can "see" it
    if (canvasBase64) {
      const visionAbort = new AbortController()
      let visionTimeout: NodeJS.Timeout | null = null
      try {
        visionTimeout = setTimeout(() => visionAbort.abort(), 45_000)
        const visionReq = await fetch(`${MODELS.vision.apiBase}/chat/completions`, {
          signal: visionAbort.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey(MODELS.vision)}`,
          },
          body: JSON.stringify({
            model: MODELS.vision.model,
            max_tokens: 2000,
            reasoning_budget: 4096,
            temperature: 0.6,
            top_p: 0.95,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: VISION_TRANSCRIBE_PROMPT,
                  },
                  {
                    type: 'image_url',
                    image_url: { url: canvasBase64 },
                  },
                ],
              },
            ],
          }),
        })

        if (visionReq.ok) {
          const visionRes = await visionReq.json()
          const transcription = extractTranscription(
            visionRes.choices[0].message.content,
            stripThinking,
          )
          systemPrompt += `\n\nThe student is currently looking at their whiteboard. Here is a transcription of what is on it right now:\n\n${transcription}`
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to transcribe canvas for chat.')
      } finally {
        if (visionTimeout) clearTimeout(visionTimeout)
      }
    }

    const groq = createGroq({
      apiKey: apiKey(MODELS.reasoning),
      baseURL: MODELS.reasoning.apiBase,
    })

    const result = streamText({
      model: groq(MODELS.reasoning.model),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    })

    return result.toUIMessageStreamResponse({
      messageMetadata: () => ({ createdAt: Date.now() }),
    })
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('chat error: An internal error occurred.')
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500 })
  }
}

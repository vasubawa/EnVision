import { NextRequest } from 'next/server'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { MODELS, apiKey, stripThinking, fetchAIWithRetry, UpstreamAIError } from '@/lib/models'
import { VISION_TRANSCRIBE_PROMPT, extractTranscription } from '@/lib/prompts'
import { rateLimit, isValidCanvasImage } from '@/lib/rateLimit'
import { requireWorkspaceOwner } from '@/lib/require-workspace-owner'

export const maxDuration = 60

const MAX_MESSAGES = 40
const MAX_MESSAGE_CHARS = 8_000

const uiMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(['system', 'user', 'assistant']),
    parts: z
      .array(
        z
          .object({
            type: z.string(),
            text: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough()

const recentFeedbackSchema = z.object({
  content: z.string(),
  isCorrect: z.boolean(),
})

const chatBodySchema = z.object({
  messages: z.array(uiMessageSchema).min(1).max(MAX_MESSAGES),
  canvasBase64: z.string().optional(),
  canvasChanged: z.boolean().optional().default(true),
  cachedTranscription: z.string().optional(),
  recentFeedback: z.array(recentFeedbackSchema).optional(),
  ocrText: z.string().optional(),
})

function getMessageText(message: UIMessage): string {
  if (message.parts) {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('')
  }
  return ''
}

export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(req, { limit: 15, windowMs: 60_000 })
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    })
  }

  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    const access = await requireWorkspaceOwner(workspaceId)
    if ('error' in access) return access.error

    const rawBody: unknown = await req.json()
    const parsed = chatBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Messages are required.' }), { status: 400 })
    }

    const { messages, canvasBase64, canvasChanged, cachedTranscription, recentFeedback, ocrText } =
      parsed.data as {
        messages: UIMessage[]
        canvasBase64?: string
        canvasChanged: boolean
        cachedTranscription?: string
        recentFeedback?: { content: string; isCorrect: boolean }[]
        ocrText?: string
      }

    for (const message of messages) {
      if (getMessageText(message).length > MAX_MESSAGE_CHARS) {
        return new Response(JSON.stringify({ error: 'Message too long.' }), { status: 400 })
      }
    }

    if (canvasBase64 && !isValidCanvasImage(canvasBase64)) {
      return new Response(JSON.stringify({ error: 'Invalid canvas image.' }), { status: 400 })
    }

    let systemPrompt =
      "You are a helpful Socratic tutor. Guide the student using hints and questions. You have access to their current whiteboard transcription and feedback previously given by your evaluator assistants. When the student asks about prior feedback, mistakes, or next steps, directly reference their whiteboard and the feedback they received. Keep replies SHORT: 2-4 sentences, or at most one short list of 3-4 items — never a multi-part outline covering several problems or steps at once. Ask ONE focused question at a time and wait for the student's answer before asking the next. STRICTLY format ALL math, physics, and chemistry expressions using LaTeX enclosed ONLY in $ for inline and $$ for blocks — NEVER use \\\\( \\\\) or \\\\[ \\\\] delimiters. Write each formula EXACTLY ONCE. When listing a few short items, format them as a markdown list using '- ' or '1. ' rather than separate plain lines."

    if (ocrText && ocrText.trim()) {
      systemPrompt += `\n\nProblem Statement (OCR):\n${ocrText.trim()}`
    }

    if (recentFeedback && recentFeedback.length > 0) {
      const feedbackBullets = recentFeedback
        .map(
          (fb) =>
            `- [Evaluation: ${fb.isCorrect ? 'On Track / Correct' : 'Needs Correction / Mistake'}]: "${fb.content}"`,
        )
        .join('\n')
      systemPrompt += `\n\nRecent whiteboard evaluations from your assistant checks:\n${feedbackBullets}\nDirectly connect your responses to these evaluations if the student asks for clarification or guidance on their mistakes.`
    }

    let activeTranscription = cachedTranscription?.trim() || null

    if (canvasBase64 && canvasChanged) {
      const visionAbort = new AbortController()
      let visionTimeout: NodeJS.Timeout | null = null
      try {
        visionTimeout = setTimeout(() => visionAbort.abort(), 20_000)
        const visionReq = await fetchAIWithRetry(
          `${MODELS.vision.apiBase}/chat/completions`,
          {
            signal: visionAbort.signal,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey(MODELS.vision)}`,
            },
            body: JSON.stringify({
              model: MODELS.vision.model,
              max_tokens: 2000,
              chat_template_kwargs: { enable_thinking: false },
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
          },
          'vision service',
          1,
          800,
        )

        const visionRes = await visionReq.json()
        const transcription = extractTranscription(
          visionRes.choices[0].message.content,
          stripThinking,
        )
        if (transcription) {
          activeTranscription = transcription
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
          'Canvas transcription skipped for chat (continuing text response):',
          e instanceof Error ? e.message : e,
        )
      } finally {
        if (visionTimeout) clearTimeout(visionTimeout)
      }
    }

    if (activeTranscription) {
      systemPrompt += `\n\nThe student is currently looking at their whiteboard. Here is a transcription of what is on it right now:\n\n${activeTranscription}`
    }

    const groq = createGroq({
      apiKey: apiKey(MODELS.reasoning),
      baseURL: MODELS.reasoning.apiBase,
    })

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'user') {
      const { error: insertError } = await access.supabase.from('messages').insert({
        workspace_id: access.workspaceId,
        role: 'user',
        kind: 'chat',
        content: getMessageText(lastMessage),
      })

      if (insertError) {
        // eslint-disable-next-line no-console
        console.error('Failed to save user message:', insertError)
      }
    }

    const result = streamText({
      model: groq(MODELS.reasoning.model),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      onFinish: async ({ text }) => {
        const { error: insertError } = await access.supabase.from('messages').insert({
          workspace_id: access.workspaceId,
          role: 'assistant',
          kind: 'chat',
          content: text,
        })

        if (insertError) {
          // eslint-disable-next-line no-console
          console.error('Failed to persist assistant message:', insertError)
        }
      },
    })

    return result.toUIMessageStreamResponse({
      messageMetadata: () => ({
        createdAt: Date.now(),
        canvasTranscription: activeTranscription || undefined,
      }),
    })
  } catch (error: unknown) {
    if (error instanceof UpstreamAIError) {
      return new Response(JSON.stringify({ error: error.userMessage }), { status: error.status })
    }
    // eslint-disable-next-line no-console
    console.error('chat error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500 },
    )
  }
}

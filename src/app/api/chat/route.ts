import { NextRequest } from 'next/server'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { MODELS, apiKey, UpstreamAIError } from '@/lib/models'
import { SUBJECT_GUIDANCE } from '@/lib/prompts'
import { transcribeImage } from '@/lib/vision'
import { algebraPromptNote } from '@/lib/mathCheck'
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
  content: z.string().max(MAX_MESSAGE_CHARS),
  isCorrect: z.boolean().nullable().optional(),
  judgement: z.enum(['correct', 'progress', 'mistake']).optional(),
})

const learningPreferencesSchema = z.object({
  oneStep: z.boolean().optional(),
  shortReplies: z.boolean().optional(),
  calm: z.boolean().optional(),
  largeText: z.boolean().optional(),
})

const chatBodySchema = z.object({
  messages: z.array(uiMessageSchema).min(1).max(MAX_MESSAGES),
  canvasBase64: z.string().optional(),
  canvasChanged: z.boolean().optional().default(true),
  cachedTranscription: z.string().max(MAX_MESSAGE_CHARS).optional(),
  recentFeedback: z.array(recentFeedbackSchema).max(8).optional(),
  learningPreferences: learningPreferencesSchema.optional(),
  ocrText: z.string().max(MAX_MESSAGE_CHARS).optional(),
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

    const {
      messages,
      canvasBase64,
      canvasChanged,
      cachedTranscription,
      recentFeedback,
      learningPreferences,
      ocrText,
    } = parsed.data as {
      messages: UIMessage[]
      canvasBase64?: string
      canvasChanged: boolean
      cachedTranscription?: string
      recentFeedback?: { content: string; isCorrect?: boolean | null; judgement?: string }[]
      learningPreferences?: {
        oneStep?: boolean
        shortReplies?: boolean
        calm?: boolean
        largeText?: boolean
      }
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
      "You are a helpful Socratic tutor. Guide the student using hints and questions. You have access to their current whiteboard transcription and feedback previously given by your evaluator assistants. When the student asks about prior feedback, mistakes, or next steps, directly reference their whiteboard and the feedback they received. Keep replies SHORT: 2-4 sentences, or at most one short list of 3-4 items — never a multi-part outline covering several problems or steps at once. Ask ONE focused question at a time and wait for the student's answer before asking the next. STRICTLY format ALL math, physics, and chemistry expressions using LaTeX enclosed ONLY in $ for inline and $$ for blocks — NEVER use \\\\( \\\\) or \\\\[ \\\\] delimiters. Write each formula EXACTLY ONCE. When listing a few short items, format them as a markdown list using '- ' or '1. ' rather than separate plain lines. " +
      SUBJECT_GUIDANCE

    if (ocrText && ocrText.trim()) {
      systemPrompt += `\n\nProblem Statement (OCR):\n${ocrText.trim()}`
    }

    if (recentFeedback && recentFeedback.length > 0) {
      const feedbackBullets = recentFeedback
        .map(
          (fb) =>
            `- [Evaluation: ${fb.judgement === 'progress' ? 'Still in progress' : fb.isCorrect ? 'On Track / Correct' : 'Needs Correction / Mistake'}]: "${fb.content}"`,
        )
        .join('\n')
      systemPrompt += `\n\nRecent whiteboard evaluations from your assistant checks:\n${feedbackBullets}\nDirectly connect your responses to these evaluations if the student asks for clarification or guidance on their mistakes.`
    }

    if (learningPreferences?.oneStep) {
      systemPrompt += `\n\nSTRICT PACING RULE (One step at a time enabled): Give ONLY the immediate single micro-step or ask ONE focused question. Never reveal subsequent steps or solve ahead.`
    }

    if (learningPreferences?.shortReplies) {
      systemPrompt += `\n\nSTRICT LENGTH RULE (Short explanations enabled): Keep your response extremely brief: 1-2 concise sentences maximum.`
    }

    let activeTranscription = cachedTranscription?.trim() || null

    if (canvasBase64 && canvasChanged) {
      try {
        const transcription = await transcribeImage(canvasBase64, 25_000)
        if (transcription) activeTranscription = transcription
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[chat] page read skipped', e instanceof Error ? e.message : e)
      }
    }

    if (activeTranscription) {
      systemPrompt += `\n\nThe student is currently looking at their whiteboard. Here is a transcription of what is on it right now:\n\n${activeTranscription}`
      systemPrompt += algebraPromptNote(activeTranscription)
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

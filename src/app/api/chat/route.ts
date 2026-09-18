import { NextRequest } from 'next/server'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { MODELS, apiKey, stripThinking } from '@/lib/models'
import { VISION_TRANSCRIBE_PROMPT, extractTranscription } from '@/lib/prompts'
import { rateLimit, isValidCanvasImage } from '@/lib/rateLimit'
import { requireWorkspaceOwner } from '@/lib/require-workspace-owner'

export const maxDuration = 60

const MAX_MESSAGES = 40
const MAX_MESSAGE_CHARS = 8_000

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

    const { messages, canvasBase64 }: { messages: UIMessage[]; canvasBase64?: string } =
      await req.json()

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages are required.' }), { status: 400 })
    }

    if (messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: `Too many messages (max ${MAX_MESSAGES}).` }), {
        status: 400,
      })
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
      "You are a helpful Socratic tutor. Guide the student using hints and questions. Keep replies SHORT: 2-4 sentences, or at most one short list of 3-4 items — never a multi-part outline covering several problems or steps at once. Ask ONE focused question at a time and wait for the student's answer before asking the next. STRICTLY format ALL math, physics, and chemistry expressions using LaTeX enclosed ONLY in $ for inline and $$ for blocks — NEVER use \\\\( \\\\) or \\\\[ \\\\] delimiters. Write each formula EXACTLY ONCE: never restate, re-derive, or 'spell out' a formula a second time in different notation, and never break a formula or sentence into one word per line. NEVER use plain-text math like 'int(x)' or 'x^2' without $...$. For example, use $\\\\int$ instead of int, $\\\\frac{1}{2}$ instead of 1/2, and $H_2O$ instead of H2O. When listing a few short items, format them as a markdown list using '- ' or '1. ' rather than separate plain lines — this renders as a proper bulleted/numbered list."

    // If a canvas image was sent, transcribe it first so the tutor can "see" it
    if (canvasBase64) {
      const visionAbort = new AbortController()
      let visionTimeout: NodeJS.Timeout | null = null
      try {
        visionTimeout = setTimeout(() => visionAbort.abort(), 20_000)
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
            chat_template_kwargs: { enable_thinking: true, reasoning_budget: 1024 },
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
        console.error('Failed to transcribe canvas for chat.', e)
      } finally {
        if (visionTimeout) clearTimeout(visionTimeout)
      }
    }

    const groq = createGroq({
      apiKey: apiKey(MODELS.reasoning),
      baseURL: MODELS.reasoning.apiBase,
    })

    // Optimistically save the user message
    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'user') {
      const { error: insertError } = await access.supabase.from('messages').insert({
        id: lastMessage.id,
        workspace_id: access.workspaceId,
        role: 'user',
        kind: 'chat',
        content: getMessageText(lastMessage),
      })

      if (insertError) {
        // eslint-disable-next-line no-console
        console.error('Failed to save user message:', insertError)
        return new Response(JSON.stringify({ error: 'Failed to save message' }), { status: 500 })
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
      messageMetadata: () => ({ createdAt: Date.now() }),
    })
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('chat error: An internal error occurred.', error)
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500 })
  }
}

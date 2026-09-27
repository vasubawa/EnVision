import { NextResponse, NextRequest } from 'next/server'
import {
  MODELS,
  apiKey,
  fetchAIWithRetry,
  UpstreamAIError,
  type ChatCompletionResponse,
} from '@/lib/models'
import { replyStep } from '@/lib/boardStep'
import { transcribeImage } from '@/lib/vision'
import { rateLimit, isValidCanvasImage } from '@/lib/rateLimit'
import { requireWorkspaceOwner } from '@/lib/require-workspace-owner'

export const maxDuration = 90

export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(req, { limit: 8, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  let stage = 'reading the page'
  const started = Date.now()

  try {
    const body = await req.json()
    const canvasBase64 = body?.canvasBase64
    const workspaceId = body?.workspaceId
    const problemText = typeof body?.problemText === 'string' ? body.problemText : ''

    const access = await requireWorkspaceOwner(workspaceId)
    if ('error' in access) return access.error
    if (!isValidCanvasImage(canvasBase64)) {
      return NextResponse.json({ error: 'Missing or invalid canvas image' }, { status: 400 })
    }

    // eslint-disable-next-line no-console
    console.info('[one-step] start', {
      imageChars: typeof canvasBase64 === 'string' ? canvasBase64.length : 0,
    })
    const writing = await transcribeImage(canvasBase64)
    // eslint-disable-next-line no-console
    console.info('[one-step] read', { ms: Date.now() - started, chars: writing.length })
    stage = 'writing the step'

    const groqAbort = new AbortController()
    const groqTimeout = setTimeout(() => groqAbort.abort(), 25_000)
    let groqRes: ChatCompletionResponse
    try {
      const groqReq = await fetchAIWithRetry(
        `${MODELS.reasoning.apiBase}/chat/completions`,
        {
          method: 'POST',
          signal: groqAbort.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey(MODELS.reasoning)}`,
          },
          body: JSON.stringify({
            model: MODELS.reasoning.model,
            max_tokens: 1200,
            reasoning_effort: 'low',
            messages: [
              {
                role: 'user',
                content: `The student asked to be shown the next step only. Return ONLY JSON {"step":"one line of KaTeX"}. If they have not written anything yet, that line is the first thing they should write under the uploaded problem, not the final answer. Do not finish the problem. Do not repeat their writing.\n\nUploaded problem:\n${problemText || '(none)'}\n\nTheir writing:\n${writing.trim() || '(nothing yet)'}`,
              },
            ],
          }),
        },
        'reasoning service',
      )
      groqRes = await groqReq.json()
    } finally {
      clearTimeout(groqTimeout)
    }

    const message = groqRes.choices?.[0]?.message
    const content = message?.content ?? ''
    const reasoning = message?.reasoning ?? ''
    const step = replyStep(content, reasoning)
    if (!step) {
      // eslint-disable-next-line no-console
      console.error('[one-step] unreadable reply', {
        ms: Date.now() - started,
        contentChars: content.length,
        reasoningChars: reasoning.length,
      })
      return NextResponse.json({ error: 'Could not write one step. Try again.' }, { status: 502 })
    }
    return NextResponse.json({ step })
  } catch (error: unknown) {
    if (error instanceof UpstreamAIError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status })
    }
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    // eslint-disable-next-line no-console
    console.error('[one-step] failed', {
      stage,
      ms: Date.now() - started,
      timeout: isTimeout,
      status: error instanceof UpstreamAIError ? error.status : null,
    })
    return NextResponse.json(
      {
        error: isTimeout
          ? `${stage === 'reading the page' ? 'Reading the page' : 'The step'} timed out. Try again.`
          : 'Could not write one step.',
      },
      { status: isTimeout ? 504 : 500 },
    )
  }
}

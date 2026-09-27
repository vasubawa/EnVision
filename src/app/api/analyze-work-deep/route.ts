import { NextResponse, NextRequest } from 'next/server'
import {
  MODELS,
  apiKey,
  fetchAIWithRetry,
  UpstreamAIError,
  type ChatCompletionResponse,
} from '@/lib/models'
import { transcribeImage } from '@/lib/vision'
import { reviewUnits } from '@/lib/units'
import { SUBJECT_GUIDANCE } from '@/lib/prompts'
import { rateLimit, isValidCanvasImage } from '@/lib/rateLimit'
import { requireWorkspaceOwner } from '@/lib/require-workspace-owner'
import { type Feedback, isFeedbackShape, normalizeFeedback } from '@/types/feedback'
import { algebraPromptNote, applyBoardChecks } from '@/lib/mathCheck'

export const maxDuration = 90

export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(req, { limit: 5, windowMs: 60_000 })
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
    console.info('[look-closer] start', {
      imageChars: typeof canvasBase64 === 'string' ? canvasBase64.length : 0,
    })
    const canvasDescription = await transcribeImage(canvasBase64)
    // eslint-disable-next-line no-console
    console.info('[look-closer] read', {
      ms: Date.now() - started,
      chars: canvasDescription.length,
    })
    stage = 'writing the reply'
    const unitNote = reviewUnits(canvasDescription)?.detail
    const boardForTutor = [
      problemText.trim()
        ? `Pasted problem, already read. Do not treat it as the student's new writing:\n${problemText.trim()}`
        : '',
      canvasDescription,
      unitNote ?? '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const deepAbort = new AbortController()
    const deepTimeout = setTimeout(() => deepAbort.abort(), 30_000)

    let deepRes: ChatCompletionResponse
    try {
      const deepReq = await fetchAIWithRetry(
        `${MODELS.reasoningDeep.apiBase}/chat/completions`,
        {
          method: 'POST',
          signal: deepAbort.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey(MODELS.reasoningDeep)}`,
          },
          body: JSON.stringify({
            model: MODELS.reasoningDeep.model,
            max_tokens: 2048,
            chat_template_kwargs: { enable_thinking: false },
            messages: [
              {
                role: 'user',
                content: `You are a Socratic tutor giving a DEEPER analysis than a quick check. The student's whiteboard contains:\n\n${boardForTutor}\n\nYour response must be more substantial than a simple question — it should:\n1. Identify the key mathematical concept or technique relevant to this problem or work (name it explicitly, e.g. "surface parameterization", "u-substitution", "cross product").\n2. Briefly explain WHY that concept applies here (1 sentence).\n3. End with a focused Socratic question that points to the next concrete step.\n\nSTRICT RULES:\n- If the canvas appears blank or only shows a problem statement (no student work), identify the problem TYPE and the main concept needed to solve it, then ask: "Do you know how to [apply that concept]?" or "What does [concept] tell you about this setup?" — don't just ask "what's your first step?".\n- NEVER give the answer, a worked solution, or step-by-step method.\n- Write 3-4 sentences maximum. No bullet lists.\n- If their work has errors, name WHAT is wrong conceptually (e.g. "the limits of integration don't account for the constraint") without showing how to fix it.\n- If their work is correct so far, confirm what they've done right and name the next concept they'll need.
- If their work is correct so far but unfinished, set judgement to progress.\n- ${SUBJECT_GUIDANCE}\n- Format ALL math with KaTeX: $...$ inline, $$...$$ block. Use ^ for exponents, \\frac{}{} for fractions — always inside $...$.\n\nReturn ONLY valid JSON: {"judgement": "correct" | "progress" | "mistake", "suggestion": "string"}. No markdown, no extra text.${algebraPromptNote(canvasDescription)}`,
              },
            ],
          }),
        },
        'deep reasoning service',
      )
      deepRes = await deepReq.json()
      // eslint-disable-next-line no-console
      console.info('[look-closer] reply', { ms: Date.now() - started })
    } finally {
      clearTimeout(deepTimeout)
    }

    const rawText: string = deepRes.choices[0].message.content

    let parsedResult: Feedback | null = null
    const extractResult = (obj: unknown): Feedback | null => {
      if (isFeedbackShape(obj)) {
        const suggestion = obj.suggestion
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\\n/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
        return normalizeFeedback({
          suggestion,
          isCorrect: typeof obj.isCorrect === 'boolean' ? obj.isCorrect : undefined,
          judgement: typeof obj.judgement === 'string' ? obj.judgement : undefined,
        })
      }
      return null
    }
    try {
      parsedResult = extractResult(JSON.parse(rawText))
    } catch {
      /* continue */
    }
    if (!parsedResult) {
      try {
        const match = rawText.match(/\{[\s\S]*\}/)
        if (match) parsedResult = extractResult(JSON.parse(match[0]))
      } catch {
        /* continue */
      }
    }
    if (!parsedResult) {
      const suggestionMatch = rawText.match(/"suggestion"\s*:\s*"([\s\S]*?)"\s*\}/)
      if (suggestionMatch) {
        parsedResult = normalizeFeedback({
          isCorrect:
            rawText.includes('"judgement": "correct"') || rawText.includes('"isCorrect": true'),
          judgement: rawText.includes('"judgement": "progress"') ? 'progress' : undefined,
          suggestion: suggestionMatch[1]
            .replace(/\\n/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim(),
        })
      }
    }
    if (!parsedResult) {
      parsedResult = normalizeFeedback({
        judgement: 'progress',
        suggestion: rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
      })
    }

    let savedId = undefined

    if (parsedResult) {
      parsedResult = applyBoardChecks(parsedResult, canvasDescription)
      const { data, error: insertError } = await access.supabase
        .from('messages')
        .insert({
          workspace_id: access.workspaceId,
          role: 'assistant',
          kind: 'feedback',
          content: parsedResult.suggestion,
          is_correct: parsedResult.isCorrect,
        })
        .select('id')
        .single()

      if (insertError) {
        return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
      }

      if (data) {
        savedId = data.id
      }
    }

    return NextResponse.json({
      ...parsedResult,
      id: savedId,
      canvasTranscription: canvasDescription,
    })
  } catch (error: unknown) {
    if (error instanceof UpstreamAIError) {
      // eslint-disable-next-line no-console
      console.warn(
        `[analyze-work-deep] Upstream AI error (${error.status}):`,
        error.details || error.message,
      )
      return NextResponse.json({ error: error.userMessage }, { status: error.status })
    }

    const isTimeout = error instanceof Error && error.name === 'AbortError'
    // eslint-disable-next-line no-console
    console.error('[look-closer] failed', {
      stage,
      ms: Date.now() - started,
      timeout: isTimeout,
      status: error instanceof UpstreamAIError ? error.status : null,
    })
    return NextResponse.json(
      {
        error: isTimeout
          ? `${stage === 'reading the page' ? 'Reading the page' : 'The reply'} timed out. Try again.`
          : 'An unexpected error occurred during deep analysis. Please try again.',
      },
      { status: isTimeout ? 504 : 500 },
    )
  }
}

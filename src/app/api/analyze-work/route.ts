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

// Vision (45s, reasoning model) + reasoning (25s) can exceed 60s combined.
export const maxDuration = 90

export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(req, { limit: 10, windowMs: 60_000 })
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
    console.info('[check] start', {
      imageChars: typeof canvasBase64 === 'string' ? canvasBase64.length : 0,
    })
    const canvasDescription = await transcribeImage(canvasBase64)
    // eslint-disable-next-line no-console
    console.info('[check] read', { ms: Date.now() - started, chars: canvasDescription.length })
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
            max_tokens: 2048,
            reasoning_effort: 'low',
            messages: [
              {
                role: 'user',
                content: `You are a Socratic tutor reviewing student work. The student's whiteboard contains:\n\n${boardForTutor}\n\nYour goal is to validate what they have done and guide them on what's next. Structure your response (3-4 sentences) as follows:\n1. Briefly acknowledge the problem they are solving.\n2. Summarize the work they have done so far.\n3. State clearly whether their current step is correct, still in progress, or a mistake.\n4. End with a Socratic question asking what to do next, or how to fix a mistake.\n\nSTRICT RULES:\n- NEVER give the answer, a worked solution, or list steps to perform.\n- If the canvas appears blank or only shows a problem statement (no student work), just acknowledge the problem and ask how they might start.\n- Use judgement progress when the step is fine but unfinished, or when there is not enough work to judge.
- judgement is "progress" when the step is fine but the problem is not finished, or when there is not enough work to judge. Use "mistake" only for a wrong step. Use "correct" only when the requested result is finished and right.
- ${SUBJECT_GUIDANCE}\n- Format ALL math with KaTeX: $...$ inline, $$...$$ block. Use ^ for exponents, \\\\frac{}{} for fractions — always inside $...$.\n\nReturn ONLY valid JSON: {"judgement": "correct" | "progress" | "mistake", "suggestion": "string"}. No markdown, no extra text.${algebraPromptNote(canvasDescription)}`,
              },
            ],
          }),
        },
        'reasoning service',
      )
      groqRes = await groqReq.json()
      // eslint-disable-next-line no-console
      console.info('[check] reply', { ms: Date.now() - started })
    } finally {
      clearTimeout(groqTimeout)
    }
    const rawText = groqRes.choices[0].message.content

    let parsedResult: Feedback | null = null

    const extractResult = (obj: unknown): Feedback | null => {
      if (isFeedbackShape(obj)) {
        let suggestion = obj.suggestion
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\\n/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
        if (suggestion.trimStart().startsWith('{')) {
          try {
            const inner: unknown = JSON.parse(suggestion)
            if (
              typeof inner === 'object' &&
              inner !== null &&
              typeof (inner as { suggestion?: unknown }).suggestion === 'string'
            ) {
              const innerObj = inner as {
                suggestion: string
                isCorrect?: unknown
              }
              suggestion = innerObj.suggestion
                .replace(/\r\n|\r|\n/g, ' ')
                .replace(/\\n/g, ' ')
                .trim()
              return normalizeFeedback({
                suggestion: innerObj.suggestion,
                isCorrect: typeof innerObj.isCorrect === 'boolean' ? innerObj.isCorrect : undefined,
                judgement:
                  typeof (inner as { judgement?: unknown }).judgement === 'string'
                    ? String((inner as { judgement?: unknown }).judgement)
                    : undefined,
              })
            }
          } catch {
            /* not nested JSON, use as-is */
          }
        }
        return normalizeFeedback({
          suggestion,
          isCorrect: typeof obj.isCorrect === 'boolean' ? obj.isCorrect : undefined,
          judgement: typeof obj.judgement === 'string' ? obj.judgement : undefined,
        })
      }
      return null
    }

    try {
      const obj = JSON.parse(rawText)
      parsedResult = extractResult(obj)
    } catch {
      /* continue */
    }

    if (!parsedResult) {
      try {
        const stripped = rawText.replace(/```json|```/g, '').trim()
        const obj = JSON.parse(stripped)
        parsedResult = extractResult(obj)
      } catch {
        /* continue */
      }
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
            rawText.includes('"judgement": "correct"') ||
            rawText.includes('"isCorrect": true') ||
            rawText.includes('"isCorrect":true'),
          judgement: rawText.includes('"judgement": "progress"')
            ? 'progress'
            : rawText.includes('"judgement": "mistake"')
              ? 'mistake'
              : undefined,
          suggestion: suggestionMatch[1]
            .replace(/\\n/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim(),
        })
      }
    }

    if (!parsedResult) {
      // eslint-disable-next-line no-console
      console.warn('[analyze-work] All JSON parse stages failed, using regex strip')
      const judgementMatch = rawText.match(/"judgement"\s*:\s*"(correct|progress|mistake)"/)
      const isCorrectMatch = rawText.match(/"isCorrect"\s*:\s*(true|false)/)
      const suggestionMatch = rawText.match(/"suggestion"\s*:\s*"([\s\S]*?)(?<!\\)"/)
      const suggestion = suggestionMatch
        ? suggestionMatch[1]
            .replace(/\\n/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/\s{2,}/g, ' ')
            .trim()
        : rawText.replace(/[{}"\\n]/g, ' ').trim()
      parsedResult = normalizeFeedback({
        isCorrect: isCorrectMatch?.[1] === 'true',
        judgement: judgementMatch?.[1],
        suggestion,
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
        `[analyze-work] Upstream AI error (${error.status}):`,
        error.details || error.message,
      )
      return NextResponse.json({ error: error.userMessage }, { status: error.status })
    }

    const isTimeout = error instanceof Error && error.name === 'AbortError'
    // eslint-disable-next-line no-console
    console.error('[check] failed', {
      stage,
      ms: Date.now() - started,
      timeout: isTimeout,
      status: error instanceof UpstreamAIError ? error.status : null,
    })
    return NextResponse.json(
      {
        error: isTimeout
          ? `${stage === 'reading the page' ? 'Reading the page' : 'The reply'} timed out. Try again.`
          : 'An unexpected error occurred during analysis. Please try again.',
      },
      { status: isTimeout ? 504 : 500 },
    )
  }
}

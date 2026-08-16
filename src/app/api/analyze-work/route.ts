import { NextResponse, NextRequest } from 'next/server'
import { MODELS, apiKey, stripThinking, type ChatCompletionResponse } from '@/lib/models'
import { VISION_TRANSCRIBE_PROMPT, extractTranscription } from '@/lib/prompts'
import { rateLimit, isValidCanvasImage } from '@/lib/rateLimit'

interface Feedback {
  isCorrect: boolean
  suggestion: string
}

function isFeedbackShape(obj: unknown): obj is Feedback {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Feedback).suggestion === 'string' &&
    typeof (obj as Feedback).isCorrect === 'boolean'
  )
}
// Vision (45s, reasoning model) + reasoning (25s) can exceed 60s combined
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(req, { limit: 10, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  try {
    const { canvasBase64 } = await req.json()

    if (!isValidCanvasImage(canvasBase64)) {
      return NextResponse.json({ error: 'Missing or invalid canvas image' }, { status: 400 })
    }

    // Step 1: Vision Transcription (45s timeout — reasoning model needs room to think)
    const visionAbort = new AbortController()
    const visionTimeout = setTimeout(() => visionAbort.abort(), 45_000)

    let visionRes: ChatCompletionResponse
    try {
      const visionReq = await fetch(`${MODELS.vision.apiBase}/chat/completions`, {
        method: 'POST',
        signal: visionAbort.signal,
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
      if (!visionReq.ok) throw new Error(`Vision API error: ${await visionReq.text()}`)
      visionRes = await visionReq.json()
    } finally {
      clearTimeout(visionTimeout)
    }
    const canvasDescription = extractTranscription(
      visionRes.choices[0].message.content,
      stripThinking,
    )

    // Step 2: Socratic Tutor (25s timeout)
    const groqAbort = new AbortController()
    const groqTimeout = setTimeout(() => groqAbort.abort(), 25_000)

    let groqRes: ChatCompletionResponse
    try {
      const groqReq = await fetch(`${MODELS.reasoning.apiBase}/chat/completions`, {
        method: 'POST',
        signal: groqAbort.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey(MODELS.reasoning)}`,
        },
        body: JSON.stringify({
          model: MODELS.reasoning.model,
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: `You are a Socratic tutor reviewing student work. The student's whiteboard contains:\n\n${canvasDescription}\n\nYour goal is to validate what they have done and guide them on what's next. Structure your response (3-4 sentences) as follows:\n1. Briefly acknowledge the problem they are solving.\n2. Summarize the work they have done so far.\n3. State clearly whether their current step is correct or if there is an error.\n4. End with a Socratic question asking what to do next (if correct) or how to fix the error (if incorrect).\n\nSTRICT RULES:\n- NEVER give the answer, a worked solution, or list steps to perform.\n- If the canvas appears blank or only shows a problem statement (no student work), just acknowledge the problem and ask how they might start.\n- Format ALL math with KaTeX: $...$ inline, $$...$$ block. Use ^ for exponents, \\\\frac{}{} for fractions — always inside $...$.\n\nReturn ONLY valid JSON: {"isCorrect": boolean, "suggestion": "string"}. No markdown, no extra text.`,
            },
          ],
        }),
      })
      if (!groqReq.ok) throw new Error(`Groq API error: ${await groqReq.text()}`)
      groqRes = await groqReq.json()
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
              return { isCorrect: !!innerObj.isCorrect, suggestion }
            }
          } catch {
            /* not nested JSON, use as-is */
          }
        }
        return { isCorrect: obj.isCorrect, suggestion }
      }
      return null
    }

    // Stage 1: direct JSON parse of the raw response
    try {
      const obj = JSON.parse(rawText)
      parsedResult = extractResult(obj)
    } catch {
      /* continue to next stage */
    }

    // Stage 2: strip markdown fences and try again
    if (!parsedResult) {
      try {
        const stripped = rawText.replace(/```json|```/g, '').trim()
        const obj = JSON.parse(stripped)
        parsedResult = extractResult(obj)
      } catch {
        /* continue */
      }
    }

    // Stage 3: extract the first JSON object block from anywhere in the text
    if (!parsedResult) {
      try {
        const match = rawText.match(/\{[\s\S]*\}/)
        if (match) parsedResult = extractResult(JSON.parse(match[0]))
      } catch {
        /* continue */
      }
    }

    // Fallback regex extraction if JSON.parse fails due to unescaped backslashes
    if (!parsedResult) {
      const suggestionMatch = rawText.match(/"suggestion"\s*:\s*"([\s\S]*?)"\s*\}/)
      if (suggestionMatch) {
        parsedResult = {
          isCorrect: rawText.includes('"isCorrect": true') || rawText.includes('"isCorrect":true'),
          suggestion: suggestionMatch[1]
            .replace(/\\n/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim(),
        }
      }
    }

    // Stage 4: last-resort regex strip — pull the suggestion string out manually
    if (!parsedResult) {
      // eslint-disable-next-line no-console
      console.warn('[analyze-work] All JSON parse stages failed, using regex strip')
      const isCorrectMatch = rawText.match(/"isCorrect"\s*:\s*(true|false)/)
      const suggestionMatch = rawText.match(/"suggestion"\s*:\s*"([\s\S]*?)(?<!\\)"/)
      const suggestion = suggestionMatch
        ? suggestionMatch[1]
            .replace(/\\n/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/\s{2,}/g, ' ')
            .trim()
        : rawText.replace(/[{}"\\n]/g, ' ').trim()
      parsedResult = {
        isCorrect: isCorrectMatch?.[1] === 'true',
        suggestion,
      }
    }

    return NextResponse.json(parsedResult)
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('analyze-work error: An internal error occurred.')
    return NextResponse.json(
      { error: 'An internal error occurred during analysis.' },
      { status: 500 },
    )
  }
}

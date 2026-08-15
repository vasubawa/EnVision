import { NextResponse, NextRequest } from 'next/server'
import { MODELS, apiKey, stripThinking, type ChatCompletionResponse } from '@/lib/models'
import { VISION_TRANSCRIBE_PROMPT, extractTranscription } from '@/lib/prompts'

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

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { canvasBase64 } = await req.json()

    if (!canvasBase64) {
      return NextResponse.json({ error: 'Missing canvas image' }, { status: 400 })
    }

    const visionAbort = new AbortController()
    const visionTimeout = setTimeout(() => visionAbort.abort(), 60_000)

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

    const deepAbort = new AbortController()
    const deepTimeout = setTimeout(() => deepAbort.abort(), 60_000)

    let deepRes: ChatCompletionResponse
    try {
      const deepReq = await fetch(`${MODELS.reasoningDeep.apiBase}/chat/completions`, {
        method: 'POST',
        signal: deepAbort.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey(MODELS.reasoningDeep)}`,
        },
        body: JSON.stringify({
          model: MODELS.reasoningDeep.model,
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: `You are a Socratic tutor giving a DEEPER analysis than a quick check. The student's whiteboard contains:\n\n${canvasDescription}\n\nYour response must be more substantial than a simple question — it should:\n1. Identify the key mathematical concept or technique relevant to this problem or work (name it explicitly, e.g. "surface parameterization", "u-substitution", "cross product").\n2. Briefly explain WHY that concept applies here (1 sentence).\n3. End with a focused Socratic question that points to the next concrete step.\n\nSTRICT RULES:\n- If the canvas appears blank or only shows a problem statement (no student work), identify the problem TYPE and the main concept needed to solve it, then ask: "Do you know how to [apply that concept]?" or "What does [concept] tell you about this setup?" — don't just ask "what's your first step?".\n- NEVER give the answer, a worked solution, or step-by-step method.\n- Write 3-4 sentences maximum. No bullet lists.\n- If their work has errors, name WHAT is wrong conceptually (e.g. "the limits of integration don't account for the constraint") without showing how to fix it.\n- If their work is correct so far, confirm what they've done right and name the next concept they'll need.\n- Format ALL math with KaTeX: $...$ inline, $$...$$ block. Use ^ for exponents, \\frac{}{} for fractions — always inside $...$.\n\nReturn ONLY valid JSON: {"isCorrect": boolean, "suggestion": "string"}. No markdown, no extra text.`,
            },
          ],
        }),
      })
      if (!deepReq.ok) throw new Error(`Deep Analysis API error: ${await deepReq.text()}`)
      deepRes = await deepReq.json()
    } finally {
      clearTimeout(deepTimeout)
    }

    const rawText: string = deepRes.choices[0].message.content

    // Reuse same robust parsing logic as the quick-check route
    let parsedResult: Feedback | null = null
    const extractResult = (obj: unknown): Feedback | null => {
      if (isFeedbackShape(obj)) {
        const suggestion = obj.suggestion
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\\n/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
        return { isCorrect: obj.isCorrect, suggestion }
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
    if (!parsedResult) {
      parsedResult = {
        isCorrect: false,
        suggestion: rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
      }
    }

    return NextResponse.json(parsedResult)
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    // eslint-disable-next-line no-console
    console.error('analyze-work-deep error:', isTimeout ? 'TIMEOUT' : 'An internal error occurred.')
    return NextResponse.json(
      {
        error: isTimeout ? 'Analysis timed out. Please try again.' : 'An internal error occurred.',
      },
      { status: isTimeout ? 504 : 500 },
    )
  }
}

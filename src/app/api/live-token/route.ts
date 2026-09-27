import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Modality } from '@google/genai'
import { z } from 'zod'
import { rateLimit } from '@/lib/rateLimit'
import { requireWorkspaceOwner } from '@/lib/require-workspace-owner'
import { LIVE_MODELS, LIVE_TOOLS, tutorInstruction } from '@/lib/live/tutorSetup'

export const maxDuration = 30

const bodySchema = z.object({
  workspaceId: z.string().min(1),
  preferences: z.object({
    oneStep: z.boolean(),
    shortReplies: z.boolean(),
    calm: z.boolean(),
    largeText: z.boolean(),
  }),
  problemText: z.string().max(8_000).optional(),
  skip: z.array(z.string()).max(LIVE_MODELS.length).optional(),
})

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 8, windowMs: 60_000 })
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many live sessions. Wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    )
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Live tutor is not configured. Add GEMINI_API_KEY on the server.' },
      { status: 503 },
    )
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid live session request.' }, { status: 400 })
  }

  const access = await requireWorkspaceOwner(parsed.data.workspaceId)
  if ('error' in access) return access.error

  const instruction = tutorInstruction(parsed.data.preferences, parsed.data.problemText ?? '')
  const skipped = new Set(parsed.data.skip ?? [])
  const models = LIVE_MODELS.filter((model) => !skipped.has(model))
  if (models.length === 0) {
    return NextResponse.json(
      { error: 'Every live voice is busy. Try again shortly.' },
      { status: 503 },
    )
  }

  const ai = new GoogleGenAI({ apiKey })
  let lastError = 'Live session could not be started.'
  for (const model of models) {
    try {
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
          liveConnectConstraints: {
            model,
            config: {
              sessionResumption: {},
              responseModalities: [Modality.AUDIO],
              systemInstruction: instruction,
              tools: [{ functionDeclarations: [...LIVE_TOOLS] }],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          },
        },
      })
      if (!token.name) continue
      return NextResponse.json({
        token: token.name,
        model,
        systemInstruction: instruction,
      })
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
      // eslint-disable-next-line no-console
      console.error('live token failed:', lastError)
    }
  }

  return NextResponse.json({ error: 'Live voice is busy. Try again in a moment.' }, { status: 502 })
}

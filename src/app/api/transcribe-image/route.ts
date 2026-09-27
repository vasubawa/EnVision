import { NextRequest, NextResponse } from 'next/server'
import { UpstreamAIError } from '@/lib/models'
import { rateLimit, isValidCanvasImage } from '@/lib/rateLimit'
import { requireWorkspaceOwner } from '@/lib/require-workspace-owner'
import { transcribeImage } from '@/lib/vision'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 10, windowMs: 60_000 })
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    )
  }

  try {
    const body: unknown = await req.json()
    const image = typeof body === 'object' && body !== null ? Reflect.get(body, 'image') : undefined
    const workspaceId =
      typeof body === 'object' && body !== null ? Reflect.get(body, 'workspaceId') : undefined

    const access = await requireWorkspaceOwner(workspaceId)
    if ('error' in access) return access.error
    if (!isValidCanvasImage(image)) {
      return NextResponse.json({ error: 'Missing or invalid image' }, { status: 400 })
    }

    const transcription = await transcribeImage(image, 50_000)
    if (!transcription) return NextResponse.json({ error: 'No reading returned.' }, { status: 502 })
    return NextResponse.json({ transcription })
  } catch (error) {
    if (error instanceof UpstreamAIError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not read that image.' }, { status: 502 })
  }
}

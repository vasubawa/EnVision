import { NextRequest } from 'next/server'

// In-memory, best-effort rate limiter. Good enough for a single Vercel instance /
// low-traffic demo; it does not share state across regions/instances. If usage
// grows, swap this for a shared store (e.g. Upstash Redis) without changing callers.
const hits = new Map<string, number[]>()
const MAX_CLIENTS = 1000

function clientId(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export function rateLimit(
  req: NextRequest,
  { limit, windowMs }: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const id = clientId(req)
  const now = Date.now()
  const windowStart = now - windowMs

  // Prune inactive clients when reaching the limit
  if (hits.size >= MAX_CLIENTS && !hits.has(id)) {
    for (const [key, timestamps] of hits.entries()) {
      const active = timestamps.filter((t) => t > windowStart)
      if (active.length === 0) {
        hits.delete(key)
      } else {
        hits.set(key, active)
      }
    }
    // Evict oldest remaining if still at limit
    if (hits.size >= MAX_CLIENTS) {
      const firstKey = hits.keys().next().value
      if (firstKey) hits.delete(firstKey)
    }
  }

  const recent = (hits.get(id) ?? []).filter((t) => t > windowStart)

  if (recent.length >= limit) {
    const retryAfterSeconds = Math.ceil((recent[0] + windowMs - now) / 1000)
    hits.set(id, recent)
    return { allowed: false, retryAfterSeconds }
  }

  recent.push(now)
  hits.set(id, recent)
  return { allowed: true, retryAfterSeconds: 0 }
}

const MAX_CANVAS_BASE64_LENGTH = 8_000_000 // ~6MB decoded, enough for a full-canvas PNG

export function isValidCanvasImage(canvasBase64: unknown): canvasBase64 is string {
  return (
    typeof canvasBase64 === 'string' &&
    canvasBase64.length > 0 &&
    canvasBase64.length <= MAX_CANVAS_BASE64_LENGTH &&
    /^data:image\/(png|jpeg|jpg|webp);base64,/.test(canvasBase64)
  )
}

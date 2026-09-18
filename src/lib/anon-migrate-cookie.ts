import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { requireEnv } from '@/lib/env'

const COOKIE_NAME = 'anon_migrate'
const MAX_AGE_MS = 10 * 60 * 1000

function migrationSecret(): string {
  // Prefer a dedicated secret when set; otherwise reuse keys already required in prod.
  return requireEnv(
    process.env.ANON_MIGRATE_SECRET ||
      process.env.CRON_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    'ANON_MIGRATE_SECRET (or CRON_SECRET / SUPABASE_SERVICE_ROLE_KEY)',
  )
}

function sign(payload: string): string {
  return createHmac('sha256', migrationSecret()).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/** Encode anonymous user id into an httpOnly cookie before password auth replaces the session. */
export async function setAnonymousMigrationCookie(anonymousUserId: string): Promise<void> {
  const expiresAt = Date.now() + MAX_AGE_MS
  const payload = `${anonymousUserId}.${expiresAt}`
  const value = `${payload}.${sign(payload)}`
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(MAX_AGE_MS / 1000),
  })
}

/** Read + clear the migration cookie. Returns null if missing/invalid/expired. */
export async function consumeAnonymousMigrationCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  cookieStore.delete(COOKIE_NAME)

  if (!raw) return null

  const parts = raw.split('.')
  if (parts.length !== 3) return null

  const [anonymousUserId, expiresAtStr, signature] = parts
  const payload = `${anonymousUserId}.${expiresAtStr}`
  if (!safeEqual(sign(payload), signature)) return null

  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null

  return anonymousUserId
}

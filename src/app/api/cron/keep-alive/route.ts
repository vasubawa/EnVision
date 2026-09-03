import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Pinged daily by the Vercel cron in vercel.json so the Supabase project
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (secret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let supabaseFailed = false

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
    if (error) {
      throw new Error(error.message)
    }
  } catch (err) {
    supabaseFailed = true
    const errorMessage = err instanceof Error ? err.message : String(err)
    // eslint-disable-next-line no-console
    console.error('keep-alive ping failed (Supabase):', errorMessage)
  }

  // Ping Upstash Redis to keep the free instance alive
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const upstashRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/keep-alive`, {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
        signal: controller.signal,
      })
      if (!upstashRes.ok) {
        // eslint-disable-next-line no-console
        console.error('keep-alive ping failed (Upstash): status', upstashRes.status)
      }
    } catch (upstashError) {
      // eslint-disable-next-line no-console
      console.error('keep-alive ping failed (Upstash):', upstashError)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  if (supabaseFailed) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

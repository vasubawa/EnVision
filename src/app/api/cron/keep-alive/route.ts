import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Heartbeat for free-tier Supabase (and optional Upstash).
 * Vercel Cron hits this twice daily; each run calls run_keep_alive() which
 * writes a counter + ping log, prunes old pings, and SELECTs app tables.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  if (process.env.NODE_ENV === 'production') {
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let supabaseOk = false
  let supabaseError: string | undefined
  let supabaseResult: unknown

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('run_keep_alive', {
      p_source: 'vercel-cron',
    })
    if (error) {
      throw new Error(error.message)
    }
    supabaseResult = data
    supabaseOk = true
  } catch (err) {
    supabaseError = err instanceof Error ? err.message : String(err)
    // eslint-disable-next-line no-console
    console.error('keep-alive ping failed (Supabase):', supabaseError)
  }

  let upstashOk: boolean | undefined
  let upstashError: string | undefined

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
        upstashOk = false
        upstashError = `status ${upstashRes.status}`
        // eslint-disable-next-line no-console
        console.error('keep-alive ping failed (Upstash):', upstashError)
      } else {
        upstashOk = true
      }
    } catch (err) {
      upstashOk = false
      upstashError = err instanceof Error ? err.message : String(err)
      // eslint-disable-next-line no-console
      console.error('keep-alive ping failed (Upstash):', upstashError)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  if (!supabaseOk) {
    return NextResponse.json(
      {
        ok: false,
        supabase: { ok: false, error: supabaseError },
        upstash: { ok: upstashOk, error: upstashError },
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    supabase: { ok: true, result: supabaseResult },
    upstash: upstashOk === undefined ? undefined : { ok: upstashOk, error: upstashError },
  })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Pinged daily by the Vercel cron in vercel.json so the Supabase project
// (free tier) doesn't get auto-paused for inactivity.
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

  const supabase = createAdminClient()
  const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('keep-alive ping failed:', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

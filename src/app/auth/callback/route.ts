import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL — but only if it's a
  // same-site path, otherwise a crafted magic-link URL could redirect a
  // freshly-authenticated user off-site (e.g. ?next=https://evil.com or //evil.com)
  const rawNext = searchParams.get('next')
  let next = '/workspace'
  if (rawNext) {
    try {
      const parsedNext = new URL(rawNext, origin)
      if (parsedNext.origin === origin) {
        next = rawNext
      }
    } catch {
      // ignore invalid URLs and fallback to /workspace
    }
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+magic+link`)
}

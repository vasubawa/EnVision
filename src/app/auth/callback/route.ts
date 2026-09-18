import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { migrateAnonymousWorkspaces } from '@/lib/migrate-anonymous-workspaces'
import { consumeAnonymousMigrationCookie } from '@/lib/anon-migrate-cookie'

function safeNextPath(rawNext: string | null, origin: string): string {
  if (!rawNext) return '/workspace'
  try {
    const parsed = new URL(rawNext, origin)
    if (parsed.origin !== origin) return '/workspace'
    // Always rebuild from pathname so a full same-origin URL cannot double-prefix.
    if (!parsed.pathname.startsWith('/')) return '/workspace'
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/workspace'
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'), origin)

  if (code) {
    const supabase = await createClient()

    const {
      data: { user: anonUser },
    } = await supabase.auth.getUser()

    const { error, data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && sessionData?.user) {
      const newUser = sessionData.user

      if (anonUser?.is_anonymous && anonUser.id !== newUser.id) {
        const migrationResult = await migrateAnonymousWorkspaces(anonUser.id, newUser.id)
        if (migrationResult.error) {
          return NextResponse.redirect(`${origin}/login?error=Failed+to+migrate+workspaces`)
        }
      } else if (!newUser.is_anonymous) {
        // Password sign-up email confirm (or OAuth without prior anon session):
        // honor the signed cookie from prepareAnonymousMigration.
        try {
          const oldUserId = await consumeAnonymousMigrationCookie()
          if (oldUserId && oldUserId !== newUser.id) {
            const migrationResult = await migrateAnonymousWorkspaces(oldUserId, newUser.id)
            if (migrationResult.error) {
              return NextResponse.redirect(`${origin}/login?error=Failed+to+migrate+workspaces`)
            }
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Cookie migration failed:', err)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+magic+link`)
}

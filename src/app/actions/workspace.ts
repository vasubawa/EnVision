'use server'

import { createClient } from '@/lib/supabase/server'
import { verifyTurnstileToken } from '@/lib/turnstile'
import {
  setAnonymousMigrationCookie,
  consumeAnonymousMigrationCookie,
} from '@/lib/anon-migrate-cookie'
import { migrateAnonymousWorkspaces } from '@/lib/migrate-anonymous-workspaces'

export async function createWorkspace(
  captchaToken?: string,
): Promise<{ data?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let currentUser = user

  if (!currentUser || currentUser.is_anonymous) {
    if (!captchaToken) {
      return { error: 'Missing captcha token' }
    }

    if (!currentUser) {
      const { data, error } = await supabase.auth.signInAnonymously({ options: { captchaToken } })
      if (error || !data.user) {
        // eslint-disable-next-line no-console
        console.error('Failed to sign in anonymously:', error)
        return { error: 'Failed to sign in anonymously: ' + (error?.message || 'Unknown error') }
      }
      currentUser = data.user
    } else if (currentUser.is_anonymous) {
      // Verify captcha token for existing anonymous users before workspace insertion
      const isValid = await verifyTurnstileToken(captchaToken!)
      if (!isValid) {
        return { error: 'Invalid captcha token' }
      }
    }
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const title = `Session: ${formatter.format(new Date())}`

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({
      user_id: currentUser.id,
      title,
    })
    .select('id')
    .single()

  if (error || !workspace) {
    // eslint-disable-next-line no-console
    console.error('Failed to create workspace:', error)
    return { error: 'Failed to create workspace: ' + (error?.message || 'Unknown error') }
  }

  return { data: workspace.id }
}

export async function deleteWorkspace(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase.from('workspaces').delete().eq('id', id).eq('user_id', user.id)

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to delete workspace:', error)
    throw new Error('Failed to delete workspace')
  }
}

/**
 * Call while still on the anonymous session, before password sign-in/up.
 * Stashes a signed cookie so we can migrate after the session is replaced.
 */
export async function prepareAnonymousMigration(): Promise<{ ok: true; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.is_anonymous) {
    return { ok: true }
  }

  try {
    await setAnonymousMigrationCookie(user.id)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to prepare anonymous migration:', err)
    return { ok: true, error: 'Failed to prepare workspace migration' }
  }

  return { ok: true }
}

/**
 * Call after a successful password sign-in/up. Migrates workspaces from the
 * anonymous user recorded by prepareAnonymousMigration.
 */
export async function completeAnonymousMigration(): Promise<{
  success?: true
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Email confirmation may leave the anon session in place — keep the cookie
  // for /auth/callback and don't treat that as failure.
  if (!user || user.is_anonymous) {
    return { success: true }
  }

  let oldUserId: string | null
  try {
    oldUserId = await consumeAnonymousMigrationCookie()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to read anonymous migration cookie:', err)
    return { error: 'Failed to migrate workspaces' }
  }

  if (!oldUserId || oldUserId === user.id) {
    return { success: true }
  }

  return migrateAnonymousWorkspaces(oldUserId, user.id)
}

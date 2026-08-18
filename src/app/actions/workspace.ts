'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { verifyTurnstileToken } from '@/lib/turnstile'

export async function createWorkspace(
  captchaToken?: string,
): Promise<{ data?: string; error?: string }> {
  if (!captchaToken) {
    return { error: 'Missing captcha token' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let currentUser = user

  if (!currentUser) {
    const { data, error } = await supabase.auth.signInAnonymously({ options: { captchaToken } })
    if (error || !data.user) {
      // eslint-disable-next-line no-console
      console.error('Failed to sign in anonymously:', error)
      return { error: 'Failed to sign in anonymously: ' + (error?.message || 'Unknown error') }
    }
    currentUser = data.user
  } else {
    // Only verify manually if we're not consuming the token in signInAnonymously
    const isValid = await verifyTurnstileToken(captchaToken)
    if (!isValid) {
      return { error: 'Invalid captcha token' }
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

export async function migrateAndSignIn(email: string, password: string, captchaToken: string) {
  const supabase = await createClient()
  const {
    data: { user: anonUser },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  })

  if (error || !data.user) {
    return { error: error?.message || 'Failed to sign in' }
  }

  // If there was an anonymous user, migrate their workspaces to the new user
  if (anonUser && anonUser.is_anonymous) {
    const admin = createAdminClient()
    const { error: updateError } = await admin
      .from('workspaces')
      .update({ user_id: data.user.id })
      .eq('user_id', anonUser.id)
    if (updateError) {
      // eslint-disable-next-line no-console
      console.error('Failed to migrate workspaces:', updateError)
      return { error: 'Failed to migrate workspaces: ' + updateError.message }
    }
  }

  return { success: true }
}

'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { verifyTurnstileToken } from '@/lib/turnstile'

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
      const isValid = await verifyTurnstileToken(captchaToken)
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

export async function migrateAnonymousWorkspacesHelper(oldUserId: string, newUserId: string) {
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('workspaces')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)

  if (updateError) {
    // eslint-disable-next-line no-console
    console.error('Failed to migrate workspaces:', updateError)
    return { error: 'Failed to migrate workspaces: ' + updateError.message }
  }

  return { success: true }
}

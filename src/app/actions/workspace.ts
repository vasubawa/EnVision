'use server'

import { createClient } from '@/lib/supabase/server'

export async function createWorkspace(
  captchaToken?: string,
): Promise<{ data?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let currentUser = user

  if (!currentUser) {
    const { data, error } = await supabase.auth.signInAnonymously(
      captchaToken ? { options: { captchaToken } } : undefined,
    )
    if (error || !data.user) {
      // eslint-disable-next-line no-console
      console.error('Failed to sign in anonymously:', error)
      return { error: 'Failed to sign in anonymously: ' + (error?.message || 'Unknown error') }
    }
    currentUser = data.user
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

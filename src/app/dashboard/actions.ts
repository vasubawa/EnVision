'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createWorkspace(formData?: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({
      user_id: user.id,
      title: 'Untitled workspace',
    })
    .select('id')
    .single()

  if (error || !workspace) {
    console.error('Failed to create workspace:', error)
    throw new Error('Failed to create workspace')
  }

  redirect(`/workspace/${workspace.id}`)
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
    console.error('Failed to delete workspace:', error)
    throw new Error('Failed to delete workspace')
  }
}

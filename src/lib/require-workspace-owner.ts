import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User, SupabaseClient } from '@supabase/supabase-js'

type Ok = {
  supabase: SupabaseClient
  user: User
  workspaceId: string
}

type Fail = {
  error: NextResponse
}

/**
 * Require a signed-in user (anon OK) who owns `workspaceId` before expensive AI work.
 */
export async function requireWorkspaceOwner(workspaceId: unknown): Promise<Ok | Fail> {
  if (typeof workspaceId !== 'string' || !workspaceId) {
    return {
      error: NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 }),
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('user_id')
    .eq('id', workspaceId)
    .single()

  if (!workspace || workspace.user_id !== user.id) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { supabase, user, workspaceId }
}

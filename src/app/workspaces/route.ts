import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createWorkspace } from '@/app/actions/workspace'

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Get the most recent workspace
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error || !workspaces || workspaces.length === 0) {
    // If no workspace exists, create one
    try {
      const newWorkspaceId = await createWorkspace()
      return NextResponse.redirect(new URL(`/workspace/${newWorkspaceId}`, req.url))
    } catch (err) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.redirect(new URL(`/workspace/${workspaces[0].id}`, req.url))
}

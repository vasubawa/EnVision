import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  if (error) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (!workspaces || workspaces.length === 0) {
    // If no workspace exists, create one
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      const title = `Session: ${formatter.format(new Date())}`

      const { data: newWorkspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          user_id: user.id,
          title,
        })
        .select('id')
        .single()

      if (createError || !newWorkspace) {
        throw new Error(createError?.message || 'Failed to create workspace')
      }

      return NextResponse.redirect(new URL(`/workspace/${newWorkspace.id}`, req.url))
    } catch (_err) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.redirect(new URL(`/workspace/${workspaces[0].id}`, req.url))
}

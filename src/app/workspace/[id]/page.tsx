import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import WorkspaceClient from './WorkspaceClient'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !workspace) {
    notFound()
  }

  return <WorkspaceClient workspace={workspace} />
}

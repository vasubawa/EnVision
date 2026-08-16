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

  const [workspaceResponse, messagesResponse] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', id).single(),
    supabase
      .from('messages')
      .select('*')
      .eq('workspace_id', id)
      .order('created_at', { ascending: true }),
  ])

  const { data: workspace, error: workspaceError } = workspaceResponse
  const { data: messages, error: messagesError } = messagesResponse

  if (workspaceError || !workspace) {
    notFound()
  }

  return <WorkspaceClient workspace={workspace} initialMessages={messages || []} />
}

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import WorkspaceClient from './WorkspaceClient'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Anonymous users are allowed in workspaces — createWorkspace signs them in
  // anonymously before creating the record. If there is truly no session
  // (e.g. direct URL with an expired cookie), show a 404 rather than redirect
  // to /login, which would break the anonymous flow.
  if (!user) {
    notFound()
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

  if (messagesError) {
    throw new Error('Failed to load chat history')
  }

  let initialCanvasState = null
  let snapshotError = false
  if (workspace.canvas_snapshot_path) {
    const { data, error } = await supabase.storage
      .from('workspace-snapshots')
      .download(workspace.canvas_snapshot_path)
    if (error) {
      snapshotError = true
      // eslint-disable-next-line no-console
      console.error('Failed to download canvas snapshot:', error)
    } else if (data) {
      initialCanvasState = await data.text()
    }
  }

  if (snapshotError) {
    throw new Error('Failed to load canvas snapshot')
  }

  return (
    <WorkspaceClient
      workspace={workspace}
      initialMessages={messages || []}
      initialCanvasState={initialCanvasState}
    />
  )
}

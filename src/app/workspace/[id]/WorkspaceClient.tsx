'use client'

import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ArrowLeft, MessageSquare, X } from 'lucide-react'
import { AuthMenu } from '@/components/AuthMenu'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
const Whiteboard = dynamic(
  () => import('@/components/workspace/Whiteboard').then((mod) => mod.Whiteboard),
  { ssr: false },
)
import { TutorChat } from '@/components/workspace/TutorChat'

interface Workspace {
  id: string
  title: string
  user_id: string
  // Add other fields as needed
}

export default function WorkspaceClient({
  workspace,
  initialMessages,
  initialCanvasState,
}: {
  workspace: Workspace
  initialMessages: unknown[]
  initialCanvasState: string | null
}) {
  const router = useRouter()
  const [isChatOpen, setIsChatOpen] = useState(true)
  const { lastCanvasUpdate, getCanvasJson } = useWorkspaceStore()
  const supabase = createClient()

  // Auto-save Canvas
  useEffect(() => {
    if (!lastCanvasUpdate || !getCanvasJson) return

    const timeout = setTimeout(async () => {
      try {
        const jsonStr = getCanvasJson()
        if (!jsonStr) return

        const filePath = `${workspace.user_id}/${workspace.id}/snapshot.json`
        const file = new File([jsonStr], 'snapshot.json', { type: 'application/json' })

        const { error: uploadError } = await supabase.storage
          .from('workspace-snapshots')
          .upload(filePath, file, { upsert: true })

        if (uploadError) throw uploadError

        const { error: dbError } = await supabase
          .from('workspaces')
          .update({
            canvas_snapshot_path: filePath,
            canvas_snapshot_updated_at: new Date().toISOString(),
          })
          .eq('id', workspace.id)

        if (dbError) throw dbError
      } catch (err) {
        console.error('Auto-save failed:', err)
      }
    }, 2000) // Debounce for 2 seconds

    return () => clearTimeout(timeout)
  }, [lastCanvasUpdate, getCanvasJson, workspace.id, workspace.user_id, supabase])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleLeave = async () => {
    if (
      !window.confirm(
        'Are you sure you want to leave? Make sure your work is saved or your canvas progress will be lost.',
      )
    ) {
      return
    }

    // Attempt to flush any pending debounced save
    if (getCanvasJson) {
      try {
        const jsonStr = getCanvasJson()
        if (jsonStr) {
          const filePath = `${workspace.user_id}/${workspace.id}/snapshot.json`
          const file = new File([jsonStr], 'snapshot.json', { type: 'application/json' })

          const { error: uploadError } = await supabase.storage
            .from('workspace-snapshots')
            .upload(filePath, file, { upsert: true })

          if (!uploadError) {
            await supabase
              .from('workspaces')
              .update({
                canvas_snapshot_path: filePath,
                canvas_snapshot_updated_at: new Date().toISOString(),
              })
              .eq('id', workspace.id)
          }
        }
      } catch (err) {
        console.error('Failed to save before leaving:', err)
      }
    }

    router.push('/')
  }

  return (
    <div className="text-foreground flex h-screen w-full flex-col overflow-hidden bg-transparent">
      {/* Workspace Header */}
      <header className="border-border bg-card/60 z-50 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="hover:bg-foreground/5 text-foreground/60 hover:text-foreground rounded-lg p-2 transition-colors"
            aria-label="Return to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="max-w-[200px] truncate font-serif text-sm font-medium">
            {workspace.title || 'Blank Workspace'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="bg-border hidden h-4 w-px sm:block" />
          <AuthMenu />
        </div>
      </header>

      {/* Main Workspace Area (Full Screen) */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="relative flex-1 bg-white dark:bg-black/20">
          <Whiteboard initialCanvasState={initialCanvasState} />
        </div>

        {/* Floating Chat Bubble */}
        <div
          className={`absolute right-6 bottom-20 z-40 flex w-120 max-w-[calc(100vw-3rem)] flex-col shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isChatOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
          }`}
          style={{ height: 'calc(100vh - 180px)', maxHeight: '700px' }}
        >
          <div className="bg-card border-border/50 flex h-full flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl">
            <div className="bg-card/80 border-border/50 flex items-center justify-between border-b px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="bg-primary-500/10 flex h-6 w-6 items-center justify-center rounded-full">
                  <span className="text-primary-500 font-serif text-xs font-bold">AI</span>
                </div>
                <span className="font-serif text-sm font-medium">Tutor Chat</span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-full p-1.5 transition-colors"
                aria-label="Close tutor chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <TutorChat workspaceId={workspace.id} initialMessages={initialMessages} />
            </div>
          </div>
        </div>

        {/* Floating Action Button (FAB) for Chat */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-primary-500 hover:bg-primary-600 shadow-primary-500/25 absolute right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
          title={isChatOpen ? 'Close AI Tutor' : 'Open AI Tutor'}
        >
          {isChatOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        </button>
      </main>
    </div>
  )
}

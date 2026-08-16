'use client'

import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useEffect, useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
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
  // Start closed; open by default on desktop after hydration
  const [isChatOpen, setIsChatOpen] = useState(false)
  const { lastCanvasUpdate, getCanvasJson } = useWorkspaceStore()
  const supabase = createClient()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.innerWidth >= 768) setIsChatOpen(true)
  }, [])

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
        // eslint-disable-next-line no-console
        console.error('Auto-save failed:', err)
      }
    }, 2000)
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

  return (
    <div className="text-foreground flex h-[100dvh] w-full flex-col overflow-hidden bg-transparent">
      {/* Workspace Header — slim on mobile */}
      <header className="border-border/50 bg-background/50 z-40 flex h-11 shrink-0 items-center justify-center border-b px-4 backdrop-blur-md sm:h-14">
        <div className="text-foreground/80 font-serif text-sm font-medium">
          {workspace.title || 'Blank Workspace'}
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="relative flex flex-1 overflow-hidden">
        {/* Whiteboard fills everything */}
        <div className="relative h-full w-full bg-white dark:bg-black/20">
          <Whiteboard initialCanvasState={initialCanvasState} />
        </div>

        {/* ── Chat panel ──
            Mobile  : full-width bottom sheet, slides up from below the toolbar
            Desktop : floating card pinned bottom-right above the FAB
        */}
        <>
          {/* Mobile scrim — tap to close */}
          <div
            className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 sm:hidden ${
              isChatOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={() => setIsChatOpen(false)}
          />

          <div
            className={[
              // Mobile: fixed full-width bottom sheet
              'fixed inset-x-0 bottom-0 z-50 flex flex-col transition-all duration-300 ease-in-out',
              // Desktop: floating card
              'sm:absolute sm:inset-x-auto sm:right-6 sm:bottom-[5.5rem] sm:w-[420px] sm:max-w-[calc(100vw-3rem)]',
              'shadow-2xl',
              isChatOpen
                ? 'pointer-events-auto translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-full opacity-0 sm:translate-y-8 sm:opacity-0',
            ].join(' ')}
            style={{
              // Mobile fills remaining height above toolbar; desktop caps at 680px
              height: 'min(calc(100dvh - 5rem), 680px)',
            }}
          >
            <div className="bg-card border-border/50 flex h-full flex-col overflow-hidden rounded-t-2xl border shadow-2xl backdrop-blur-xl sm:rounded-2xl">
              {/* Header */}
              <div className="bg-card/80 border-border/50 flex shrink-0 items-center justify-between border-b px-4 py-2.5 backdrop-blur-md sm:py-3">
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
        </>

        {/* FAB — chat toggle
            Mobile : sits just above the toolbar
            Desktop: bottom-6 right-6
        */}
        <button
          onClick={() => setIsChatOpen((v) => !v)}
          className={[
            'absolute right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-xl',
            'bg-primary-500 hover:bg-primary-600 shadow-primary-500/25',
            'transition-all duration-200 hover:scale-105 active:scale-95',
            // On mobile, float above the bottom toolbar strip
            'bottom-24 sm:right-6 sm:bottom-6 sm:h-14 sm:w-14',
          ].join(' ')}
          title={isChatOpen ? 'Close AI Tutor' : 'Open AI Tutor'}
        >
          {isChatOpen ? (
            <X className="h-4 w-4 sm:h-6 sm:w-6" />
          ) : (
            <MessageSquare className="h-4 w-4 sm:h-6 sm:w-6" />
          )}
        </button>
      </main>
    </div>
  )
}

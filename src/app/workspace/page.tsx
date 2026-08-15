'use client'

import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ArrowLeft, PanelRightClose, PanelRightOpen } from 'lucide-react'
import dynamic from 'next/dynamic'
const Whiteboard = dynamic(
  () =>
    import('@/components/workspace/Whiteboard').then((mod) => mod.Whiteboard),
  { ssr: false },
)
import { TutorChat } from '@/components/workspace/TutorChat'

export default function WorkspacePage() {
  const file = useWorkspaceStore((state) => state.file)
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleLeave = () => {
    if (
      window.confirm(
        'Are you sure you want to leave? Your canvas progress will be lost.',
      )
    ) {
      router.push('/')
    }
  }

  return (
    <div className="text-foreground flex h-screen w-full flex-col overflow-hidden bg-transparent">
      {/* Workspace Header */}
      <header className="border-border bg-card/60 z-50 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="hover:bg-foreground/5 text-foreground/60 hover:text-foreground rounded-lg p-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="max-w-200px truncate font-serif text-sm font-medium">
            {file?.name || 'Blank Canvas'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hover:bg-foreground/5 text-foreground/60 hover:text-foreground rounded-lg p-2 transition-colors"
            title={isSidebarOpen ? 'Close AI Tutor' : 'Open AI Tutor'}
          >
            {isSidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Area (Split Screen) */}
      <main className="relative flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Top/Left Side: Whiteboard */}
        <section
          className={`h-[60vh] md:h-auto ${isSidebarOpen ? 'md:flex-7' : 'md:flex-1'} border-border relative shrink-0 border-b bg-transparent transition-all duration-300 md:shrink md:border-r md:border-b-0`}
        >
          <Whiteboard />
        </section>

        {/* Bottom/Right Side: AI Tutor Chat */}
        {isSidebarOpen && (
          <section className="bg-card/40 relative flex min-h-0 flex-1 flex-col backdrop-blur-sm transition-all duration-300 md:w-[30%] md:flex-3">
            <TutorChat />
          </section>
        )}
      </main>
    </div>
  )
}

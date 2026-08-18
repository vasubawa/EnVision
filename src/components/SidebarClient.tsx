'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createWorkspace, deleteWorkspace } from '@/app/actions/workspace'
import { Plus, Loader2, MessageSquare, PanelLeftClose, PanelLeft, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EnVisionMark } from '@/components/EnVisionMark'
import { AuthMenu } from '@/components/AuthMenu'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useCaptcha } from '@/components/CaptchaModal'
import { toast } from 'sonner'

interface Workspace {
  id: string
  title: string
  updated_at: string
}

export default function SidebarClient({
  workspaces,
  children,
}: {
  workspaces: Workspace[]
  children: React.ReactNode
}) {
  // Default closed — hydrated from localStorage after mount to avoid blocking
  // the screen on mobile before JS runs.
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { requireCaptcha } = useCaptcha()

  // Persist sidebar open/closed; first visit defaults to closed on desktop
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-open')
    if (stored !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(stored === 'true')
    } else {
      setIsOpen(false)
    }
  }, [])

  const toggle = (next: boolean) => {
    setIsOpen(next)
    localStorage.setItem('sidebar-open', String(next))
  }

  const handleNewSession = async () => {
    if (isCreating) return
    setIsCreating(true)

    let token: string | undefined
    try {
      token = await requireCaptcha()
    } catch {
      setIsCreating(false)
      return
    }

    try {
      const { data: id, error: createError } = await createWorkspace(token)

      if (createError || !id) {
        throw new Error(createError || 'Failed to create workspace')
      }

      router.push(`/workspace/${id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create session')
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this session?')) return

    setDeletingId(id)
    try {
      await deleteWorkspace(id)
      toast.success('Session deleted')
      router.refresh()
      if (pathname === `/workspace/${id}`) {
        router.push('/workspaces')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete session')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden"
          onClick={() => toggle(false)}
        />
      )}

      {/* Sidebar container */}
      <div
        className={`border-border bg-background fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden border-r transition-all duration-300 ease-in-out md:relative ${isOpen ? 'translate-x-0' : '-translate-x-full md:w-0 md:-translate-x-full md:border-r-0'}`}
      >
        <div
          className={`flex h-full w-64 flex-col overflow-hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 md:opacity-0'}`}
        >
          {/* Header */}
          <div className="border-border/50 flex h-14 shrink-0 items-center justify-between border-b px-4">
            <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
              <EnVisionMark className="text-primary-500 h-6 w-6" />
              <span className="font-serif font-medium tracking-tight">EnVision</span>
            </Link>
            <button
              onClick={() => toggle(false)}
              className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-md p-1.5"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* New Workspace Button */}
          <div className="shrink-0 p-3">
            <button
              onClick={handleNewSession}
              disabled={isCreating}
              className="border-border/50 bg-background hover:bg-foreground/5 mb-2 flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm transition-colors disabled:opacity-60"
            >
              <span className="font-medium">{isCreating ? 'Creating…' : 'New session'}</span>
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Workspace List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="text-foreground/50 mb-2 px-2 text-xs font-semibold">Recent</div>
            <div className="flex flex-col gap-0.5">
              {workspaces.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/workspace/${ws.id}`}
                  className={`group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                    pathname === `/workspace/${ws.id}`
                      ? 'bg-foreground/10 text-foreground font-medium'
                      : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MessageSquare className="text-foreground/40 group-hover:text-foreground/70 h-4 w-4 shrink-0" />
                    <span className="truncate">{ws.title}</span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(ws.id, e)}
                    disabled={deletingId === ws.id}
                    className="text-foreground/40 rounded p-1 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 focus:opacity-100 disabled:opacity-50"
                    aria-label="Delete session"
                  >
                    {deletingId === ws.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </Link>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-border/50 shrink-0 border-t p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <AuthMenu />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content wrapper */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Main View */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* Fixed re-open button — always rendered on top so it's never hidden by workspace content */}
      {!isOpen && (
        <button
          onClick={() => toggle(true)}
          className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground border-border/50 bg-background/80 fixed top-4 left-4 z-[60] rounded-md border p-2 shadow-sm backdrop-blur-sm transition-colors"
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

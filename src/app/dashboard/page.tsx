import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, Clock, Image as ImageIcon } from 'lucide-react'
import { createWorkspace, deleteWorkspace } from './actions'
import { EnVisionMark } from '@/components/EnVisionMark'
import { AuthMenu } from '@/components/AuthMenu'
import { BackgroundMath } from '@/components/BackgroundMath'

// Minimal format date helper
function formatDate(dateString: string) {
  const d = new Date(dateString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching workspaces:', error)
  }

  return (
    <div className="bg-background text-foreground relative min-h-screen overflow-hidden">
      {/* Editorial background texture */}
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply dark:mix-blend-screen">
        <BackgroundMath />
      </div>

      {/* Top Nav */}
      <header className="border-border/50 bg-background/80 relative z-10 flex items-center justify-between border-b px-6 py-4 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
          <EnVisionMark className="text-primary-500 h-8 w-8" />
          <span className="text-foreground/90 font-serif text-xl font-medium tracking-tight">
            EnVision
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <AuthMenu />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="mb-2 font-serif text-4xl font-light tracking-tight">Your Workspaces</h1>
            <p className="text-foreground/60 max-w-xl">
              Pick up where you left off or start a new reasoning session.
            </p>
          </div>
          <form action={createWorkspace}>
            <button
              type="submit"
              className="group bg-primary-500 hover:bg-primary-600 flex items-center gap-2 rounded-full px-6 py-3 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              <span>New Workspace</span>
            </button>
          </form>
        </div>

        {workspaces && workspaces.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="group envision-card relative flex h-64 flex-col overflow-hidden"
              >
                <Link href={`/workspace/${workspace.id}`} className="absolute inset-0 z-10" />

                {/* Card Header */}
                <div className="flex grow flex-col p-6">
                  <h3 className="group-hover:text-primary-500 mb-2 line-clamp-1 font-serif text-xl transition-colors">
                    {workspace.title}
                  </h3>

                  <div className="text-foreground/50 mt-auto flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3" />
                    <span>Updated {formatDate(workspace.updated_at)}</span>
                  </div>
                </div>

                {/* Card Actions (Delete) */}
                <div className="absolute top-4 right-4 z-20 opacity-0 transition-opacity group-hover:opacity-100">
                  <form
                    action={async () => {
                      'use server'
                      await deleteWorkspace(workspace.id)
                    }}
                  >
                    <button
                      type="submit"
                      className="bg-background/80 text-foreground/50 rounded-full p-2 backdrop-blur transition-colors hover:bg-red-500/10 hover:text-red-500"
                      aria-label="Delete workspace"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-border/50 bg-foreground/[0.02] flex flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-24 text-center">
            <div className="bg-primary-500/10 text-primary-500 mb-6 flex h-16 w-16 items-center justify-center rounded-full">
              <ImageIcon className="h-8 w-8" />
            </div>
            <h2 className="mb-2 font-serif text-2xl">No workspaces yet</h2>
            <p className="text-foreground/60 mb-8 max-w-md">
              Create a new workspace to start sketching, uploading PDFs, and chatting with your
              tutor.
            </p>
            <form action={createWorkspace}>
              <button
                type="submit"
                className="bg-card border-border text-foreground hover:bg-foreground/[0.02] hover:border-primary-300 flex items-center gap-2 rounded-full border px-6 py-3 shadow-sm transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Create your first workspace</span>
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

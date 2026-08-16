import { createClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'
import { createWorkspace } from './actions'
import { EnVisionMark } from '@/components/EnVisionMark'
import { BackgroundMath } from '@/components/BackgroundMath'

export default async function DashboardPage() {
  // We can still call getUser to ensure cookies/auth state is refreshed,
  // but we don't need to fetch workspaces because the Sidebar handles that.
  const supabase = await createClient()
  await supabase.auth.getUser()

  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* Editorial background texture */}
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply dark:mix-blend-screen">
        <BackgroundMath />
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-8 flex items-center justify-center">
          <EnVisionMark className="text-primary-500 h-16 w-16" />
        </div>

        <h1 className="mb-4 font-serif text-4xl font-light tracking-tight md:text-5xl">
          What would you like to explore?
        </h1>

        <p className="text-foreground/60 mb-10 max-w-lg text-lg">
          Start a new reasoning session to map out derivations, visualize concepts, or get AI
          tutoring.
        </p>

        <form action={createWorkspace}>
          <button
            type="submit"
            className="group bg-primary-500 hover:bg-primary-600 shadow-primary-500/20 flex items-center gap-2 rounded-full px-8 py-4 text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
          >
            <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
            <span className="font-medium">New Session</span>
          </button>
        </form>
      </main>
    </div>
  )
}

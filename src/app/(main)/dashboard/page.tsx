import { createClient } from '@/lib/supabase/server'
import { NewSessionForm } from './NewSessionForm'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <main className="animate-fade-in-up relative z-10 flex w-full max-w-2xl flex-col items-center justify-center p-6 text-center">
        <h1 className="text-foreground/90 mb-8 font-serif text-3xl font-light tracking-tight md:text-4xl">
          How can I help you today?
        </h1>
        <div className="w-full">
          <NewSessionForm isAuthenticated={!!user} />
        </div>
      </main>
    </div>
  )
}

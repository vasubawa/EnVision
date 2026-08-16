import { createClient } from '@/lib/supabase/server'
import SidebarClient from './SidebarClient'

export async function Sidebar({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let workspaces: Array<{ id: string; title: string; updated_at: string }> = []

  if (user) {
    const { data } = await supabase
      .from('workspaces')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
    if (data) {
      workspaces = data
    }
  }

  return (
    <SidebarClient workspaces={workspaces} _isAuthenticated={!!user}>
      {children}
    </SidebarClient>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

export function AuthMenu() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  if (loading) return <div className="bg-foreground/10 h-5 w-20 animate-pulse rounded" />

  return (
    <div className="flex items-center gap-4 font-sans text-sm">
      {user && !user.is_anonymous ? (
        <>
          <span className="text-foreground/80 hidden sm:inline">{user.email}</span>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-foreground/60 hover:text-foreground font-medium transition-colors"
            >
              Sign Out
            </button>
          </form>
        </>
      ) : (
        <Link
          href="/login"
          className="bg-foreground text-background hover:bg-foreground/90 rounded-xl px-4 py-1.5 font-medium transition-colors"
        >
          Sign In
        </Link>
      )}
    </div>
  )
}

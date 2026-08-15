'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
      toast.success('Magic link sent to your email!')
    }
    setLoading(false)
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Sign in to EnVision</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter your email to receive a magic link
          </p>
        </div>

        {sent ? (
          <div className="bg-muted/50 border-border rounded-lg border p-6 text-center">
            <h3 className="text-lg font-medium">Check your email</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              We sent a magic link to <strong>{email}</strong>
            </p>
            <button
              className="mt-6 rounded-md border border-gray-600 bg-transparent px-4 py-2 transition-colors hover:bg-gray-800"
              onClick={() => setSent(false)}
            >
              Try another email
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                'Send Magic Link'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

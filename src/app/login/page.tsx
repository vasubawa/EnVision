'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useCaptcha } from '@/components/CaptchaModal'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const { requireCaptcha } = useCaptcha()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    let token = ''
    try {
      token = await requireCaptcha()
    } catch (_err) {
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        captchaToken: token,
      },
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Check your email for the login link.')
    }
    setLoading(false)
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Sign in to EnVision</h1>
          <p className="text-foreground/60 mt-2 text-sm">
            Enter your email to receive a magic login link
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-border bg-card text-foreground focus:ring-primary-500 w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="bg-primary-500 hover:bg-primary-600 flex w-full items-center justify-center rounded-md px-4 py-2 text-white transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </>
            ) : (
              'Send Magic Link'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

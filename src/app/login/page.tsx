'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useCaptcha } from '@/components/CaptchaModal'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [showOtp, setShowOtp] = useState(false)
  const [otp, setOtp] = useState('')
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
      toast.success('Check your email for the login link or code.')
      setShowOtp(true)
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Logged in successfully!')
      window.location.href = '/workspaces'
    }
    setLoading(false)
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {showOtp ? 'Enter Login Code' : 'Sign in to EnVision'}
          </h1>
          <p className="text-foreground/60 mt-2 text-sm">
            {showOtp 
              ? `Enter the 6-digit code sent to ${email}` 
              : 'Enter your email to receive a magic login link or code'}
          </p>
        </div>

        {showOtp ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp-input" className="sr-only">
                Login Code
              </label>
              <input
                id="otp-input"
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="border-border bg-card text-foreground focus:ring-primary-500 w-full rounded-md border px-3 py-2 text-center text-lg tracking-widest focus:ring-2 focus:outline-none"
                disabled={loading}
                autoFocus
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
                  Verifying
                </>
              ) : (
                'Verify Code'
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowOtp(false)}
              className="text-foreground/60 hover:text-foreground mt-2 w-full text-center text-sm transition-colors"
              disabled={loading}
            >
              Back to email
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label htmlFor="email-input" className="sr-only">
                Email
              </label>
              <input
                id="email-input"
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
        )}
      </div>
    </div>
  )
}

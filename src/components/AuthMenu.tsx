'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { useCaptcha } from '@/components/CaptchaModal'

export function AuthMenu() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [showOtp, setShowOtp] = useState(false)
  const [otp, setOtp] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const { requireCaptcha } = useCaptcha()

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)

    try {
      let token = ''
      try {
        token = await requireCaptcha()
      } catch (_err) {
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
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Logged in successfully!')
        setIsModalOpen(false)
        setShowOtp(false)
        setOtp('')
      }
    } finally {
      setAuthLoading(false)
    }
  }

  if (loading) return <div className="bg-foreground/10 h-5 w-20 animate-pulse rounded" />

  return (
    <>
      <div className="flex items-center gap-4 font-sans text-sm">
        {user && !user.is_anonymous ? (
          <>
            <span className="text-foreground/80 hidden sm:inline">{user.email}</span>
            <Link
              href="/workspaces"
              className="text-foreground hover:bg-foreground/5 rounded-xl px-4 py-1.5 font-medium transition-colors"
            >
              My Workspaces
            </Link>
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
          <button
            onClick={() => {
              previousFocusRef.current = document.activeElement as HTMLElement
              setIsModalOpen(true)
              setTimeout(() => emailInputRef.current?.focus(), 0)
            }}
            className="bg-foreground text-background hover:bg-foreground/90 rounded-xl px-4 py-1.5 font-medium transition-colors"
          >
            {user?.is_anonymous ? 'Sign in to save' : 'Sign In'}
          </button>
        )}
      </div>

      {isModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="bg-background/80 fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-modal-title"
              className="bg-card border-border/50 relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
            >
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  previousFocusRef.current?.focus()
                }}
                className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground absolute top-4 right-4 rounded-full p-1 transition-colors"
                aria-label="Close authentication dialog"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-6 text-center">
                <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight">
                  {showOtp ? 'Enter Login Code' : 'Sign in to EnVision'}
                </h2>
                <p className="text-foreground/60 mt-1 text-sm">
                  {showOtp 
                    ? `Enter the 6-digit code sent to ${email}` 
                    : 'Enter your email to receive a magic login link or code'}
                </p>
              </div>

              {showOtp ? (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label htmlFor="auth-otp" className="sr-only">
                      Login Code
                    </label>
                    <input
                      id="auth-otp"
                      type="text"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      className="border-border bg-card text-foreground focus:ring-primary-500 w-full rounded-md border px-3 py-2 text-center text-lg tracking-widest focus:ring-2 focus:outline-none"
                      disabled={authLoading}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-primary-500 hover:bg-primary-600 flex w-full items-center justify-center rounded-md px-4 py-2 text-white transition-colors disabled:opacity-50"
                    disabled={authLoading}
                  >
                    {authLoading ? (
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
                    disabled={authLoading}
                  >
                    Back to email
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <label htmlFor="auth-email" className="sr-only">
                      Email
                    </label>
                    <input
                      id="auth-email"
                      ref={emailInputRef}
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="border-border bg-card text-foreground focus:ring-primary-500 w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                      disabled={authLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-primary-500 hover:bg-primary-600 flex w-full items-center justify-center rounded-md px-4 py-2 text-white transition-colors disabled:opacity-50"
                    disabled={authLoading}
                  >
                    {authLoading ? (
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
          </div>,
          document.body,
        )}
    </>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useCaptcha } from '@/components/CaptchaModal'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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

    try {
      let authError = null

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken: token,
          },
        })
        authError = error
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            captchaToken: token,
          },
        })
        authError = error
      }

      if (authError) {
        toast.error(authError.message)
      } else {
        toast.success(isSignUp ? 'Account created successfully!' : 'Signed in successfully!')
        if (!isSignUp) {
          router.push('/workspaces')
        }
      }
    } catch (_err) {
      toast.error('An unexpected error occurred during authentication')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {isSignUp ? 'Create an account' : 'Sign in to EnVision'}
          </h1>
          <p className="text-foreground/60 mt-2 text-sm">
            {isSignUp
              ? 'Enter your details to sign up'
              : 'Enter your email and password to sign in'}
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
          <div>
            <label
              htmlFor="auth-password"
              className="text-foreground/80 mb-1 block text-sm font-medium"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
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
            ) : isSignUp ? (
              'Sign Up'
            ) : (
              'Sign In'
            )}
          </button>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary-500 transition-colors hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

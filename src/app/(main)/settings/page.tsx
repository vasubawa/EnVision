'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [newPassword, setNewPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user?.email) {
        setNewEmail(user.email)
      }
      setLoadingUser(false)
    })
  }, [supabase])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdatingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Password updated successfully!')
        setNewPassword('')
      }
    } catch (_err) {
      toast.error('An unexpected error occurred while updating the password')
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newEmail === user?.email) {
      toast.info('This is already your email address.')
      return
    }

    setUpdatingEmail(true)

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Check your old and new email addresses for confirmation links.')
      }
    } catch (_err) {
      toast.error('An unexpected error occurred while updating the email')
    } finally {
      setUpdatingEmail(false)
    }
  }

  if (loadingUser) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-primary-500 h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user || user.is_anonymous) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-foreground/60 mt-4 max-w-md text-center">
          You are currently signed in anonymously. Please sign up or log in to a permanent account
          to change your settings.
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Account Settings</h1>

      <div className="space-y-8">
        {/* Email Settings */}
        <section className="bg-card border-border rounded-xl border p-6">
          <h2 className="mb-4 text-xl font-semibold">Email Address</h2>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-foreground/80 mb-1 block text-sm font-medium">
                New Email
              </label>
              <input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="border-border bg-background text-foreground focus:ring-primary-500 w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                disabled={updatingEmail}
              />
            </div>
            <button
              type="submit"
              className="bg-primary-500 hover:bg-primary-600 flex items-center justify-center rounded-md px-4 py-2 text-white transition-colors disabled:opacity-50"
              disabled={updatingEmail || newEmail === user.email}
            >
              {updatingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Email'
              )}
            </button>
          </form>
        </section>

        {/* Password Settings */}
        <section className="bg-card border-border rounded-xl border p-6">
          <h2 className="mb-4 text-xl font-semibold">Change Password</h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="text-foreground/80 mb-1 block text-sm font-medium"
              >
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="border-border bg-background text-foreground focus:ring-primary-500 w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                disabled={updatingPassword}
              />
            </div>
            <button
              type="submit"
              className="bg-primary-500 hover:bg-primary-600 flex items-center justify-center rounded-md px-4 py-2 text-white transition-colors disabled:opacity-50"
              disabled={updatingPassword || !newPassword}
            >
              {updatingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

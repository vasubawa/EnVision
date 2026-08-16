'use client'

import { Plus } from 'lucide-react'
import { createWorkspace } from './actions'
import { Turnstile } from '@marsidev/react-turnstile'
import { useState } from 'react'

export function NewSessionForm({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [captchaToken, setCaptchaToken] = useState<string>('')

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  return (
    <form action={createWorkspace} className="flex flex-col items-center">
      <input type="hidden" name="captchaToken" value={captchaToken} />
      <button
        type="submit"
        className="group bg-primary-500 hover:bg-primary-600 shadow-primary-500/20 mb-4 flex items-center gap-2 rounded-full px-8 py-4 text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
      >
        <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
        <span className="font-medium">New Session</span>
      </button>

      {!isAuthenticated && siteKey && (
        <div className="mt-2 flex justify-center">
          <Turnstile siteKey={siteKey} onSuccess={(token) => setCaptchaToken(token)} />
        </div>
      )}
    </form>
  )
}

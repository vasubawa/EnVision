'use client'

import { Plus, Loader2 } from 'lucide-react'
import { createWorkspace } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCaptcha } from '@/components/CaptchaModal'

export function NewSessionForm({ _isAuthenticated }: { _isAuthenticated?: boolean }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const { requireCaptcha } = useCaptcha()

  const handleClick = async () => {
    if (isLoading) return
    setIsLoading(true)
    try {
      // For anonymous users: create the session immediately, verification
      // happens inside the workspace via the captcha overlay.
      const captchaToken = await requireCaptcha()
      const formData = new FormData()
      if (captchaToken) formData.append('captchaToken', captchaToken)

      const id = await createWorkspace(formData)
      router.push(`/workspace/${id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create session')
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="group bg-primary-500 hover:bg-primary-600 shadow-primary-500/20 mb-4 flex items-center gap-2 rounded-full px-8 py-4 text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl active:translate-y-0 disabled:pointer-events-none disabled:opacity-70"
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
      )}
      <span className="font-medium">{isLoading ? 'Creating…' : 'New Session'}</span>
    </button>
  )
}

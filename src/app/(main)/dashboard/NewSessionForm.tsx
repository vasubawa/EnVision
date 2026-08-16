'use client'

import { Plus } from 'lucide-react'
import { createWorkspace } from './actions'
import { useCaptcha } from '@/components/CaptchaModal'

export function NewSessionForm({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { requireCaptcha } = useCaptcha()

  const handleSubmit = async (formData: FormData) => {
    if (!isAuthenticated) {
      const token = await requireCaptcha()
      formData.append('captchaToken', token)
    }
    await createWorkspace(formData)
  }

  return (
    <form action={handleSubmit} className="flex w-full flex-col items-center">
      <button
        type="submit"
        className="bg-card border-border hover:border-foreground/20 text-foreground group flex w-full max-w-2xl items-center justify-between gap-2 rounded-2xl border px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
      >
        <span className="text-foreground/50 ml-2 text-base">Start a new reasoning session...</span>
        <div className="bg-foreground text-background flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105">
          <Plus className="h-5 w-5" />
        </div>
      </button>
    </form>
  )
}

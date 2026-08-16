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
    <form action={handleSubmit} className="flex flex-col items-center">
      <button
        type="submit"
        className="group bg-primary-500 hover:bg-primary-600 shadow-primary-500/20 mb-4 flex items-center gap-2 rounded-full px-8 py-4 text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
      >
        <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
        <span className="font-medium">New Session</span>
      </button>
    </form>
  )
}

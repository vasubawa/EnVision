'use client'

import { Toaster } from 'sonner'
import { useTheme } from 'next-themes'

export function PaperToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="bottom-right"
      visibleToasts={2}
    />
  )
}

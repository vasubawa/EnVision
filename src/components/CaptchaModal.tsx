'use client'

import { Turnstile } from '@marsidev/react-turnstile'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface CaptchaContextType {
  requireCaptcha: () => Promise<string>
}

const CaptchaContext = createContext<CaptchaContextType | undefined>(undefined)

export function CaptchaProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [resolvePromise, setResolvePromise] = useState<(token: string) => void>()
  const [rejectPromise, setRejectPromise] = useState<(reason?: unknown) => void>()

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const requireCaptcha = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      if (process.env.NODE_ENV === 'development') {
        resolve('bypass')
        return
      }
      if (!siteKey) {
        // If no sitekey is configured, immediately resolve with empty string so the app doesn't break
        resolve('')
        return
      }
      setResolvePromise(() => resolve)
      setRejectPromise(() => reject)
      setIsOpen(true)
    })
  }, [siteKey])

  const handleSuccess = (token: string) => {
    setIsOpen(false)
    if (resolvePromise) {
      resolvePromise(token)
    }
  }

  const handleCancel = () => {
    setIsOpen(false)
    if (rejectPromise) {
      rejectPromise(new Error('Captcha cancelled'))
    }
  }

  return (
    <CaptchaContext.Provider value={{ requireCaptcha }}>
      {children}
      {isOpen && siteKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-md transition-all duration-300">
          <div className="bg-background border-border/50 flex flex-col items-center rounded-2xl border p-8 shadow-2xl">
            <h3 className="mb-2 text-xl font-medium tracking-tight">Security Check</h3>
            <p className="text-foreground/70 mb-8 text-center text-sm">
              Please complete the verification below
              <br />
              to continue to the application.
            </p>
            <Turnstile siteKey={siteKey} onSuccess={handleSuccess} />
            <button
              onClick={handleCancel}
              className="text-foreground/50 hover:text-foreground mt-8 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </CaptchaContext.Provider>
  )
}

export function useCaptcha() {
  const context = useContext(CaptchaContext)
  if (context === undefined) {
    throw new Error('useCaptcha must be used within a CaptchaProvider')
  }
  return context
}
